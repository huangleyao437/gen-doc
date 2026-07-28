#!/usr/bin/env node
import { Command } from 'commander';
import { Pipeline, PluginRegistry } from 'gendoc-core';
import { docusaurusPlugin } from 'gendoc-plugin-docusaurus';
import { vitepressPlugin } from 'gendoc-plugin-vitepress';
import type { PipelineOptions } from 'gendoc-core';

const program = new Command();

program
  .name('gendoc')
  .description('Convert online documentation sites to local Markdown files')
  .argument('<url>', 'Entry URL of the documentation site')
  .option('-o, --output <dir>', 'Output directory', './gendoc-output')
  .option('-f, --framework <name>', 'Force a specific framework (skip detection)')
  .option('-c, --concurrency <n>', 'Number of concurrent requests', '3')
  .option('--delay <ms>', 'Delay between requests in ms', '200')
  .option('--timeout <ms>', 'Request timeout in ms', '15000')
  .option('--max-pages <n>', 'Maximum number of pages to crawl')
  .option('--depth <n>', 'Maximum crawl depth')
  .option('--include <glob>', 'Path glob to include')
  .option('--exclude <glob>', 'Path glob to exclude')
  .option('--flat', 'Flat output (no directory hierarchy)')
  .option('--detect-only', 'Only detect framework, do not crawl')
  .option('-v, --verbose', 'Verbose output')
  .action(async (url: string, options: Record<string, string | boolean>) => {
    // Register plugins
    const registry = new PluginRegistry();
    registry.register(docusaurusPlugin);
    registry.register(vitepressPlugin);

    if (options.detectOnly) {
      const { Renderer, Detector } = await import('gendoc-core');
      const renderer = new Renderer({ timeout: parseInt(String(options.timeout)) });
      const detector = new Detector(registry);

      console.log(`🔍 Fetching ${url}...`);
      const page = await renderer.fetch(url);
      const result = await detector.detect(page);

      if (result) {
        console.log(`✅ Detected: ${result.framework} (confidence: ${result.confidence}${result.version ? `, version: ${result.version}` : ''})`);
      } else {
        console.log('❌ Could not identify the documentation framework.');
        console.log(`   Registered plugins: ${registry.listAll().map(p => p.name).join(', ')}`);
        console.log('   Try forcing with --framework <name>');
      }
      return;
    }

    const pipelineOptions: PipelineOptions = {
      output: String(options.output),
      framework: options.framework ? String(options.framework) : undefined,
      concurrency: parseInt(String(options.concurrency)),
      delay: parseInt(String(options.delay)),
      timeout: parseInt(String(options.timeout)),
      maxPages: options.maxPages ? parseInt(String(options.maxPages)) : Infinity,
      depth: options.depth ? parseInt(String(options.depth)) : Infinity,
      include: options.include ? String(options.include) : undefined,
      exclude: options.exclude ? String(options.exclude) : undefined,
      flat: Boolean(options.flat),
      verbose: Boolean(options.verbose),
    };

    const pipeline = new Pipeline(registry, pipelineOptions);

    try {
      await pipeline.run(url);
      process.exit(0);
    } catch (err) {
      console.error('Fatal error:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program.parse();
