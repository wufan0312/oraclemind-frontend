'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getShare, saveShare, type PosterResult, type ShareInput, type ShareOut } from '@/lib/api';

/**
 * 把库的分享存档（ShareOut）映射成页面展示用的 PosterResult。
 * 用于「用户第二次进入 → 从库读取 → 直接渲染」，省去一次 AI 生成 / CogView 配额。
 */
export function shareOutToPoster(s: ShareOut): PosterResult {
  return {
    shareText: s.shareText,
    imageUrl: s.imageUrl ?? null,
    imagePrompt: s.imagePrompt ?? '',
    imageError: s.imageUrl ? null : '图片未生成',
    fallback: false,
  };
}

export type ShareModule = 'tarot' | 'bugua' | 'dream';

export interface UseShareResult {
  /** 是否登录 */
  isAuthed: boolean;
  /** 认证状态是否就绪（避免首屏闪烁误判未登录） */
  ready: boolean;
  /** 从库读取到的存档（第二次进入直接展示）；无存档为 null */
  saved: ShareOut | null;
  /** 是否已向库请求过 */
  loaded: boolean;
  /** 是否正在保存 */
  saving: boolean;
  /** 把本次生成的分享落库：首次 or 重新生成都走它（后端按 user+module upsert 覆盖） */
  persist: (payload: Omit<ShareInput, 'module'>) => Promise<ShareOut | null>;
  /** 手动覆盖本地存档（如刚生成后立即本地展示，无需等库返回） */
  setSaved: (s: ShareOut | null) => void;
}

/**
 * 分享存档 Hook（玄镜 · 保存/分享功能统一封装）。
 *
 * 行为：
 * 1. 登录后首次进入页面 → 自动 GET /api/v1/shares 读取已存档，直接展示（省一次 AI 生成 / 省 CogView 配额）。
 * 2. persist() 调用 POST /api/v1/shares 落库（同 user+module 覆盖，实现「首次落库 / 重新生成更新」）。
 * 3. 所有请求自动带 Bearer token（getAuthToken）；未登录时调用方应先用登录守卫拦截。
 */
export function useShare(module: ShareModule): UseShareResult {
  const { isAuthed, ready } = useAuth();
  const [saved, setSaved] = useState<ShareOut | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadingRef = useRef(false);

  // 登录态下：首次进入从库读取已存档（用户第二次进入看到的数据从库中获取）
  useEffect(() => {
    if (!ready || !isAuthed) return;
    if (loadingRef.current) return;
    loadingRef.current = true;
    getShare(module)
      .then((d) => setSaved(d))
      .catch(() => setSaved(null))
      .finally(() => {
        loadingRef.current = false;
        setLoaded(true);
      });
  }, [ready, isAuthed, module]);

  const persist = useCallback(
    async (payload: Omit<ShareInput, 'module'>): Promise<ShareOut | null> => {
      setSaving(true);
      try {
        const d = await saveShare({ module, ...payload });
        setSaved(d);
        return d;
      } catch {
        return null;
      } finally {
        setSaving(false);
      }
    },
    [module]
  );

  return { isAuthed, ready, saved, loaded, saving, persist, setSaved };
}
