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

  it('recurses nested VPSidebar groups and drops empty external-only groups', async () => {
    const navHtml = fs.readFileSync(path.join(fixtureDir, 'nav-snippet.html'), 'utf-8');
    const fullHtml = `<html><body>${navHtml}</body></html>`;
    const ctx = {
      url: 'https://pinia.vuejs.org/zh/cookbook/',
      html: fullHtml,
      $: cheerio.load(fullHtml),
    };
    const tree = await vitepressPlugin.getNavTree(ctx);

    // 嵌套分组应出现在 children 中
    const handbook = tree.find((n) => n.title === '手册');
    expect(handbook?.children?.some((c) => c.title === '进阶')).toBe(true);
    const advanced = handbook?.children?.find((c) => c.title === '进阶');
    expect(advanced?.children?.map((c) => c.title)).toEqual(['进阶用法', '更深层']);
    const deeper = advanced?.children?.find((c) => c.title === '更深层');
    expect(deeper?.children).toEqual([{ title: '深层页面', path: '/zh/cookbook/deep.html' }]);

    // 纯外链 level-0 分组不应残留
    expect(tree.some((n) => n.title === '外部资源')).toBe(false);
    // 外链叶子不应出现
    const flatTitles = JSON.stringify(tree);
    expect(flatTitles).not.toContain('GitHub');
    expect(flatTitles).not.toContain('vuejs.org');
  });
});
