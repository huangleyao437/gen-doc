import fs from 'node:fs/promises';
import path from 'node:path';
import type { ExtractedPage, NavNode, PipelineOptions } from './types.js';

/** Map URL → relative output path */
interface PathMapping {
  url: string;
  relativePath: string;
}

export class Writer {
  /** Sanitize a string for use as a filename */
  private sanitize(name: string): string {
    return name
      .replace(/[/\\:*?"<>|]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      || 'untitled';
  }

  /** Build URL → path mappings from navTree */
  private buildPathMap(navTree: NavNode[], parentDir: string = ''): PathMapping[] {
    const result: PathMapping[] = [];
    for (const node of navTree) {
      const filename = this.sanitize(node.title || path.basename(node.path));
      const childDir = parentDir ? `${parentDir}/${filename}` : filename;

      // Only register page-level mappings for nodes with actual URLs.
      // Category nodes (path === '' or '#') only contribute directories,
      // not page entries — avoids every-page-matches-empty-string bug.
      if (node.path && node.path !== '#') {
        const relativePath = `${childDir}.md`;
        result.push({ url: node.path, relativePath });
      }

      if (node.children && node.children.length > 0) {
        result.push(...this.buildPathMap(node.children, childDir));
      }
    }
    return result;
  }

  /** Resolve a page's output path, handling conflicts */
  private resolvePath(
    page: ExtractedPage,
    mappings: PathMapping[],
    usedPaths: Set<string>,
    outputDir: string,
  ): string {
    // Match by URL: try exact match first, then suffix match
    const mapping = mappings.find(m => {
      if (!m.url) return false;
      return m.url === page.url || page.url.endsWith(m.url);
    });
    let basePath: string;

    if (mapping) {
      basePath = mapping.relativePath.replace(/\.md$/, '');
    } else {
      // Fallback: derive from URL path
      const urlPath = new URL(page.url).pathname;
      basePath = this.sanitize(urlPath.replace(/\/$/, '').split('/').pop() || 'untitled');
    }

    let candidate = `${basePath}.md`;
    let counter = 2;
    while (usedPaths.has(candidate)) {
      candidate = `${basePath}-${counter}.md`;
      counter++;
    }
    usedPaths.add(candidate);
    return path.join(outputDir, candidate);
  }

  async write(pages: ExtractedPage[], navTree: NavNode[], options: PipelineOptions): Promise<number> {
    const mappings = options.flat ? [] : this.buildPathMap(navTree);
    const usedPaths = new Set<string>();
    let count = 0;

    await fs.mkdir(options.output, { recursive: true });

    for (const page of pages) {
      const filePath = this.resolvePath(page, mappings, usedPaths, options.output);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, page.markdown, 'utf-8');
      count++;
    }

    return count;
  }
}
