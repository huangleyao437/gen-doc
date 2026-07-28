import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { sphinxPlugin } from '../src/index.js';
import fs from 'node:fs';
import path from 'node:path';

const fixtureDir = path.join(__dirname, '..', '__fixtures__');

function makePageContext(html: string, url = 'https://java.agentscope.io/v2/zh/docs/index.html') {
  return { url, html, $: cheerio.load(html) };
}

describe('SphinxPlugin.detect', () => {
  it('detects Sphinx+Furo from HTML comment', async () => {
    const html = fs.readFileSync(path.join(fixtureDir, 'furo-content-page.html'), 'utf-8');
    const result = await sphinxPlugin.detect(makePageContext(html));
    expect(result).not.toBeNull();
    expect(result!.framework).toBe('sphinx');
    expect(result!.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result!.version).toBe('7.4.7');
  });

  it('detects Jupyter Book theme assets', async () => {
    const html = `
      <html><head>
        <link href="_static/styles/sphinx-book-theme.css" rel="stylesheet" />
        <link href="_static/styles/pydata-sphinx-theme.css" rel="stylesheet" />
      </head>
      <body><nav class="bd-sidenav"><ul><li class="toctree-l1"><a href="a.html">A</a></li></ul></nav>
      <article class="bd-article"><p>docs</p></article></body></html>`;
    const result = await sphinxPlugin.detect(makePageContext(html, 'https://jupyterbook.org/en/stable/intro.html'));
    expect(result).not.toBeNull();
    expect(result!.framework).toBe('sphinx');
    expect(result!.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('detects from toctree + article DOM', async () => {
    const html = `<html><body>
      <ul><li class="toctree-l1"><a href="x.html">X</a></li></ul>
      <article role="main"><p>hello world content here long enough</p></article>
    </body></html>`;
    const result = await sphinxPlugin.detect(makePageContext(html));
    expect(result).not.toBeNull();
    expect(result!.framework).toBe('sphinx');
    expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('returns null for non-Sphinx page', async () => {
    const html = '<html><head></head><body><p>Hello</p></body></html>';
    expect(await sphinxPlugin.detect(makePageContext(html))).toBeNull();
  });
});
