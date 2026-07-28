import { describe, it, expect } from 'vitest';
import { matchPathGlob, filterUrlsByPath } from '../src/path-filter.js';

describe('matchPathGlob', () => {
  it('matches ** across path segments', () => {
    expect(matchPathGlob('/zh/cookbook/composables.html', '/zh/cookbook/**')).toBe(true);
    expect(matchPathGlob('/zh/cookbook/', '/zh/cookbook/**')).toBe(true);
    expect(matchPathGlob('/zh/introduction.html', '/zh/cookbook/**')).toBe(false);
  });

  it('matches single * within one segment', () => {
    expect(matchPathGlob('/zh/cookbook/foo.html', '/zh/cookbook/*.html')).toBe(true);
    expect(matchPathGlob('/zh/cookbook/a/b.html', '/zh/cookbook/*.html')).toBe(false);
  });

  it('normalizes trailing slashes on pathname side', () => {
    expect(matchPathGlob('/zh/cookbook', '/zh/cookbook/**')).toBe(true);
  });
});

describe('filterUrlsByPath', () => {
  const urls = [
    'https://pinia.vuejs.org/zh/cookbook/',
    'https://pinia.vuejs.org/zh/cookbook/composables.html',
    'https://pinia.vuejs.org/zh/introduction.html',
  ];

  it('keeps only include matches', () => {
    const out = filterUrlsByPath(urls, { include: '/zh/cookbook/**' });
    expect(out).toEqual([
      'https://pinia.vuejs.org/zh/cookbook/',
      'https://pinia.vuejs.org/zh/cookbook/composables.html',
    ]);
  });

  it('drops exclude matches', () => {
    const out = filterUrlsByPath(urls, { exclude: '/zh/introduction.html' });
    expect(out).toHaveLength(2);
    expect(out.every((u) => !u.includes('introduction'))).toBe(true);
  });

  it('applies include then exclude', () => {
    const out = filterUrlsByPath(urls, {
      include: '/zh/**',
      exclude: '/zh/cookbook/composables.html',
    });
    expect(out).toEqual([
      'https://pinia.vuejs.org/zh/cookbook/',
      'https://pinia.vuejs.org/zh/introduction.html',
    ]);
  });

  it('returns all urls when no filters', () => {
    expect(filterUrlsByPath(urls, {})).toEqual(urls);
  });
});
