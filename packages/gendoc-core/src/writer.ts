import fs from 'node:fs/promises';
import path from 'node:path';
import type { ExtractedPage, NavNode, PipelineOptions } from './types.js';
import { sanitizeMarkdown } from './markdown-sanitizer.js';
import { rewriteLinks, normalizeUrlPath } from './link-rewriter.js';

/** Map URL → relative output path */
interface PathMapping {
  url: string;
  relativePath: string;
}

/** YAML double-quoted string escape */
function yamlEscape(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;
}

/** Build YAML frontmatter block for a page */
function buildFrontmatter(page: ExtractedPage): string {
  const lines = ['---', `title: ${yamlEscape(page.title || '')}`];
  const desc = page.frontmatter?.description;
  if (typeof desc === 'string' && desc.trim()) {
    lines.push(`description: ${yamlEscape(desc.trim())}`);
  }
  lines.push(`source_url: ${yamlEscape(page.url)}`);
  lines.push('---', '');
  return lines.join('\n');
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

  /** Resolve a page's output path, handling conflicts.
   *  Uses the page's extracted title as filename, navTree for directory structure. */
  private resolvePath(
    page: ExtractedPage,
    mappings: PathMapping[],
    usedPaths: Set<string>,
    outputDir: string,
  ): string {
    // Determine directory from navTree mapping, fallback to URL path
    const mapping = mappings.find(m => {
      if (!m.url) return false;
      return m.url === page.url || page.url.endsWith(m.url);
    });

    let dir: string;
    if (mapping) {
      dir = path.dirname(mapping.relativePath);
      if (dir === '.') dir = '';
    } else {
      // Fallback: derive directory from URL path structure
      const urlPath = new URL(page.url).pathname.replace(/\/$/, '');
      const parts = urlPath.split('/').slice(0, -1);
      dir = parts.map(s => this.sanitize(s)).join('/');
    }

    // Use page title as filename, fallback to URL segment
    const filename = page.title
      ? this.sanitize(page.title)
      : this.sanitize(
          new URL(page.url).pathname.replace(/\/$/, '').split('/').pop() || 'untitled'
        );

    let candidate = dir ? `${dir}/${filename}.md` : `${filename}.md`;
    let counter = 2;
    while (usedPaths.has(candidate)) {
      candidate = dir
        ? `${dir}/${filename}-${counter}.md`
        : `${filename}-${counter}.md`;
      counter++;
    }
    usedPaths.add(candidate);
    return path.join(outputDir, candidate);
  }

  /** Convert absolute output file path to posix relative path from output dir */
  private toRelPath(absFilePath: string, outputDir: string): string {
    return path.relative(outputDir, absFilePath).split(path.sep).join('/');
  }

  async write(pages: ExtractedPage[], navTree: NavNode[], options: PipelineOptions): Promise<number> {
    const mappings = options.flat ? [] : this.buildPathMap(navTree);
    const usedPaths = new Set<string>();
    let count = 0;

    await fs.mkdir(options.output, { recursive: true });

    // First pass: resolve all output paths (needed for pathMap before rewrite)
    const resolved: { page: ExtractedPage; absPath: string; relPath: string }[] = [];
    for (const page of pages) {
      const absPath = this.resolvePath(page, mappings, usedPaths, options.output);
      const relPath = this.toRelPath(absPath, options.output);
      resolved.push({ page, absPath, relPath });
    }

    // PathMap from actual written pages (authoritative for link rewrite)
    const pathMap = new Map<string, string>();
    for (const item of resolved) {
      try {
        pathMap.set(normalizeUrlPath(item.page.url), item.relPath);
      } catch {
        /* skip bad url */
      }
    }

    // Second pass: sanitize, rewrite links, prepend frontmatter, write
    for (const item of resolved) {
      let siteOrigin = 'https://localhost';
      try {
        siteOrigin = new URL(item.page.url).origin;
      } catch {
        /* default */
      }

      let body = sanitizeMarkdown(item.page.markdown);
      body = rewriteLinks(body, {
        siteOrigin,
        currentRelPath: item.relPath,
        pathMap,
      });
      if (!body.endsWith('\n')) body += '\n';

      const content = buildFrontmatter(item.page) + body;
      await fs.mkdir(path.dirname(item.absPath), { recursive: true });
      await fs.writeFile(item.absPath, content, 'utf-8');
      count++;
    }

    return count;
  }
}
