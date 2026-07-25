import path from 'node:path';

export interface LinkRewriteContext {
  siteOrigin: string;
  currentRelPath: string;
  pathMap: Map<string, string>;
}

export function normalizeUrlPath(urlOrPath: string): string {
  let pathname: string;
  try {
    if (/^https?:\/\//i.test(urlOrPath) || urlOrPath.startsWith('//')) {
      const href = urlOrPath.startsWith('//') ? `https:${urlOrPath}` : urlOrPath;
      pathname = new URL(href).pathname;
    } else {
      pathname = urlOrPath.split('?')[0].split('#')[0];
    }
  } catch {
    pathname = urlOrPath.split('?')[0].split('#')[0];
  }
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    /* keep */
  }
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  return pathname || '/';
}

function splitHash(href: string): { base: string; hash: string } {
  const i = href.indexOf('#');
  if (i === -1) return { base: href, hash: '' };
  return { base: href.slice(0, i), hash: href.slice(i) };
}

function sameOrigin(href: string, siteOrigin: string): boolean {
  try {
    const full = href.startsWith('//') ? `https:${href}` : href;
    return new URL(full).origin === new URL(siteOrigin).origin;
  } catch {
    return false;
  }
}

function toPosixRel(fromFile: string, toFile: string): string {
  const fromDir = path.posix.dirname(fromFile);
  let rel = path.posix.relative(fromDir === '.' ? '' : fromDir, toFile);
  rel = rel.split('\\').join('/');
  if (!rel.startsWith('.') && !rel.startsWith('/')) rel = `./${rel}`;
  return rel;
}

function absUrl(pathname: string, siteOrigin: string, hash: string): string {
  return new URL(pathname, siteOrigin).href.replace(/\/$/, '') + hash;
}

function resolvePathname(base: string, siteOrigin: string): string | null {
  try {
    if (/^https?:\/\//i.test(base) || base.startsWith('//')) {
      if (!sameOrigin(base, siteOrigin)) return null;
      return normalizeUrlPath(base);
    }
    if (base.startsWith('/')) return normalizeUrlPath(base);
    return normalizeUrlPath(new URL(base, siteOrigin).pathname);
  } catch {
    return null;
  }
}

function rewritePageHref(url: string, ctx: LinkRewriteContext): string {
  const t = url.trim();
  if (!t || t.startsWith('#') || /^(mailto:|javascript:|data:)/i.test(t)) return url;
  if (/^https?:\/\//i.test(t) || t.startsWith('//')) {
    if (!sameOrigin(t, ctx.siteOrigin)) return url;
  } else if (!t.startsWith('/')) {
    if (/\.md(\b|#|$)/.test(t) || t.startsWith('./') || t.startsWith('../')) return url;
  }
  const { base, hash } = splitHash(t);
  const pathname = resolvePathname(base || '/', ctx.siteOrigin);
  if (pathname === null) return url;
  const target = ctx.pathMap.get(pathname);
  if (target) return toPosixRel(ctx.currentRelPath, target) + hash;
  return absUrl(pathname, ctx.siteOrigin, hash);
}

function rewriteImageHref(url: string, ctx: LinkRewriteContext): string {
  const t = url.trim();
  if (!t || t.startsWith('#') || /^(mailto:|javascript:|data:)/i.test(t)) return url;
  if (/^https?:\/\//i.test(t)) return url;
  if (t.startsWith('//')) {
    try {
      return `https:${t}`;
    } catch {
      return url;
    }
  }
  const { base, hash } = splitHash(t);
  try {
    return new URL(base || '/', ctx.siteOrigin).href + hash;
  } catch {
    return url;
  }
}

export function rewriteLinks(markdown: string, ctx: LinkRewriteContext): string {
  let text = markdown.replace(/!\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g, (_full, alt: string, url: string, title: string) => {
    return `![${alt}](${rewriteImageHref(url, ctx)}${title || ''})`;
  });
  text = text.replace(/(^|[^!])\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g, (_full, prefix: string, label: string, url: string, title: string) => {
    return `${prefix}[${label}](${rewritePageHref(url, ctx)}${title || ''})`;
  });
  return text;
}
