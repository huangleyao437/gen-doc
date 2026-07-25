const ZERO_WIDTH = /[\u200b\u200c\u200d\ufeff]/g;

/** ATX heading line with trailing markdown link that is empty/ZWSP text (hash-link residue) */
const HEADING_HASH_LINK = /^(#{1,6}\s+.*?)(\[[\u200b\s]*\]\([^)]*\))\s*$/gm;

/**
 * Framework-agnostic Markdown string cleanup.
 * Pure function; never throws — on unexpected errors returns original input + trailing newline.
 */
export function sanitizeMarkdown(markdown: string): string {
  try {
    let text = markdown ?? '';
    text = text.replace(ZERO_WIDTH, '');
    text = text.replace(HEADING_HASH_LINK, '$1');
    // Also strip residual patterns like [​](#id "title") mid-heading after ZWSP removal
    text = text.replace(/^(#{1,6}\s+.*?)(\[\s*\]\([^)]*\))\s*$/gm, '$1');
    text = text
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/g, ''))
      .join('\n');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/^\n+/, '').replace(/\n*$/, '\n');
    if (text === '\n' && (markdown ?? '').trim() === '') {
      return '\n';
    }
    return text.length === 0 ? '\n' : text.endsWith('\n') ? text : `${text}\n`;
  } catch {
    const fallback = markdown ?? '';
    return fallback.endsWith('\n') ? fallback : `${fallback}\n`;
  }
}
