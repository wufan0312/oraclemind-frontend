'use client';

/**
 * 玄镜 · 命运轨迹（用户成长留存体系）
 * --------------------------------------------------------------------------
 * 设计：各模块每次完成一次测算/占卜，都向这里追加一条带时间戳的记录。
 * 这是「命运数据库 / 轨迹留存」的唯一数据源——只追加、不去重（与
 * crossReadings 的「各模块最新结论池」分工不同：crossReadings 去重用于报告融合，
 * 本文件保留每一次查询，用于竞品同款的时间线 + 月度复盘）。
 *
 * 写入：pushTrajectory（本地 + 异步上云，复用 cloudStore.setCloudItem）。
 * 读取：getTrajectory（按时间倒序）、groupByMonth（按月分组）。
 * 播种：seedTrajectory（首启用旧 crossReadings / tarot_history 回填，避免老用户空白）。
 */

import { storage } from '@/lib/storage';
import { setCloudItem } from '@/lib/cloudStore';

const TRAJ_KEY = 'om_trajectory';
const TRAJ_LIMIT = 500;

/** 轨迹条目类型（兼容 crossReadings 的 type，并扩展 bugua/dream/ming） */
export type TrajectoryType =
  | 'tarot'
  | 'numerology'
  | 'horoscope'
  | 'report'
  | 'bugua'
  | 'dream'
  | 'ming';

export interface TrajectoryItem {
  type: TrajectoryType | string;
  label: string;
  summary: string;
  ts: number;
}

/** 模块展示元数据（图标 + 主题色），供时间线渲染 */
export const TRAJ_MODULE_META: Record<string, { icon: string; color: string }> = {
  tarot: { icon: '🎴', color: '#a78bfa' },
  numerology: { icon: '🔢', color: '#60a5fa' },
  horoscope: { icon: '✨', color: '#f472b6' },
  report: { icon: '🔮', color: '#c084fc' },
  bugua: { icon: '☯', color: '#34d399' },
  dream: { icon: '🌙', color: '#818cf8' },
  ming: { icon: '✒️', color: '#fbbf24' },
};

export function moduleMeta(type: string): { icon: string; color: string } {
  return TRAJ_MODULE_META[type] || { icon: '🔯', color: '#9b8cff' };
}

/** 追加一条轨迹（不去重，保留每一次查询） */
export function pushTrajectory(item: Omit<TrajectoryItem, 'ts'>): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getTrajectory();
    list.push({ ...item, ts: Date.now() });
    if (list.length > TRAJ_LIMIT) list.splice(0, list.length - TRAJ_LIMIT);
    setCloudItem(TRAJ_KEY, JSON.stringify(list));
  } catch {
    /* 存储不可用（隐私模式/配额满）则跳过，不影响主流程 */
  }
}

/** 读取全部轨迹，按时间倒序 */
export function getTrajectory(): TrajectoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = storage.getItem(TRAJ_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return (arr as TrajectoryItem[])
      .filter((it) => it && typeof it.ts === 'number')
      .sort((a, b) => b.ts - a.ts);
  } catch {
    return [];
  }
}

/** 清空轨迹（含云端） */
export function clearTrajectory(): void {
  try {
    setCloudItem(TRAJ_KEY, JSON.stringify([]));
  } catch {
    /* ignore */
  }
}

/** 当月（YYYY-MM）轨迹 */
export function getMonthTrajectory(monthKey?: string): TrajectoryItem[] {
  const key = monthKey || currentMonthKey();
  return getTrajectory().filter((it) => tsToMonthKey(it.ts) === key);
}

/** 按月份分组（倒序：新月份在前） */
export function groupByMonth(items: TrajectoryItem[]): { key: string; label: string; items: TrajectoryItem[] }[] {
  const map = new Map<string, TrajectoryItem[]>();
  for (const it of items) {
    const k = tsToMonthKey(it.ts);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, list]) => ({
      key,
      label: `${key.slice(0, 4)}年${Number(key.slice(5))}月`,
      items: list.sort((a, b) => b.ts - a.ts),
    }));
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function tsToMonthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 首启播种：用旧 crossReadings + tarot_history 回填，避免老用户时间线空白 */
export function seedTrajectory(items: TrajectoryItem[]): void {
  if (typeof window === 'undefined') return;
  if (getTrajectory().length > 0) return;
  if (!items.length) return;
  const sorted = items.slice().sort((a, b) => a.ts - b.ts).slice(-TRAJ_LIMIT);
  try {
    setCloudItem(TRAJ_KEY, JSON.stringify(sorted));
  } catch {
    /* ignore */
  }
}

/* ============================= 月度复盘报告 ============================= */

const REVIEW_KEY = 'om_monthly_reviews';

export interface MonthlyReview {
  monthKey: string;
  text: string;
  ts: number;
}

/** 保存一份月度复盘（按月份覆盖） */
export function saveMonthlyReview(monthKey: string, text: string): void {
  if (typeof window === 'undefined' || !text.trim()) return;
  try {
    const list = getMonthlyReviews().filter((r) => r.monthKey !== monthKey);
    list.push({ monthKey, text, ts: Date.now() });
    setCloudItem(REVIEW_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function getMonthlyReviews(): MonthlyReview[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = storage.getItem(REVIEW_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as MonthlyReview[]) : [];
  } catch {
    return [];
  }
}

export function getMonthlyReview(monthKey: string): MonthlyReview | null {
  return getMonthlyReviews().find((r) => r.monthKey === monthKey) || null;
}
