import { normalizeUrlPath } from './link-rewriter.js';

/**
 * 将简易 glob（仅 * 与 **）转为匹配 pathname 的正则。
 * - `**` 匹配跨段任意字符（含 `/`）
 * - `*` 匹配单段内除 `/` 外任意字符
 */
export function matchPathGlob(pathname: string, pattern: string): boolean {
  const path = normalizeUrlPath(pathname);
  let pat = pattern.trim();
  if (!pat) return true;

  // 模式也去掉 query/hash；保留 glob 星号
  pat = pat.split('?')[0].split('#')[0];
  // 若 pattern 以 /** 结尾，允许匹配前缀目录本身
  // 例：/zh/cookbook/** 应匹配 /zh/cookbook 与 /zh/cookbook/x

  let i = 0;
  let out = '^';
  while (i < pat.length) {
    if (pat[i] === '*' && pat[i + 1] === '*') {
      out += '.*';
      i += 2;
      // 吞掉 ** 后多余的 /
      if (pat[i] === '/') i += 1;
      continue;
    }
    if (pat[i] === '*') {
      out += '[^/]*';
      i += 1;
      continue;
    }
    const ch = pat[i];
    if (/[.+^${}()|[\]\\]/.test(ch)) {
      out += '\\' + ch;
    } else {
      out += ch;
    }
    i += 1;
  }
  out += '$';

  const re = new RegExp(out);
  if (re.test(path)) return true;

  // /zh/cookbook/** 对 normalize 后的 /zh/cookbook 再试：把末尾 /** 视为可选后缀
  if (pattern.includes('**')) {
    const prefix = pattern.replace(/\*\*.*$/, '').replace(/\/$/, '');
    if (prefix && (path === normalizeUrlPath(prefix) || path.startsWith(normalizeUrlPath(prefix) + '/'))) {
      return true;
    }
  }
  return false;
}

/** 按 include / exclude pathname glob 过滤 URL 列表（先 include 再 exclude） */
export function filterUrlsByPath(
  urls: string[],
  options: { include?: string; exclude?: string },
): string[] {
  return urls.filter((url) => {
    const pathname = normalizeUrlPath(url);
    if (options.include && !matchPathGlob(pathname, options.include)) {
      return false;
    }
    if (options.exclude && matchPathGlob(pathname, options.exclude)) {
      return false;
    }
    return true;
  });
}
