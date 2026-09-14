'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { computeGrowth, type GrowthState } from '@/lib/growth';

/**
 * 成长徽章（挂在顶部导航，全站可见修行境界）
 * 显示等级 + 灵修值，点击进入个人中心。
 */
export default function GrowthBadge() {
  const [state, setState] = useState<GrowthState | null>(null);

  useEffect(() => {
    setState(computeGrowth());
  }, []);

  if (!state) return null;

  return (
    <Link href="/profile" className="nav-growth" title={`${state.levelName} · ${state.totalXp} 灵修值`}>
      <span className="nav-growth-lv">Lv.{state.level}</span>
      <span className="nav-growth-name">{state.levelName}</span>
      <span className="nav-growth-xp">{state.totalXp}</span>
    </Link>
  );
}
