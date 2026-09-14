'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { computeGrowth, checkIn, type GrowthState } from '@/lib/growth';

/**
 * 首页「我的修行境界」成长卡片（用户成长体系）
 * - 等级 / 称号 / 灵修值进度
 * - 每日签到（连续天数加成）
 * - 各模块修行足迹聚合（实时）
 *
 * 挂载位置：**只有个人中心 /profile**（2026-09-10 起首页不再展示此卡片）。
 * hideLink 用于隐藏卡片内的"查看个人中心 →"跳转（个人中心内联时不需要）。
 */
export default function GrowthCard({ hideLink = false }: { hideLink?: boolean }) {
  const [state, setState] = useState<GrowthState | null>(null);
  const [justGain, setJustGain] = useState<number | null>(null);

  const refresh = useCallback(() => setState(computeGrowth()), []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onCheckIn = () => {
    const before = state?.persist.checkInXp ?? 0;
    const next = checkIn();
    const after = next.persist.checkInXp;
    setJustGain(after - before);
    setState(next);
    window.setTimeout(() => setJustGain(null), 2400);
  };

  if (!state) return null;

  const maxContrib = Math.max(1, ...state.moduleContrib.map((c) => c.count));

  return (
    <div className="growth-card">
      <div className="growth-head">
        <div className="growth-title">🪷 我的修行境界</div>
        {!hideLink && (
          <Link href="/profile" className="growth-link">查看个人中心 →</Link>
        )}
      </div>

      <div className="growth-body">
        <div className="growth-level-badge">
          <div className="growth-level-num">{state.level}</div>
          <div className="growth-level-name">{state.levelName}</div>
        </div>

        <div className="growth-main">
          <div className="growth-xp-row">
            <span className="growth-xp-val">{state.totalXp}</span>
            <span className="growth-xp-unit">灵修值</span>
            {state.nextLevelName ? (
              <span className="growth-next">距「{state.nextLevelName}」还需 {Math.max(0, state.levelSpan - state.intoLevel)}</span>
            ) : (
              <span className="growth-next">已达最高境界 · 大觉</span>
            )}
          </div>

          <div className="growth-progress">
            <div className="growth-progress-fill" style={{ width: `${state.progress}%` }} />
          </div>

          <div className="growth-foot-row">
            <button
              className={'growth-checkin' + (state.canCheckIn ? '' : ' done')}
              onClick={onCheckIn}
              disabled={!state.canCheckIn}
            >
              {state.canCheckIn ? (
                <>📿 今日签到 +{10 + state.streakBonus}{state.streakBonus > 0 ? `（连${state.persist.streakDays}天+${state.streakBonus}）` : ''}</>
              ) : (
                <>✅ 今日已签到{state.persist.streakDays > 0 ? ` · 连续 ${state.persist.streakDays} 天` : ''}</>
              )}
            </button>
            {justGain !== null && justGain > 0 && (
              <span className="growth-gain">+{justGain} 灵修值</span>
            )}
          </div>
        </div>
      </div>

      <div className="growth-modules">
        <div className="growth-modules-label">修行足迹</div>
        <div className="growth-modules-list">
          {state.moduleContrib.map((c) => (
            <div key={c.key} className="growth-module" title={`${c.label}：${c.raw} 条记录`}>
              <span className="growth-module-icon">{c.icon}</span>
              <span className="growth-module-label">{c.label}</span>
              <span className="growth-module-bar">
                <span className="growth-module-bar-fill" style={{ width: `${Math.round((c.count / maxContrib) * 100)}%` }} />
              </span>
              <span className="growth-module-count">{c.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
