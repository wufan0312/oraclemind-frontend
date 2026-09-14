/**
 * 时辰 ↔ HH:mm 双向转换工具
 * 访客缓存存储时辰名（如 "辰时"/"不详"），星座页需要精确 HH:mm 时间。
 */

/** 时辰 → 中点时间（每时辰跨 2 小时，取中间值） */
const SHICHEN_TO_HHMM: Record<string, string> = {
  '子时': '00:00',
  '丑时': '02:00',
  '寅时': '04:00',
  '卯时': '06:00',
  '辰时': '08:00',
  '巳时': '10:00',
  '午时': '12:00',
  '未时': '14:00',
  '申时': '16:00',
  '酉时': '18:00',
  '戌时': '20:00',
  '亥时': '22:00',
};

/** HH:mm → 时辰名（按小时段映射） */
const HOUR_TO_SHICHEN: { hour: number; name: string }[] = [
  { hour: 23, name: '子时' }, { hour: 0, name: '子时' },
  { hour: 1, name: '丑时' }, { hour: 2, name: '丑时' },
  { hour: 3, name: '寅时' }, { hour: 4, name: '寅时' },
  { hour: 5, name: '卯时' }, { hour: 6, name: '卯时' },
  { hour: 7, name: '辰时' }, { hour: 8, name: '辰时' },
  { hour: 9, name: '巳时' }, { hour: 10, name: '巳时' },
  { hour: 11, name: '午时' }, { hour: 12, name: '午时' },
  { hour: 13, name: '未时' }, { hour: 14, name: '未时' },
  { hour: 15, name: '申时' }, { hour: 16, name: '申时' },
  { hour: 17, name: '酉时' }, { hour: 18, name: '酉时' },
  { hour: 19, name: '戌时' }, { hour: 20, name: '戌时' },
  { hour: 21, name: '亥时' }, { hour: 22, name: '亥时' },
];

/** 时辰名 → HH:mm（不详/未知 → 12:00 正午默认） */
export function shichenToHHmm(shichen: string): string {
  if (!shichen || shichen === '不详') return '12:00';
  return SHICHEN_TO_HHMM[shichen] ?? '12:00';
}

/** HH:mm → 时辰名 */
export function hhmmToShichen(hhmm: string): string {
  const hour = parseInt(hhmm.split(':')[0], 10);
  const match = HOUR_TO_SHICHEN.find((s) => s.hour === hour);
  return match?.name ?? '不详';
}
