import fs from 'node:fs/promises';
import pLimit from 'p-limit';
import { Detector } from './detector.js';
import { Renderer } from './renderer.js';
import { Writer } from './writer.js';
import { PluginRegistry } from './plugin-registry.js';
import { expandNavTree } from './nav-expander.js';
import { filterUrlsByPath } from './path-filter.js';
import { normalizeUrlPath } from './link-rewriter.js';
import type { FrameworkPlugin, NavNode, PipelineOptions, PipelineResult, CrawlError } from './types.js';

/** Flatten NavNode tree to unique URL path list */
function flattenNavUrls(nodes: NavNode[]): string[] {
  const urls = new Set<string>();
  function walk(items: NavNode[]) {
    for (const node of items) {
      if (node.path) urls.add(node.path);
      if (node.children) walk(node.children);
    }
  }
  walk(nodes);
  return Array.from(urls);
}

/** Resolve relative / absolute paths to full URLs against entry page URL */
function resolveUrls(paths: string[], baseUrl: string): string[] {
  return paths.map((p) => {
    if (p.startsWith('http://') || p.startsWith('https://')) return p;
    // 相对 path 必须相对入口页目录解析（Sphinx toctree 常见 start/foo.html）
    // 以 / 开头的站点绝对 path 由 new URL 按 origin 处理
    return new URL(p, baseUrl).href;
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class Pipeline {
  private detector: Detector;
  private renderer: Renderer;
  private writer: Writer;

  constructor(private registry: PluginRegistry, private options: PipelineOptions) {
    this.detector = new Detector(registry);
    this.renderer = new Renderer({ timeout: options.timeout });
    this.writer = new Writer();
  }

  async run(entryUrl: string): Promise<PipelineResult> {
    const startTime = Date.now();
    const allErrors: CrawlError[] = [];
    let framework = 'unknown';

    // 1. Fetch entry page
    if (this.options.verbose) console.log(`⬇  Fetching entry page: ${entryUrl}`);
    const entryPage = await this.renderer.fetch(entryUrl);

    // 2. Detect framework (or use forced)
    let plugin: FrameworkPlugin | undefined;

    if (this.options.framework) {
      plugin = this.registry.findByName(this.options.framework);
      if (!plugin) throw new Error(`Unknown framework: ${this.options.framework}`);
      framework = plugin.name;
      if (this.options.verbose) console.log(`🔍 Using forced framework: ${framework}`);
    } else {
      const detection = await this.detector.detect(entryPage);
      if (detection) {
        plugin = this.registry.findByName(detection.framework);
        framework = detection.framework;
        if (this.options.verbose) {
          console.log(`🔍 Detected framework: ${framework} (confidence: ${detection.confidence})`);
        }
      }
    }

    // Fallback: use first registered plugin
    if (!plugin) {
      const plugins = this.registry.listAll();
      if (plugins.length > 0) {
        plugin = plugins[0];
        framework = `[unidentified, using ${plugin.name}]`;
        if (this.options.verbose) console.log(`⚠  Framework detection failed, falling back to: ${plugin.name}`);
      } else {
        throw new Error('No plugins registered and framework detection failed');
      }
    }

    // 3. Parse nav tree, then expand collapsed categories
    if (this.options.verbose) console.log('📂 Parsing navigation...');
    let navTree = await plugin.getNavTree(entryPage);
    if (this.options.verbose) {
      console.log(`   ${flattenNavUrls(navTree).length} pages in entry nav (before expand)`);
    }

    const expanded = await expandNavTree(navTree, entryPage, plugin, this.renderer, {
      baseUrl: entryUrl,
      concurrency: this.options.concurrency,
      delay: this.options.delay,
      verbose: this.options.verbose,
    });
    navTree = expanded.tree;
    allErrors.push(...expanded.errors);

    const navUrls = flattenNavUrls(navTree);
    if (this.options.verbose) {
      console.log(`   ${navUrls.length} pages in navigation after expand`);
    }

    // 4. Resolve URLs and apply limits
    let allUrls = resolveUrls(navUrls, entryUrl);

    // Add entry URL if not in list (pathname-aware)
    const entryKey = normalizeUrlPath(entryUrl);
    if (!allUrls.some((u) => normalizeUrlPath(u) === entryKey)) {
      allUrls.unshift(entryUrl);
    }

    // De-dupe by pathname（同一 path 不同 trailing slash 只抓一次）
    {
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const u of allUrls) {
        try {
          const k = normalizeUrlPath(u);
          if (seen.has(k)) continue;
          seen.add(k);
          unique.push(u);
        } catch {
          unique.push(u);
        }
      }
      allUrls = unique;
    }

    // include / exclude（pathname glob；在 dedupe 之后、maxPages 之前）
    if (this.options.include || this.options.exclude) {
      const before = allUrls.length;
      allUrls = filterUrlsByPath(allUrls, {
        include: this.options.include,
        exclude: this.options.exclude,
      });
      if (this.options.verbose) {
        console.log(
          `   Filtered URLs by include/exclude: ${before} → ${allUrls.length}`,
        );
      }
    }

    if (this.options.maxPages < Infinity) {
      allUrls = allUrls.slice(0, this.options.maxPages);
    }

    // 5. 预构建 PathMap（仅 URL + 导航，不持有 HTML）
    await fs.mkdir(this.options.output, { recursive: true });
    const pathMap = this.writer.assignOutputPaths(allUrls, navTree, this.options);

    // 6. 流式：并发 抓取 → 提取 → 写入，页面 DOM 用完即释放
    if (this.options.verbose) {
      console.log(
        `⬇  Streaming ${allUrls.length} pages (concurrency: ${this.options.concurrency}, fetch→extract→write)...`,
      );
    }

    const limit = pLimit(this.options.concurrency);
    let successful = 0;
    let completed = 0;
    const total = allUrls.length;

    // 简单串行节流：任务开始前按 delay 错开，避免所有任务同时 sleep(0)
    let nextSlot = Date.now();
    const acquireSlot = async (): Promise<void> => {
      if (this.options.delay <= 0) return;
      const now = Date.now();
      const startAt = Math.max(now, nextSlot);
      nextSlot = startAt + this.options.delay;
      const wait = startAt - now;
      if (wait > 0) await sleep(wait);
    };

    const tasks = allUrls.map((url) =>
      limit(async () => {
        await acquireSlot();
        try {
          const page = await this.renderer.fetch(url);
          let extracted;
          try {
            extracted = await plugin.extractContent(page);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            allErrors.push({ url, reason: `extract failed: ${message}` });
            return;
          }
          // 尽快断开对大对象的引用：html + cheerio 仅存在于本作用域
          extracted.url = page.url;

          let key: string;
          try {
            key = normalizeUrlPath(page.url);
          } catch {
            key = url;
          }
          const relPath = pathMap.get(key);
          if (!relPath) {
            allErrors.push({ url, reason: 'no output path assigned' });
            return;
          }

          await this.writer.writePage(extracted, relPath, pathMap, this.options);
          successful += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const statusMatch = message.match(/HTTP (\d+)/);
          allErrors.push({
            url,
            reason: message,
            statusCode: statusMatch ? parseInt(statusMatch[1], 10) : undefined,
          });
        } finally {
          completed += 1;
          if (this.options.verbose && (completed % 25 === 0 || completed === total)) {
            console.log(`   … ${completed}/${total} done (${successful} ok, ${allErrors.length} err)`);
          }
        }
      }),
    );

    await Promise.all(tasks);

    // 7. Write error log
    if (allErrors.length > 0) {
      const logPath = `${this.options.output}/gendoc-errors.log`;
      const logContent = allErrors
        .map((e) => `[${e.statusCode ?? 'ERR'}] ${e.url}: ${e.reason}`)
        .join('\n');
      await fs.writeFile(logPath, logContent, 'utf-8');
    }

    const duration = Math.round((Date.now() - startTime) / 100) / 10;

    console.log(`\n📊 Summary:`);
    console.log(`  Total pages:     ${allUrls.length}`);
    console.log(`  Successful:      ${successful}`);
    console.log(`  Failed:          ${allErrors.length}`);
    console.log(`  Output:          ${this.options.output}/`);
    console.log(`  Duration:        ${duration}s`);
    console.log(`  Framework:       ${framework}`);

    return {
      totalPages: allUrls.length,
      successful,
      failed: allErrors.length,
      errors: allErrors,
      output: this.options.output,
      duration,
      framework,
    };
  }
}
