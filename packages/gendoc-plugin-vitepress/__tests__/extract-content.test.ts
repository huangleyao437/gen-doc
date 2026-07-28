import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { vitepressPlugin } from '../src/index.js';
import fs from 'node:fs';
import path from 'node:path';

const fixtureDir = path.join(__dirname, '..', '__fixtures__');

function makePageContext(html: string, url = 'https://pinia.vuejs.org/zh/cookbook/') {
  return { url, html, $: cheerio.load(html) };
}

describe('VitePressPlugin.extractContent', () => {
  it('extracts title, strips chrome, maps custom-block, preserves code language and lines', async () => {
    const html = fs.readFileSync(path.join(fixtureDir, 'content-page.html'), 'utf-8');
    const page = await vitepressPlugin.extractContent(makePageContext(html));

    expect(page.title).toMatch(/手册/);
    expect(page.markdown).toContain('# 手册');
    expect(page.markdown).not.toMatch(/header-anchor|VPDocFooter|prev next|Copy Code/i);
    // 正文内推广卡 / 翻译状态条应剔除，避免破碎 Markdown 链接
    expect(page.markdown).not.toMatch(
      /rulekit\.dev|RuleKit|Vibe 代码|masteringpinia\.com|官方视频课程|该翻译已同步/i,
    );
    expect(page.markdown).toMatch(/>\s*\*\*WARNING\*\*/i);
    expect(page.markdown).toContain('不要直接返回 DOM 引用');
    // 语言与多行；行间 HTML 空白不应膨胀成多余空行，空 span.line 才保留空行
    expect(page.markdown).toMatch(/```ts\nconst x = 1\nconst y = 2\n\nconst z = 3\n```/);
    expect(page.frontmatter?.description).toBe('Test VitePress page');
  });

  it('maps code-group tabs into sequential titled blocks', async () => {
    const snippet = fs.readFileSync(path.join(fixtureDir, 'code-group-snippet.html'), 'utf-8');
    const html = `
      <html><head><meta name="generator" content="VitePress v1.6.4"></head>
      <body><main><div class="vp-doc"><h1>Tabs</h1>${snippet}</div></main></body></html>`;
    const page = await vitepressPlugin.extractContent(makePageContext(html));
    expect(page.markdown).toMatch(/###\s*js/);
    expect(page.markdown).toMatch(/###\s*ts/);
    expect(page.markdown).toContain('const a = 1');
    expect(page.markdown).toContain('const a: number = 1');
  });
});
