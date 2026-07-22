import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Writer } from '../src/writer.js';
import type { ExtractedPage, NavNode, PipelineOptions } from '../src/types.js';

const defaultOptions: PipelineOptions = {
  output: '',
  concurrency: 3,
  delay: 200,
  timeout: 15000,
  maxPages: Infinity,
  depth: Infinity,
  flat: false,
  verbose: false,
};

describe('Writer', () => {
  let tmpDir: string;
  let writer: Writer;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `gendoc-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tmpDir, { recursive: true });
    writer = new Writer();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('writes pages into directory structure based on navTree', async () => {
    const pages: ExtractedPage[] = [
      { url: 'https://example.com/docs/intro', title: 'Introduction', markdown: '# Intro content' },
      { url: 'https://example.com/docs/guide/install', title: 'Installation', markdown: '# Install' },
      { url: 'https://example.com/docs/guide/config', title: 'Configuration', markdown: '# Config' },
    ];

    const navTree: NavNode[] = [
      { title: 'Introduction', path: '/docs/intro' },
      {
        title: 'Guides',
        path: '/docs/guide',
        children: [
          { title: 'Installation', path: '/docs/guide/install' },
          { title: 'Configuration', path: '/docs/guide/config' },
        ],
      },
    ];

    const options: PipelineOptions = { ...defaultOptions, output: tmpDir };
    const count = await writer.write(pages, navTree, options);

    expect(count).toBe(3);
    const intro = await fs.readFile(path.join(tmpDir, 'introduction.md'), 'utf-8');
    expect(intro).toBe('# Intro content');
    const install = await fs.readFile(path.join(tmpDir, 'guides', 'installation.md'), 'utf-8');
    expect(install).toBe('# Install');
    const config = await fs.readFile(path.join(tmpDir, 'guides', 'configuration.md'), 'utf-8');
    expect(config).toBe('# Config');
  });

  it('sanitizes illegal filename characters', async () => {
    const pages: ExtractedPage[] = [
      { url: 'https://example.com/api/users:create', title: 'POST /api/users:create', markdown: '# API' },
    ];
    const navTree: NavNode[] = [{ title: 'POST /api/users:create', path: '/api/users:create' }];
    const options: PipelineOptions = { ...defaultOptions, output: tmpDir };
    await writer.write(pages, navTree, options);

    const files = await fs.readdir(tmpDir);
    expect(files[0]).not.toContain(':');
    expect(files[0]).toContain('post-api-users-create');
  });

  it('handles name conflicts with suffix', async () => {
    const pages: ExtractedPage[] = [
      { url: 'https://example.com/a/guide', title: 'Guide', markdown: '# A' },
      { url: 'https://example.com/b/guide', title: 'Guide', markdown: '# B' },
    ];
    const navTree: NavNode[] = [
      { title: 'Guide', path: '/a/guide' },
      { title: 'Guide', path: '/b/guide' },
    ];
    const options: PipelineOptions = { ...defaultOptions, output: tmpDir };
    await writer.write(pages, navTree, options);

    const files = await fs.readdir(tmpDir);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    expect(mdFiles).toHaveLength(2);
    expect(mdFiles).toContain('guide.md');
    expect(mdFiles).toContain('guide-2.md');
  });

  it('uses URL path as filename when title is empty', async () => {
    const pages: ExtractedPage[] = [
      { url: 'https://example.com/docs/api-reference', title: '', markdown: '# ref' },
    ];
    const navTree: NavNode[] = [{ title: '', path: '/docs/api-reference' }];
    const options: PipelineOptions = { ...defaultOptions, output: tmpDir };
    await writer.write(pages, navTree, options);

    const files = await fs.readdir(tmpDir);
    expect(files).toContain('api-reference.md');
  });
});
