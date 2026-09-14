'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import {
  requestLogin,
  requestRegister,
  requestMe,
  requestLogout,
  type AuthUser,
} from '@/lib/api';
import { getVisitorBirth, getVisitorId } from '@/lib/visitor';
import { migrateVisitorBirth, clearUserBirthCache } from '@/lib/profileSync';
import { getCurrentCacheOwner, clearRequestCacheForOwner } from '@/lib/requestCache';
import { setCacheOwner, clearCacheOwner } from '@/lib/cacheKey';
import { clearAstroCacheForOwner } from '@/lib/astroCache';

// ============================================================================
// 玄镜 OracleMind · 认证上下文
// 全局管理 token + 当前用户状态，提供 login / register / logout 方法
//
// 登录/注册成功后：
// 1. 把访客 localStorage 中的出生信息迁移到后端（仅当后端为空时）
// 2. 派发 'om:auth-change' 事件通知 VisitorProvider 切换数据源
//
// 登出时：
// 1. 清除 token
// 2. 清除用户资料缓存
// 3. 派发 'om:auth-change' 事件通知 VisitorProvider 回退到访客模式
// ============================================================================

interface AuthContextValue {
  /** 当前登录用户（未登录 null，加载中 null） */
  user: AuthUser | null;
  /** token 是否就绪（初次加载完成） */
  ready: boolean;
  /** 是否已登录 */
  isAuthed: boolean;
  /** 登录 */
  login: (username: string, password: string) => Promise<AuthUser>;
  /** 注册并自动登录 */
  register: (username: string, password: string, email?: string) => Promise<AuthUser>;
  /** 退出 */
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** 派发认证变更事件（通知 VisitorProvider 等其他模块） */
function emitAuthChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('om:auth-change'));
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  // 首次挂载：直接 /me 试探（P1-4 起 token 在 httpOnly Cookie，由浏览器自动携带）
  useEffect(() => {
    requestMe()
      .then((u) => setUser(u))
      .catch(() => {
        clearCacheOwner();
      })
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    // 带上访客ID：后端登录时把该访客名下的匿名报告认领到账号
    const res = await requestLogin(username, password, getVisitorId());
    // P1-4：仅记录非敏感 owner 标识（token 在 httpOnly Cookie，不落前端）
    setCacheOwner(`u:${res.user.id}`);
    // 先迁移访客数据到后端，再更新用户状态（确保 VisitorProvider 加载时后端已有数据）
    try {
      const visitorBirth = getVisitorBirth();
      if (visitorBirth?.date) {
        await migrateVisitorBirth(visitorBirth);
      }
    } catch {
      // 迁移失败不影响登录
    }
    setUser(res.user);
    // 通知其他模块（VisitorProvider 等）
    emitAuthChange();
    return res.user;
  }, []);

  const register = useCallback(async (username: string, password: string, email?: string) => {
    const res = await requestRegister(username, password, email);
    setCacheOwner(`u:${res.user.id}`);
    // 先迁移访客数据到后端，再更新用户状态
    try {
      const visitorBirth = getVisitorBirth();
      if (visitorBirth?.date) {
        await migrateVisitorBirth(visitorBirth);
      }
    } catch {
      // 迁移失败不影响注册
    }
    setUser(res.user);
    emitAuthChange();
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    // 通知后端拉黑当前 token 并清除 httpOnly Cookie（P1-4 启用 JWT 黑名单登出）
    try {
      await requestLogout();
    } catch {
      // 后端不可达也继续本地清理
    }
    // 清掉当前归属下的本地缓存，避免下一账号读到残留
    const owner = getCurrentCacheOwner();
    try {
      clearRequestCacheForOwner(owner);
      clearAstroCacheForOwner(owner);
    } catch { /* 忽略 */ }
    clearCacheOwner();
    setUser(null);
    // 清除用户资料缓存（保留访客 localStorage 数据）
    clearUserBirthCache();
    emitAuthChange();
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, isAuthed: !!user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/** 使用认证上下文（必须在 AuthProvider 内） */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
