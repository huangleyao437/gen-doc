import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { docusaurusPlugin } from '../src/index.js';
import fs from 'node:fs';
import path from 'node:path';

const fixtureDir = path.join(__dirname, '..', '__fixtures__');

describe('DocusaurusPlugin.extractContent', () => {
  it('extracts content as Markdown', async () => {
    const html = fs.readFileSync(path.join(fixtureDir, 'content-page.html'), 'utf-8');
    const ctx = { url: 'https://example.com/docs/guides/installation', html, $: cheerio.load(html) };
    const result = await docusaurusPlugin.extractContent(ctx);

    expect(result.title).toBe('Installation');
    expect(result.markdown).toContain('# Installation');
    expect(result.markdown).toContain('## Prerequisites');
    expect(result.markdown).toContain('```bash');
    expect(result.markdown).toContain('pnpm add my-lib');
    expect(result.markdown).toContain('```js');
    expect(result.markdown).toContain("import { MyLib } from 'my-lib';");
    expect(result.markdown).toContain('const app = initApp();');
    expect(result.markdown).toContain('app.start();');
    expect(result.markdown).toContain('## Supported Browsers');
    expect(result.markdown).toContain('| Browser | Version | Notes |');
    expect(result.markdown).toContain('| Chrome | 90+ | Recommended |');
    expect(result.markdown).toContain('| Firefox | 88+ | Full support |');
    expect(result.markdown).toContain('| Safari | 14+ | Partial support |');
  });

  it('removes chrome: locale list, last-updated, hash-links, footer', async () => {
    const html = fs.readFileSync(path.join(fixtureDir, 'dirty-intro.html'), 'utf-8');
    const ctx = { url: 'https://example.com/zh-CN/docs/intro', html, $: cheerio.load(html) };
    const result = await docusaurusPlugin.extractContent(ctx);

    expect(result.title).toContain('Apache Doris');
    expect(result.markdown).not.toMatch(/English/);
    expect(result.markdown).not.toMatch(/日本語/);
    expect(result.markdown).not.toMatch(/最后于/);
    expect(result.markdown).not.toMatch(/Edit this page/);
    expect(result.markdown).not.toMatch(/hash-link|直接链接/);
    expect(result.markdown).toMatch(/我是新手/);
    expect(result.markdown).not.toMatch(/我是新手\[/);
    expect(result.frontmatter?.description).toBe('Doris intro');
  });

  it('maps doc cards to list links', async () => {
    const html = fs.readFileSync(path.join(fixtureDir, 'cards-snippet.html'), 'utf-8');
    const result = await docusaurusPlugin.extractContent({
      url: 'https://example.com/docs/cards',
      html,
      $: cheerio.load(html),
    });
    expect(result.markdown).toContain('[Title A](/docs/a)');
    expect(result.markdown).toContain('Desc A');
    expect(result.markdown).not.toMatch(/^\[$/m);
    expect(result.markdown).toContain('[Title B](/docs/b)');
  });

  it('maps tabs to headings and admonitions to blockquotes', async () => {
    const html = fs.readFileSync(path.join(fixtureDir, 'tabs-admonition.html'), 'utf-8');
    const result = await docusaurusPlugin.extractContent({
      url: 'https://example.com/docs/w',
      html,
      $: cheerio.load(html),
    });
    expect(result.markdown).toMatch(/###\s*npm/);
    expect(result.markdown).toMatch(/###\s*pnpm/);
    expect(result.markdown).toContain('npm i x');
    expect(result.markdown).toContain('pnpm add x');
    expect(result.markdown).toMatch(/>\s*\*\*WARNING:\*\*/i);
    expect(result.markdown).toContain('Be careful');
  });

  it('does not remove short Chinese doc link lists under /zh-CN/ paths', async () => {
    // i18n 站点正文中的普通文档链接列表：href 含 locale 段，标签是文档标题而非语言名
    const html = `<!DOCTYPE html>
<html><head><meta name="generator" content="Docusaurus v3.5.0"><title>目录</title></head>
<body><main><article>
  <h1>相关文档</h1>
  <p>请参阅下列章节了解更多细节与部署步骤说明。</p>
  <ul>
    <li><a href="/zh-CN/docs/install/compilation">编译安装</a></li>
    <li><a href="/zh-CN/docs/install/cluster-deployment">集群部署</a></li>
    <li><a href="/zh-CN/docs/query/sql-manual">SQL 手册</a></li>
    <li><a href="/zh-CN/docs/admin/config">配置管理</a></li>
  </ul>
</article></main></body></html>`;
    const result = await docusaurusPlugin.extractContent({
      url: 'https://doris.apache.org/zh-CN/docs/gettingStarted',
      html,
      $: cheerio.load(html),
    });
    expect(result.markdown).toContain('编译安装');
    expect(result.markdown).toContain('集群部署');
    expect(result.markdown).toContain('SQL 手册');
    expect(result.markdown).toContain('配置管理');
    expect(result.markdown).toContain('/zh-CN/docs/install/compilation');
  });

  it('preserves tab container content when no role=tabpanel panels exist', async () => {
    // 仅有 tab 标签、正文未用 role=tabpanel 包裹时，不得替换为仅含 h3 的碎片
    const html = `<!DOCTYPE html>
<html><head><meta name="generator" content="Docusaurus v3.5.0"><title>Tabs</title></head>
<body><main><article>
  <h1>Install</h1>
  <div class="tabs-container">
    <ul role="tablist" class="tabs">
      <li class="tabs__item" role="tab">npm</li>
      <li class="tabs__item" role="tab">pnpm</li>
    </ul>
    <div class="margin-top--md">
      <div class="tab-content"><pre><code class="language-bash">npm i x</code></pre></div>
      <div class="tab-content" hidden><pre><code class="language-bash">pnpm add x</code></pre></div>
    </div>
  </div>
  <p>After install, run the app with the documented entry command carefully.</p>
</article></main></body></html>`;
    const result = await docusaurusPlugin.extractContent({
      url: 'https://example.com/docs/install',
      html,
      $: cheerio.load(html),
    });
    // 正文代码不得因无 tabpanel 而丢失（可能仍含 tab 标签文本，但内容须保留）
    expect(result.markdown).toContain('npm i x');
    expect(result.markdown).toContain('pnpm add x');
    expect(result.markdown).toContain('After install');
  });

  it('does not wrap unrelated bare li when mapping cards', async () => {
    const html = `<!DOCTYPE html>
<html><head><meta name="generator" content="Docusaurus v3.5.0"><title>Mix</title></head>
<body><main><article>
  <h1>Mixed content page with enough text for root selection</h1>
  <p>Intro paragraph so content root selection has enough body text length here.</p>
  <li class="orphan-item" data-marker="keep-orphan">Orphan list item not from card</li>
  <div class="row">
    <a class="card padding--lg" href="/docs/a"><h3>Title A</h3><p>Desc A</p></a>
  </div>
</article></main></body></html>`;
    const $ = cheerio.load(html);
    const result = await docusaurusPlugin.extractContent({
      url: 'https://example.com/docs/mix',
      html,
      $,
    });
    expect(result.markdown).toContain('[Title A](/docs/a)');
    expect(result.markdown).toContain('Orphan list item not from card');
    // card 映射后应出现列表语法；孤儿 li 若被全局包 ul 不易在 md 中区分，
    // 这里用原始 HTML 再跑一遍组件映射，断言孤儿 li 父节点仍非我们新建的 ul 独占包裹
    const $2 = cheerio.load(html);
    const $article = $2('article');
    const { mapDocusaurusComponents } = await import('../src/component-map.js');
    mapDocusaurusComponents($2, $article);
    const orphanParent = $2('li.orphan-item').parent().get(0);
    const orphanParentTag = orphanParent?.tagName?.toLowerCase() ?? '';
    // 修复前会把孤儿 li 包进 ul；修复后父节点仍是 article
    expect(orphanParentTag).toBe('article');
    expect($2('a.card').length).toBe(0);
    expect($2('ul > li > a[href="/docs/a"]').length).toBe(1);
  });
});
