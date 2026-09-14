'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export interface UseUrlStateConfig<K extends string> {
  /** 需要同步进 URL 的字段名（白名单） */
  keys: K[];
  /** 从 URL 读入时反序列化（如把 '1'/'0' 还原为业务值） */
  parse?: (raw: string, key: K) => string;
  /** 写回 URL 时序列化 */
  serialize?: (value: string, key: K) => string;
}

/**
 * 统一 URL ↔ 组件状态同步（此前 6 个页面各自手写
 * `URLSearchParams` + `history.replaceState`）。
 *
 * - 初始从 `?k=v` 读取，SSR/首屏安全
 * - 浏览器前进/后退等外部 URL 变化自动同步回 state
 * - `setKey`/`setValues` 写回用 `router.replace`（不污染历史栈）
 */
export function useUrlState<K extends string>({
  keys,
  parse,
  serialize,
}: UseUrlStateConfig<K>) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const readFromUrl = useCallback((): Record<K, string> => {
    const out = {} as Record<K, string>;
    for (const k of keys) {
      const raw = searchParams.get(k);
      out[k] = raw != null ? (parse ? parse(raw, k) : raw) : '';
    }
    return out;
  }, [searchParams, keys, parse]);

  const [state, setState] = useState<Record<K, string>>(readFromUrl);

  // 外部 URL 变化（前进/后退/其它入口）→ 同步进 state
  useEffect(() => {
    const next = readFromUrl();
    setState((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [readFromUrl]);

  const commit = useCallback(
    (next: Record<K, string>) => {
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      for (const k of keys) {
        const v = next[k];
        const ser = serialize ? serialize(v, k) : v;
        if (!ser) params.delete(k);
        else params.set(k, ser);
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    },
    [router, searchParams, keys, serialize]
  );

  const setKey = useCallback(
    (key: K, value: string) => {
      setState((prev) => {
        const next = { ...prev, [key]: value };
        commit(next);
        return next;
      });
    },
    [commit]
  );

  const setValues = useCallback(
    (patch: Partial<Record<K, string>>) => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        commit(next);
        return next;
      });
    },
    [commit]
  );

  return { state, setKey, setValues, commit };
}
