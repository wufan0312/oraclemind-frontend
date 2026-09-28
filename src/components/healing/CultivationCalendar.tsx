'use client';

import { useMemo } from 'react';
import { todayStr } from '@/data/healingData';

function dateToNum(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function numToStr(n: number): string {
  const d = new Date(n * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function fmtLabel(s: string): string {
  const p = s.split('-');
  return p.length === 3 ? `${Number(p[1])}月${Number(p[2])}日` : s;
}

// 由日期列表算连续 / 累计（断更超 1 天则连续清零）
function stat(dates?: string[]): { streak: number; total: number } {
  if (!dates || dates.length === 0) return { streak: 0, total: 0 };
  const nums = [...new Set(dates.map(dateToNum))].sort((a, b) => a - b);
  const today = dateToNum(todayStr());
  const total = nums.length;
  let streak = 0;
  let last = nums[nums.length - 1];
  if (last === today || last === today - 1) {
    streak = 1;
    for (let i = nums.length - 2; i >= 0; i--) {
      if (nums[i] === last - 1) { streak++; last = nums[i]; } else break;
    }
  }
  return { streak, total };
}

// 空状态演示：用零散的「点亮样本」展示 84 天铺满后的样子，消除一片空白的空旷感
function buildDemoDates(today: string): string[] {
  const base = dateToNum(today);
  const offsets = [0, 2, 4, 7, 9, 13, 18, 24, 31, 39, 48, 60, 73];
  return offsets.filter(o => o <= 83).map(o => numToStr(base - o));
}

// ============================================================================
// 修行日历热力图（经典诵读 / 静坐足迹 共用）
// 展示最近 84 天（12 周）的打卡痕迹，高亮有记录的日期，hover 显示日期与是否打卡。
// 无记录时渲染「示例预览」+ 引导，避免一片空白。
// ============================================================================
export default function CultivationCalendar({ dates, title, emptyHint, onStart, startLabel }: {
  dates: string[];
  title: string;
  emptyHint?: string;
  onStart?: () => void;
  startLabel?: string;
}) {
  const realDates = dates || [];
  const isEmpty = realDates.length === 0;
  const today = todayStr();
  const todayNum = dateToNum(today);

  const demoDates = useMemo(() => buildDemoDates(today), [today]);
  const activeSet = isEmpty ? new Set(demoDates) : new Set(realDates);

  // 最近 84 天，从最早到今天
  const days: { date: string; inPast: boolean }[] = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({ date: ds, inPast: dateToNum(ds) <= todayNum });
  }

  const { streak, total } = stat(realDates);

  return (
    <div className={'cultivation-calendar' + (isEmpty ? ' demo' : '')}>
      <div className="cc-head">
        <div className="cc-title">
          {title}
          {isEmpty && <span className="cc-demo-tag">示例预览</span>}
        </div>
        <div className="cc-stat">
          <span><b>{streak}</b> 连续</span>
          <span><b>{total}</b> 累计</span>
        </div>
      </div>

      <div className="cc-grid">
        {days.map(d => {
          const hit = activeSet.has(d.date);
          return (
            <div
              key={d.date}
              className={'cc-cell' + (hit ? ' active' : '') + (d.inPast ? '' : ' future')}
              title={`${fmtLabel(d.date)}${hit ? ' · 已打卡' : (d.inPast ? ' · 未打卡' : ' · 未来')}`}
            />
          );
        })}
      </div>

      <div className="cc-legend">
        <span className="cc-legend-item"><i className="cc-dot" /> 已打卡</span>
        <span className="cc-legend-item"><i className="cc-dot off" /> 未打卡</span>
      </div>

      {isEmpty && (
        <div className="cc-empty-state">
          <div className="cc-empty-text">
            这是 <b>84 天修行地图</b> 点亮后的样子 ✨ 现在还是一片空白——
            <b>今天静坐一次，点亮属于你的第一格</b> 🌟
          </div>
          {onStart && (
            <button className="cc-start-btn" onClick={onStart}>
              {startLabel || '🌬️ 开始静坐'}
            </button>
          )}
          {!onStart && emptyHint && <div className="cc-empty-hint">{emptyHint}</div>}
        </div>
      )}
    </div>
  );
}
