// ===== 真太阳时校正（中国术数排盘必备） =====
// 原理：北京时间基于东经 120°（东八区中央经线），而出生地经度不同、且地球公转速度不均，
// 需把「平太阳时（钟表时间）」换算成「真太阳时」再定八字时辰，否则东/西部出生者八字可能整体偏移。
//
// 公式：真太阳时 = 北京时间 + (出生地经度 − 120°) × 4 分钟/度 + 时差(EoT)
//   - 经度时差：每偏东 1° 早 4 分钟；
//   - 时差(EoT)：真太阳时与平太阳时之差，由日地关系决定，全年在 ±16 分钟内波动。

/** 12 时辰（地支顺序） */
export const SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

/** 小时(0-23) → 时辰名（子时跨 23:00-01:00） */
export function hourToShichen(h: number): string {
  const h2 = ((h + 1) % 24 + 24) % 24;
  return SHICHEN[Math.floor(h2 / 2)];
}

/** 一年中的第几天（1-366） */
export function dayOfYear(y: number, m: number, d: number): number {
  const start = new Date(y, 0, 0);
  const cur = new Date(y, m - 1, d);
  return Math.round((cur.getTime() - start.getTime()) / 86400000);
}

/** 时差 EoT（分钟）：标准近似公式，误差 < 1 分钟 */
export function equationOfTime(y: number, m: number, d: number): number {
  const N = dayOfYear(y, m, d);
  const B = (2 * Math.PI * (N - 81)) / 365;
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

export interface TrueSolarResult {
  lng: number;
  /** 经度时差（分钟）：(lng − 120) × 4 */
  longitudeMin: number;
  /** 真平太阳时差 EoT（分钟） */
  eotMin: number;
  /** 总修正（分钟） */
  totalMin: number;
  /** 修正后钟表时间 HH:MM（0-23:59，已处理跨日） */
  correctedTime: string;
  /** 跨日偏移天数（0 / +1 / -1） */
  dayOffset: number;
  /** 修正后时辰名 */
  shichen: string;
  /** 原时间（分钟） */
  origMin: number;
}

/**
 * 计算真太阳时。
 * @param date 出生日期 yyyy-MM-dd
 * @param hhmm 出生钟表时间 HH:MM（视为北京时间）
 * @param lng  出生地经度（东经为正，如北京 116.4）
 */
export function computeTrueSolarTime(date: string, hhmm: string, lng: number): TrueSolarResult {
  const [y = 2000, m = 1, d = 1] = date.split('-').map(Number);
  const [hh = 12, mm = 0] = hhmm.split(':').map(Number);

  const origMin = hh * 60 + mm;
  const longitudeMin = (lng - 120) * 4;
  const eotMin = equationOfTime(y, m, d);
  const totalMin = longitudeMin + eotMin;

  let corr = origMin + totalMin;
  let dayOffset = 0;
  while (corr >= 1440) {
    corr -= 1440;
    dayOffset += 1;
  }
  while (corr < 0) {
    corr += 1440;
    dayOffset -= 1;
  }

  const ch = Math.floor(corr / 60);
  const cm = Math.round(corr % 60);
  const correctedTime = `${String(ch).padStart(2, '0')}:${String(cm).padStart(2, '0')}`;
  const shichen = hourToShichen(ch);

  return {
    lng,
    longitudeMin: Math.round(longitudeMin * 100) / 100,
    eotMin: Math.round(eotMin * 100) / 100,
    totalMin: Math.round(totalMin * 100) / 100,
    correctedTime,
    dayOffset,
    shichen,
    origMin,
  };
}
