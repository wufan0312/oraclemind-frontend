/**
 * AI 流式响应去重 + 编号修正（GLM-4-Flash 兼容）
 * ----------------------------------------------------------------
 * 来源：2026-09-02 「AI 流式重复 · 五层防御」从 src/app/page.tsx（home agent）
 *       抽到共享 utils，使 horoscope/numerology/bugua 等通过 LightFollowUp
 *       走的通用追问分支也能复用同一套兜底。
 *
 * 流水线（推荐顺序）：
 *   1. dedupAdjacentParagraphs       相邻段去重
 *   2. dedupListItemsByTitle         跨段重复标题去重
 *   3. renumberStandaloneNumberedHeadings  独立编号标题递增修正
 *   4. dedupCrossTurn                跨轮重复兜底（需历史 AI 累积文本）
 */

/**
 * 相邻段落去重
 * ----------------------------------------------------------------
 * 流式拼接中偶发把同一段连续写两遍，本函数按"空行分段"比较相邻段
 * 全文相同就丢弃后者。
 */
export function dedupAdjacentParagraphs(s: string): string {
  if (!s) return s;
  const paras = s.split(/\n\s*\n/);
  const out: string[] = [];
  for (const p of paras) {
    const t = p.trim();
    if (!t) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      continue;
    }
    if (out.length > 0 && out[out.length - 1].trim() === t) continue;
    out.push(p);
  }
  return out.join('\n\n');
}

/**
 * 按列表项标题去重（跨段重复兜底）
 * ----------------------------------------------------------------
 * GLM-4-Flash 偶发把同一组要点写两遍：
 *   第一次编号错乱（1.写日记 / 1.写日记 / 2.冥想）
 *   第二次又完整重写一遍（1.写日记 / 2.冥想 / 3.正面思考）
 * 相邻去重抓不住这种「隔了一段距离再重写」的情况。
 *
 * 本函数提取所有「N. 标题：描述」模式的列表项，按「标题」（冒号前）
 * 去重：同一标题只保留第一次出现，后续出现时整行删除。
 */
export function dedupListItemsByTitle(s: string): string {
  if (!s) return s;
  const lines = s.split('\n');
  const seenTitles = new Set<string>();
  return lines
    // 用 null 标记「需删除」而非空串 —— 否则 filter(l => l !== '') 会把
    // 正常的空行（段落分隔）一起吞掉，导致段落之间失去空行。
    .map((line): string | null => {
      const trimmed = line.replace(/^[\s\u3000]+/, '');
      const m = trimmed.match(/^(\d+)\.\s*(.+?)[:：]\s*(.*)$/);
      if (!m) return line;
      const title = m[2].trim();
      if (seenTitles.has(title)) return null;
      seenTitles.add(title);
      return line;
    })
    .filter((l): l is string => l !== null)
    .join('\n');
}

/**
 * 修正独立段落标题的编号
 * ----------------------------------------------------------------
 * GLM-4-Flash 偶发把多个并列大段都写成「1. xxx：…」（应该 1. 2. 3. 递增），
 * 浏览器对每个独立的 ol 都从 1 编号 → 用户看到多条都是「1.」。
 *
 * 识别两种情况并把编号按出现顺序递增：
 *  A. 前空行/文首 + 紧跟子列表（"- xxx"）的独立成段编号标题
 *  B. 连续多行「N. 标题：描述」格式（GLM 误把每条都打成 1.）：
 *     1. 运用领导力：xxx
 *     1. 发挥创造力：xxx
 *     1. 追求平衡：xxx
 *     —— 应修正为 1./2./3.。LLM 正常递增的连续 ol 不会触发。
 */
export function renumberStandaloneNumberedHeadings(s: string): string {
  if (!s) return s;
  const lines = s.split('\n');
  const out: string[] = [];
  let counter = 0;

  // 先识别「连续 N. 标题：描述」段（A 场景不依赖，B 场景必需）
  // 走一遍：把连续匹配的段落用 counter 重新编号
  for (let k = 0; k < lines.length; k++) {
    const line = lines[k];
    const numberedTitleMatch = line.match(/^(\d+)\.\s*(.+?)[:：]\s*(.*)$/);
    if (!numberedTitleMatch) {
      // 紧接当前行：检查是否上一行也是「N. 标题：描述」形成连续
      out.push(line);
      continue;
    }
    const prevLine = k > 0 ? lines[k - 1] : '';
    const nextLine = k + 1 < lines.length ? lines[k + 1] : '';
    const prevIsEmpty = prevLine.trim() === '';
    const nextIsSublist = /^\s*[-•·]\s/.test(nextLine);

    // 当前行是不是「N. 标题：描述」格式
    const prevIsSameShape =
      k > 0 && !!prevLine.match(/^\d+\.\s*.+?[:：]\s*.*$/);
    const nextIsSameShape =
      k + 1 < lines.length && !!nextLine.match(/^\d+\.\s*.+?[:：]\s*.*$/);

    const isStandaloneHeading = prevIsEmpty && nextIsSublist;
    // B 场景：当前行是「N. 标题：描述」且 上一行/下一行也是同模式 → 构成连续编号段
    const isConsecutiveSameShape = prevIsSameShape || nextIsSameShape;

    if (isStandaloneHeading || isConsecutiveSameShape) {
      const m = line.match(/^(\d+)\.\s/);
      const currentN = m ? parseInt(m[1], 10) : 1;
      // 连续场景：每行强制递增（不再信任 LLM 写出来的编号）
      if (isConsecutiveSameShape) {
        counter += 1;
        out.push(line.replace(/^\d+\.\s/, `${counter}. `));
      } else if (currentN <= counter) {
        counter += 1;
        out.push(line.replace(/^\d+\.\s/, `${counter}. `));
      } else {
        counter = currentN;
        out.push(line);
      }
    } else {
      out.push(line);
    }
  }
  return out.join('\n');
}

/**
 * 按已知候选名做确定性递增编号（起名点评专用，不依赖 AI 输出格式）
 * ----------------------------------------------------------------
 * 前端已知候选名列表（按推荐序），直接锚定真实姓名重编号：
 *   - 对每行去掉前导 markdown 标记（# / **）与已有数字编号后，若其内容以某个
 *     候选名开头，则把该行编号替换为「该候选名在列表中的序号」（1./2./3.…）。
 *   - 长名优先匹配，避免「明」抢先命中「明轩」所在行。
 *   - 每个候选名只在首次出现处编号，正文复述不会被误改。
 * 这样无论 AI 是否加粗 / 用 ### / 块间有无空行 / 子列表是 • 还是 -，
 * 编号都能正确递增。
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function renumberByAnchors(text: string, anchors: string[]): string {
  if (!text || anchors.length === 0) return text;
  const lines = text.split('\n');
  // 长名优先，避免「明」先匹配到「明轩」所在行
  const ordered = [...anchors].sort((a, b) => b.length - a.length);
  const used = new Set<number>();
  const renumbered: Array<[number, number]> = [];
  for (const anchor of ordered) {
    const re = new RegExp(
      '^(\\s*(?:#{1,6}\\s*)?(?:\\*\\*)?\\s*(?:\\d+\\.\\s*)?)' + escapeRegExp(anchor)
    );
    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;
      if (re.test(lines[i])) {
        used.add(i);
        renumbered.push([i, anchors.indexOf(anchor) + 1]);
        break;
      }
    }
  }
  if (renumbered.length === 0) return text;
  const out = lines.slice();
  for (const [idx, num] of renumbered) {
    out[idx] = out[idx].replace(
      /^(\s*(?:#{1,6}\s*)?(?:\*\*)?\s*)(?:\d+\.\s*)?/,
      `$1${num}. `
    );
  }
  return out.join('\n');
}

/**
 * 跨轮次去重
 * ----------------------------------------------------------------
 * GLM-4-Flash 在多轮对话中容易把已说过的内容原样再输出一遍。
 * 本函数把当前轮回复与「历史所有 AI 回复累积文本」做段落级比对：
 * 如果某段落在历史中已出现过（≥92% 字符重叠率），则剔除。
 *
 * 安全保护：阈值 92%；短段落（< 30 字）跳过；
 *           清理后若剩余内容 < 原文 40% → 回退原文。
 */
export function dedupCrossTurn(current: string, previous: string): string {
  if (!current || !previous) return current;

  const prevParas = previous.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (prevParas.length === 0) return current;

  const curParas = current.split(/\n\s*\n/);
  const kept: string[] = [];
  let removedChars = 0;
  const totalChars = current.length;

  for (const para of curParas) {
    const t = para.trim();
    if (!t) {
      if (kept.length && kept[kept.length - 1] !== '') kept.push('');
      continue;
    }
    if (t.length < 30) {
      kept.push(para);
      continue;
    }

    let maxOverlap = 0;
    const tLen = t.length;
    for (const pp of prevParas) {
      if (pp.length < 20) continue;
      const shorter = tLen <= pp.length ? t : pp;
      const longer = tLen > pp.length ? t : pp;
      if (longer.includes(shorter)) {
        maxOverlap = Math.max(maxOverlap, shorter.length / longer.length);
        continue;
      }
      const overlap = _maxSubstringRatio(t, pp);
      if (overlap > maxOverlap) maxOverlap = overlap;
    }

    if (maxOverlap >= 0.92) {
      removedChars += t.length;
      continue;
    }
    kept.push(para);
  }

  const result = kept.join('\n\n');
  if (totalChars > 0 && removedChars / totalChars > 0.6) {
    return current;
  }
  return result;
}

/** 计算两段文本的最大公共子串占较短串长度的比例（0~1） */
function _maxSubstringRatio(a: string, b: string): number {
  const s = a.length <= b.length ? a : b;
  const l = a.length > b.length ? a : b;
  if (s.length < 5) return 0;
  let best = 0;
  const minLen = Math.min(8, s.length);
  for (let len = minLen; len <= s.length; len++) {
    let found = false;
    for (let i = 0; i <= s.length - len; i++) {
      if (l.includes(s.substring(i, i + len))) {
        best = len;
        found = true;
        break;
      }
    }
    if (!found) break;
  }
  return best / s.length;
}

/**
 * 一站式应用 4 步去重流水线（不含 dedupCrossTurn，需单独传 history）
 * ----------------------------------------------------------------
 * 用法：
 *   let cleaned = applyTextDedup(text);
 *   if (history) cleaned = dedupCrossTurn(cleaned, history);
 */
export function applyTextDedup(s: string): string {
  let out = dedupAdjacentParagraphs(s);
  out = dedupListItemsByTitle(out);
  out = renumberStandaloneNumberedHeadings(out);
  return out;
}
