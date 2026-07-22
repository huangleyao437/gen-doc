import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { docusaurusPlugin } from '../src/index.js';
import fs from 'node:fs';
import path from 'node:path';

const fixtureDir = path.join(__dirname, '..', '__fixtures__');

function makePageContext(html: string, url: string = 'https://example.com/docs/test') {
  return { url, html, $: cheerio.load(html) };
}

describe('DocusaurusPlugin.detect', () => {
  it('detects Docusaurus from meta generator tag', async () => {
    const html = fs.readFileSync(path.join(fixtureDir, 'content-page.html'), 'utf-8');
    const ctx = makePageContext(html);
    const result = await docusaurusPlugin.detect(ctx);
    expect(result).not.toBeNull();
    expect(result!.framework).toBe('docusaurus');
    expect(result!.confidence).toBeGreaterThan(0.8);
    expect(result!.version).toBe('3.5.0');
  });

  it('returns null for non-Docusaurus page', async () => {
    const html = '<html><head></head><body><p>Hello</p></body></html>';
    const ctx = makePageContext(html);
    const result = await docusaurusPlugin.detect(ctx);
    expect(result).toBeNull();
  });

  it('detects Docusaurus from menu__list CSS class', async () => {
    const html = '<html><body><nav class="menu"><ul class="menu__list"></ul></nav></body></html>';
    const ctx = makePageContext(html);
    const result = await docusaurusPlugin.detect(ctx);
    expect(result).not.toBeNull();
    expect(result!.framework).toBe('docusaurus');
  });
});
