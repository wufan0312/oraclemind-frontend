/**
 * AI 文本清洗工具（全站复用）。
 *
 * 此前 dream/page.tsx 内联了一份 cleanAiTplResidue（约 20 行），
 * 其他页若需同类清洗只能再抄一份。本次收敛到此文件，
 * 供 tarot / numerology / bugua / ming 等所有 AI 文本页复用。
 */

/**
 * 清理 LLM 偶尔把 OUTPUT_FORMAT 模板示例当内容输出的残留：
 * 「整体概述，」「近期趋势提示，」「≤80字」「≤120字」以及偶发的 JSON 结构残留。
 */
export function cleanAiTplResidue(text: string): string {
  if (!text) return '';
  let t = text
    .replace(/整体概述[，,：:]*\s*/g, '')
    .replace(/近期趋势提示[，,：:]*\s*/g, '')
    .replace(/≤\s*\d+\s*字[，,]?/g, '')
    .replace(/（\s*≤\s*\d+\s*字\s*）/g, '')
    .replace(/\(\s*≤\s*\d+\s*字\s*\)/g, '')
    .replace(/\n{3,}/g, '\n\n');
  // 兜底：清理 LLM 偶尔输出的 JSON 结构残留
  t = t
    .replace(/^\s*\{[\s\S]*?\}\s*$/m, '') // 整段就是 JSON 对象时清空
    .replace(/^\s*```json\s*$/gm, '') // markdown 代码块标记
    .replace(/^\s*```\s*$/gm, '')
    .replace(/"ok"\s*:\s*(true|false)\s*,?/g, '')
    .replace(/"summary"\s*:/g, '')
    .replace(/"aspects"\s*:/g, '')
    .replace(/"advice"\s*:/g, '')
    .replace(/"outlook"\s*:/g, '')
    .replace(/\{\s*"[^"]+"\s*:\s*"[^"]*"\s*\}/g, '')
    .replace(/\n{3,}/g, '\n\n');
  return t.trim();
}
