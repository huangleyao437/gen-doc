import { describe, it, expect } from 'vitest';
import { rewriteLinks, normalizeUrlPath, type LinkRewriteContext } from '../src/link-rewriter.js';

function ctx(partial: Partial<LinkRewriteContext> & Pick<LinkRewriteContext, 'pathMap' | 'currentRelPath'>): LinkRewriteContext {
  return {
    siteOrigin: 'https://example.com',
    ...partial,
  };
}

describe('normalizeUrlPath', () => {
  it('strips origin, hash, query, trailing slash', () => {
    expect(normalizeUrlPath('https://example.com/docs/foo/?q=1#x')).toBe('/docs/foo');
    expect(normalizeUrlPath('/docs/foo/')).toBe('/docs/foo');
  });
});

describe('rewriteLinks', () => {
  const pathMap = new Map<string, string>([
    ['/docs/intro', 'introduction.md'],
    ['/docs/guide/install', 'guides/installation.md'],
  ]);

  it('rewrites same-dir and cross-dir links to relative md', () => {
    const md = 'See [Install](/docs/guide/install) and [Intro](/docs/intro#start).';
    const out = rewriteLinks(
      md,
      ctx({ currentRelPath: 'guides/configuration.md', pathMap }),
    );
    expect(out).toMatch(/\[Install\]\(\.\/installation\.md\)/);
    expect(out).toMatch(/\[Intro\]\(\.\.\/introduction\.md#start\)/);
  });

  it('falls back to absolute site URL when unmapped', () => {
    const md = 'See [Other](/docs/missing).';
    const out = rewriteLinks(md, ctx({ currentRelPath: 'introduction.md', pathMap }));
    expect(out).toContain('[Other](https://example.com/docs/missing)');
  });

  it('leaves external, mailto, and pure hash alone', () => {
    const md = '[a](https://other.com/x) [b](mailto:a@b.com) [c](#local)';
    const out = rewriteLinks(md, ctx({ currentRelPath: 'introduction.md', pathMap }));
    expect(out).toBe(md);
  });

  it('resolves site-relative image paths to absolute URL, keeps https images', () => {
    const md = '![a](/img/x.png) ![b](https://cdn.example.com/y.png)';
    const out = rewriteLinks(md, ctx({ currentRelPath: 'introduction.md', pathMap }));
    expect(out).toContain('![a](https://example.com/img/x.png)');
    expect(out).toContain('![b](https://cdn.example.com/y.png)');
  });

  it('does not rewrite already-relative md links', () => {
    const md = '[x](./installation.md)';
    const out = rewriteLinks(md, ctx({ currentRelPath: 'guides/configuration.md', pathMap }));
    expect(out).toBe(md);
  });

  it('rewrites every adjacent )[ 粘连 link (not every other one)', () => {
    // turndown 未映射 DocCard 时会出现 ](url1)[label2](url2) 粘连；旧正则会漏改偶数条
    const md = [
      '[',
      '',
      '### 表模型概述',
      '',
      '对比',
      '',
      '](/docs/intro)[',
      '',
      '### 明细模型',
      '',
      '保留明细',
      '',
      '](/docs/guide/install)[',
      '',
      '### 主键',
      '',
      '更新',
      '',
      '](/docs/intro)',
    ].join('\n');

    const out = rewriteLinks(md, ctx({ currentRelPath: 'use-doris/表设计.md', pathMap }));
    expect(out).toMatch(/\]\([^)]*introduction\.md\)/);
    expect(out).toMatch(/\]\([^)]*installation\.md\)/);
    // 三条均应改写，不应残留 /docs/
    expect(out).not.toMatch(/\]\(\/docs\//);
    // 图片语法不被当成普通链接
    const img = rewriteLinks('![x](/docs/intro.png)', ctx({ currentRelPath: 'a.md', pathMap }));
    expect(img).toContain('![x](https://example.com/docs/intro.png)');
  });

  it('encodes & in relative paths and wraps non-ASCII in angle brackets', () => {
    const map = new Map<string, string>([
      ['/docs/fe', 'operate-&-maintain/fe配置.md'],
    ]);
    const out = rewriteLinks('[fe](/docs/fe)', ctx({ currentRelPath: 'use-doris/a.md', pathMap: map }));
    // & → %26，避免 HTML 预览截断；中文路径用 <>
    expect(out).toContain('%26');
    expect(out).toMatch(/\[fe\]\(<\.\.\/operate-%26-maintain\/fe配置\.md>\)/);
  });
});
