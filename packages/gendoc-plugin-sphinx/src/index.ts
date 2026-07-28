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
     * - 优先取直接子 a 作为节点
     * - 子 ul：直接子 ul，或 PyData/Book 的 details > ul
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

        // Book Theme：子树常包在 <details><summary/><ul>...</ul></details>
        const $sub =
          $li.children('ul').first().length > 0
            ? $li.children('ul').first()
            : $li.children('details').children('ul').first();
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

    function elementTag(el: unknown): string {
      const t =
        (el as { tagName?: string; name?: string }).tagName ||
        (el as { name?: string }).name ||
        '';
      return String(t).toLowerCase();
    }

    /**
     * 解析容器直接子节点：caption+ul 分组、裸 ul、嵌套 div（bd-toc-item 等）
     */
    function parseContainer($container: ReturnType<typeof $>): NavNode[] {
      const out: NavNode[] = [];
      const kids = $container.children().toArray();
      let i = 0;
      while (i < kids.length) {
        const el = kids[i]!;
        const $el = $(el);
        const tag = elementTag(el);

        // caption 开组，紧随的 ul 为其 children
        if ($el.is('p.caption') || ($el.is('p') && $el.hasClass('caption'))) {
          const captionTitle =
            normalizeText($el.find('.caption-text').first().text()) ||
            normalizeText($el.text());
          let j = i + 1;
          while (j < kids.length) {
            const next = kids[j]!;
            const $next = $(next);
            const nextTag = elementTag(next);
            if (!nextTag || nextTag === '#text' || nextTag === '#comment') {
              j += 1;
              continue;
            }
            if ($next.is('ul') || nextTag === 'ul') {
              const groupChildren = parseList($next);
              if (groupChildren.length > 0 && captionTitle) {
                out.push({ title: captionTitle, path: '', children: groupChildren });
              }
              i = j + 1;
              break;
            }
            i = j;
            break;
          }
          if (j >= kids.length) {
            i = j;
          }
          continue;
        }

        if ($el.is('ul') || tag === 'ul') {
          out.push(...parseList($el));
          i += 1;
          continue;
        }

        // Book: 中间层 div.bd-toc-item 等，递归解析其 caption/ul 子树
        if ($el.is('div') || tag === 'div') {
          out.push(...parseContainer($el));
          i += 1;
          continue;
        }

        i += 1;
      }
      return out;
    }

    let result = parseContainer($root);

    // 若 root 自身是 ul
    if (result.length === 0 && ($root.is('ul') || elementTag($root.get(0)) === 'ul')) {
      result = parseList($root);
    }

    // 退化为在 root 内找第一个 ul
    if (result.length === 0) {
      const $fallbackUl = $root.find('ul.bd-sidenav, ul.nav, ul').first();
      if ($fallbackUl.length > 0) {
        return parseList($fallbackUl);
      }
    }

    return result;
  },


  async extractContent(page: PageContext): Promise<ExtractedPage> {
    const $ = page.$;

    const selectors = [
      'article[role="main"]',
      '.bd-article',
      'div.bd-article',
      '.article-container article',
      'article',
      'main .body',
      'div[itemprop="articleBody"]',
      'main',
      'body',
    ];

    let $content: ReturnType<typeof $> | null = null;
    for (const sel of selectors) {
      const match = $(sel);
      if (match.length > 0 && match.text().trim().length > 50) {
        $content = match.first();
        break;
      }
    }
    // 短页面放宽长度阈值
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

    cleanSphinxContent($, $content);
    mapSphinxComponents($, $content);

    const title =
      $content.find('h1').first().text().replace(/\s+/g, ' ').trim() ||
      $('title')
        .text()
        .replace(/\s*[—–\-|].*$/, '')
        .trim() ||
      '';

    // Sphinx highlight-* / 代码块：语言 class 落到 code，保证 pre>code 结构供 turndown fenced
    $content.find('div.highlight, pre').each((_, node) => {
      const $node = $(node);
      const $pre = $node.is('pre') ? $node : $node.find('pre').first();
      if ($pre.length === 0) return;
      // 已处理过的 pre 跳过（div.highlight 与其内 pre 都会匹配）
      if ($pre.attr('data-gendoc-code') === '1') return;

      const $codeEl = $pre.find('code').first();
      const preClass = $pre.attr('class') || '';
      const codeClass = $codeEl.attr('class') || '';
      // 合并自身与祖先 class（highlight-bash 常在 .highlight 的父级）
      const ancestorCls = $pre
        .parents()
        .map((__, p) => $(p).attr('class') || '')
        .get()
        .join(' ');
      const classPool = [$node.attr('class') || '', preClass, codeClass, ancestorCls].join(' ');

      let lang: string | undefined;
      const langMatch =
        classPool.match(/highlight-(\w[\w+-]*)/) || classPool.match(/language-(\S+)/);
      if (langMatch) {
        const raw = langMatch[1]!.toLowerCase();
        lang = raw.startsWith('ipython') ? 'python' : raw === 'default' ? 'text' : raw;
      }

      // 行级 span 压平为纯文本
      let text: string;
      if ($codeEl.length > 0) {
        const $lines = $codeEl.find('span.line, span.token-line');
        if ($lines.length > 0) {
          text = $lines
            .map((__, span) => $(span).text())
            .get()
            .join('\n');
        } else {
          text = $codeEl.text();
        }
      } else {
        text = $pre.text();
      }

      // 重建 pre>code，去掉 Pygments 空 span 等干扰（否则 turndown 不认 fenced）
      const $newCode = $('<code></code>');
      $newCode.text(text);
      if (lang) {
        $newCode.attr('class', `language-${lang}`);
      } else if (codeClass.includes('language-')) {
        $newCode.attr('class', codeClass);
      }
      $pre.empty().append($newCode);
      $pre.attr('data-gendoc-code', '1');
    });

    // 再次清掉可能残留的 copy 按钮
    $content.find('button.copy, button.copybtn, .copybtn, span.lang').remove();

    const html = $content.html() || '';
    const markdown = turndown.turndown(html);

    const description = $('meta[name="description"]').attr('content') || '';
    const frontmatter: Record<string, unknown> = {};
    if (description) frontmatter.description = description;

    return { url: page.url, title, markdown, frontmatter };
  },
};

