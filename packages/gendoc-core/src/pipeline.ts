import fs from 'node:fs/promises';
import { Detector } from './detector.js';
import { Renderer } from './renderer.js';
import { Crawler } from './crawler.js';
import { Extractor } from './extractor.js';
import { Writer } from './writer.js';
import { PluginRegistry } from './plugin-registry.js';
import { expandNavTree } from './nav-expander.js';
import { filterUrlsByPath } from './path-filter.js';
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

/** Resolve relative paths to full URLs */
function resolveUrls(paths: string[], baseUrl: string): string[] {
  const base = new URL(baseUrl);
  return paths.map(p => {
    if (p.startsWith('http://') || p.startsWith('https://')) return p;
    return new URL(p, base.origin).href;
  });
}

export class Pipeline {
  private detector: Detector;
  private renderer: Renderer;
  private crawler: Crawler;
  private extractor: Extractor;
  private writer: Writer;

  constructor(private registry: PluginRegistry, private options: PipelineOptions) {
    this.detector = new Detector(registry);
    this.renderer = new Renderer({ timeout: options.timeout });
    this.crawler = new Crawler(this.renderer);
    this.extractor = new Extractor();
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
        if (this.options.verbose) console.log(`🔍 Detected framework: ${framework} (confidence: ${detection.confidence})`);
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

    // 3. Parse nav tree, then expand collapsed categories (方案 A)
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

    // Add entry URL if not in navTree
    if (!allUrls.includes(entryUrl)) {
      allUrls.unshift(entryUrl);
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

    // Apply page limit
    if (this.options.maxPages < Infinity) {
      allUrls = allUrls.slice(0, this.options.maxPages);
    }

    // 5. Crawl pages
    if (this.options.verbose) {
      console.log(`⬇  Crawling ${allUrls.length} pages (concurrency: ${this.options.concurrency})...`);
    }

    const { pages, errors } = await this.crawler.crawl(allUrls, {
      concurrency: this.options.concurrency,
      delay: this.options.delay,
    });
    allErrors.push(...errors);

    // 6. Extract content
    if (this.options.verbose) console.log('📝 Extracting content...');
    const extracted = await this.extractor.extractAll(pages, plugin);

    // 7. Write output
    if (this.options.verbose) console.log(`📝 Writing markdown to ${this.options.output}...`);
    const count = await this.writer.write(extracted, navTree, this.options);

    // 8. Write error log
    if (allErrors.length > 0) {
      const logPath = `${this.options.output}/gendoc-errors.log`;
      const logContent = allErrors.map(e => `[${e.statusCode ?? 'ERR'}] ${e.url}: ${e.reason}`).join('\n');
      await fs.writeFile(logPath, logContent, 'utf-8');
    }

    const duration = Math.round((Date.now() - startTime) / 100) / 10;

    console.log(`\n📊 Summary:`);
    console.log(`  Total pages:     ${allUrls.length}`);
    console.log(`  Successful:      ${count}`);
    console.log(`  Failed:          ${allErrors.length}`);
    console.log(`  Output:          ${this.options.output}/`);
    console.log(`  Duration:        ${duration}s`);
    console.log(`  Framework:       ${framework}`);

    return {
      totalPages: allUrls.length,
      successful: count,
      failed: allErrors.length,
      errors: allErrors,
      output: this.options.output,
      duration,
      framework,
    };
  }
}
