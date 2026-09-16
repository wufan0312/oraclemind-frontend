// ============================================================================
// 玄镜 OracleMind · 农历（阴阳历）换算单一来源
// 所有出生日期相关的「公历 ↔ 农历」换算、生肖、农历文本，统一走这里，
// 避免 bugua / numerology / fengshui / synastry 各自重复实现导致口径漂移。
// 依赖 lunar-typescript（Lunar / Solar）。
// 约定：农历月以负数表示闰月（如 -8 = 闰八月）；展示文本闰月写作 YYYY--MM-DD。
// ============================================================================
import { Lunar, Solar } from 'lunar-typescript';

export interface LunarParts {
  /** 农历年，如 1987 */
  ly: number;
  /** 农历月 1-12，闰月用负数（如 -8 = 闰八月） */
  lm: number;
  /** 农历日 1-30 */
  ld: number;
}

export const LUNAR_YEAR_MIN = 1920;
export const LUNAR_YEAR_MAX = new Date().getFullYear();

const LUNAR_MONTH_NAMES = ['', '正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];

/** 农历月 → 中文名（闰月带「闰」前缀） */
export function lunarMonthName(m: number): string {
  return m < 0 ? `闰${LUNAR_MONTH_NAMES[-m]}` : LUNAR_MONTH_NAMES[m];
}

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/**
 * 公历 YYYY-MM-DD → 农历分量 {ly, lm(负=闰月), ld}；非法/缺省返回 null。
 * 八字、数字命理、生肖等命理推算一律以此结果为基准（农历口径）。
 */
export function solarToLunarParts(solarStr: string): LunarParts | null {
  const [y, m, d] = (solarStr || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  try {
    const lunar = Solar.fromYmd(y, m, d).getLunar();
    return { ly: lunar.getYear(), lm: lunar.getMonth(), ld: lunar.getDay() };
  } catch {
    return null;
  }
}

/** 农历分量 → 公历 YYYY-MM-DD；非法组合（如闰月不存在）返回 null */
export function lunarToSolarISO(ly: number, lm: number, ld: number): string | null {
  try {
    const solar = Lunar.fromYmd(ly, lm, ld).getSolar();
    return `${solar.getYear()}-${pad2(solar.getMonth())}-${pad2(solar.getDay())}`;
  } catch {
    return null;
  }
}

/** 农历展示文本：YYYY-MM-DD（闰月展示为 -MM，如 1987--06-12） */
export function formatLunarText(ly: number, lm: number, ld: number): string {
  const m = pad2(Math.abs(lm));
  const d = pad2(ld);
  return `${ly}-${lm < 0 ? '-' : ''}${m}-${d}`;
}

/**
 * 解析用户键入的农历日期文本 → 农历分量；无法识别返回 null。
 * 支持：1987年3月12日 | 1987年闰3月12日 | 1987-3-12 | 1987/03/12 | 19870312 | 1987--06-12（闰月展示）
 */
export function parseLunarToParts(text: string): LunarParts | null {
  const s = (text ?? '').trim().replace(/\s+/g, '');
  if (!s) return null;
  // 中文格式：1987年3月12日 / 1987年闰3月12日
  let m = /^(\d{4})年(闰)?(\d{1,2})月(\d{1,2})日?$/.exec(s);
  if (m) return { ly: Number(m[1]), lm: Number(m[3]) * (m[2] ? -1 : 1), ld: Number(m[4]) };
  // 闰月展示格式：1987--06-12
  m = /^(\d{4})--(\d{2})-(\d{2})$/.exec(s);
  if (m) return { ly: Number(m[1]), lm: -Number(m[2]), ld: Number(m[3]) };
  // 分隔符格式：1987-3-12 / 1987/03/12 / 1987.3.12
  m = /^(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})$/.exec(s);
  if (m) return { ly: Number(m[1]), lm: Number(m[2]), ld: Number(m[3]) };
  // 8 位连续数字：19870312
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return { ly: Number(m[1]), lm: Number(m[2]), ld: Number(m[3]) };
  return null;
}

/**
 * DatePicker parseInput（农历模式）：解析成功返回「农历文本本身」（YYYY-MM-DD，闰月 -MM），
 * 不换算为公历。目的：保证农历模式输入框只显示用户所写的农历，绝不把公历换算值写回输入框。
 * 无法识别返回 null（交由 DatePicker 标红）。
 */
export function parseLunarInput(text: string): string | null {
  const p = parseLunarToParts(text);
  if (!p) return null;
  return formatLunarText(p.ly, p.lm, p.ld);
}

/** 公历可读文本：1987年4月9日（空值返回占位符） */
export function formatSolarText(solar: string): string {
  if (!solar) return '—';
  const [y, m, d] = solar.split('-');
  return `${y}年${Number(m)}月${Number(d)}日`;
}

/**
 * 生肖（基于农历年，正确处理春节/立春边界）。
 * 入参为公历 YYYY-MM-DD；走 lunar-typescript 取农历年地支生肖，与后端 lunar-python 同源历法。
 * 失败降级用公历年份公式（粗略，未考虑立春）。
 */
export function getShengxiao(solarISO: string): string {
  const [y, m, d] = (solarISO || '').split('-').map(Number);
  if (!y || !m || !d) return '未知';
  const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
  try {
    const lunar = Solar.fromYmd(y, m, d).getLunar();
    return lunar.getYearShengXiao();
  } catch {
    return ZODIAC[(((y - 4) % 12) + 12) % 12];
  }
}
