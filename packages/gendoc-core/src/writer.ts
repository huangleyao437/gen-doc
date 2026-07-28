import fs from 'node:fs/promises';
import path from 'node:path';
import type { ExtractedPage, NavNode, PipelineOptions } from './types.js';
import { sanitizeMarkdown } from './markdown-sanitizer.js';
import { rewriteLinks, normalizeUrlPath } from './link-rewriter.js';

/** Map URL → relative output path */
interface PathMapping {
  url: string;
  relativePath: string;
}

/** YAML double-quoted string escape */
function yamlEscape(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;
}

/** Build YAML frontmatter block for a page */
function buildFrontmatter(page: ExtractedPage): string {
  const lines = ['---', `title: ${yamlEscape(page.title || '')}`];
  const desc = page.frontmatter?.description;
  if (typeof desc === 'string' && desc.trim()) {
    lines.push(`description: ${yamlEscape(desc.trim())}`);
  }
  lines.push(`source_url: ${yamlEscape(page.url)}`);
  lines.push('---', '');
  return lines.join('\n');
}

export class Writer {
  /** Sanitize a string for use as a filename */
  private sanitize(name: string): string {
    return name
      .replace(/[/\\:*?"<>|]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      || 'untitled';
  }

  /** Build URL → path mappings from navTree */
  private buildPathMap(navTree: NavNode[], parentDir: string = ''): PathMapping[] {
    const result: PathMapping[] = [];
    for (const node of navTree) {
      const filename = this.sanitize(node.title || path.basename(node.path));
      const childDir = parentDir ? `${parentDir}/${filename}` : filename;
      const hasChildren = Boolean(node.children && node.children.length > 0);

      // Only register page-level mappings for nodes with actual URLs.
      // Category nodes (path === '' or '#') only contribute directories,
      // not page entries — avoids every-page-matches-empty-string bug.
      //
      // 有子节点时写成 childDir/index.md，避免同时存在「name.md + name/」同名文件与目录：
      // 该结构在 Windows / 部分 Markdown 预览器里会导致相对链接无法点击跳转。
      if (node.path && node.path !== '#') {
        const relativePath = hasChildren ? `${childDir}/index.md` : `${childDir}.md`;
        result.push({ url: node.path, relativePath });
      }

      if (hasChildren) {
        result.push(...this.buildPathMap(node.children!, childDir));
      }
    }
    return result;
  }

  private findMapping(pageUrl: string, mappings: PathMapping[]): PathMapping | undefined {
    let pathname: string;
    try {
      pathname = normalizeUrlPath(pageUrl);
    } catch {
      return undefined;
    }
    return mappings.find((m) => {
      if (!m.url) return false;
      try {
        const mPath = normalizeUrlPath(m.url);
        return (
          mPath === pathname ||
          pageUrl === m.url ||
          pageUrl.endsWith(m.url) ||
          pathname.endsWith(mPath)
        );
      } catch {
        return pageUrl.endsWith(m.url);
      }
    });
  }

  /** 在 usedPaths 中保证唯一，冲突时追加 -2、-3… */
  private uniquePath(desired: string, usedPaths: Set<string>): string {
    const normalized = desired.split(path.sep).join('/');
    if (!usedPaths.has(normalized)) {
      usedPaths.add(normalized);
      return normalized;
    }
    const ext = path.posix.extname(normalized) || '.md';
    const base = normalized.slice(0, normalized.length - ext.length);
    let counter = 2;
    let candidate = `${base}-${counter}${ext}`;
    while (usedPaths.has(candidate)) {
      counter += 1;
      candidate = `${base}-${counter}${ext}`;
    }
    usedPaths.add(candidate);
    return candidate;
  }

  /**
   * 仅为 URL 预分配输出相对路径（不依赖正文 title）。
   * 流式流水线可在抓取前构建完整 PathMap，以便单页即可改写站内链接。
   */
  assignOutputPaths(
    urls: string[],
    navTree: NavNode[],
    options: Pick<PipelineOptions, 'flat'>,
  ): Map<string, string> {
    const mappings = options.flat ? [] : this.buildPathMap(navTree);
    const usedPaths = new Set<string>();
    const pathMap = new Map<string, string>();

    for (const url of urls) {
      const relPath = this.resolvePathForUrl(url, mappings, usedPaths, Boolean(options.flat));
      try {
        pathMap.set(normalizeUrlPath(url), relPath);
      } catch {
        /* skip bad url */
      }
    }
    return pathMap;
  }

  /**
   * 根据 nav 映射或 URL 路径解析单页相对路径。
   * 优先使用 navTree 生成的 relativePath（目录+文件名），冲突时加后缀。
   */
  private resolvePathForUrl(
    pageUrl: string,
    mappings: PathMapping[],
    usedPaths: Set<string>,
    flat: boolean,
  ): string {
    const mapping = this.findMapping(pageUrl, mappings);

    if (flat) {
      let filename: string;
      if (mapping) {
        filename = path.posix.basename(mapping.relativePath, '.md');
      } else {
        try {
          filename = this.sanitize(
            new URL(pageUrl).pathname.replace(/\/$/, '').split('/').pop() || 'untitled',
          );
        } catch {
          filename = 'untitled';
        }
      }
      return this.uniquePath(`${filename}.md`, usedPaths);
    }

    if (mapping) {
      return this.uniquePath(mapping.relativePath, usedPaths);
    }

    // 未在导航中：按 URL 路径镜像
    try {
      const urlPath = new URL(pageUrl).pathname.replace(/\/$/, '');
      const parts = urlPath.split('/').filter(Boolean).map((s) => this.sanitize(s));
      if (parts.length === 0) {
        return this.uniquePath('index.md', usedPaths);
      }
      const filename = parts[parts.length - 1];
      const dir = parts.slice(0, -1).join('/');
      const candidate = dir ? `${dir}/${filename}.md` : `${filename}.md`;
      return this.uniquePath(candidate, usedPaths);
    } catch {
      return this.uniquePath('untitled.md', usedPaths);
    }
  }

  /** 单页：sanitize + 链接改写 + frontmatter + 落盘 */
  async writePage(
    page: ExtractedPage,
    relPath: string,
    pathMap: Map<string, string>,
    options: Pick<PipelineOptions, 'output'>,
  ): Promise<void> {
    let siteOrigin = 'https://localhost';
    try {
      siteOrigin = new URL(page.url).origin;
    } catch {
      /* default */
    }

    let body = sanitizeMarkdown(page.markdown);
    body = rewriteLinks(body, {
      siteOrigin,
      currentRelPath: relPath,
      pathMap,
    });
    if (!body.endsWith('\n')) body += '\n';

    const content = buildFrontmatter(page) + body;
    const absPath = path.join(options.output, ...relPath.split('/'));
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, content, 'utf-8');
  }

  /**
   * 批量写入（兼容旧 API / 单测）。
   * 内部先 assignOutputPaths 再逐页 writePage，路径规则与流式一致。
   */
  async write(pages: ExtractedPage[], navTree: NavNode[], options: PipelineOptions): Promise<number> {
    await fs.mkdir(options.output, { recursive: true });
    const pathMap = this.assignOutputPaths(
      pages.map((p) => p.url),
      navTree,
      options,
    );

    let count = 0;
    for (const page of pages) {
      let key: string;
      try {
        key = normalizeUrlPath(page.url);
      } catch {
        continue;
      }
      const relPath = pathMap.get(key);
      if (!relPath) continue;
      await this.writePage(page, relPath, pathMap, options);
      count += 1;
    }
    return count;
  }
}
