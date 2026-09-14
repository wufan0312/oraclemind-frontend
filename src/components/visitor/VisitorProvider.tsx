'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  clearVisitorBirth,
  getOrCreateVisitorId,
  getVisitorBirth,
  saveVisitorBirth,
  type VisitorBirth,
} from '@/lib/visitor';
import {
  loadUserBirth,
  saveUserBirth,
  clearUserBirthCache,
} from '@/lib/profileSync';
import { useAuth } from '@/contexts/AuthContext';
import { storage } from '@/lib/storage';
import { syncCloud } from '@/lib/cloudStore';

/** 用户模式本地缓存 key（同步读取用） */
const USER_BIRTH_CACHE_KEY = 'om_user_birth_cache';

/** 从本地缓存同步读取用户出生信息 */
function getCachedUserBirth(): VisitorBirth | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = storage.getItem(USER_BIRTH_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Partial<VisitorBirth>;
    if (!cached?.date) return null;
    return {
      date: cached.date,
      time: cached.time ?? '不详',
      gender: cached.gender ?? undefined,
      lunarYear: cached.lunarYear ?? undefined,
      lunarMonth: cached.lunarMonth ?? undefined,
      lunarDay: cached.lunarDay ?? undefined,
      province: cached.province ?? undefined,
      city: cached.city ?? undefined,
      lat: cached.lat ?? undefined,
      lng: cached.lng ?? undefined,
    };
  } catch { return null; }
}

interface VisitorContextValue {
  visitorId: string;
  birth: VisitorBirth | null;
  mode: 'visitor' | 'user';
  setBirth: (birth: VisitorBirth) => Promise<void>;
  clearBirth: () => Promise<void>;
  loading: boolean;
}

const VisitorContext = createContext<VisitorContextValue | null>(null);

/**
 * 访客/用户会话 Provider：全局共享出生信息。
 *
 * 数据源策略：
 * - 未登录（visitor 模式）：出生信息存 localStorage，跨页面/跨标签页共享
 * - 已登录（user 模式）：出生信息存后端（双写 localStorage 支持离线）
 *
 * mode 由 isAuthed 直接推导，确保始终与登录态同步。
 * birth 通过 useEffect 在登录态变化时从后端加载。
 */
export function VisitorProvider({ children }: { children: ReactNode }) {
  const { isAuthed, ready } = useAuth();
  const [visitorId] = useState(() => getOrCreateVisitorId());
  const [birth, setBirthState] = useState<VisitorBirth | null>(null);
  const [loading, setLoading] = useState(false);

  // mode 直接由 isAuthed 推导，不存 state，避免不同步
  const mode: 'visitor' | 'user' = isAuthed ? 'user' : 'visitor';

  // ===== 登录态变化 → 加载对应数据源 =====
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!ready) return;

    if (isAuthed) {
      // 用户模式：先同步读缓存（秒开），再异步从后端更新
      const cached = getCachedUserBirth();
      if (cached) setBirthState(cached);
      setLoading(true);
      loadUserBirth()
        .then((b) => {
          if (b) setBirthState(b);  // 仅在有数据时更新，避免 null 覆盖缓存
        })
        .catch(() => { /* 保留缓存数据 */ })
        .finally(() => setLoading(false));
    } else {
      // 访客模式：从 localStorage 读取
      clearUserBirthCache();
      const b = getVisitorBirth();
      setBirthState(b);
    }
  }, [isAuthed, ready]);

  // ===== 核心业务数据上云同步（P1-8）=====
  // 身份就绪后与后端 user_stash 对账：换设备 / 清浏览器数据后自动恢复排盘历史等。
  // 已登录走 httpOnly Cookie 鉴权（不传 visitorId），匿名态传 visitorId。
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!ready) return;
    void syncCloud(isAuthed ? undefined : visitorId).catch(() => {
      /* 云端不可达：本地数据继续可用，pending 留待下次补偿 */
    });
  }, [isAuthed, ready, visitorId]);

  // ===== 跨标签页同步（仅访客模式）=====
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'om_visitor_birth' && !isAuthed) {
        setBirthState(getVisitorBirth());
      }
    };
    const onCustom = (e: Event) => {
      if (!isAuthed) {
        setBirthState((e as CustomEvent<VisitorBirth | null>).detail ?? null);
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('om:visitor-change', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('om:visitor-change', onCustom);
    };
  }, [isAuthed]);

  // ===== 保存出生信息 =====
  const setBirth = useCallback(async (b: VisitorBirth) => {
    if (isAuthed) {
      try {
        await saveUserBirth(b);
      } catch { /* 后端失败保留本地 */ }
    }
    saveVisitorBirth(b);
    setBirthState(b);
  }, [isAuthed]);

  // ===== 清除出生信息 =====
  const clearBirth = useCallback(async () => {
    if (isAuthed) {
      try {
        const { requestClearProfileBirth } = await import('@/lib/api');
        await requestClearProfileBirth();
      } catch { /* ignore */ }
    }
    clearVisitorBirth();
    setBirthState(null);
  }, []);

  return (
    <VisitorContext.Provider value={{ visitorId, birth, mode, setBirth, clearBirth, loading }}>
      {children}
    </VisitorContext.Provider>
  );
}

export function useVisitor(): VisitorContextValue {
  const ctx = useContext(VisitorContext);
  if (!ctx) throw new Error('useVisitor 必须在 <VisitorProvider> 内使用');
  return ctx;
}
