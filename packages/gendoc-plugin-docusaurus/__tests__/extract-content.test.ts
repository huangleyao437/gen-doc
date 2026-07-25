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
});
