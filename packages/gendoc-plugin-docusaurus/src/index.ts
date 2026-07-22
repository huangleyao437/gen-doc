import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import type { FrameworkPlugin, PageContext, DetectionResult, NavNode, ExtractedPage } from 'gendoc-core';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
});

turndown.use(gfm);

export const docusaurusPlugin: FrameworkPlugin = {
  name: 'docusaurus',
  version: '0.1.0',

  async detect(page: PageContext): Promise<DetectionResult | null> {
    const $ = page.$;

    // Method 1: Check meta generator tag
    const generator = $('meta[name="generator"]').attr('content') || '';
    const match = generator.match(/Docusaurus\s*v?(\d+\.\d+\.\d+)?/i);
    if (match) {
      return {
        framework: 'docusaurus',
        confidence: 0.95,
        version: match[1] || undefined,
      };
    }

    // Method 2: Check for Docusaurus-specific CSS classes
    if ($('nav.menu').length > 0 && $('ul.menu__list').length > 0) {
      return { framework: 'docusaurus', confidence: 0.7 };
    }

    // Method 3: Check for __docusaurus in scripts
    const scripts = $('script').text();
    if (scripts.includes('__docusaurus')) {
      return { framework: 'docusaurus', confidence: 0.9 };
    }

    return null;
  },

  async getNavTree(page: PageContext): Promise<NavNode[]> {
    const $ = page.$;

    // Primary: parse .menu__list sidebar
    const menuLists = $('nav.menu > ul.menu__list');
    if (menuLists.length > 0) {
      return parseMenuList($, menuLists.first());
    }

    // Fallback: parse any .menu__list
    const anyMenu = $('ul.menu__list');
    if (anyMenu.length > 0) {
      return parseMenuList($, anyMenu.first());
    }

    return [];

    function parseMenuList($: PageContext['$'], ul: ReturnType<PageContext['$']>): NavNode[] {
      const nodes: NavNode[] = [];
      ul.children('li.menu__list-item').each((_, li) => {
        const $li = $(li);
        const $link = $li.children('a.menu__link').first();
        const title = $link.text().trim();
        const href = $link.attr('href') || '';

        const $subList = $li.children('ul.menu__list');
        const children = $subList.length > 0 ? parseMenuList($, $subList) : undefined;

        // Skip category nodes that have no direct href but have children
        if (!href || href === '#') {
          if (children) {
            nodes.push({ title, path: '', children });
          }
          return;
        }

        nodes.push({ title, path: href, children });
      });
      return nodes;
    }
  },

  async extractContent(page: PageContext): Promise<ExtractedPage> {
    const $ = page.$;

    // Primary content selectors (fallback chain)
    const selectors = [
      'article',
      'main article',
      'main .theme-doc-markdown',
      '.markdown',
      'main',
    ];

    let $content = null;
    for (const sel of selectors) {
      const match = $(sel);
      if (match.length > 0 && match.text().trim().length > 50) {
        $content = match.first();
        break;
      }
    }

    // Ultimate fallback
    if (!$content) {
      $content = $('body');
    }

    // Remove nav elements within content area
    $content.find('nav, .theme-doc-toc-desktop, .theme-doc-toc-mobile').remove();

    // Extract title
    const title =
      $content.find('h1').first().text().trim() ||
      $('title').text().replace(/\s*\|.*$/, '').trim() ||
      '';

    // Strip syntax highlighting spans from code blocks, preserving language class.
    // Inject newlines before line-level spans (Prism.js token-line, Shiki line)
    // so that cheerio .text() produces proper multi-line output.
    $content.find('pre code').each((_, el) => {
      const $el = $(el);
      $el.find('span.token-line, span.line').each((_, span) => {
        $(span).before('\n');
      });
      const text = $el.text();
      $el.empty().text(text);
    });

    // Convert HTML to Markdown
    const html = $content.html() || '';
    const markdown = turndown.turndown(html);

    // Extract frontmatter from meta tags
    const description = $('meta[name="description"]').attr('content') || '';
    const frontmatter: Record<string, unknown> = {};
    if (description) {
      frontmatter.description = description;
    }

    return { url: page.url, title, markdown, frontmatter };
  },
};
