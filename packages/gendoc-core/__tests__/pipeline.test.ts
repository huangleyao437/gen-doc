import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Pipeline } from '../src/pipeline.js';
import { PluginRegistry } from '../src/plugin-registry.js';
import type { FrameworkPlugin, PageContext, DetectionResult, NavNode, ExtractedPage, PipelineOptions } from '../src/types.js';
import type { AddressInfo } from 'node:net';

/** A minimal Docusaurus-like plugin for testing */
const testPlugin: FrameworkPlugin = {
  name: 'docusaurus',
  version: '1.0.0',
  async detect(page: PageContext): Promise<DetectionResult | null> {
    const gen = page.$('meta[name="generator"]').attr('content') || '';
    if (gen.includes('Docusaurus')) {
      return { framework: 'docusaurus', confidence: 0.95, version: '3.5.0' };
    }
    return null;
  },
  async getNavTree(page: PageContext): Promise<NavNode[]> {
    const nodes: NavNode[] = [];
    page.$('nav.menu ul.menu__list > li.menu__list-item').each((_, li) => {
      const $li = page.$(li);
      const $link = $li.children('a.menu__link').first();
      const title = $link.text().trim();
      const href = $link.attr('href') || '';
      nodes.push({ title, path: href });
    });
    return nodes;
  },
  async extractContent(page: PageContext): Promise<ExtractedPage> {
    const $ = page.$;
    const $article = $('article').first();
    const title = $article.find('h1').first().text().trim();
    const html = $article.html() || '';
    const TurndownService = (await import('turndown')).default;
    const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
    const markdown = turndown.turndown(html);
    return { url: page.url, title, markdown };
  },
};

const defaultOptions: PipelineOptions = {
  output: '',
  concurrency: 2,
  delay: 0,
  timeout: 5000,
  maxPages: Infinity,
  depth: Infinity,
  flat: false,
  verbose: false,
};

describe('Pipeline Integration', () => {
  let server: http.Server;
  let baseUrl: string;
  let tmpDir: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const page = (title: string, body: string) => `<!DOCTYPE html>
<html><head><meta name="generator" content="Docusaurus v3.5.0"><title>${title} | Docs</title></head>
<body>
<nav class="menu"><ul class="menu__list">
<li class="menu__list-item"><a class="menu__link" href="/docs/intro">Introduction</a></li>
<li class="menu__list-item"><a class="menu__link" href="/docs/install">Installation</a></li>
<li class="menu__list-item"><a class="menu__link" href="/docs/api">API</a></li>
</ul></nav>
<main><article>${body}</article></main>
</body></html>`;

      if (req.url === '/docs/intro') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(page('Introduction', '<h1>Introduction</h1><p>Welcome to the docs.</p>'));
      } else if (req.url === '/docs/install') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(page('Installation', '<h1>Installation</h1><p>Run <code>npm i</code> to install.</p>'));
      } else if (req.url === '/docs/api') {
        res.writeHead(500);
        res.end();
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>(resolve => server.listen(0, resolve));
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
    tmpDir = path.join(os.tmpdir(), `gendoc-integration-${Date.now()}`);
  });

  afterAll(async () => {
    server.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('runs full pipeline: detect -> crawl -> extract -> write', async () => {
    const registry = new PluginRegistry();
    registry.register(testPlugin);

    const options: PipelineOptions = { ...defaultOptions, output: tmpDir };
    const pipeline = new Pipeline(registry, options);
    const result = await pipeline.run(`${baseUrl}/docs/intro`);

    expect(result.totalPages).toBe(3);
    expect(result.successful).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.framework).toBe('docusaurus');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].statusCode).toBe(500);

    // Verify written files
    const introContent = await fs.readFile(path.join(tmpDir, 'introduction.md'), 'utf-8');
    expect(introContent).toContain('# Introduction');
    expect(introContent).toContain('Welcome to the docs.');

    const installContent = await fs.readFile(path.join(tmpDir, 'installation.md'), 'utf-8');
    expect(installContent).toContain('# Installation');
    expect(installContent).toContain('`npm i`');

    // Verify error log
    const errorLog = await fs.readFile(path.join(tmpDir, 'gendoc-errors.log'), 'utf-8');
    expect(errorLog).toContain('/docs/api');
    expect(errorLog).toContain('500');
  }, 15000);
});
