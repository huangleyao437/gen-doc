import type { CheerioAPI } from 'cheerio';

const LOCALE_LABELS = new Set([
  'english',
  '中文',
  '日本語',
  'japanese',
  'chinese',
  'en',
  'zh',
  'zh-cn',
  'zh-tw',
  'ja',
  'ko',
  'fr',
  'de',
  'es',
  'ru',
]);

function isLocaleLabel(text: string): boolean {
  const t = text.trim().toLowerCase();
  return LOCALE_LABELS.has(t);
}

/**
 * 移除内容根节点内的 Docusaurus chrome 与噪声 UI（原地修改 DOM）。
 */
export function cleanDocusaurusContent($: CheerioAPI, $content: ReturnType<CheerioAPI>): void {
  $content
    .find(
      [
        'nav',
        '.theme-doc-toc-desktop',
        '.theme-doc-toc-mobile',
        '.theme-last-updated',
        '.theme-doc-footer',
        '.pagination-nav',
        '.navbar',
        '.navbar__items',
      ].join(', '),
    )
    .remove();

  $content.find('h1, h2, h3, h4, h5, h6').each((_, el) => {
    $(el).find('a.hash-link, a[aria-hidden="true"]').remove();
  });

  // 启发式：子项几乎都是语言切换链接的短列表。
  // 仅用标签文本判定（isLocaleLabel），不因 href 含 /zh-CN/、/en/ 等路径段就计为语言切换，
  // 避免误删 i18n 站点上普通中文文档链接列表（如 Doris 侧栏/正文目录）。
  $content.find('ul, ol').each((_, list) => {
    const $list = $(list);
    const $items = $list.children('li');
    if ($items.length < 2 || $items.length > 8) return;
    let localeLike = 0;
    $items.each((__, li) => {
      const text = $(li).text().replace(/\s+/g, ' ').trim();
      if (isLocaleLabel(text)) {
        localeLike += 1;
      }
    });
    if (localeLike >= Math.ceil($items.length * 0.75)) {
      $list.remove();
    }
  });
}
