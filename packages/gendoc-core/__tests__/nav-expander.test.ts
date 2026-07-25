import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import * as cheerio from 'cheerio';
import {
  mergeNavTrees,
  expandNavTree,
  collectDefaultExpandUrls,
  normalizeNavPath,
} from '../src/nav-expander.js';
import { Renderer } from '../src/renderer.js';
import type { FrameworkPlugin, PageContext, NavNode, DetectionResult, ExtractedPage } from '../src/types.js';

describe('normalizeNavPath', () => {
  it('strips origin trailing slash and hash', () => {
    expect(normalizeNavPath('https://ex.com/docs/a/?x=1#h')).toBe('/docs/a');
    expect(normalizeNavPath('/docs/a/')).toBe('/docs/a');
  });
});

describe('mergeNavTrees', () => {
  it('merges children under same path', () => {
    const a: NavNode[] = [
      {
        title: 'Guide',
        path: '/docs/guide',
        children: [{ title: 'A', path: '/docs/guide/a' }],
      },
    ];
    const b: NavNode[] = [
      {
        title: 'Guide',
        path: '/docs/guide',
        children: [{ title: 'B', path: '/docs/guide/b' }],
      },
    ];
    const m = mergeNavTrees(a, b);
    expect(m).toHaveLength(1);
    expect(m[0].children?.map((c) => c.path).sort()).toEqual([
      '/docs/guide/a',
      '/docs/guide/b',
    ]);
  });

  it('keeps category nodes with empty path by title', () => {
    const a: NavNode[] = [{ title: 'Use Doris', path: '', children: [{ title: 'X', path: '/x' }] }];
    const b: NavNode[] = [{ title: 'Use Doris', path: '', children: [{ title: 'Y', path: '/y' }] }];
    const m = mergeNavTrees(a, b);
    expect(m).toHaveLength(1);
    expect(m[0].children).toHaveLength(2);
  });
});

describe('collectDefaultExpandUrls', () => {
  it('collects collapsed menu links only', () => {
    const html = `
      <nav class="menu"><ul class="menu__list">
        <li class="menu__list-item"><a class="menu__link" href="/open">Open</a>
          <ul class="menu__list"><li class="menu__list-item"><a class="menu__link" href="/open/child">C</a></li></ul>
        </li>
        <li class="menu__list-item menu__list-item--collapsed">
          <a class="menu__link" href="/collapsed">Collapsed</a>
        </li>
      </ul></nav>`;
    const $ = cheerio.load(html);
    const page: PageContext = { url: 'https://ex.com/open', html, $ };
    expect(collectDefaultExpandUrls(page)).toEqual(['/collapsed']);
  });
});

describe('expandNavTree', () => {
  let server: http.Server;
  let baseUrl: string;

  const plugin: FrameworkPlugin = {
    name: 'docusaurus',
    version: '1.0.0',
    async detect(): Promise<DetectionResult | null> {
      return { framework: 'docusaurus', confidence: 1 };
    },
    async getNavTree(page: PageContext): Promise<NavNode[]> {
      // 简化：顶层 li
      const nodes: NavNode[] = [];
      page.$('nav.menu > ul.menu__list > li.menu__list-item').each((_, li) => {
        const $li = page.$(li);
        const $link = $li.find('a.menu__link').first();
        const title = $link.text().trim();
        const href = $link.attr('href') || '';
        const children: NavNode[] = [];
        $li.children('ul.menu__list').children('li.menu__list-item').each((__, cli) => {
          const $c = page.$(cli).find('a.menu__link').first();
          children.push({ title: $c.text().trim(), path: $c.attr('href') || '' });
        });
        nodes.push({
          title,
          path: href,
          children: children.length ? children : undefined,
        });
      });
      return nodes;
    },
    async extractContent(page: PageContext): Promise<ExtractedPage> {
      return { url: page.url, title: '', markdown: '' };
    },
  };

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (req.url === '/docs/intro') {
        // 入口：快速开始已展开；表设计折叠
        res.end(`<!DOCTYPE html><html><body>
<nav class="menu"><ul class="menu__list">
  <li class="menu__list-item">
    <a class="menu__link" href="/docs/intro">快速开始</a>
    <ul class="menu__list">
      <li class="menu__list-item"><a class="menu__link" href="/docs/intro">Intro</a></li>
      <li class="menu__list-item"><a class="menu__link" href="/docs/quick">Quick</a></li>
    </ul>
  </li>
  <li class="menu__list-item menu__list-item--collapsed">
    <a class="menu__link" href="/docs/table">表设计</a>
  </li>
</ul></nav>
<main><article><h1>Intro</h1></article></main>
</body></html>`);
      } else if (req.url === '/docs/table') {
        // 分类页：表设计展开，含子页；快速开始折叠
        res.end(`<!DOCTYPE html><html><body>
<nav class="menu"><ul class="menu__list">
  <li class="menu__list-item menu__list-item--collapsed">
    <a class="menu__link" href="/docs/intro">快速开始</a>
  </li>
  <li class="menu__list-item">
    <a class="menu__link" href="/docs/table">表设计</a>
    <ul class="menu__list">
      <li class="menu__list-item"><a class="menu__link" href="/docs/table">Overview</a></li>
      <li class="menu__list-item"><a class="menu__link" href="/docs/table/model">表模型</a></li>
      <li class="menu__list-item"><a class="menu__link" href="/docs/table/type">数据类型</a></li>
    </ul>
  </li>
</ul></nav>
<main><article><h1>Table</h1></article></main>
</body></html>`);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(() => {
    server.close();
  });

  it('fetches collapsed category pages and merges children into nav tree', async () => {
    const renderer = new Renderer({ timeout: 5000, retries: 0 });
    const entry = await renderer.fetch(`${baseUrl}/docs/intro`);
    const initial = await plugin.getNavTree(entry);

    function flatten(nodes: NavNode[]): Set<string> {
      const all = new Set<string>();
      (function w(items: NavNode[]) {
        for (const n of items) {
          if (n.path) all.add(n.path);
          if (n.children) w(n.children);
        }
      })(nodes);
      return all;
    }

    const flatInitial = flatten(initial);
    expect(flatInitial.has('/docs/quick')).toBe(true);
    expect(flatInitial.has('/docs/table/model')).toBe(false);

    const { tree, expandFetches, errors } = await expandNavTree(initial, entry, plugin, renderer, {
      baseUrl: `${baseUrl}/docs/intro`,
      concurrency: 2,
      delay: 0,
      maxRounds: 3,
    });

    expect(errors).toHaveLength(0);
    expect(expandFetches).toBeGreaterThanOrEqual(1);

    const all = flatten(tree);
    expect(all.has('/docs/quick')).toBe(true);
    expect(all.has('/docs/table/model')).toBe(true);
    expect(all.has('/docs/table/type')).toBe(true);
  });
});
