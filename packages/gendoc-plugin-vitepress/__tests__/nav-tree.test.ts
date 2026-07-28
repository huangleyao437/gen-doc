import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { vitepressPlugin } from '../src/index.js';
import fs from 'node:fs';
import path from 'node:path';

const fixtureDir = path.join(__dirname, '..', '__fixtures__');

describe('VitePressPlugin.getNavTree', () => {
  it('parses VPSidebar navigation and skips external links', async () => {
    const navHtml = fs.readFileSync(path.join(fixtureDir, 'nav-snippet.html'), 'utf-8');
    const fullHtml = `<html><body>${navHtml}</body></html>`;
    const ctx = {
      url: 'https://pinia.vuejs.org/zh/cookbook/',
      html: fullHtml,
      $: cheerio.load(fullHtml),
    };
    const tree = await vitepressPlugin.getNavTree(ctx);
    const expected = JSON.parse(
      fs.readFileSync(path.join(fixtureDir, 'expected-nav.json'), 'utf-8'),
    );
    expect(tree).toEqual(expected);
  });
});
