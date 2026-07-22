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
    expect(result.markdown).toContain("import { myLib } from 'my-lib';");
  });
});
