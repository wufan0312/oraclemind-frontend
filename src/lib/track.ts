'use client';

import { storage, registerLegacy } from './storage';

// ===== 本地埋点（零后端依赖） =====
// 此前全站没有任何埋点，无法回答「哪个牌阵用得最多」「解读完成率多少」「平均等多久」这类
// 最基本的运营问题。这里只做**本地流水**：事件写 localStorage，不上传任何服务器，
// 因此不涉及隐私合规，也不给后端增加存储负担。
//
// 约定：
//  - action 用「模块.动作」命名，如 `tarot.draw` / `tarot.interpret`；
//  - 成败用 props.ok 表达（true/false），统计侧据此算成功率；
//  - 耗时统一叫 props.latencyMs，统计侧据此算均值。

/** 事件流水 key（已收口到统一 storage 层，旧 key 惰性迁移） */
const TRACK_KEY = 'om_track_events';
// 旧 key 惰性迁移：首次读到新 key 缺失时自动回退旧键并复制
registerLegacy('oraclemind_track_events', 'om_track_events');
/** 最多保留的事件条数：超出后丢掉最旧的一半，避免 localStorage 被写满 */
const TRACK_LIMIT = 500;

export interface TrackEvent {
  ts: number;
  module: string;
  action: string;
  props?: Record<string, string | number | boolean>;
}

/** 记录一次事件。存储不可用（隐私模式 / 配额满）时静默失败，绝不影响主流程。 */
export function track(
  module: string,
  action: string,
  props?: Record<string, string | number | boolean>
): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = storage.getItem(TRACK_KEY);
    let list: TrackEvent[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    list.push({ ts: Date.now(), module, action, ...(props ? { props } : {}) });
    // 超限：保留较新的一半，宁可丢历史也不撑爆存储
    if (list.length > TRACK_LIMIT) list = list.slice(Math.floor(TRACK_LIMIT / 2));
    storage.setItem(TRACK_KEY, JSON.stringify(list));
  } catch {
    /* 埋点失败不影响业务 */
  }
}

/** 读取全部事件 */
export function getEvents(): TrackEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = storage.getItem(TRACK_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as TrackEvent[]) : [];
  } catch {
    return [];
  }
}

/** 清空全部事件 */
export function clearEvents(): void {
  if (typeof window === 'undefined') return;
  try {
    storage.removeItem(TRACK_KEY);
  } catch {
    /* 忽略 */
  }
}

/** 按 action 计数（降序） */
export function countByAction(events: TrackEvent[]): { action: string; count: number }[] {
  const map = new Map<string, number>();
  for (const e of events) map.set(e.action, (map.get(e.action) || 0) + 1);
  return [...map.entries()]
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count);
}

/** 按某个 props 字段计数（降序），字段缺失的事件跳过 */
export function countByProp(
  events: TrackEvent[],
  prop: string
): { key: string; count: number }[] {
  const map = new Map<string, number>();
  for (const e of events) {
    const v = e.props?.[prop];
    if (v === undefined || v === null || typeof v === 'boolean') continue;
    const k = String(v);
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

/** 数值型 props 的平均值；一条都没有时返回 null（0 与「无数据」必须区分） */
export function avgProp(events: TrackEvent[], prop: string): number | null {
  let sum = 0;
  let n = 0;
  for (const e of events) {
    const v = e.props?.[prop];
    if (typeof v === 'number' && Number.isFinite(v)) {
      sum += v;
      n += 1;
    }
  }
  return n ? sum / n : null;
}

/** 成功率：props.ok 为 true 的比例；样本为空返回 null */
export function successRate(events: TrackEvent[]): number | null {
  let ok = 0;
  let n = 0;
  for (const e of events) {
    if (typeof e.props?.ok !== 'boolean') continue;
    n += 1;
    if (e.props.ok) ok += 1;
  }
  return n ? ok / n : null;
}

/** 过滤：指定模块 + 时间窗口（毫秒，默认全部） */
export function filterEvents(events: TrackEvent[], module: string, sinceMs?: number): TrackEvent[] {
  const floor = sinceMs ? Date.now() - sinceMs : 0;
  return events.filter((e) => e.module === module && e.ts >= floor);
}
