import type { CheerioAPI } from 'cheerio';

/**
 * 移除 Sphinx 内容根内的 chrome / 装饰 UI（原地修改 DOM）。
 */
export function cleanSphinxContent($: CheerioAPI, $content: ReturnType<CheerioAPI>): void {
  $content
    .find(
      [
        // 导航 / 页眉
        '.bd-header',
        '.bd-header-article',
        '.docs-site-header',
        '.sidebar-drawer',
        '.bd-sidebar',
        '.bd-sidebar-primary',
        '.bd-sidebar-secondary',
        '.related',
        // 页脚 / 翻页
        'footer',
        '.bd-footer',
        '.bd-footer-article',
        '.related-pages',
        '.prev-next',
        '.prev-next-area',
        // 页内 TOC
        '.bd-toc',
        '.toc-drawer',
        '.tocsection',
        'nav.onthispage',
        'nav.page-toc',
        'nav.toc-tree',
        // 工具
        '.headerlink',
        'a.headerlink',
        '.copybtn',
        'button.copybutton',
        'button.copybtn',
        '.toggle-button',
        // 搜索 / 主题 / 版本
        '.bd-search',
        '.theme-toggle',
        '.theme-toggle-container',
        '.version-switcher',
        '.version-switcher__container',
        // 其它元信息
        '.editthispage',
        '.page-info',
      ].join(', '),
    )
    .remove();

  // 标题内的 headerlink / 隐藏锚点
  $content.find('h1, h2, h3, h4, h5, h6').each((_, el) => {
    $(el).find('a.headerlink, a.anchor, a[aria-hidden="true"]').remove();
  });
}
