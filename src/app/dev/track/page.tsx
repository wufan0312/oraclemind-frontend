'use client';

import '@/styles/track.scss';
import { useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import {
  getEvents,
  countByAction,
  successRate,
  avgProp,
  clearEvents,
  type TrackEvent,
} from '@/lib/track';

const RANGES = [
  { label: '全部', ms: 0 },
  { label: '近 1 天', ms: 86_400_000 },
  { label: '近 7 天', ms: 604_800_000 },
  { label: '近 30 天', ms: 2_592_000_000 },
];

function fmtRate(v: number | null): { text: string; cls: string } {
  if (v === null) return { text: '—', cls: 'rate-none' };
  const pct = (v * 100).toFixed(1) + '%';
  return {
    text: pct,
    cls: v >= 0.9 ? 'rate-high' : v >= 0.7 ? 'rate-mid' : 'rate-low',
  };
}
function fmtMs(v: number | null): string {
  return v === null ? '—' : `${Math.round(v)} ms`;
}
function fmtTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return String(ts);
  }
}

export default function TrackDashboard() {
  const [events, setEvents] = useState<TrackEvent[]>([]);
  const [rangeMs, setRangeMs] = useState(0);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setEvents(getEvents());
  }, [version]);

  const filtered = useMemo(() => {
    if (!rangeMs) return events;
    const floor = Date.now() - rangeMs;
    return events.filter((e) => e.ts >= floor);
  }, [events, rangeMs]);

  const total = filtered.length;
  const rate = useMemo(() => successRate(filtered), [filtered]);
  const avgLatency = useMemo(() => avgProp(filtered, 'latencyMs'), [filtered]);
  const modules = useMemo(
    () => Array.from(new Set(filtered.map((e) => e.module))),
    [filtered]
  );
  const actionCounts = useMemo(() => countByAction(filtered), [filtered]);
  const maxCount = actionCounts.length ? actionCounts[0].count : 1;

  const moduleStats = useMemo(
    () =>
      modules
        .map((m) => {
          const me = filtered.filter((e) => e.module === m);
          return {
            module: m,
            count: me.length,
            rate: successRate(me),
            latency: avgProp(me, 'latencyMs'),
          };
        })
        .sort((a, b) => b.count - a.count),
    [modules, filtered]
  );

  const recent = useMemo(
    () => [...filtered].sort((a, b) => b.ts - a.ts).slice(0, 100),
    [filtered]
  );

  const rateFmt = fmtRate(rate);

  const handleClear = () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('确认清空全部本地埋点事件？此操作不可恢复。')
    ) {
      return;
    }
    clearEvents();
    setVersion((v) => v + 1);
  };

  return (
    <main className="track-page">
      <header>
        <h1>本地埋点看板</h1>
        <p>
          数据仅存于当前浏览器 localStorage，不上传任何服务器，不涉及隐私合规。
          用于回答「哪个牌阵用得最多 / 解读完成率多少 / 平均等待多久」等运营问题。
        </p>
      </header>

      <div className="track-toolbar">
        {RANGES.map((r) => (
          <button
            key={r.label}
            className={'range-btn' + (rangeMs === r.ms ? ' active' : '')}
            onClick={() => setRangeMs(r.ms)}
          >
            {r.label}
          </button>
        ))}
        <span className="spacer" />
        <button className="ghost-btn" onClick={() => setVersion((v) => v + 1)}>
          🔄 刷新
        </button>
        <button className="ghost-btn" onClick={handleClear}>
          🗑 清空
        </button>
      </div>

      <div className="track-stats">
        <Card title="总事件数">
          <div className="stat-value">{total}</div>
          <div className="stat-sub">{rangeMs ? '当前时间范围内' : '全部历史'}</div>
        </Card>
        <Card title="成功率 (ok=true)">
          <div className={'stat-value ' + rateFmt.cls}>{rateFmt.text}</div>
          <div className="stat-sub">仅统计含 ok 字段的事件</div>
        </Card>
        <Card title="平均耗时 (latencyMs)">
          <div className="stat-value">{fmtMs(avgLatency)}</div>
          <div className="stat-sub">数值型事件求均值</div>
        </Card>
        <Card title="覆盖模块">
          <div className="stat-value">{modules.length}</div>
          <div className="stat-sub">{modules.join(' · ') || '—'}</div>
        </Card>
      </div>

      <Card title="动作使用频次（countByAction）" titleIcon="📈" className="block-card">
        {actionCounts.length === 0 ? (
          <p className="empty-hint">
            暂无事件。去各页面操作（抽牌、解读、起卦等）后回来查看。
          </p>
        ) : (
          <div className="bar-list">
            {actionCounts.map((a) => (
              <div className="bar-row" key={a.action}>
                <span className="bar-label" title={a.action}>
                  {a.action}
                </span>
                <span className="bar-track">
                  <span
                    className="bar-fill"
                    style={{ width: `${(a.count / maxCount) * 100}%` }}
                  />
                </span>
                <span className="bar-count">{a.count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="模块维度：成功率 / 平均耗时"
        titleIcon="🧩"
        className="block-card"
      >
        {moduleStats.length === 0 ? (
          <p className="empty-hint">暂无事件。</p>
        ) : (
          <div className="table-wrap">
            <table className="track-table">
              <thead>
                <tr>
                  <th>模块</th>
                  <th>事件数</th>
                  <th>成功率</th>
                  <th>平均耗时</th>
                </tr>
              </thead>
              <tbody>
                {moduleStats.map((m) => {
                  const rf = fmtRate(m.rate);
                  return (
                    <tr key={m.module}>
                      <td>{m.module}</td>
                      <td>{m.count}</td>
                      <td className={rf.cls}>{rf.text}</td>
                      <td>{fmtMs(m.latency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title={`原始事件流（最近 ${recent.length} 条）`}
        titleIcon="📜"
        className="block-card"
      >
        {recent.length === 0 ? (
          <p className="empty-hint">暂无事件。</p>
        ) : (
          <div className="table-wrap">
            <table className="track-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>模块</th>
                  <th>动作</th>
                  <th>属性</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((e, i) => (
                  <tr key={i}>
                    <td className="mono">{fmtTime(e.ts)}</td>
                    <td>{e.module}</td>
                    <td>{e.action}</td>
                    <td className="mono">
                      {e.props ? JSON.stringify(e.props) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}
