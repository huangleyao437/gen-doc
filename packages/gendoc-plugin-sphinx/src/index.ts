import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import type { FrameworkPlugin, PageContext, DetectionResult, NavNode, ExtractedPage } from 'gendoc-core';
import { cleanSphinxContent } from './dom-clean.js';
import { mapSphinxComponents } from './component-map.js';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
});
turndown.use(gfm);

export const sphinxPlugin: FrameworkPlugin = {
  name: 'sphinx',
  version: '0.1.0',

  async detect(page: PageContext): Promise<DetectionResult | null> {
    const html = page.html;
    const $ = page.$;

    // 注释 / 文案中的 "Sphinx x.y.z"（如 Furo 生成页）
    const sphinxVer = html.match(/Sphinx\s+([\d.]+)/i);
    if (sphinxVer) {
      return { framework: 'sphinx', confidence: 0.95, version: sphinxVer[1] };
    }

    // Jupyter Book / PyData Sphinx Theme 资源
    if (
      /sphinx-book-theme|pydata-sphinx-theme|jupyter-book/i.test(html) ||
      $('link[href*="sphinx-book-theme"], link[href*="pydata-sphinx-theme"]').length > 0
    ) {
      return { framework: 'sphinx', confidence: 0.9 };
    }

    // Furo 主题样式或侧栏 + toctree
    if (
      /furo\.css|furo-extensions/i.test(html) ||
      ($('.sidebar-tree, .sidebar-drawer').length > 0 && $('.toctree-l1').length > 0)
    ) {
      return { framework: 'sphinx', confidence: 0.88 };
    }

    // Sphinx 运行时全局配置
    if (html.includes('DOCUMENTATION_OPTIONS') || html.includes('DocumentationOptions')) {
      return { framework: 'sphinx', confidence: 0.8 };
    }

    // 弱信号：toctree / bd-sidenav + article
    const hasToc = $('.toctree-l1, .bd-sidenav').length > 0;
    const hasArticle = $('article, .bd-article, [itemprop="articleBody"]').length > 0;
    if (hasToc && hasArticle) {
      return { framework: 'sphinx', confidence: 0.75 };
    }

    return null;
  },

  async getNavTree(page: PageContext): Promise<NavNode[]> {
    const $ = page.$;
    let $root = $('.sidebar-tree').first();
    if ($root.length === 0) {
      $root = $('nav.bd-docs-nav, #bd-docs-nav, .bd-sidenav').first();
    }
    if ($root.length === 0) {
      // 取第一个含 toctree-l1 的容器
      const $li = $('li.toctree-l1').first();
      $root = $li.length ? $li.parent() : $();
    }
    if ($root.length === 0) return [];

    const pageOrigin = (() => {
      try {
        return new URL(page.url).origin;
      } catch {
        return '';
      }
    })();

    /** 跨域 / mailto / 纯 hash / javascript 视为外链，跳过；同站绝对 path 与相对 path 保留 */
    function isExternal(href: string): boolean {
      if (!href || href === '#' || href.startsWith('mailto:') || href.startsWith('javascript:')) {
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
     * 递归解析 ul 下的 li.toctree-l*：
     * - 优先取 a.reference.internal（及任意 a）作为节点
     * - 子 ul 递归为 children
     * - 外链叶子丢弃；过滤后无 children 的空分组丢弃
     */
    function parseList($ul: ReturnType<typeof $>): NavNode[] {
      const nodes: NavNode[] = [];
      $ul.children('li').each((_, li) => {
        const $li = $(li);
        // 直接子链接（避免误取嵌套 li 内的 a）
        const $a = $li.children('a').first();
        const title = normalizeText($a.text());
        const href = ($a.attr('href') || '').trim();

        const $sub = $li.children('ul').first();
        const children = $sub.length > 0 ? parseList($sub) : [];

        if (!href || isExternal(href)) {
          // 无有效内链：有子节点则当分组（无 path）
          if (children.length === 0) return;
          if (!title) {
            nodes.push(...children);
            return;
          }
          nodes.push({ title, path: '', children });
          return;
        }

        if (!title) return;

        nodes.push({
          title,
          path: href,
          children: children.length > 0 ? children : undefined,
        });
      });
      return nodes;
    }

    const result: NavNode[] = [];
    const children = $root.children().toArray();
    let i = 0;
    while (i < children.length) {
      const el = children[i]!;
      const $el = $(el);
      const tag = (el as { tagName?: string; name?: string }).tagName ||
        (el as { name?: string }).name ||
        '';

      // caption 开组，紧随的 ul 为其 children
      if ($el.is('p.caption') || ($el.is('p') && $el.hasClass('caption'))) {
        const captionTitle =
          normalizeText($el.find('.caption-text').first().text()) ||
          normalizeText($el.text());
        // 跳过 caption 后空白，取紧随 ul
        let j = i + 1;
        while (j < children.length) {
          const next = children[j]!;
          const $next = $(next);
          const nextTag =
            (next as { tagName?: string; name?: string }).tagName ||
            (next as { name?: string }).name ||
            '';
          // 跳过非元素节点（text/comment）
          if (!nextTag || nextTag === '#text' || nextTag === '#comment') {
            j += 1;
            continue;
          }
          if ($next.is('ul')) {
            const groupChildren = parseList($next);
            // 外链滤空后无 children 则不输出该 caption 组
            if (groupChildren.length > 0 && captionTitle) {
              result.push({ title: captionTitle, path: '', children: groupChildren });
            }
            i = j + 1;
            break;
          }
          // 紧随不是 ul：结束本 caption 处理
          i = j;
          break;
        }
        if (j >= children.length) {
          i = j;
        }
        continue;
      }

      if ($el.is('ul') || tag.toLowerCase() === 'ul') {
        result.push(...parseList($el));
        i += 1;
        continue;
      }

      // Book: 中间层 div.bd-toc-item 等，递归找顶层 ul
      if ($el.is('div') || tag.toLowerCase() === 'div') {
        const $innerUl = $el.find('> ul, ul.bd-sidenav, ul.nav').first();
        if ($innerUl.length > 0) {
          result.push(...parseList($innerUl));
        }
        i += 1;
        continue;
      }

      i += 1;
    }

    // 若按子节点未解析出内容，退化为在 root 内找第一个 ul
    if (result.length === 0) {
      const $fallbackUl = $root.is('ul')
        ? $root
        : $root.find('ul.bd-sidenav, ul.nav, ul').first();
      if ($fallbackUl.length > 0) {
        return parseList($fallbackUl);
      }
    }

    return result;
  },


  async extractContent(page: PageContext): Promise<ExtractedPage> {
    void cleanSphinxContent;
    void mapSphinxComponents;
    void turndown;
    return { url: page.url, title: '', markdown: '', frontmatter: {} };
  },
};
