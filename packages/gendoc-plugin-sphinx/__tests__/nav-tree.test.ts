import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { sphinxPlugin } from '../src/index.js';
import fs from 'node:fs';
import path from 'node:path';

const fixtureDir = path.join(__dirname, '..', '__fixtures__');

function loadNavContext(fixtureName: string, url: string) {
  const navHtml = fs.readFileSync(path.join(fixtureDir, fixtureName), 'utf-8');
  const fullHtml = `<html><body>${navHtml}</body></html>`;
  return {
    url,
    html: fullHtml,
    $: cheerio.load(fullHtml),
  };
}

describe('SphinxPlugin.getNavTree', () => {
  it('parses Furo sidebar-tree with captions and skips external links', async () => {
    const ctx = loadNavContext('furo-nav-snippet.html', 'https://docs.example.com/zh/index.html');
    const tree = await sphinxPlugin.getNavTree(ctx);
    const expected = JSON.parse(
      fs.readFileSync(path.join(fixtureDir, 'expected-nav-furo.json'), 'utf-8'),
    );
    expect(tree).toEqual(expected);
  });

  it('parses Book/PyData bd-docs-nav toctree without captions', async () => {
    const ctx = loadNavContext(
      'book-nav-snippet.html',
      'https://jupyterbook.org/en/stable/intro.html',
    );
    const tree = await sphinxPlugin.getNavTree(ctx);
    const expected = JSON.parse(
      fs.readFileSync(path.join(fixtureDir, 'expected-nav-book.json'), 'utf-8'),
    );
    expect(tree).toEqual(expected);
  });
});
