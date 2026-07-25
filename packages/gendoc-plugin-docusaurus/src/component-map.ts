import type { CheerioAPI } from 'cheerio';

/**
 * 将 Docusaurus 组件（DocCard / Admonition / Tabs）映射为语义化 HTML，
 * 便于 turndown 输出可读 Markdown。
 */
export function mapDocusaurusComponents($: CheerioAPI, $content: ReturnType<CheerioAPI>): void {
  // 隐藏的 tabpanel 在映射前解除 hidden，避免下游忽略
  $content.find('[role="tabpanel"]').removeAttr('hidden');

  mapCards($, $content);
  mapAdmonitions($, $content);
  mapTabs($, $content);
}

function mapCards($: CheerioAPI, $content: ReturnType<CheerioAPI>): void {
  const $cards = $content.find('a.card, a[class*="cardContainer"]');
  if ($cards.length === 0) return;

  $cards.each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href') || '#';
    const title =
      $a.find('h1,h2,h3,h4,h5,h6').first().text().trim() ||
      $a.text().replace(/\s+/g, ' ').trim();
    const desc = $a.find('p').first().text().trim();
    const $li = $('<li></li>');
    const $link = $('<a></a>').attr('href', href).text(title);
    $li.append($link);
    if (desc) $li.append(` — ${desc}`);
    $a.replaceWith($li);
  });

  // 若 li 父节点不是 ul/ol，则包一层 ul
  $content.find('li').each((_, li) => {
    const parent = $(li).parent();
    const tag = parent.length ? parent.get(0)?.tagName?.toLowerCase() : '';
    if (tag !== 'ul' && tag !== 'ol') {
      const $ul = $('<ul></ul>');
      $(li).before($ul);
      $ul.append(li);
    }
  });
}

function mapAdmonitions($: CheerioAPI, $content: ReturnType<CheerioAPI>): void {
  $content.find('.theme-admonition, .admonition, [class*="admonition"]').each((_, el) => {
    const $el = $(el);
    // 已从 DOM 摘除或为嵌套子节点时跳过
    if (!$el.parent().length) return;
    // 仅处理容器本身：若祖先已是 admonition 容器则跳过（避免 heading/content 子节点）
    if ($el.parents('.theme-admonition, .admonition').length > 0) return;
    // class 仅含 admonitionHeading / admonitionContent 的内层节点
    const cls = ($el.attr('class') || '').toLowerCase();
    if (/admonition(heading|content)/i.test(cls) && !$el.hasClass('theme-admonition') && !$el.hasClass('admonition')) {
      return;
    }

    let type = 'NOTE';
    for (const t of ['danger', 'warning', 'caution', 'tip', 'info', 'note', 'important']) {
      if (cls.includes(t)) {
        type = t.toUpperCase();
        break;
      }
    }
    const bodyHtml =
      $el.find('[class*="admonitionContent"]').html() ||
      $el.find('.admonition-content').html() ||
      $el.html() ||
      '';
    const $bq = $('<blockquote></blockquote>');
    $bq.append($('<p></p>').html(`<strong>${type}:</strong>`));
    $bq.append(bodyHtml);
    $el.replaceWith($bq);
  });
}

function mapTabs($: CheerioAPI, $content: ReturnType<CheerioAPI>): void {
  $content.find('.tabs-container').each((_, container) => {
    const $c = $(container);
    const labels: string[] = [];
    $c.find('[role="tab"], .tabs__item').each((__, tab) => {
      labels.push($(tab).text().replace(/\s+/g, ' ').trim());
    });
    const panels = $c.find('[role="tabpanel"]').toArray();
    const $frag = $('<div class="gendoc-tabs"></div>');
    labels.forEach((label, i) => {
      if (!label) return;
      $frag.append($('<h3></h3>').text(label));
      if (panels[i]) {
        $frag.append($(panels[i]).contents().clone());
      }
    });
    // 若无 role=tabpanel，尝试 .margin-top--md 下的子 div
    if (panels.length === 0) {
      if ($frag.children().length === 0) return;
    }
    $c.replaceWith($frag);
  });
}
