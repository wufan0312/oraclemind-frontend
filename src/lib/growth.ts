'use client';

/**
 * 玄镜 · 成长体系（用户成长体系）
 * --------------------------------------------------------------------------
 * 设计：灵修值 = 签到积累 + 各模块修行足迹实时聚合，二者相加映射等级与称号。
 * - 签到积累：持久化在 om_growth（可上云），每日签到 +10，连续天数额外加成。
 * - 修行足迹：实时从各模块本地/云端历史键聚合（不求精确、只反映"越用越深"）。
 *
 * 注意：各模块历史即 localStorage 键（cloudStore 本地优先），此处直接读取聚合，
 * 不依赖 getCloudItem（未导出）。解析全部容错，任一项异常不影响其它。
 */

import { setCloudItem, removeCloudItem } from '@/lib/cloudStore';

const GROWTH_KEY = 'om_growth';

// 等级阈值：累计灵修值 → 等级 / 称号（参考修行境界，纯趣味）
export interface LevelTier {
  level: number;
  name: string;
  min: number; // 进入该等级所需累计灵修值
}

export const LEVEL_TIERS: LevelTier[] = [
  { level: 1, name: '初心', min: 0 },
  { level: 2, name: '问道', min: 120 },
  { level: 3, name: '渐悟', min: 320 },
  { level: 4, name: '明心', min: 640 },
  { level: 5, name: '见性', min: 1100 },
  { level: 6, name: '通玄', min: 1800 },
  { level: 7, name: '合道', min: 2800 },
  { level: 8, name: '大觉', min: 4200 },
];

// 模块贡献权重（每条记录折算灵修值）
interface ModuleDef {
  key: string; // localStorage 键
  label: string;
  icon: string;
  weight: number; // 每条/每点折算
  kind: 'count' | 'healingXp';
}

const MODULES: ModuleDef[] = [
  { key: 'om_bugua_divined', label: '卜卦', icon: '☯', weight: 12, kind: 'count' },
  { key: 'om_tarot_history', label: '塔罗', icon: '🎴', weight: 10, kind: 'count' },
  { key: 'om_dream_diary', label: '周公解梦', icon: '🌙', weight: 8, kind: 'count' },
  { key: 'om_numerology_history', label: '数字密码', icon: '🔢', weight: 8, kind: 'count' },
  { key: 'om_ming_history', label: '测字起名', icon: '✒️', weight: 8, kind: 'count' },
  { key: 'om_cross_readings', label: '跨术数', icon: '🔮', weight: 15, kind: 'count' },
  { key: 'om_healing', label: '疗愈修行', icon: '🪷', weight: 1, kind: 'healingXp' },
];

export interface ModuleContrib {
  key: string;
  label: string;
  icon: string;
  count: number; // 折算后的"修行点数"
  raw: number; // 原始条数 / xp
}

export interface GrowthPersist {
  checkInXp: number; // 签到累计灵修值
  streakDays: number; // 连续签到天数
  lastCheckIn: string; // 最近签到日期 YYYY-MM-DD
  totalCheckIns: number; // 累计签到次数
}

export interface GrowthState {
  persist: GrowthPersist;
  moduleContrib: ModuleContrib[];
  footprintXp: number; // 修行足迹折算灵修值
  totalXp: number; // 签到 + 足迹
  level: number;
  levelName: string;
  intoLevel: number; // 当前等级已累积
  levelSpan: number; // 当前等级区间跨度
  nextLevelName: string | null;
  progress: number; // 0~100 当前等级进度
  canCheckIn: boolean; // 今日是否可签到
  streakBonus: number; // 当前连续签到加成（用于展示）
}

const CHECKIN_BASE = 10;
const STREAK_BONUS_PER_DAY = 2; // 连续每多 1 天，单次签到多 +2
const STREAK_BONUS_CAP = 20; // 加成上限

function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayDiff(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime();
  const db = new Date(b + 'T00:00:00').getTime();
  return Math.round((db - da) / 86400000);
}

function safeReadCount(key: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return 0;
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.length;
    if (typeof v === 'number') return v; // 例如 om_bugua_divined 可能存次数
    if (v && typeof v === 'object') {
      // healing：取 xp 字段
      if (typeof v.xp === 'number') return v.xp;
      if (Array.isArray(v.wudao)) return v.wudao.length;
    }
    return 0;
  } catch {
    return 0;
  }
}

function safeReadHealingXp(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem('om_healing');
    if (!raw) return 0;
    const v = JSON.parse(raw);
    return typeof v?.xp === 'number' ? v.xp : 0;
  } catch {
    return 0;
  }
}

function defaultPersist(): GrowthPersist {
  return { checkInXp: 0, streakDays: 0, lastCheckIn: '', totalCheckIns: 0 };
}

export function loadPersist(): GrowthPersist {
  if (typeof window === 'undefined') return defaultPersist();
  try {
    const raw = window.localStorage.getItem(GROWTH_KEY);
    if (!raw) return defaultPersist();
    const p = JSON.parse(raw);
    return {
      checkInXp: p.checkInXp || 0,
      streakDays: p.streakDays || 0,
      lastCheckIn: p.lastCheckIn || '',
      totalCheckIns: p.totalCheckIns || 0,
    };
  } catch {
    return defaultPersist();
  }
}

function savePersist(p: GrowthPersist): void {
  try {
    const val = JSON.stringify(p);
    window.localStorage.setItem(GROWTH_KEY, val);
    setCloudItem(GROWTH_KEY, val);
  } catch {
    /* 忽略 */
  }
}

/** 聚合各模块修行足迹（实时，不持久化） */
export function aggregateModules(): { contrib: ModuleContrib[]; footprintXp: number } {
  const contrib: ModuleContrib[] = MODULES.map((m) => {
    const raw = m.kind === 'healingXp' ? safeReadHealingXp() : safeReadCount(m.key);
    const count = Math.round(raw * m.weight);
    return { key: m.key, label: m.label, icon: m.icon, count, raw };
  });
  const footprintXp = contrib.reduce((s, c) => s + c.count, 0);
  return { contrib, footprintXp };
}

/** 计算等级信息 */
function resolveLevel(totalXp: number): {
  level: number; name: string; intoLevel: number; levelSpan: number; nextName: string | null; progress: number;
} {
  let idx = 0;
  for (let i = 0; i < LEVEL_TIERS.length; i++) {
    if (totalXp >= LEVEL_TIERS[i].min) idx = i;
  }
  const cur = LEVEL_TIERS[idx];
  const next = LEVEL_TIERS[idx + 1] || null;
  const intoLevel = totalXp - cur.min;
  const levelSpan = next ? next.min - cur.min : 1;
  const progress = next ? Math.min(100, Math.round((intoLevel / levelSpan) * 100)) : 100;
  return {
    level: cur.level,
    name: cur.name,
    intoLevel,
    levelSpan,
    nextName: next ? next.name : null,
    progress,
  };
}

export function computeGrowth(): GrowthState {
  const persist = loadPersist();
  const { contrib, footprintXp } = aggregateModules();
  const totalXp = persist.checkInXp + footprintXp;
  const lv = resolveLevel(totalXp);
  const t = todayStr();
  const canCheckIn = persist.lastCheckIn !== t;
  // 连续签到加成（基于当前 streak）
  const streakBonus = Math.min(STREAK_BONUS_CAP, persist.streakDays * STREAK_BONUS_PER_DAY);
  return {
    persist,
    moduleContrib: contrib,
    footprintXp,
    totalXp,
    level: lv.level,
    levelName: lv.name,
    intoLevel: lv.intoLevel,
    levelSpan: lv.levelSpan,
    nextLevelName: lv.nextName,
    progress: lv.progress,
    canCheckIn,
    streakBonus,
  };
}

/** 签到：返回更新后的 GrowthState；已签到则原样返回 */
export function checkIn(): GrowthState {
  const p = loadPersist();
  const t = todayStr();
  if (p.lastCheckIn === t) return computeGrowth();

  // 计算连续天数
  let streak = 1;
  if (p.lastCheckIn) {
    const diff = dayDiff(p.lastCheckIn, t);
    streak = diff === 1 ? p.streakDays + 1 : 1;
  }
  const bonus = Math.min(STREAK_BONUS_CAP, (streak - 1) * STREAK_BONUS_PER_DAY);
  const gain = CHECKIN_BASE + bonus;

  const next: GrowthPersist = {
    checkInXp: p.checkInXp + gain,
    streakDays: streak,
    lastCheckIn: t,
    totalCheckIns: p.totalCheckIns + 1,
  };
  savePersist(next);
  return computeGrowth();
}

export function resetGrowth(): void {
  savePersist(defaultPersist());
  try {
    removeCloudItem(GROWTH_KEY);
  } catch {
    /* 忽略 */
  }
}

export { GROWTH_KEY, CHECKIN_BASE, STREAK_BONUS_PER_DAY, STREAK_BONUS_CAP };
