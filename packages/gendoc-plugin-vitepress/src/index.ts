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

  async getNavTree(page: PageContext): Promise<NavNode[]> {
    const $ = page.$;
    const $root =
      $('aside.VPSidebar nav#VPSidebarNav').first().length > 0
        ? $('aside.VPSidebar nav#VPSidebarNav').first()
        : $('#VPSidebarNav').first().length > 0
          ? $('#VPSidebarNav').first()
          : $('.VPSidebar').first();

    if ($root.length === 0) return [];

    const pageOrigin = (() => {
      try {
        return new URL(page.url).origin;
      } catch {
        return '';
      }
    })();

    /** 跨域 / mailto / 纯 hash 视为外链，跳过；同站绝对 path 与相对 path 保留 */
    function isExternalLink(href: string): boolean {
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) {
        return true;
      }
      if (/^https?:\/\//i.test(href)) {
        try {
          return !pageOrigin || new URL(href).origin !== pageOrigin;
        } catch {
          return true;
        }
      }
      return false;
    }

    function normalizeText(raw: string): string {
      return raw.replace(/\s+/g, ' ').trim();
    }

    function parseItems($container: ReturnType<typeof $>): NavNode[] {
      const nodes: NavNode[] = [];

      // 顶层分组：直接子树中的 level-0
      const $groups = $container.find('> .group > .VPSidebarItem.level-0, > .VPSidebarItem.level-0');
      const $scope = $groups.length > 0 ? $groups : $container.find('.VPSidebarItem.level-0');

      $scope.each((_, section) => {
        const $section = $(section);
        const title =
          normalizeText(
            $section.find('> .item h2.text, > .item .text').first().text(),
          ) ||
          normalizeText($section.children('.item').find('.text').first().text());

        const children: NavNode[] = [];
        // 仅取分组下直接 items 中的链接项，避免嵌套重复
        const $linkItems = $section.children('.items').find('> .VPSidebarItem.is-link');
        const $links =
          $linkItems.length > 0
            ? $linkItems
            : $section.find('> .items .VPSidebarItem.level-1.is-link, > .items .VPSidebarItem.is-link');

        $links.each((__, linkItem) => {
          const $item = $(linkItem);
          const $a = $item.find('a.VPLink').first();
          if ($a.length === 0) return;
          const href = ($a.attr('href') || '').trim();
          const linkTitle =
            normalizeText($a.find('.text').first().text()) ||
            normalizeText($a.text());
          if (!linkTitle) return;
          if (!href || href === '#') return;
          if (isExternalLink(href)) return;
          children.push({ title: linkTitle, path: href });
        });

        if (!title && children.length === 0) return;
        if (!title) {
          nodes.push(...children);
          return;
        }
        nodes.push({
          title,
          path: '',
          children: children.length > 0 ? children : undefined,
        });
      });

      // 若没有 level-0 分组，退化为平铺所有 is-link
      if (nodes.length === 0) {
        $container.find('.VPSidebarItem.is-link a.VPLink').each((_, a) => {
          const $a = $(a);
          const href = ($a.attr('href') || '').trim();
          const linkTitle =
            normalizeText($a.find('.text').first().text()) ||
            normalizeText($a.text());
          if (!linkTitle || !href || href === '#') return;
          if (isExternalLink(href)) return;
          nodes.push({ title: linkTitle, path: href });
        });
      }

      return nodes;
    }

    return parseItems($root);
  },

  async extractContent(page: PageContext): Promise<ExtractedPage> {
    void cleanVitePressContent;
    void mapVitePressComponents;
    void turndown;
    return { url: page.url, title: '', markdown: '', frontmatter: {} };
  },
};
