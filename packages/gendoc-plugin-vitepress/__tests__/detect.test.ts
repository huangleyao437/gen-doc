import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { vitepressPlugin } from '../src/index.js';
import fs from 'node:fs';
import path from 'node:path';

const fixtureDir = path.join(__dirname, '..', '__fixtures__');

function makePageContext(html: string, url = 'https://pinia.vuejs.org/zh/cookbook/') {
  return { url, html, $: cheerio.load(html) };
}

describe('VitePressPlugin.detect', () => {
  it('detects VitePress from meta generator tag', async () => {
    const html = fs.readFileSync(path.join(fixtureDir, 'content-page.html'), 'utf-8');
    const result = await vitepressPlugin.detect(makePageContext(html));
    expect(result).not.toBeNull();
    expect(result!.framework).toBe('vitepress');
    expect(result!.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result!.version).toBe('1.6.4');
  });

  it('returns null for non-VitePress page', async () => {
    const html = '<html><head></head><body><p>Hello</p></body></html>';
    const result = await vitepressPlugin.detect(makePageContext(html));
    expect(result).toBeNull();
  });

  it('detects VitePress from DOM features without generator', async () => {
    const html = `
      <html><body>
        <aside class="VPSidebar"><nav id="VPSidebarNav"></nav></aside>
        <div class="VPContent"><div class="vp-doc"><p>docs</p></div></div>
      </body></html>`;
    const result = await vitepressPlugin.detect(makePageContext(html));
    expect(result).not.toBeNull();
    expect(result!.framework).toBe('vitepress');
    expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('detects VitePress from __VP_HASH_MAP__ marker', async () => {
    const html = '<html><body><script>window.__VP_HASH_MAP__={}</script></body></html>';
    const result = await vitepressPlugin.detect(makePageContext(html));
    expect(result).not.toBeNull();
    expect(result!.framework).toBe('vitepress');
    expect(result!.confidence).toBeGreaterThanOrEqual(0.85);
  });
});
