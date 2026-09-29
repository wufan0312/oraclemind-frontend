'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 全局搜索框（全局搜索）
 * 输入即跳转 /search?q=，由搜索页聚合功能入口与各模块本地记录。
 */
export default function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');

  const go = () => {
    const kw = q.trim();
    router.push(kw ? `/search?q=${encodeURIComponent(kw)}` : '/search');
  };

  return (
    <div className="global-search">
      <span className="global-search-icon">🔍</span>
      <input
        className="global-search-input"
        placeholder="搜索功能或你的占卜记录…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') go();
        }}
      />
      <button className="global-search-btn" onClick={go} aria-label="搜索">搜索</button>
    </div>
  );
}
