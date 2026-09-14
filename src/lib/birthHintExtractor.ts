import { Lunar, Solar } from 'lunar-typescript';

export interface MingAgentBirthHint {
  year?: number;
  month?: number;
  day?: number;
  timeText?: string;
  gender?: string;
}

/** 十二时辰（索引 = 时辰序，子 = 0） */
const SHICHEN = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时'];

/** 地支写法：丑时 / 丑時 */
const ZHI_RE = /(子|丑|寅|卯|辰|巳|午|未|申|酉|戌|亥)\s*[时時]/;

/**
 * 小时 → 时辰。按区间起点取整：
 * 23/0→子, 1→丑, 3→寅, 5→卯, 7→辰, 9→巳, 11→午, 13→未, 15→申, 17→酉, 19→戌, 21→亥
 */
function shichenFromHour(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  return SHICHEN[Math.floor(((hh + 1) % 24) / 2)];
}

/**
 * 从自然语言里识别出生时辰。
 * 支持：地支写法（丑时/丑）、数字区间（凌晨1~3点、7-9 点）、单点（凌晨2点 / 12点）。
 *
 * ⚠️ 区间与单点都必须带「点/时」后缀 —— 否则「农历 1987-03-12」里的 `03-12`
 * 会被当成「3 点到 12 点」，把日期误判成时辰。
 */
function parseTimeText(msg: string): string | undefined {
  const zhi = msg.match(ZHI_RE);
  if (zhi) return `${zhi[1]}时`;

  const range = msg.match(/(\d{1,2})\s*[-~—－至到]\s*(\d{1,2})\s*[点时時]/);
  if (range) {
    const h = parseInt(range[1], 10);
    if (h >= 0 && h <= 23) return shichenFromHour(h);
  }

  const single = msg.match(/(\d{1,2})\s*[点时時]/);
  if (single) {
    const h = parseInt(single[1], 10);
    if (h >= 0 && h <= 23) return shichenFromHour(h);
  }
  return undefined;
}

/**
 * 从自然语言里识别性别。
 *
 * ⚠️ 历史坑（2026-09-11 修复）：旧实现用 `/\b女\b/` 做词边界匹配。JS 的 `\b` 基于
 * ASCII `\w`，中文字符两侧都是「非词字符」，因此 **`\b女\b` 对中文永远不匹配**；
 * 兜底词表又只有「女孩/女生/女的」，漏掉了最高频的「…出生的女」这种收尾写法，
 * 导致 birthHint.gender 恒为 undefined → 后端判定生辰不完整 → 不排盘、CTA 不带性别。
 * 改为按字符位置判断，彻底摆脱词边界。
 */
function parseGender(msg: string): string | undefined {
  // 「男/女」并列（如选项罗列「性别：男/女」）不算用户表态，先剔除
  const s = msg.replace(/男女|女男/g, '');
  const f = s.search(/女/);
  const m = s.search(/男/);
  if (f >= 0 && m >= 0) return f < m ? '女' : '男';
  if (f >= 0) return '女';
  if (m >= 0) return '男';
  return undefined;
}

/**
 * 从自然语言消息中提取结构化生辰。
 * 支持「农历/阴历/旧历」与「公历/阳历/新历」声明，支持常见日期格式及时辰口语。
 * 农历日期会被换算为公历返回（排盘工具只接受公历）。
 *
 * 注意：年月日与时辰/性别是**独立**解析的 —— 只要能拿到年月日就返回（时辰/性别
 * 缺失时置 undefined），由调用方决定是否再向历史消息回溯补齐。
 */
export function extractBirthHintFromMessage(msg: string): MingAgentBirthHint | undefined {
  const s = msg.replace(/[\u200b\u200c\u200d\ufeff]/g, '').trim();
  if (!s) return undefined;

  const isLunar = /(农历|阴历|旧历|農曆)/.test(s);
  const isSolar = /(公历|阳历|新历|国历|西历)/.test(s);

  // 尝试 YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD / YYYY年M月D日
  let year: number | undefined;
  let month: number | undefined;
  let day: number | undefined;

  const ymd1 = s.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (ymd1) {
    year = parseInt(ymd1[1], 10);
    month = parseInt(ymd1[2], 10);
    day = parseInt(ymd1[3], 10);
  }

  if (!year || !month || !day) return undefined;

  let solar: Solar | undefined;
  try {
    if (isLunar && !isSolar) {
      const lunar = Lunar.fromYmd(year, month, day);
      solar = lunar.getSolar();
    } else {
      solar = Solar.fromYmd(year, month, day);
    }
  } catch {
    return undefined;
  }

  if (!solar) return undefined;

  const hint: MingAgentBirthHint = {
    year: solar.getYear(),
    month: solar.getMonth(),
    day: solar.getDay(),
    timeText: parseTimeText(s),
    gender: parseGender(s),
  };

  return hint;
}

/**
 * 从多轮历史里回溯最近一条「能解析出完整年月日」的用户消息。
 *
 * 场景：用户第 1 轮报生辰、第 2 轮才追问「那我今年财运呢」——第 2 轮消息本身不含
 * 生辰，若只解析当前消息就会丢掉排盘依据（旧实现即如此，追问必定退化成通用建议）。
 *
 * @param texts 按时间正序排列的用户消息文本（不含当前这句）
 */
export function extractBirthHintFromMessages(texts: string[]): MingAgentBirthHint | undefined {
  for (let i = texts.length - 1; i >= 0; i--) {
    const h = extractBirthHintFromMessage(texts[i]);
    if (h && h.year && h.month && h.day) return h;
  }
  return undefined;
}

/**
 * 综合当前消息与历史消息得到最终 birthHint。
 * 年月日以**当前消息**为准（用户可能中途改生辰），时辰/性别缺失时用历史补齐。
 */
export function resolveBirthHint(
  question: string,
  historyTexts: string[] = [],
): MingAgentBirthHint | undefined {
  const fromCurrent = extractBirthHintFromMessage(question);
  const fromHistory = extractBirthHintFromMessages(historyTexts);

  if (!fromCurrent) {
    // 当前消息没生辰（追问轮）：整体沿用历史里最近一次完整生辰
    if (!fromHistory) return undefined;
    return {
      year: fromHistory.year,
      month: fromHistory.month,
      day: fromHistory.day,
      timeText: fromHistory.timeText,
      gender: fromHistory.gender,
    };
  }

  return {
    year: fromCurrent.year,
    month: fromCurrent.month,
    day: fromCurrent.day,
    timeText: fromCurrent.timeText ?? fromHistory?.timeText,
    gender: fromCurrent.gender ?? fromHistory?.gender,
  };
}
