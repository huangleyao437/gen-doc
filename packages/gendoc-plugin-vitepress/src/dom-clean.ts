import type { CheerioAPI } from 'cheerio';

/**
 * 移除内容根内的 VitePress chrome、站内推广与装饰 UI（原地修改 DOM）。
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
        // Pinia 等站：正文内 RuleKit 赞助卡（非 VPSponsors class，会 turndown 成破碎链接）
        '.rulekit',
        '[class*="rulekit"]',
        'a.rulekit-link',
        // 翻译同步状态条（非正文）
        '.text-status',
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

  // 正文内 rel=sponsored 的推广链（如 RuleKit），不保留到 Markdown
  $content.find('a[rel~="sponsored"]').remove();

  $content.find('h1, h2, h3, h4, h5, h6').each((_, el) => {
    $(el).find('a.header-anchor, a.anchor, a[aria-hidden="true"]').remove();
  });
}
