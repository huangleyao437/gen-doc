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

/**
 * 将相对路径写成更易被预览器点击的 Markdown 目标：
 * - 段内编码 & # ? ( ) 空格等（HTML 预览里 & 会截断 href）
 * - 含非 ASCII 或已编码特殊字符时用 <...> 包裹（CommonMark）
 */
export function formatMarkdownHref(href: string): string {
  const t = href.trim();
  if (!t || t.startsWith('#') || /^(mailto:|javascript:|data:)/i.test(t)) return href;
  if (/^https?:\/\//i.test(t) || t.startsWith('//')) return href;

  const { base, hash } = splitHash(t);
  const encodedBase = base
    .split('/')
    .map((seg) => {
      if (seg === '' || seg === '.' || seg === '..') return seg;
      // 只编码会破坏 Markdown/HTML 解析的 ASCII 特殊字符，中文等保留可读性
      return seg.replace(/[%#?&() ]/g, (ch) => encodeURIComponent(ch));
    })
    .join('/');

  const full = encodedBase + hash;
  const needsAngle =
    /[^\u0000-\u007F]/.test(encodedBase) ||
    /%[0-9A-Fa-f]{2}/.test(encodedBase) ||
    /[() ]/.test(base);

  return needsAngle ? `<${full}>` : full;
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
  // 去掉已有的尖括号包裹再解析
  const unwrapped = t.startsWith('<') && t.endsWith('>') ? t.slice(1, -1) : t;
  if (!unwrapped || unwrapped.startsWith('#') || /^(mailto:|javascript:|data:)/i.test(unwrapped)) {
    return url;
  }
  if (/^https?:\/\//i.test(unwrapped) || unwrapped.startsWith('//')) {
    if (!sameOrigin(unwrapped, ctx.siteOrigin)) return url;
  } else if (!unwrapped.startsWith('/')) {
    if (/\.md(\b|#|$)/.test(unwrapped) || unwrapped.startsWith('./') || unwrapped.startsWith('../')) {
      return formatMarkdownHref(unwrapped);
    }
  }
  const { base, hash } = splitHash(unwrapped);
  const pathname = resolvePathname(base || '/', ctx.siteOrigin);
  if (pathname === null) return url;
  const target = ctx.pathMap.get(pathname);
  if (target) return formatMarkdownHref(toPosixRel(ctx.currentRelPath, target) + hash);
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

/** 匹配 (url) 或 (<url>) 形式的链接目标 */
const LINK_DEST = String.raw`(?:<([^>\n]+)>|([^)\s]+))`;

export function rewriteLinks(markdown: string, ctx: LinkRewriteContext): string {
  const imgRe = new RegExp(String.raw`!\[([^\]]*)\]\(${LINK_DEST}((?:\s+"[^"]*")?)\)`, 'g');
  let text = markdown.replace(imgRe, (_full, alt: string, angle: string, plain: string, title: string) => {
    const url = angle || plain;
    return `![${alt}](${rewriteImageHref(url, ctx)}${title || ''})`;
  });

  // lookbehind 排除图片；支持粘连 ](a)[b](c) 与 <url> 目标
  const pageRe = new RegExp(String.raw`(?<!!)\[([^\]]*)\]\(${LINK_DEST}((?:\s+"[^"]*")?)\)`, 'g');
  text = text.replace(pageRe, (_full, label: string, angle: string, plain: string, title: string) => {
    const url = angle || plain;
    return `[${label}](${rewritePageHref(url, ctx)}${title || ''})`;
  });
  return text;
}
