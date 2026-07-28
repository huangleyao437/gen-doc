import type { FrameworkPlugin, NavNode, PageContext, CrawlError } from './types.js';
import type { Renderer } from './renderer.js';
import pLimit from 'p-limit';

export interface NavExpandOptions {
  /** 入口页完整 URL，用于解析相对 path */
  baseUrl: string;
  concurrency: number;
  delay: number;
  /** 最多展开轮次，防止环路；默认 5 */
  maxRounds?: number;
  verbose?: boolean;
}

/**
 * 默认：收集 Docusaurus 风格折叠分类上的链接。
 * 折叠项子树通常不在 HTML 中，需请求该 href 才能拿到展开后的侧边栏。
 */
export function collectDefaultExpandUrls(page: PageContext): string[] {
  const urls = new Set<string>();
  page.$('li.menu__list-item--collapsed a.menu__link').each((_, el) => {
    const href = page.$(el).attr('href')?.trim() || '';
    if (href && href !== '#') urls.add(href);
  });
  return Array.from(urls);
}

/** 规范化 path，便于 merge / 去重 */
export function normalizeNavPath(path: string): string {
  if (!path) return '';
  try {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      path = new URL(path).pathname;
    }
  } catch {
    /* keep */
  }
  path = path.split('?')[0].split('#')[0];
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}

function nodeKey(node: NavNode): string {
  const p = normalizeNavPath(node.path);
  if (p) return `p:${p}`;
  return `t:${node.title}`;
}

/**
 * 合并两棵导航树：同 key 节点合并 children，优先保留更完整子树。
 */
export function mergeNavTrees(base: NavNode[], extra: NavNode[]): NavNode[] {
  const map = new Map<string, NavNode>();
  const order: string[] = [];

  function ensure(node: NavNode): NavNode {
    const key = nodeKey(node);
    const existing = map.get(key);
    if (!existing) {
      const copy: NavNode = {
        title: node.title,
        path: node.path,
        children: node.children ? [] : undefined,
      };
      map.set(key, copy);
      order.push(key);
      if (node.children) {
        copy.children = mergeNavTrees([], node.children);
      }
      return copy;
    }
    // 补全 path / title
    if (!existing.path && node.path) existing.path = node.path;
    if (node.title && (!existing.title || existing.title.length < node.title.length)) {
      existing.title = node.title;
    }
    if (node.children && node.children.length > 0) {
      existing.children = mergeNavTrees(existing.children ?? [], node.children);
    }
    return existing;
  }

  for (const n of base) ensure(n);
  for (const n of extra) ensure(n);

  return order.map((k) => map.get(k)!);
}

function resolveToAbsolute(href: string, baseUrl: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  // 相对 href 相对 baseUrl（入口页）解析，勿仅用 origin（会丢 /en/stable/ 等前缀）
  return new URL(href, baseUrl).href;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 多轮抓取折叠分类入口页，合并侧边栏，直到没有新的折叠 URL 或达到 maxRounds。
 */
export async function expandNavTree(
  initialTree: NavNode[],
  entryPage: PageContext,
  plugin: FrameworkPlugin,
  renderer: Renderer,
  options: NavExpandOptions,
): Promise<{ tree: NavNode[]; errors: CrawlError[]; expandFetches: number }> {
  const maxRounds = options.maxRounds ?? 5;
  const errors: CrawlError[] = [];
  let tree = initialTree;
  let expandFetches = 0;

  const collect =
    plugin.getExpandableNavUrls != null
      ? (page: PageContext) => plugin.getExpandableNavUrls!(page)
      : async (page: PageContext) => collectDefaultExpandUrls(page);

  const visited = new Set<string>();
  // 入口页自身不必再作展开种子重复抓
  visited.add(normalizeNavPath(new URL(options.baseUrl).pathname));

  let pending = (await collect(entryPage))
    .map((u) => resolveToAbsolute(u, options.baseUrl))
    .filter((u) => {
      const key = normalizeNavPath(u);
      if (!key || visited.has(key)) return false;
      return true;
    });

  const limit = pLimit(options.concurrency);

  for (let round = 1; round <= maxRounds && pending.length > 0; round++) {
    if (options.verbose) {
      console.log(`📂 Expanding nav (round ${round}): ${pending.length} category page(s)...`);
    }

    const batch = pending.filter((u) => {
      const key = normalizeNavPath(u);
      if (!key || visited.has(key)) return false;
      visited.add(key);
      return true;
    });
    pending = [];

    type RoundHit = { partial: NavNode[]; moreAbs: string[] };
    const hits: RoundHit[] = [];

    const tasks = batch.map((url, index) =>
      limit(async () => {
        if (index > 0 && options.delay > 0) {
          await sleep(options.delay);
        }

        try {
          const page = await renderer.fetch(url);
          const partial = await plugin.getNavTree(page);
          const more = await collect(page);
          const moreAbs = more.map((href) => resolveToAbsolute(href, options.baseUrl));
          hits.push({ partial, moreAbs });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const statusMatch = message.match(/HTTP (\d+)/);
          errors.push({
            url,
            reason: message,
            statusCode: statusMatch ? parseInt(statusMatch[1], 10) : undefined,
          });
        }
      }),
    );

    await Promise.all(tasks);

    expandFetches += hits.length;
    for (const hit of hits) {
      tree = mergeNavTrees(tree, hit.partial);
      for (const abs of hit.moreAbs) {
        const k = normalizeNavPath(abs);
        if (k && !visited.has(k)) pending.push(abs);
      }
    }

    // 去重 pending
    const uniq = new Map<string, string>();
    for (const u of pending) {
      uniq.set(normalizeNavPath(u), u);
    }
    pending = Array.from(uniq.values()).filter((u) => !visited.has(normalizeNavPath(u)));
  }

  if (options.verbose) {
    console.log(`   Nav expand done: ${expandFetches} fetch(es), ${errors.length} error(s)`);
  }

  return { tree, errors, expandFetches };
}
