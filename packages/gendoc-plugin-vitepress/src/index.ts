import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import type { FrameworkPlugin, PageContext, DetectionResult, NavNode, ExtractedPage } from 'gendoc-core';
import { cleanVitePressContent } from './dom-clean.js';
import { mapVitePressComponents } from './component-map.js';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
});
turndown.use(gfm);

export const vitepressPlugin: FrameworkPlugin = {
  name: 'vitepress',
  version: '0.1.0',

  async detect(page: PageContext): Promise<DetectionResult | null> {
    const $ = page.$;

    const generator = $('meta[name="generator"]').attr('content') || '';
    const match = generator.match(/VitePress\s*v?([\d.]+)?/i);
    if (match) {
      return {
        framework: 'vitepress',
        confidence: 0.95,
        version: match[1] || undefined,
      };
    }

    if (page.html.includes('__VP_HASH_MAP__') || $('script').text().includes('__VP_HASH_MAP__')) {
      return { framework: 'vitepress', confidence: 0.85 };
    }

    const hasSidebar = $('.VPSidebar, #VPSidebarNav').length > 0;
    const hasContent = $('.VPContent, .vp-doc').length > 0;
    if (hasSidebar && hasContent) {
      return { framework: 'vitepress', confidence: 0.7 };
    }

    return null;
  },

  async getNavTree(_page: PageContext): Promise<NavNode[]> {
    return [];
  },

  async extractContent(page: PageContext): Promise<ExtractedPage> {
    void cleanVitePressContent;
    void mapVitePressComponents;
    void turndown;
    return { url: page.url, title: '', markdown: '', frontmatter: {} };
  },
};
