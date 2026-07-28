import type { CheerioAPI } from 'cheerio';

/**
 * 移除内容根内的 VitePress chrome 与装饰 UI（原地修改 DOM）。
 */
export function cleanVitePressContent($: CheerioAPI, $content: ReturnType<CheerioAPI>): void {
  $content
    .find(
      [
        '.VPNav',
        '.VPSidebar',
        '.VPLocalNav',
        '.VPDocAside',
        '.aside',
        '.VPDocFooter',
        '.prev-next',
        '.pager',
        '.VPDocOutline',
        '.outline',
        '[class*="aside-outline"]',
        '.VPSponsors',
        '.vp-sponsor',
        '.VPCarbonAds',
        '[class*="sponsor"]',
        '.edit-link',
        '.last-updated',
        'button.copy',
        '.vp-copy',
        'span.lang',
        '.line-numbers-wrapper',
        '.line-numbers-mode > .line-numbers-wrapper',
      ].join(', '),
    )
    .remove();

  $content.find('h1, h2, h3, h4, h5, h6').each((_, el) => {
    $(el).find('a.header-anchor, a.anchor, a[aria-hidden="true"]').remove();
  });
}
