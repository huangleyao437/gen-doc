import type { CheerioAPI } from 'cheerio';

/**
 * 将 VitePress 组件映射为语义化 HTML，便于 turndown。
 */
export function mapVitePressComponents($: CheerioAPI, $content: ReturnType<CheerioAPI>): void {
  $content.find('[hidden]').removeAttr('hidden');
  mapCustomBlocks($, $content);
  mapCodeGroups($, $content);
  mapBadges($, $content);
}

/**
 * custom-block → blockquote（data-type + 粗体标题），不产出 MDX ::: tip。
 * 类型仅按 class token 精确匹配。
 */
function mapCustomBlocks($: CheerioAPI, $content: ReturnType<CheerioAPI>): void {
  $content.find('.custom-block').each((_, el) => {
    const $el = $(el);
    if (!$el.parent().length) return;
    if ($el.parents('.custom-block').length > 0) return;

    const cls = ($el.attr('class') || '').toLowerCase();
    const tokens = cls.split(/\s+/).filter(Boolean);
    let type = 'NOTE';
    for (const t of ['danger', 'warning', 'caution', 'tip', 'info', 'note', 'details', 'important']) {
      if (tokens.includes(t)) {
        type = t.toUpperCase();
        break;
      }
    }

    const titleText =
      $el.find('> .custom-block-title, > summary, .custom-block-title').first().text().trim() || type;

    const $titleEl = $el.find('> .custom-block-title, > summary').first();
    if ($titleEl.length) $titleEl.remove();

    const bodyHtml = $el.html() || '';
    const $bq = $('<blockquote class="gendoc-custom-block"></blockquote>');
    $bq.attr('data-type', type.toLowerCase());
    $bq.append($('<p></p>').html(`<strong>${titleText}</strong>`));
    $bq.append(bodyHtml);
    $el.replaceWith($bq);
  });
}

/**
 * vp-code-group → 顺序 h3 标题 + 各 tab 代码块内容。
 */
function mapCodeGroups($: CheerioAPI, $content: ReturnType<CheerioAPI>): void {
  $content.find('.vp-code-group, [class*="code-group"]').each((_, container) => {
    const $c = $(container);
    const labels: string[] = [];
    $c.find('.tabs label, [role="tab"]').each((__, lab) => {
      const t = $(lab).text().replace(/\s+/g, ' ').trim();
      if (t) labels.push(t);
    });

    const blockEls =
      $c.find('> .blocks > div').length > 0
        ? $c.find('> .blocks > div').toArray()
        : $c.find('.blocks > div').toArray();

    if (blockEls.length === 0) return;

    const $frag = $('<div class="gendoc-code-group"></div>');
    blockEls.forEach((block, i) => {
      const label = labels[i] || `Tab ${i + 1}`;
      $frag.append($('<h3></h3>').text(label));
      $frag.append($(block).contents().clone());
    });
    $c.replaceWith($frag);
  });
}

/**
 * Badge 压成纯文本节点。
 */
function mapBadges($: CheerioAPI, $content: ReturnType<CheerioAPI>): void {
  $content.find('.VPBadge, span.badge').each((_, el) => {
    const $el = $(el);
    const text = $el.text().replace(/\s+/g, ' ').trim();
    $el.replaceWith(text);
  });
}
