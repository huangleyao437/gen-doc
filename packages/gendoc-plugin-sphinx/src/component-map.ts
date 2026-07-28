import type { CheerioAPI } from 'cheerio';

/**
 * 将 Sphinx 组件映射为语义化 HTML，便于 turndown。
 */
export function mapSphinxComponents($: CheerioAPI, $content: ReturnType<CheerioAPI>): void {
  // 隐藏 tab 面板在映射前解除 hidden
  $content.find('.sd-tab-content[hidden], [role="tabpanel"][hidden]').removeAttr('hidden');

  // docutils 表格单元格内单层 <p> 会破坏 GFM table 行，须先展开
  mapDocutilsTables($, $content);
  mapAdmonitions($, $content);
  mapSdCards($, $content);
  mapSdTabs($, $content);
  mapMystnb($, $content);
}

/**
 * Sphinx docutils 表格：每个 th/td 常包一层 <p>，turndown+gfm 会把 <p> 当块级元素
 * 插入换行，导致 `| cell |` 拆成多行碎表。若单元格「恰好一个元素子节点且为 p」，
 * 则展开该 p 的内容。多 p / 混有其它块级结构时不改动。
 */
function mapDocutilsTables($: CheerioAPI, $content: ReturnType<CheerioAPI>): void {
  $content.find('table').each((_, table) => {
    const $table = $(table);
    $table.find('th, td').each((__, cell) => {
      const $cell = $(cell);
      // 只看元素子节点，忽略空白文本
      const elementChildren = $cell
        .contents()
        .toArray()
        .filter((node) => node.type === 'tag');
      if (elementChildren.length !== 1) return;
      const only = elementChildren[0];
      if (!only || only.type !== 'tag') return;
      const tag = (only as { name?: string }).name?.toLowerCase() || '';
      if (tag !== 'p') return;
      const $p = $(only);
      $p.replaceWith($p.contents());
    });
  });
}

/**
 * Sphinx admonition → blockquote（> **NOTE** 形式）。
 */
function mapAdmonitions($: CheerioAPI, $content: ReturnType<CheerioAPI>): void {
  $content.find('.admonition, div[class*="admonition"]').each((_, el) => {
    const $el = $(el);
    if (!$el.parent().length) return;
    if ($el.parents('.admonition').length > 0) return;

    const cls = ($el.attr('class') || '').toLowerCase();
    // 跳过仅标题/内容子节点
    if (/admonition-(title|content)/i.test(cls) && !$el.hasClass('admonition')) {
      return;
    }

    let type = 'NOTE';
    const tokens = cls.split(/\s+/).filter(Boolean);
    for (const t of [
      'danger',
      'error',
      'warning',
      'caution',
      'attention',
      'important',
      'tip',
      'hint',
      'seealso',
      'note',
      'info',
    ]) {
      if (tokens.includes(t) || tokens.includes(`admonition-${t}`)) {
        type = t.toUpperCase();
        break;
      }
    }

    // 移除标题节点，正文保留
    $el.find('> .admonition-title, > p.admonition-title').remove();
    const bodyHtml = $el.html() || '';

    const $bq = $('<blockquote class="gendoc-admonition"></blockquote>');
    $bq.attr('data-type', type.toLowerCase());
    $bq.append($('<p></p>').html(`<strong>${type}</strong>`));
    $bq.append(bodyHtml);
    $el.replaceWith($bq);
  });
}

/**
 * sphinx-design cards → ul > li > a（同网格合并）。
 */
function mapSdCards($: CheerioAPI, $content: ReturnType<CheerioAPI>): void {
  const $cards = $content.find('.sd-card');
  if ($cards.length === 0) return;

  type CardEl = (typeof $cards)[0];
  const groups = new Map<unknown, CardEl[]>();
  const seen = new Set<unknown>();

  $cards.each((_, el) => {
    if (seen.has(el)) return;
    seen.add(el);
    // 优先按行/网格父级分组，避免每个 col 各自一列表
    const $el = $(el);
    const $grid =
      $el.closest('.sd-row, .sd-container-fluid, .sd-container, [class*="sd-row"]').first();
    const groupKey = $grid.length
      ? ('parent' in ($grid.get(0) as object)
          ? ($grid.get(0) as { parent?: unknown }).parent ?? $grid.get(0)
          : $grid.get(0))
      : 'parent' in el
        ? (el as { parent: unknown }).parent
        : null;
    const list = groups.get(groupKey) ?? [];
    list.push(el);
    groups.set(groupKey, list);
  });

  for (const [, els] of groups) {
    if (els.length === 0) continue;

    const $ul = $('<ul class="gendoc-sd-cards"></ul>');
    for (const el of els) {
      const $card = $(el);
      const $a = $card.find('a[href]').first();
      const href = ($a.attr('href') || '#').trim();
      const title =
        $card.find('.sd-card-title').first().text().replace(/\s+/g, ' ').trim() ||
        $a.text().replace(/\s+/g, ' ').trim() ||
        $card.find('h1,h2,h3,h4,h5,h6').first().text().replace(/\s+/g, ' ').trim();
      const desc =
        $card.find('.sd-card-text, .sd-card-body p').first().text().replace(/\s+/g, ' ').trim();

      if (!title && !href) continue;

      const $li = $('<li></li>');
      const $link = $('<a></a>').attr('href', href).text(title || href);
      $li.append($link);
      if (desc && desc !== title) $li.append(` — ${desc}`);
      $ul.append($li);
    }

    if ($ul.children().length === 0) continue;

    // 若有网格容器则替换整个网格，否则替换首卡并删同组其余
    const $first = $(els[0]!);
    const $grid = $first.closest('.sd-row, .sd-container-fluid, .sd-container').first();
    if ($grid.length && groups.size > 0) {
      // 同一 grid 内所有卡：替换最外层 row/container 中的第一个匹配容器
      const $replaceTarget =
        $first.closest('.sd-row').length > 0
          ? $first.closest('.sd-row')
          : $first.closest('.sd-col').length > 0
            ? $first.closest('.sd-col').parent()
            : $first;
      $replaceTarget.replaceWith($ul);
      // 同组其它卡已在被替换子树中，若仍在 DOM 则清理
      for (let i = 1; i < els.length; i++) {
        const $rest = $(els[i]!);
        if ($rest.parent().length) $rest.remove();
      }
    } else {
      $first.replaceWith($ul);
      for (let i = 1; i < els.length; i++) {
        $(els[i]!).remove();
      }
    }
  }
}

/**
 * sphinx-design tabs → h3 + 各 panel 内容。
 */
function mapSdTabs($: CheerioAPI, $content: ReturnType<CheerioAPI>): void {
  $content.find('.sd-tab-set').each((_, container) => {
    const $c = $(container);
    const labels: string[] = [];
    // label 紧随 radio input 之后
    $c.children('label').each((__, lab) => {
      const t = $(lab).text().replace(/\s+/g, ' ').trim();
      if (t) labels.push(t);
    });
    if (labels.length === 0) {
      $c.find('label, [role="tab"]').each((__, lab) => {
        const t = $(lab).text().replace(/\s+/g, ' ').trim();
        if (t) labels.push(t);
      });
    }

    const panels = $c.children('.sd-tab-content').toArray();
    const panelsFallback =
      panels.length > 0 ? panels : $c.find('.sd-tab-content, [role="tabpanel"]').toArray();

    if (panelsFallback.length === 0) return;

    const $frag = $('<div class="gendoc-sd-tabs"></div>');
    panelsFallback.forEach((panel, i) => {
      const label = labels[i] || `Tab ${i + 1}`;
      $frag.append($('<h3></h3>').text(label));
      $frag.append($(panel).contents().clone());
    });
    $c.replaceWith($frag);
  });
}

/**
 * mystnb 代码单元：输入/输出 → pre/code；去掉 prompt。
 */
function mapMystnb($: CheerioAPI, $content: ReturnType<CheerioAPI>): void {
  // 输入块
  $content.find('.cell_input, div.input, .nbinput').each((_, el) => {
    const $el = $(el);
    if (!$el.parent().length) return;
    if ($el.closest('.gendoc-mystnb-in').length) return;

    $el.find('.prompt, .gp').remove();

    let lang = 'python';
    const highlightCls =
      $el.find('[class*="highlight-"]').first().attr('class') ||
      $el.attr('class') ||
      '';
    const m = highlightCls.match(/highlight-(\w+)/) || highlightCls.match(/language-(\w+)/);
    if (m) {
      const raw = m[1]!.toLowerCase();
      // ipython3 → python
      lang = raw.startsWith('ipython') ? 'python' : raw === 'default' ? 'text' : raw;
    }

    const codeText =
      $el.find('pre code').first().text() ||
      $el.find('pre').first().text() ||
      $el.text();
    const text = codeText.replace(/\n$/, '');

    const $wrap = $('<div class="gendoc-mystnb-in"></div>');
    const $pre = $('<pre></pre>');
    const $code = $('<code></code>').attr('class', `language-${lang}`).text(text);
    $pre.append($code);
    $wrap.append($pre);
    $el.replaceWith($wrap);
  });

  // 输出块
  $content.find('.cell_output, div.output, .nboutput').each((_, el) => {
    const $el = $(el);
    if (!$el.parent().length) return;
    if ($el.closest('.gendoc-mystnb-out').length) return;

    $el.find('.prompt, .gp').remove();

    // 保留远程图片
    const $imgs = $el.find('img[src]').clone();
    const text =
      $el.find('pre').first().text() ||
      $el.find('.output, .text_plain, .stream').text() ||
      $el.text();
    const cleaned = text.replace(/\n$/, '').trim();

    const $wrap = $('<div class="gendoc-mystnb-out"></div>');
    if (cleaned) {
      const $pre = $('<pre></pre>');
      const $code = $('<code></code>').attr('class', 'language-text').text(cleaned);
      $pre.append($code);
      $wrap.append($pre);
    }
    $imgs.each((__, img) => {
      $wrap.append($(img));
    });
    if ($wrap.children().length === 0) {
      $el.remove();
      return;
    }
    $el.replaceWith($wrap);
  });
}
