'use client';

import { useEffect, useState } from 'react';

/**
 * 客户端地区 Hook
 * --------------------------------------------------------------------------
 * 读取 middleware 种下的 `om_region` Cookie（来自 Vercel `x-vercel-ip-country`）。
 * 本地开发 / 无该头时默认为 'XX'（非 CN），即完整版可见。
 *
 * `ready` 用于规避 SSR/CSR 水合不一致：首次客户端渲染与 SSR 一致（未知地区），
 * 挂载后根据 cookie 校正，避免出现 hydration mismatch 警告。
 */
export function useRegion() {
  const [country, setCountry] = useState<string>('XX');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)om_region=([^;]+)/);
    setCountry(m ? m[1] : 'XX');
    setReady(true);
  }, []);

  return {
    country,
    isCN: country === 'CN',
    ready,
  };
}
