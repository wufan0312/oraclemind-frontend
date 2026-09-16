// ============================================================================
// 农历（阴阳历）换算共享库
// 抽自 bugua/page.tsx，供卜卦 / 数字命理 / 报告 / 合盘 等页面统一复用，
// 避免「同一套农历逻辑在多页各写一份」带来的口径漂移。
// 约定：农历月以负数表示闰月（如 -8 = 闰八月）。
// 依赖 lunar-typescript（Solar / Lunar）。
// ============================================================================
import { Lunar, Solar } from 'lunar-typescript';
import type { VisitorBirth } from './visitor';

export const LUNAR_YEAR_MIN = 1920;
export const LUNAR_YEAR_MAX = 2026;

export const LUNAR_MONTH_NAMES = ['', '正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/** 农历月 → 中文名（闰月带「闰」前缀） */
export function lunarMonthName(m: number): string {
  return m < 0 ? `闰${LUNAR_MONTH_NAMES[-m]}` : LUNAR_MONTH_NAMES[m];
}

/** 探测某农历年是否有闰月，返回闰月数字（无则 0）。尝试负月构造，捕获异常即无闰月。 */
export function leapMonthOf(year: number): number {
  for (let m = 1; m <= 12; m++) {
    try {
      Lunar.fromYmd(year, -m, 1);
      return m;
    } catch {
      /* 该月非闰月，继续 */
    }
  }
  return 0;
}

/** 构造农历月份下拉选项（正月~腊月，若该年有闰月则插入「闰X月」） */
export function buildLunarMonths(year: number): { value: number; label: string }[] {
  const months: { value: number; label: string }[] = [];
  for (let m = 1; m <= 12; m++) months.push({ value: m, label: `${LUNAR_MONTH_NAMES[m]}月` });
  const leap = leapMonthOf(year);
  if (leap > 0) months.splice(leap, 0, { value: -leap, label: `闰${LUNAR_MONTH_NAMES[leap]}月` });
  return months;
}

/** 农历 → 阳历，返回 YYYY-MM-DD；非法组合返回 null */
export function lunarToSolar(ly: number, lm: number, ld: number): string | null {
  try {
    const solar = Lunar.fromYmd(ly, lm, ld).getSolar();
    return `${solar.getYear()}-${pad2(solar.getMonth())}-${pad2(solar.getDay())}`;
  } catch {
    return null;
  }
}

/** 阳历 YYYY-MM-DD → 农历各分量 {ly, lm(负=闰月), ld} */
export function solarToLunarParts(solarStr: string): { ly: number; lm: number; ld: number } | null {
  const [y, m, d] = solarStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  try {
    const lunar = Solar.fromYmd(y, m, d).getLunar();
    return { ly: lunar.getYear(), lm: lunar.getMonth(), ld: lunar.getDay() };
  } catch {
    return null;
  }
}

/** 农历日期展示格式：YYYY-MM-DD（闰月 month 为负，展示为 YYYY--MM-DD，如 1987--06-12） */
export function formatLunarText(ly: number, lm: number, ld: number): string {
  const m = String(Math.abs(lm)).padStart(2, '0');
  const d = String(ld).padStart(2, '0');
  return `${ly}-${lm < 0 ? '-' : ''}${m}-${d}`;
}

/** 解析农历日期文本 → 农历各分量 {ly, lm(负=闰月), ld}；无法识别返回 null。
 *  支持：1987年3月12日 | 1987年闰3月12日 | 1987-3-12 | 1987/03/12 | 19870312 */
export function parseLunarToParts(text: string): { ly: number; lm: number; ld: number } | null {
  const s = (text ?? '').trim().replace(/\s+/g, '');
  if (!s) return null;
  // 中文格式：1987年3月12日 / 1987年闰3月12日
  let m = /^(\d{4})年(闰)?(\d{1,2})月(\d{1,2})日?$/.exec(s);
  if (m) return { ly: Number(m[1]), lm: Number(m[3]) * (m[2] ? -1 : 1), ld: Number(m[4]) };
  // 分隔符格式：1987-3-12 / 1987/03/12 / 1987.3.12
  m = /^(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})$/.exec(s);
  if (m) return { ly: Number(m[1]), lm: Number(m[2]), ld: Number(m[3]) };
  // 8 位连续数字：19870312
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return { ly: Number(m[1]), lm: Number(m[2]), ld: Number(m[3]) };
  return null;
}

/** 农历文本解析器（供 DatePicker parseInput 使用）：解析成功返回「农历文本本身」，不换算为公历。
 *  目的：保证农历模式输入框只显示用户所写的农历，绝不把公历换算值写回输入框。
 *  输出格式：YYYY-MM-DD（闰月展示为 -MM，如 1987--06-12）。
 *  支持输入：1987年3月12日 | 1987年闰3月12日 | 1987-3-12 | 1987/03/12 | 19870312 */
export function parseLunarLooseDate(text: string): string | null {
  const p = parseLunarToParts(text);
  if (!p) return null;
  const m = String(Math.abs(p.lm)).padStart(2, '0');
  const d = String(p.ld).padStart(2, '0');
  return `${p.ly}-${p.lm < 0 ? '-' : ''}${m}-${d}`;
}

/** 公历生日可读文本（如「1987年4月9日」；空值返回占位符） */
export function formatSolarText(solar: string): string {
  if (!solar) return '—';
  const [y, m, d] = solar.split('-');
  return `${y}年${Number(m)}月${Number(d)}日`;
}

/** 生命灵数计算所用「年/月/日」基准：按历法口径从出生档案取分量。
 *  - mode === 'lunar'：优先用档案里存的农历分量；缺失则把公历转农历兜底。
 *  - mode === 'solar'（默认）：用公历 date 分量。
 *  任意路径非法返回 null（调用方应回退或提示）。 */
export function lifePathBasisFromBirth(
  birth: Pick<VisitorBirth, 'date' | 'lunarYear' | 'lunarMonth' | 'lunarDay'> | null | undefined,
  mode: 'solar' | 'lunar' = 'solar'
): { y: number; m: number; d: number } | null {
  if (!birth) return null;
  if (mode === 'lunar') {
    if (
      typeof birth.lunarYear === 'number' &&
      typeof birth.lunarMonth === 'number' &&
      typeof birth.lunarDay === 'number'
    ) {
      return { y: birth.lunarYear, m: birth.lunarMonth, d: birth.lunarDay };
    }
    if (birth.date) {
      const l = solarToLunarParts(birth.date);
      if (l) return { y: l.ly, m: l.lm, d: l.ld };
    }
    return null;
  }
  if (!birth.date) return null;
  const [y, m, d] = birth.date.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}
