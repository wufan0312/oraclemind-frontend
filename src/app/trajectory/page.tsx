'use client';

import '@/styles/trajectory.scss';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { mdToHtml, sanitizeAiText } from '@/lib/markdown';
import {
  getTrajectory,
  groupByMonth,
  getMonthTrajectory,
  getMonthlyReview,
  saveMonthlyReview,
  seedTrajectory,
  moduleMeta,
  currentMonthKey,
  formatDate,
  type TrajectoryItem,
} from '@/lib/trajectory';
import { getCrossReadings } from '@/lib/crossReadings';
import { requestHomeAgentStream } from '@/lib/api';

/** 轨迹类型 → 模块页路由（点击跳回对应功能） */
const TYPE_HREF: Record<string, string> = {
  tarot: '/tarot',
  numerology: '/numerology',
  horoscope: '/horoscope',
  report: '/report',
  bugua: '/bugua',
  dream: '/dream',
  ming: '/ming',
};

export default function TrajectoryPage() {
  const [items, setItems] = useState<TrajectoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [review, setReview] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [disclaimer, setDisclaimer] = useState('');
  const [saved, setSaved] = useState(false);

  const monthKey = currentMonthKey();

  const load = useCallback(() => {
    // 首启播种：用旧 crossReadings + tarot_history 回填时间线
    const seeded: TrajectoryItem[] = [];
    for (const c of getCrossReadings()) {
      seeded.push({ type: c.type, label: c.label, summary: c.summary, ts: c.ts });
    }
    try {
      const raw = window.localStorage.getItem('om_tarot_history');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          for (const t of arr) {
            if (t && typeof t.ts === 'number' && !seeded.some((s) => s.ts === t.ts)) {
              seeded.push({
                type: 'tarot',
                label: '塔罗',
                summary: t.question || t.spreadName || '塔罗占卜',
                ts: t.ts,
              });
            }
          }
        }
      }
    } catch { /* ignore */ }
    if (seeded.length) seedTrajectory(seeded);

    const all = getTrajectory();
    setItems(all);
    setLoaded(true);

    // 当月已有复盘则直接展示
    const existing = getMonthlyReview(monthKey);
    if (existing) {
      setReview(existing.text);
      setSaved(true);
    }
  }, [monthKey]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => groupByMonth(items), [items]);
  const monthItems = useMemo(() => getMonthTrajectory(monthKey), [items, monthKey]);
  const hasMonthData = monthItems.length > 0;

  const handleGenerate = useCallback(async () => {
    if (!hasMonthData) {
      showToast('本月还没有任何命理轨迹，先去卜一卦或抽张塔罗吧～', 'warn');
      return;
    }
    setReviewing(true);
    setReview('');
    setSaved(false);
    setDisclaimer('');

    const lines = monthItems
      .map((it, i) => `${i + 1}. [${it.label}] ${it.summary}`)
      .join('\n');
    const prompt =
      `你现在是玄镜「成长轨迹」的月度复盘官。下面是我本月（${monthKey.replace('-', '年')}月）` +
      `在玄镜留下的命理轨迹记录，每条含模块与结论摘要：\n${lines}\n\n` +
      `请基于这些真实记录，为我生成一段「本月命理复盘」：\n` +
      `- 我这段时间最关注哪些主题（事业 / 感情 / 决策 / 自我成长…）；\n` +
      `- 能量或心绪的起伏线索；\n` +
      `- 哪些抉择值得过段时间回头验证是否应验；\n` +
      `- 给下个月的一句温柔提醒。\n` +
      `用有温度、有洞察的中文，避免套话与绝对化断言；命理仅为参考，不构成专业建议。`;

    try {
      let full = '';
      await requestHomeAgentStream(
        prompt,
        {
          onDelta: (chunk: string, text: string) => {
            full = text;
            setReview(text);
          },
          onMeta: (m: { disclaimer?: string }) => {
            if (m?.disclaimer) setDisclaimer(m.disclaimer);
          },
        },
        [],
        undefined,
      );
      if (full.trim()) {
        saveMonthlyReview(monthKey, full);
        setSaved(true);
        showToast('🌙 本月复盘已生成', 'success');
      }
    } catch (e) {
      showToast('复盘生成失败，请稍后再试', 'error');
      // 保留已流式输出的部分内容
    } finally {
      setReviewing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMonthData, monthItems, monthKey, review]);

  const handleSave = useCallback(() => {
    if (!review.trim()) return;
    saveMonthlyReview(monthKey, review);
    setSaved(true);
    showToast('已保存到本机', 'success');
  }, [review, monthKey]);

  return (
    <main className="traj-page">
      <header className="traj-header">
        <h1 className="traj-title">🔮 成长轨迹</h1>
        <p className="traj-sub">
          你每一次占卜、排盘与提问都会被静静记下——这是属于你的个人足迹库。
          过段时间回来看看，哪些心境已有了答案，哪些仍在进行中。
        </p>
      </header>

      <section className="traj-review-card">
        <div className="traj-review-head">
          <div>
            <h2 className="traj-review-title">📅 本月复盘</h2>
            <p className="traj-review-meta">
              {monthKey.replace('-', '年')}月 · 本月轨迹 {monthItems.length} 条
            </p>
          </div>
          <div className="traj-review-actions">
            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={reviewing || !hasMonthData}
            >
              {reviewing ? '生成中…' : review ? '重新生成' : '生成本月复盘'}
            </Button>
            {review && !reviewing && (
              <Button variant="ghost" onClick={handleSave}>
                {saved ? '已保存' : '保存'}
              </Button>
            )}
          </div>
        </div>

        {reviewing && !review && <div className="traj-review-loading">命理复盘官正在回望你的本月轨迹…</div>}

        {review && (
          <div
            className="traj-review-body markdown-body"
            dangerouslySetInnerHTML={{ __html: sanitizeAiText(mdToHtml(review)) }}
          />
        )}
        {!review && !reviewing && (
          <p className="traj-review-empty">
            {hasMonthData
              ? '点击「生成本月复盘」，让 AI 基于你本月的真实轨迹写一段回顾。'
              : '本月还没有轨迹记录，先去任意功能页测一次吧。'}
          </p>
        )}
        {disclaimer && <p className="traj-disclaimer">{disclaimer}</p>}
      </section>

      <section className="traj-timeline">
        {!loaded && <div className="traj-review-loading">加载中…</div>}
        {loaded && items.length === 0 && (
          <div className="traj-empty">
            <p>还没有任何轨迹。</p>
            <p className="traj-empty-hint">去 <Link href="/bugua">卜卦</Link>、<Link href="/tarot">抽塔罗</Link> 或 <Link href="/dream">记个梦</Link>，第一条记录就会出现在这里。</p>
          </div>
        )}

        {groups.map((g) => (
          <div key={g.key} className="traj-month">
            <div className="traj-month-label">{g.label}</div>
            <ul className="traj-list">
              {g.items.map((it, idx) => {
                const meta = moduleMeta(it.type);
                const href = TYPE_HREF[it.type];
                const inner = (
                  <>
                    <span className="traj-dot" style={{ background: meta.color }}>{meta.icon}</span>
                    <div className="traj-item-main">
                      <div className="traj-item-top">
                        <span className="traj-item-label">{it.label}</span>
                        <span className="traj-item-time">{formatDate(it.ts)}</span>
                      </div>
                      <div className="traj-item-summary">{it.summary}</div>
                    </div>
                  </>
                );
                return (
                  <li key={`${it.ts}-${idx}`} className="traj-item">
                    {href ? <Link href={href} className="traj-item-link">{inner}</Link> : inner}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
    </main>
  );
}
