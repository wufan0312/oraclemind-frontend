/**
 * 极简 Markdown → HTML（AI 服务输出受限格式：`#` 标题 / 段落 / **加粗** / *斜体* /
 * `-` 无序列表 / `1.` 有序列表 / `>` 引用 / `` `行内代码` ``）
 *
 * 为什么抽到这里：此前 bugua（shared.tsx）、dream、ming、tarot **各存一份实现**，
 * 共 4 份且能力不一致 —— 只有 ming 支持斜体，四份都不支持标题与有序列表，
 * 模型一旦输出「## 小结」或「1. 第一步」，页面就把井号、序号原样显示给用户。
 * 统一到 lib 后任何修正全站生效，不会再出现「改了一处、另外三处还是旧的」。
 *
 * 注意：输出直接进 dangerouslySetInnerHTML，必须先转义再还原行内标记，
 * 且只认白名单标签，绝不能放行原始 HTML。
 */
/**
 * 清洗 AI 输出中混入的结构化残留（全站渲染防线）。
 *
 * 背景：LLM 偶发输出「markdown 为主体、局部粘连 JSON/字段名残留」的混合体，
 * 后端整体 JSON 检测拦不住，会把 **Text**: / **Title**: 字段名、行尾 '}/'] 、
 * 字面 \n- 、独立 '], 行直接亮给用户。此处按窄规则摘除：
 * 只匹配「行首英文键名」「纯 ASCII 符号行」「引号紧邻括号」等正常中文正文
 * 不可能出现的形态，不会误伤内容。
 */
export function sanitizeAiText(md: string): string {
  let s = md ?? '';
  if (!s) return s;
  // ① 字面转义符 → 真换行（模型把 \n 当正文输出时，段落/列表会粘成一行）
  s = s.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\t/g, '  ');
  // ② Python repr 风格 '中文短语' → 「中文短语」（要求中文开头，英文缩写如 don't 不受影响）
  s = s.replace(/'([\u4e00-\u9fff][^'\n]{0,60}?)'/g, '「$1」');
  // ③ 字段名标签（多行；可选列表符 / 加粗标记包裹）：**Text**: / - **Title**: /
  //    **Outlook**: 等 → 剥掉标签、保留该行剩余正文。与后端 formatter 同规则。
  s = s.replace(
    /^[ \t]*(?:[-*]\s+)?\*{0,2}(?:text|title|outlook|summary|advice|consensus|cards|timeline|key[ _]?findings|divergences?|reason|score|label|name|type|content)\*{0,2}\s*[:：]\s*/gim,
    ''
  );
  // ③.5 独立成行的字段名占位符：模型偶发把 title 字段值写成 "title"，导致整行只剩
  // "title" / "**title**" / "- title"；正常中文正文不可能整行只有这些英文词，直接删除。
  s = s.replace(
    /^[ \t]*(?:[-*]\s+)?\*{0,2}(?:text|title|outlook|summary|advice|consensus|cards|timeline|key[ _]?findings|divergences?|reason|score|label|name|type|content)\*{0,2}[ \t]*$/gim,
    ''
  );
  // ④ JSON 风格对象 {...}（如 {"score": 85}）→ 删除
  s = s.replace(/\{[^{}]*\}/g, '');
  // ⑤ 纯符号行（仅含引号/括号/逗号/空白）→ 删除
  s = s.replace(/^[ \t]*['"\[\]{}(),][ \t'"\[\]{}(),]*$/gm, '');
  // ⑥ 引号/括号粘连残片（如 '] / '], / "}, ）→ 删除
  s = s.replace(/['"\]\}][ \t]*,?[ \t]*['"\]\}]*/g, '');
  // ⑦ 多余空行收敛
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

export function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');

  // 表格行：首尾带分隔符 | 的行（标准 GFM 表格至少一端有 |）
  const isTableRow = (s: string) => /^(\|.*\|.*\|)|(\|.*\|)$/.test(s);
  const isSepLine = (s: string) =>
    /^\s*\|?[\s:|-]+\|?\s*$/.test(s) && (s.match(/-/g)?.length ?? 0) >= 2;
  const parseRow = (s: string) =>
    s.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());

  const out: string[] = [];
  let ul: string[] = [];
  let ol: { num: number; content: string }[] = [];
  let tableBuf: string[] = [];
  const flushTable = () => {
    if (tableBuf.length < 2) {
      // 不足两行（至少表头 + 分隔）时退化为普通段落，不丢内容
      tableBuf.forEach((r) => out.push(`<p>${inline(r)}</p>`));
      tableBuf = [];
      return;
    }
    const startIdx = isSepLine(tableBuf[1] ?? '') ? 2 : 1;
    const header = parseRow(tableBuf[0]);
    const body = tableBuf.slice(startIdx).map(parseRow);
    out.push(
      '<table class="md-table"><thead><tr>' +
        header.map((h) => `<th>${inline(h)}</th>`).join('') +
        '</tr></thead><tbody>' +
        body.map((row) => '<tr>' + row.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table>'
    );
    tableBuf = [];
  };
  const flush = () => {
    if (ul.length) {
      out.push('<ul>' + ul.map((li) => `<li>${inline(li)}</li>`).join('') + '</ul>');
      ul = [];
    }
    if (ol.length) {
      out.push(
        '<ol>' +
          ol
            .map((li) => `<li value="${li.num}">${inline(li.content)}</li>`)
            .join('') +
          '</ol>'
      );
      ol = [];
    }
    flushTable();
  };

  // 仅 flush ul / table —— ol 跨空行累积（AI 常在有序项之间插空行，
  // 否则浏览器每 <ol> 独立从 1 编号，会显示成 1.1.1.1.1.）
  const flushUlTable = () => {
    if (ul.length) {
      out.push('<ul>' + ul.map((li) => `<li>${inline(li)}</li>`).join('') + '</ul>');
      ul = [];
    }
    flushTable();
  };

  // 全站防线：先清洗 AI 输出中混入的字段名/JSON 残留，再进入逐行解析
  for (const raw of sanitizeAiText(md).split('\n')) {
    const line = raw.trim();
    if (!line) {
      flushUlTable();
      // 当没有 ol 累积时，把空行当作段落分隔（push 一个 \n）；
      // 有 ol 累积时跳过，让列表紧凑、不被段落空行打断。
      if (ol.length === 0 && out.length && !out[out.length - 1].endsWith('\n')) {
        out.push('\n');
      }
      continue;
    }
    // 表格行先累积，遇到非表格行再统一 flush（连续表格行才能拼成一张表）
    if (isTableRow(line)) {
      tableBuf.push(line);
      continue;
    }
    // 标题：页面自身的 h1/h2 已占用，从 h3 起（## → h4）
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const level = Math.min(h[1].length + 2, 6);
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      // ul 出现会打断有序列表累积 → 必须完整 flush（包括已有的 ol）
      flush();
      ul.push(line.replace(/^[-*]\s+/, ''));
      continue;
    }
    const ordered = /^(\d+)[.)]\s+(.*)$/.exec(line);
    if (ordered) {
      // ⭐ 关键修复 1：连续有序列表项（含跨空行）必须合并到同一个 <ol>，
      // 否则浏览器每个 <ol> 都从 1 编号，模型把多条都打成「1.」时
      // 就会显示成 1.1.1.1. 只在 ul / table 非空时才 flush；ol 项
      // 之间不互相打断；空行也不再打断 ol 累积（见上面 if (!line) 分支）。
      //
      // ⭐ 关键修复 2：序号**不信任模型**。模型（GLM-4-Flash）常把多个并列条目
      // 全打成「1.」——若原样写进 <li value="1">，浏览器就显示成 1.1.1.1.（复发根因）。
      // 故：同一累积 <ol> 内首个条目用模型给的起始号（尊重显式起始），其后一律
      // 前一项 +1。嵌套 ul 打断时 ol 会被 flush 清空，下一段数字段用模型号，
      // 与「每个候选名下的子列表」场景兼容（该场景模型序号本就正确）。
      if (ul.length || tableBuf.length) flush();
      const startNum = parseInt(ordered[1], 10);
      const num = ol.length ? ol[ol.length - 1].num + 1 : startNum;
      ol.push({ num, content: ordered[2] });
      continue;
    }
    if (line.startsWith('> ')) {
      flush();
      out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
      continue;
    }
    flush();
    out.push(`<p>${inline(line)}</p>`);
  }
  flush();
  return out.join('').replace(/\n+/g, '\n');
}
