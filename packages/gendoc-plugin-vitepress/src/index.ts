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

    /**
     * 递归解析单个 VPSidebarItem：
     * - is-link：叶子链接（跳过外链）
     * - 非 link：分组，递归其直接子 .items > .VPSidebarItem
     * - 过滤后无 path 且无 children 的分组丢弃
     */
    function parseSidebarItem($item: ReturnType<typeof $>): NavNode | null {
      const isLink = $item.hasClass('is-link');
      const $a = $item.find('> .item a.VPLink').first();

      let title = '';
      let path = '';

      if ($a.length > 0) {
        path = ($a.attr('href') || '').trim();
        title =
          normalizeText($a.find('.text').first().text()) ||
          normalizeText($a.text());
      } else {
        title =
          normalizeText(
            $item.find('> .item h2.text, > .item .text, > .item p.text').first().text(),
          ) ||
          normalizeText($item.children('.item').find('.text').first().text());
      }

      // 直接子 items 中的 VPSidebarItem（含嵌套分组与链接）
      const children: NavNode[] = [];
      $item.children('.items').children('.VPSidebarItem').each((_, childEl) => {
        const child = parseSidebarItem($(childEl));
        if (child) children.push(child);
      });

      if (isLink || path) {
        if (!path || path === '#') {
          // 无有效 href 时若有子节点则当分组处理，否则丢弃
          if (children.length === 0) return null;
          if (!title) return null;
          return { title, path: '', children };
        }
        if (isExternalLink(path)) return null;
        if (!title) return null;
        return {
          title,
          path,
          children: children.length > 0 ? children : undefined,
        };
      }

      // 纯分组：过滤后无 children 则丢弃（含外链滤空的 level-0）
      if (children.length === 0) return null;
      if (!title) {
        // 无标题时不造空壳节点，由调用方决定是否展开
        return { title: '', path: '', children };
      }
      return { title, path: '', children };
    }

    function parseItems($container: ReturnType<typeof $>): NavNode[] {
      const nodes: NavNode[] = [];

      // 顶层分组：直接子树中的 level-0
      const $groups = $container.find('> .group > .VPSidebarItem.level-0, > .VPSidebarItem.level-0');
      const $scope = $groups.length > 0 ? $groups : $container.find('.VPSidebarItem.level-0');

      $scope.each((_, section) => {
        const node = parseSidebarItem($(section));
        if (!node) return;
        if (!node.title && node.children?.length) {
          nodes.push(...node.children);
          return;
        }
        // 无 path 且无 children 已在 parseSidebarItem 丢弃；此处再保险一次
        if (!node.path && (!node.children || node.children.length === 0)) return;
        nodes.push(node);
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
    const $ = page.$;

    const selectors = [
      'main .vp-doc',
      '.VPDoc .vp-doc',
      '.vp-doc',
      'main.main',
      '#VPContent',
      'main',
    ];

    let $content: ReturnType<typeof $> | null = null;
    for (const sel of selectors) {
      const match = $(sel);
      if (match.length > 0 && match.text().trim().length > 50) {
        $content = match.first();
        break;
      }
    }
    // 短页面（如仅 code-group 测试）放宽长度阈值
    if (!$content) {
      for (const sel of selectors) {
        const match = $(sel);
        if (match.length > 0 && match.text().trim().length > 0) {
          $content = match.first();
          break;
        }
      }
    }
    if (!$content) {
      $content = $('body');
    }

    cleanVitePressContent($, $content);
    mapVitePressComponents($, $content);

    const title =
      $content.find('h1').first().text().trim() ||
      $('title').text().replace(/\s*\|.*$/, '').trim() ||
      '';

    // Shiki / 代码块预处理：语言 class 落到 code，行节点注入换行后压平为纯文本
    $content.find('pre').each((_, pre) => {
      const $pre = $(pre);
      const $code = $pre.find('code').first();
      if ($code.length === 0) return;

      const preClass = $pre.attr('class') || '';
      const codeClass = $code.attr('class') || '';
      const langMatch =
        preClass.match(/language-(\S+)/) ||
        ($pre.closest('[class*="language-"]').attr('class') || '').match(/language-(\S+)/);
      if (langMatch && !codeClass.includes('language-')) {
        $code.attr('class', `${codeClass} language-${langMatch[1]}`.trim());
      }

      // Shiki 用 span.line 分行；真实 HTML 行间常已有空白换行，
      // 若再 before('\n') 再取 text 会得到空行，故直接按行节点 join。
      const $lines = $code.find('span.line, span.token-line');
      let text: string;
      if ($lines.length > 0) {
        text = $lines
          .map((__, span) => $(span).text())
          .get()
          .join('\n');
      } else {
        text = $code.text();
      }
      $code.empty().text(text);
    });

    // 去掉 language 容器上残留 copy 按钮（若 clean 未覆盖）
    $content.find('button.copy, span.lang').remove();

    const html = $content.html() || '';
    const markdown = turndown.turndown(html);

    const description = $('meta[name="description"]').attr('content') || '';
    const frontmatter: Record<string, unknown> = {};
    if (description) frontmatter.description = description;

    return { url: page.url, title, markdown, frontmatter };
  },
};
