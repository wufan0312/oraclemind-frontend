'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LUCID_INTRO,
  REALITY_CHECKS,
  LUCID_TECHNIQUES,
  LUCID_TIPS,
  LUCID_LOG_KEY,
  type LucidEntry,
} from '@/data/lucidDreamData';
import { setCloudItem } from '@/lib/cloudStore';

type Tab = 'intro' | 'practice' | 'log';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadLog(): LucidEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LUCID_LOG_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveLog(list: LucidEntry[]): void {
  try {
    const val = JSON.stringify(list);
    window.localStorage.setItem(LUCID_LOG_KEY, val);
    setCloudItem(LUCID_LOG_KEY, val);
  } catch {
    /* 忽略 */
  }
}

/**
 * 清醒梦引导 —— 认识 / 练习 / 日志 三合一
 * 修复「清醒梦引导缺失」：提供科普、四种技法分步练习与清醒梦打卡日志。
 */
export default function LucidDreamGuide() {
  const [tab, setTab] = useState<Tab>('intro');
  const [techId, setTechId] = useState<string>(LUCID_TECHNIQUES[0].id);
  const [stepIdx, setStepIdx] = useState(0);
  const [log, setLog] = useState<LucidEntry[]>([]);
  // 日志表单
  const [date, setDate] = useState(todayStr());
  const [success, setSuccess] = useState(true);
  const [note, setNote] = useState('');

  useEffect(() => {
    setLog(loadLog());
  }, []);

  const tech = useMemo(
    () => LUCID_TECHNIQUES.find((t) => t.id === techId) || LUCID_TECHNIQUES[0],
    [techId]
  );

  const onSelectTech = useCallback((id: string) => {
    setTechId(id);
    setStepIdx(0);
    setTab('practice');
  }, []);

  const addLog = () => {
    const item: LucidEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: date || todayStr(),
      success,
      technique: techId,
      note: note.trim(),
    };
    const next = [item, ...log].slice(0, 100);
    setLog(next);
    saveLog(next);
    setNote('');
  };

  const removeEntry = (id: string) => {
    const next = log.filter((e) => e.id !== id);
    setLog(next);
    saveLog(next);
  };

  const total = log.length;
  const okCount = log.filter((e) => e.success).length;
  const rate = total ? Math.round((okCount / total) * 100) : 0;

  const isLastStep = stepIdx >= tech.steps.length - 1;

  return (
    <div className="lucid-guide">
      <div className="lucid-head">
        <div className="lucid-title">🌗 清醒梦引导</div>
        <div className="lucid-tabs">
          <button className={'lucid-tab' + (tab === 'intro' ? ' active' : '')} onClick={() => setTab('intro')}>认识</button>
          <button className={'lucid-tab' + (tab === 'practice' ? ' active' : '')} onClick={() => setTab('practice')}>练习</button>
          <button className={'lucid-tab' + (tab === 'log' ? ' active' : '')} onClick={() => setTab('log')}>
            日志{total > 0 ? ` (${total})` : ''}
          </button>
        </div>
      </div>

      {/* ===== 认识 ===== */}
      {tab === 'intro' && (
        <div className="lucid-body">
          <div className="lucid-intro-list">
            {LUCID_INTRO.map((b) => (
              <div key={b.title} className="lucid-intro-item">
                <div className="lucid-intro-title">{b.title}</div>
                <div className="lucid-intro-body">{b.body}</div>
              </div>
            ))}
          </div>

          <div className="lucid-sub">🔍 现实检验：判断"我是不是在梦里"</div>
          <div className="lucid-rc-list">
            {REALITY_CHECKS.map((rc) => (
              <div key={rc.action} className="lucid-rc">
                <span className="lucid-rc-icon">{rc.icon}</span>
                <div className="lucid-rc-main">
                  <div className="lucid-rc-action">{rc.action}</div>
                  <div className="lucid-rc-why">{rc.why}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="lucid-tips">
            <div className="lucid-sub">⚠️ 练习须知</div>
            <ul>
              {LUCID_TIPS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ===== 练习 ===== */}
      {tab === 'practice' && (
        <div className="lucid-body">
          <div className="lucid-tech-grid">
            {LUCID_TECHNIQUES.map((t) => (
              <button
                key={t.id}
                className={'lucid-tech' + (t.id === techId ? ' active' : '')}
                onClick={() => { setTechId(t.id); setStepIdx(0); }}
              >
                <span className="lucid-tech-icon">{t.icon}</span>
                <span className="lucid-tech-main">
                  <span className="lucid-tech-name">
                    {t.name}
                    <span className={'lucid-tech-diff diff-' + (t.difficulty === '入门' ? 'easy' : t.difficulty === '进阶' ? 'mid' : 'hard')}>
                      {t.difficulty}
                    </span>
                  </span>
                  <span className="lucid-tech-desc">{t.desc}</span>
                  <span className="lucid-tech-when">⏰ {t.when}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="lucid-practice">
            <div className="lucid-practice-head">
              <div>
                <div className="lucid-practice-name">{tech.icon} {tech.name}</div>
                <div className="lucid-practice-when">最佳时机：{tech.when}</div>
              </div>
              <div className="lucid-practice-count">第 {stepIdx + 1} / {tech.steps.length} 步</div>
            </div>

            <ol className="lucid-steps">
              {tech.steps.map((s, i) => (
                <li key={i} className={'lucid-step' + (i === stepIdx ? ' current' : '') + (i < stepIdx ? ' done' : '')}>
                  <span className="lucid-step-num">{i < stepIdx ? '✓' : i + 1}</span>
                  <span className="lucid-step-text">{s}</span>
                </li>
              ))}
            </ol>

            <div className="lucid-practice-actions">
              <button className="lucid-btn" onClick={() => setStepIdx((i) => Math.max(0, i - 1))} disabled={stepIdx === 0}>
                上一步
              </button>
              {isLastStep ? (
                <button className="lucid-btn primary" onClick={() => setTab('log')}>练习完成，记一笔 ✍️</button>
              ) : (
                <button className="lucid-btn primary" onClick={() => setStepIdx((i) => Math.min(tech.steps.length - 1, i + 1))}>
                  下一步
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== 日志 ===== */}
      {tab === 'log' && (
        <div className="lucid-body">
          <div className="lucid-stats">
            <div className="lucid-stat">
              <div className="lucid-stat-val">{total}</div>
              <div className="lucid-stat-label">练习记录</div>
            </div>
            <div className="lucid-stat">
              <div className="lucid-stat-val">{okCount}</div>
              <div className="lucid-stat-label">成功清醒</div>
            </div>
            <div className="lucid-stat">
              <div className="lucid-stat-val">{rate}%</div>
              <div className="lucid-stat-label">成功率</div>
            </div>
          </div>

          <div className="lucid-form">
            <div className="lucid-form-row">
              <label className="lucid-field">
                <span>日期</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="lucid-field">
                <span>技法</span>
                <select value={techId} onChange={(e) => setTechId(e.target.value)}>
                  {LUCID_TECHNIQUES.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <label className="lucid-field">
                <span>结果</span>
                <select value={success ? '1' : '0'} onChange={(e) => setSuccess(e.target.value === '1')}>
                  <option value="1">成功清醒</option>
                  <option value="0">未成功</option>
                </select>
              </label>
            </div>
            <textarea
              className="lucid-note"
              placeholder="记下这次的感受、梦里的线索…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button className="lucid-btn primary lucid-save" onClick={addLog}>保存记录</button>
          </div>

          {total === 0 ? (
            <div className="lucid-empty">还没有练习记录，先去「练习」tab 选一个技法试试 🌙</div>
          ) : (
            <div className="lucid-log-list">
              {log.map((e) => {
                const t = LUCID_TECHNIQUES.find((x) => x.id === e.technique);
                return (
                  <div key={e.id} className="lucid-log-item">
                    <span className={'lucid-log-badge' + (e.success ? ' ok' : ' no')}>
                      {e.success ? '✓ 成功' : '○ 未成功'}
                    </span>
                    <span className="lucid-log-date">{e.date}</span>
                    <span className="lucid-log-tech">{t ? `${t.icon} ${t.short}` : e.technique}</span>
                    {e.note && <span className="lucid-log-note">{e.note}</span>}
                    <button className="lucid-log-del" onClick={() => removeEntry(e.id)} aria-label="删除">✕</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="lucid-footer">
        清醒梦练习属兴趣探索，非医疗建议；长期失眠或受噩梦困扰请咨询专业睡眠门诊。
      </div>
    </div>
  );
}
