/**
 * AI 解读文本 → 结构化小节
 * ----------------------------------------------------------------
 * 后端 formatter.py 固定输出 `**标题**\n\n正文` 的小节结构，前端此前
 * 直接整段 mdToHtml 渲染成一长条纯文本，纵向又长又空。本文件把它逆解析
 * 成 {title, body} 数组，供各页渲染成卡片网格。
 *
 * 关键：AI 服务端是「LLM 全量生成 → 统一转 Markdown → 打字机逐段发送」，
 * 因此流式期间拿到的始终是**已格式化 Markdown 的前缀**（不会是原始 JSON），
 * 逆解析安全；最后一个小节可能不完整，正好形成「逐卡出现」的打字机效果。
 */

export interface AiSection {
  title: string;
  body: string;
  /** 按标题匹配的 emoji（无匹配时为空串） */
  icon: string;
}

/** 标题 → emoji 映射（按关键字包含匹配，顺序即优先级） */
const ICON_RULES: [string[], string][] = [
  [['整体概述', '概述', '总结', '总览'], '✨'],
  [['天赋', '特质', '优势'], '🎯'],
  [['人生课题', '课题', '功课'], '🧩'],
  [['事业', '工作', '财运', '职业'], '💼'],
  [['情感', '感情', '关系', '婚姻'], '💕'],
  [['姓名', '名字', '能量'], '🔤'],
  [['挑战'], '🧗'],
  [['建议', '行动'], '🎬'],
  [['趋势', '展望', '近期'], '📈'],
  [['契合', '配对', '合盘', '相处'], '🤝'],
  [['结论', '判断'], '🔮'],
  [['风险', '注意', '警惕'], '⚠️'],
];

export function iconForTitle(title: string): string {
  for (const [keys, icon] of ICON_RULES) {
    if (keys.some((k) => title.includes(k))) return icon;
  }
  return '🔹';
}

/**
 * 解析 AI 解读文本为小节数组。
 *
 * 标题识别规则：`**X**` 且 X ≤ 24 字、后面紧跟换行或文末。
 * 这样正文里的行内加粗（如 `**代表稳定**，`）不会被误判成小节标题。
 */
export function parseAiSections(text: string): AiSection[] {
  if (!text || !text.trim()) return [];

  // 先统一换行符：后端/文件可能输出 \r\n，不规范化会导致
  // `**标题**` 后的 `\r` 挡住 lookahead，整段被误判为「无标题块」。
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const marks: { title: string; start: number; end: number }[] = [];
  const re = /\*\*([^*\n]{1,24})\*\*[ \t]*(?=\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    marks.push({ title: m[1].trim(), start: m.index, end: m.index + m[0].length });
  }

  // 没有任何小节标题 → 整段作为一个无标题块
  if (marks.length === 0) {
    return [{ title: '', body: src.trim(), icon: '' }];
  }

  // 首个标题之前的文字（若有）作为「引言」块
  const sections: AiSection[] = [];
  const lead = src.slice(0, marks[0].start).trim();
  if (lead) sections.push({ title: '', body: lead, icon: '' });

  for (let i = 0; i < marks.length; i++) {
    const bodyStart = marks[i].end;
    const bodyEnd = i + 1 < marks.length ? marks[i + 1].start : src.length;
    const body = src.slice(bodyStart, bodyEnd).trim();
    // 流式末尾可能出现「**标题**」但正文还没到 → body 为空也保留（显示标题占位）
    sections.push({ title: marks[i].title, body, icon: iconForTitle(marks[i].title) });
  }
  return sections;
}
