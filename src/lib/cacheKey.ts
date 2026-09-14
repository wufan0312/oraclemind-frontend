'use client';

import { storage } from './storage';
import { hashStr } from './hash';

// ============================================================================
// 缓存键公共工具 —— 归属隔离 + 稳定 hash
// ----------------------------------------------------------------------------
// 数据存储重设计方案 §二(L1)：所有本地缓存按登录身份做命名空间隔离，
// 避免公共电脑上账号切换串数据、或登出后仍能读到上一账号的缓存。
//
// P1-4 修订：token 已移入后端 httpOnly Cookie（JS 不可读，防 XSS 窃取），
// 此处只存**非敏感**的 owner 标识 `om_cache_owner`（anon / u:{userId}），
// 供 astroCache / requestCache 做命名空间隔离，不再解析 JWT。
//
// 被 requestCache / astroCache 共用，保证两处 owner 计算口径完全一致。
// ============================================================================

/** 缓存归属标识的 localStorage key（非敏感：不含 token） */
export const CACHE_OWNER_KEY = 'om_cache_owner';

/**
 * 读取当前缓存归属：
 * - 未登录 → 'anon'
 * - 已登录 → `u:{userId}`（由 AuthContext 在登录成功后写入）
 */
export function getCacheOwner(): string {
  if (typeof window === 'undefined') return 'anon';
  return storage.getItem(CACHE_OWNER_KEY) || 'anon';
}

/** 登录成功后记录归属（非敏感，可被任意 JS 读取，但无认证风险） */
export function setCacheOwner(owner: string): void {
  if (typeof window === 'undefined') return;
  storage.setItem(CACHE_OWNER_KEY, owner);
}

/** 登出时清除归属标识 */
export function clearCacheOwner(): void {
  if (typeof window === 'undefined') return;
  storage.removeItem(CACHE_OWNER_KEY);
}

/**
 * 稳定 hash：相同入参必得相同 key（JSON 序列化 + djb2）。
 * 用于把长参数（出生信息、经纬度等）压缩成短 key，避免 localStorage key 过长。
 */
export function hashParams(params: unknown): string {
  try {
    const s = typeof params === 'string' ? params : JSON.stringify(params ?? null);
    return hashStr(s).toString(36);
  } catch {
    return 'fallback';
  }
}
