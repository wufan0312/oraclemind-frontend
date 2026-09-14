'use client';

import { useEffect } from 'react';
import { requestCacheSweep } from '@/lib/requestCache';
import { astroCacheSweep } from '@/lib/astroCache';

/**
 * 本地缓存清扫器（P1-3）
 * ----------------------------------------------------------------------------
 * 应用启动后延时清扫一次 localStorage 中的请求缓存与占星缓存。
 *
 * 为什么需要：
 * - requestCache 有 30 天 TTL，但**过期不会自己消失**，只有再次读到时才惰性判废；
 *   长期不访问的老 key 会一直占用 5MB 配额（P1 风险清单 P1-3）。
 * - astroCache 的 key 含经纬度等维度，每个参数组合都是独立 key，增长更快。
 *
 * 清扫内容：过期项 + 超出条数上限的最旧项（各模块自己实现淘汰逻辑）。
 * 执行时机：挂载后 1.5s，避开首屏渲染；失败静默，绝不影响主流程。
 */
export default function CacheSweeper() {
  useEffect(() => {
    const run = () => {
      try {
        const req = requestCacheSweep();
        const astro = astroCacheSweep();
        if (req || astro) {
          // eslint-disable-next-line no-console
          console.info(`[cache-sweep] 已清理 request=${req} astro=${astro}`);
        }
      } catch {
        /* 存储不可用（隐私模式等）则忽略 */
      }
    };

    // 优先用 requestIdleCallback，不支持则退回 setTimeout
    const ric = (
      window as typeof window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;

    if (typeof ric === 'function') {
      const id = ric(run, { timeout: 3000 });
      return () => {
        const cancel = (window as typeof window & { cancelIdleCallback?: (id: number) => void })
          .cancelIdleCallback;
        if (typeof cancel === 'function') cancel(id);
      };
    }

    const id = window.setTimeout(run, 1500);
    return () => window.clearTimeout(id);
  }, []);

  return null;
}
