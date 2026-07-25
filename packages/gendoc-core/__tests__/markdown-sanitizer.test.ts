import { describe, it, expect } from 'vitest';
import { sanitizeMarkdown } from '../src/markdown-sanitizer.js';

describe('sanitizeMarkdown', () => {
  it('removes zero-width characters', () => {
    const input = `## Hello\u200b World\ufeff`;
    expect(sanitizeMarkdown(input)).toBe('## Hello World\n');
  });

  it('strips hash-link residue from ATX headings', () => {
    const input = `## SQL 兼容[\u200b](#sql-兼容 "SQL 兼容的直接链接")\n\n正文`;
    const out = sanitizeMarkdown(input);
    expect(out).toContain('## SQL 兼容');
    expect(out).not.toContain('#sql-兼容');
    expect(out).not.toContain('直接链接');
    expect(out).toContain('正文');
  });

  it('collapses 3+ newlines to 2 and trims ends', () => {
    const input = `\n\n# Title\n\n\n\nPara\n\n`;
    expect(sanitizeMarkdown(input)).toBe('# Title\n\nPara\n');
  });

  it('strips trailing spaces on lines', () => {
    const input = `# Title  \n\nPara   `;
    // trailing spaces on Title line removed; final newline ensured
    expect(sanitizeMarkdown(input)).toBe('# Title\n\nPara\n');
  });

  it('returns empty-safe for empty string', () => {
    expect(sanitizeMarkdown('')).toBe('\n');
  });
});
