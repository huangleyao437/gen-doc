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
    expect(out).toContain('[Install](./installation.md)');
    expect(out).toContain('[Intro](../introduction.md#start)');
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
});
