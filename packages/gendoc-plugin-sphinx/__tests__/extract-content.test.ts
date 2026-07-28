import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { sphinxPlugin } from '../src/index.js';
import fs from 'node:fs';
import path from 'node:path';

const fixtureDir = path.join(__dirname, '..', '__fixtures__');

function makePage(html: string, url = 'https://java.agentscope.io/v2/zh/docs/index.html') {
  return { url, html, $: cheerio.load(html) };
}

describe('SphinxPlugin.extractContent', () => {
  it('Furo: title、正文、admonition、无 chrome/headerlink', async () => {
    const html = fs.readFileSync(path.join(fixtureDir, 'furo-content-page.html'), 'utf-8');
    const page = await sphinxPlugin.extractContent(makePage(html));

    expect(page.title).toMatch(/AgentScope 2\.0/);
    expect(page.markdown).toContain('# AgentScope 2.0 是什么？');
    expect(page.markdown).toContain('正文足够长度');
    expect(page.markdown).toMatch(/>\s*\*\*NOTE\*\*/i);
    expect(page.markdown).toContain('这是一条提示');
    // chrome / 锚点 / copy 残留
    expect(page.markdown).not.toMatch(/headerlink|sidebar-tree|站点顶栏|Copyright footer|Copy to clipboard|¶/i);
    expect(page.frontmatter?.description).toBe('AgentScope 2.0 概述');
  });

  it('Furo: sd-card 映射为列表链接', async () => {
    const html = fs.readFileSync(path.join(fixtureDir, 'furo-content-page.html'), 'utf-8');
    const page = await sphinxPlugin.extractContent(makePage(html));

    expect(page.markdown).toContain('[快速开始](tutorial/quickstart.html)');
    expect(page.markdown).toContain('[API 参考](api/index.html)');
  });

  it('Furo: highlight-python 产出 fenced python 代码块', async () => {
    const html = fs.readFileSync(path.join(fixtureDir, 'furo-content-page.html'), 'utf-8');
    const page = await sphinxPlugin.extractContent(makePage(html));

    expect(page.markdown).toMatch(/```python/);
    expect(page.markdown).toContain('import agentscope');
    expect(page.markdown).toContain('agentscope.init()');
  });

  it('Furo: mystnb cell 输入与输出均保留', async () => {
    const html = fs.readFileSync(path.join(fixtureDir, 'furo-content-page.html'), 'utf-8');
    const page = await sphinxPlugin.extractContent(makePage(html));

    expect(page.markdown).toContain('print("hello mystnb")');
    expect(page.markdown).toContain('hello mystnb');
  });

  it('Furo: sd-tab-set 各 panel 保留并标标题', async () => {
    const html = fs.readFileSync(path.join(fixtureDir, 'furo-content-page.html'), 'utf-8');
    const page = await sphinxPlugin.extractContent(makePage(html));

    expect(page.markdown).toMatch(/###\s*Maven/);
    expect(page.markdown).toMatch(/###\s*Gradle/);
    expect(page.markdown).toContain('dependency maven snippet');
    expect(page.markdown).toContain('dependency gradle snippet');
  });

  it('Book Theme: 从 .bd-article 抽正文，剔除 chrome', async () => {
    const html = fs.readFileSync(path.join(fixtureDir, 'book-content-page.html'), 'utf-8');
    const page = await sphinxPlugin.extractContent(
      makePage(html, 'https://jupyterbook.org/en/stable/intro.html'),
    );

    expect(page.title).toMatch(/Welcome to Jupyter Book/i);
    expect(page.markdown).toContain('# Welcome to Jupyter Book');
    expect(page.markdown).toContain('publication-quality books');
    expect(page.markdown).toMatch(/>\s*\*\*TIP\*\*/i);
    expect(page.markdown).toMatch(/```bash/);
    expect(page.markdown).toContain('jupyter-book build mybook/');
    expect(page.markdown).not.toMatch(/Book 顶栏|On this page|bd-sidenav|Permalink|#\s*$/m);
  });
});
