// 统一请求缓存层
// 设计目标：参数不变时，前端先查 localStorage 命中即返回，不再调用接口（省网络往返、省 AI token）。
// 仅用于「非流式、幂等」的读接口（排盘 / AI 解读 / 占星 / 每日运势 / 历史列表）。
// 流式接口（*Stream）不在此层缓存 —— AI 服务自身已有响应缓存，省的是重算而非网络。
//
// 数据存储重设计方案 §二(L1)：缓存 key 按登录身份做命名空间隔离。
// - 未登录 → owner='anon'
// - 已登录 → owner=`u:{userId}`（解析 JWT sub，按账号隔离，避免公共电脑泄露 / 账号切换串数据）
// 登出时调用 clearRequestCacheForOwner(owner) 清掉当前身份缓存。
//
// P2-1/A 收口（2026-09-08）：所有 localStorage 读写统一经 storage 层
// （grep `localStorage.` 在本文件应归零），迭代改用 storage.allKeys()。

import { getCacheOwner, hashParams } from './cacheKey';
import { storage } from './storage';

const PREFIX = 'om_reqcache_v2';

/** 分类型 TTL（毫秒） */
export const REQ_CACHE_TTL = {
  /** 排盘 / AI 解读类：同参数结果恒定，长期缓存 */
  long: 30 * 24 * 60 * 60 * 1000,
  /** 每日运势：每天刷新 */
  daily: 24 * 60 * 60 * 1000,
  /** 历史列表等易变数据：短时效 */
  short: 5 * 60 * 1000,
} as const;

export type ReqCacheTTL = keyof typeof REQ_CACHE_TTL | number;

interface CacheEntry<T> {
  d: T;
  t: number;
  /** 写入时使用的 TTL(ms)，供 sweep 精确判断过期（各 namespace 的 TTL 不同） */
  ttl?: number;
}

function storageKey(namespace: string, params: unknown): string {
  return `${PREFIX}:${getCacheOwner()}:${namespace}:${hashParams(params)}`;
}

export interface CachedRequestResult<T> {
  data: T;
  /** true 表示来自缓存、未发起网络请求 */
  fromCache: boolean;
  /** true 表示来自过期本地副本（后端不可达时的离线兜底），供 UI 提示「离线副本」 */
  stale?: boolean;
}

/**
 * 统一缓存读接口。
 * @param namespace 业务命名空间（如 'bazi' / 'interpret' / 'tarot-daily'），用于隔离不同接口
 * @param params     请求入参（用于生成缓存 key，必须可 JSON 序列化）
 * @param fetcher    真实请求函数（仅在缓存未命中时调用，闭包 signal 等）
 * @param ttl       时效：'long' | 'daily' | 'short' 或自定义毫秒数
 */
export async function cachedRequest<T>(
  namespace: string,
  params: unknown,
  fetcher: () => Promise<T>,
  ttl: ReqCacheTTL = 'long',
): Promise<CachedRequestResult<T>> {
  const ms = typeof ttl === 'number' ? ttl : REQ_CACHE_TTL[ttl];
  const key = storageKey(namespace, params);

  // 先查本地：命中且未过期直接返回；命中但已过期则暂存为「过期副本」，
  // 待后端请求失败时回退（§3 风险第 8 条：断网可恢复）。
  let cachedExpired: CacheEntry<T> | null = null;
  try {
    const raw = storage.getItem(key);
    if (raw) {
      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (Date.now() - entry.t < ms) {
        return { data: entry.d, fromCache: true, stale: false };
      }
      cachedExpired = entry;
    }
  } catch {
    /* 解析失败则忽略，走真实请求 */
  }

  try {
    const data = await fetcher();
    try {
      // 记录 ttl：sweep 时才能按当初的时效精确判断，而不是一律按 long 处理
      storage.setItem(key, JSON.stringify({ d: data, t: Date.now(), ttl: ms }));
    } catch {
      /* 隐私模式 / 容量满：静默忽略，不影响主流程 */
    }
    return { data, fromCache: false, stale: false };
  } catch (err) {
    // 后端不可达 / 请求异常：回退到本地（即便过期）副本，标记 stale
    if (cachedExpired) {
      return { data: cachedExpired.d, fromCache: true, stale: true };
    }
    throw err;
  }
}

/** 是否命中缓存（供调用方做 UI 提示，如「已缓存」标签） */
export function peekRequestCache(namespace: string, params: unknown): boolean {
  const raw = storage.getItem(storageKey(namespace, params));
  if (!raw) return false;
  try {
    const entry = JSON.parse(raw) as CacheEntry<unknown>;
    return Date.now() - entry.t < REQ_CACHE_TTL.long;
  } catch {
    return false;
  }
}

/** 清除全部请求缓存，返回清除条数 */
export function clearRequestCache(): number {
  const toRemove = storage.allKeys().filter((k) => k.startsWith(`${PREFIX}:`));
  toRemove.forEach((k) => storage.removeItem(k));
  return toRemove.length;
}

/** 清除指定归属（owner）下的请求缓存，返回清除条数（登出时调用） */
export function clearRequestCacheForOwner(owner: string): number {
  if (!owner) return 0;
  const prefix = `${PREFIX}:${owner}:`;
  const toRemove = storage.allKeys().filter((k) => k.startsWith(prefix));
  toRemove.forEach((k) => storage.removeItem(k));
  return toRemove.length;
}

/** 获取当前缓存归属（供登出前捕获，避免清错命名空间） */
export function getCurrentCacheOwner(): string {
  return getCacheOwner();
}

/** 当前请求缓存条数 */
export function requestCacheCount(): number {
  let n = 0;
  for (const k of storage.allKeys()) {
    if (k.startsWith(`${PREFIX}:`)) n++;
  }
  return n;
}

/**
 * 清理请求缓存（P1-3）：先删过期，仍超限则按写入时间淘汰最旧的。
 *
 * 过期判断用**每条自己的 ttl**（写入时记录），而不是一律按 long(30d) 处理 ——
 * 否则 daily(24h) / short(5min) 的缓存在 sweep 时会被误判为「未过期」而留下来。
 *
 * 扫描范围不限当前 owner：已登出账号的残留缓存也一并清掉。
 * 应在应用启动时调用一次（见 components/system/CacheSweeper）。
 *
 * @param maxEntries 保留上限，超出淘汰最旧的
 * @returns 被删除的条数
 */
export function requestCacheSweep(maxEntries: number = 300): number {
  const now = Date.now();
  const alive: { key: string; ts: number }[] = [];
  let removed = 0;

  for (const k of storage.allKeys()) {
    if (!k.startsWith(`${PREFIX}:`)) continue;
    try {
      const raw = storage.getItem(k);
      if (!raw) continue;
      const entry = JSON.parse(raw) as CacheEntry<unknown>;
      if (!entry || typeof entry.t !== 'number') {
        storage.removeItem(k);
        removed++;
        continue;
      }
      const ttl = typeof entry.ttl === 'number' ? entry.ttl : REQ_CACHE_TTL.long;
      if (now - entry.t > ttl) {
        storage.removeItem(k);
        removed++;
        continue;
      }
      alive.push({ key: k, ts: entry.t });
    } catch {
      // 解析失败（脏数据）→ 删掉
      storage.removeItem(k);
      removed++;
    }
  }

  // 仍超限：按时间升序，淘汰最旧的
  if (alive.length > maxEntries) {
    alive.sort((a, b) => a.ts - b.ts);
    for (let i = 0; i < alive.length - maxEntries; i++) {
      storage.removeItem(alive[i].key);
      removed++;
    }
  }
  return removed;
}
