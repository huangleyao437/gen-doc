import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { docusaurusPlugin } from '../src/index.js';
import fs from 'node:fs';
import path from 'node:path';

const fixtureDir = path.join(__dirname, '..', '__fixtures__');

describe('DocusaurusPlugin.getNavTree', () => {
  it('parses sidebar navigation correctly', async () => {
    const navHtml = fs.readFileSync(path.join(fixtureDir, 'nav-snippet.html'), 'utf-8');
    const fullHtml = `<html><body>${navHtml}</body></html>`;
    const ctx = { url: 'https://example.com/docs/intro', html: fullHtml, $: cheerio.load(fullHtml) };
    const tree = await docusaurusPlugin.getNavTree(ctx);

    const expected = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'expected-nav.json'), 'utf-8'));
    expect(tree).toEqual(expected);
  });
});
