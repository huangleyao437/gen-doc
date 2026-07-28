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

  async getNavTree(_page: PageContext): Promise<NavNode[]> {
    return [];
  },

  async extractContent(page: PageContext): Promise<ExtractedPage> {
    void cleanSphinxContent;
    void mapSphinxComponents;
    void turndown;
    return { url: page.url, title: '', markdown: '', frontmatter: {} };
  },
};
