'use client';

// ============================================================================
// 玄镜 OracleMind · 占星结果客户端缓存
// ----------------------------------------------------------------------------
// 相同出生参数的请求结果缓存到 localStorage（24h TTL），避免重复请求后端。
//
// P1-2 改造（2026-09-08）：
//  1. **命名空间**：key 加入 owner（anon / u:{userId}），与 requestCache 口径一致，
//     解决公共电脑上账号切换串数据的问题；
//  2. **LRU 淘汰**：原先 key 永不清理，多胎测试 / 多家庭成员 / 公共电脑场景下
//     每个参数组合都生成独立 key，可撑爆 5MB 配额。现在限制条数，超限淘汰最旧。
//
// P2-1/A 收口（2026-09-08）：所有 localStorage 读写统一经 storage 层
// （grep `localStorage.` 在本文件应归零），迭代改用 storage.allKeys()。
// ============================================================================

import type { AstroBirth } from './api';
import { getCacheOwner, hashParams } from './cacheKey';
import { storage } from './storage';

const PREFIX = 'om_astro_v1';
const TTL = 24 * 60 * 60 * 1000; // 24 小时

/** 单 owner 下最多保留的条目数，超出按写入时间淘汰最旧的一半 */
const MAX_ENTRIES = 40;

interface AstroEntry<T> {
  d: T;
  t: number;
}

function buildKey(type: string, birth: AstroBirth, extra?: string): string {
  // houseSystem / unknownTime / utcOffset 必须参与：它们不改变「是谁」，
  // 却改变「算出来是什么」。缺任何一个都会出现「用户改了参数、盘纹丝不动」。
  // 曾因漏掉 houseSystem，导致后端刚修好的宫制透传在前端缓存层被完全抵消。
  // 这里整体 hash，保证任何入参变化都能反映到 key 上。
  const hash = hashParams({
    type,
    birthDate: birth.birthDate,
    birthTime: birth.birthTime,
    lat: birth.latitude.toFixed(4),
    lng: birth.longitude.toFixed(4),
    houseSystem: birth.houseSystem ?? 'equal',
    unknownTime: birth.unknownTime ? 'unk' : 'known',
    utcOffset: birth.utcOffset ?? 0,
    extra: extra ?? '',
  });
  return `${PREFIX}:${getCacheOwner()}:${type}:${hash}`;
}

/** 当前 owner 下的缓存条数（调试 / 运维用） */
export function astroCacheCount(): number {
  const p = `${PREFIX}:${getCacheOwner()}:`;
  let n = 0;
  for (const k of storage.allKeys()) {
    if (k.startsWith(p)) n++;
  }
  return n;
}

/**
 * 清理占星缓存：先删过期（>24h），仍超限则按写入时间淘汰最旧的。
 *
 * 应在应用启动时调用一次（见 components/system/CacheSweeper），
 * 也在每次写入后自动调用，避免长期运行无限增长。
 *
 * @returns 被删除的条数
 */
export function astroCacheSweep(keep: number = MAX_ENTRIES): number {
  const p = `${PREFIX}:${getCacheOwner()}:`;
  const now = Date.now();
  const alive: { key: string; ts: number }[] = [];
  let removed = 0;

  for (const k of storage.allKeys()) {
    if (!k.startsWith(p)) continue;
    try {
      const raw = storage.getItem(k);
      if (!raw) continue;
      const entry = JSON.parse(raw) as AstroEntry<unknown>;
      // 过期或结构损坏 → 直接删
      if (!entry || typeof entry.t !== 'number' || now - entry.t > TTL) {
        storage.removeItem(k);
        removed++;
        continue;
      }
      alive.push({ key: k, ts: entry.t });
    } catch {
      storage.removeItem(k);
      removed++;
    }
  }

  // 仍超限：按时间升序，删掉最旧的（保留 keep 条）
  if (alive.length > keep) {
    alive.sort((a, b) => a.ts - b.ts);
    for (let i = 0; i < alive.length - keep; i++) {
      storage.removeItem(alive[i].key);
      removed++;
    }
  }
  return removed;
}

/** 读取缓存（过期返回 null） */
export function getAstroCache<T>(type: string, birth: AstroBirth, extra?: string): T | null {
  try {
    const raw = storage.getItem(buildKey(type, birth, extra));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AstroEntry<T>;
    if (Date.now() - parsed.t > TTL) return null;
    return parsed.d;
  } catch {
    return null;
  }
}

/** 写入缓存（写后自动 LRU 淘汰） */
export function setAstroCache<T>(type: string, birth: AstroBirth, data: T, extra?: string): void {
  try {
    storage.setItem(
      buildKey(type, birth, extra),
      JSON.stringify({ d: data, t: Date.now() } satisfies AstroEntry<T>),
    );
    // 写入后顺便 sweeping，控制总量
    astroCacheSweep();
  } catch {
    /* localStorage 满或隐私模式，静默忽略 */
  }
}

/** 判断是否有缓存（用于决定是否跳过流式动画） */
export function hasAstroCache(type: string, birth: AstroBirth, extra?: string): boolean {
  return getAstroCache(type, birth, extra) !== null;
}

/**
 * 读取缓存（过期也返回），供后端不可达时回退本地副本（§3 风险第 8 条：断网可恢复）。
 * 调用方需自行判断数据时效性（如提示「离线副本」）。
 */
export function getAstroCacheStale<T>(type: string, birth: AstroBirth, extra?: string): T | null {
  try {
    const raw = storage.getItem(buildKey(type, birth, extra));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AstroEntry<T>;
    return parsed.d ?? null;
  } catch {
    return null;
  }
}

/** 清空当前 owner 的全部占星缓存（登出时调用） */
export function clearAstroCacheForOwner(owner: string): number {
  if (!owner) return 0;
  const p = `${PREFIX}:${owner}:`;
  const toRemove = storage.allKeys().filter((k) => k.startsWith(p));
  toRemove.forEach((k) => storage.removeItem(k));
  return toRemove.length;
}
