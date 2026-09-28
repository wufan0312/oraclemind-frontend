'use client';

import { useState } from 'react';
import SectionIcon from '@/components/ui/SectionIcon';
import {
  TODAY_SUTRA, FULL_SUTRA, SCRIPTURE_LIBRARY, SCRIPTURE_SITUATIONS,
  DAILY_VERSE_POOL, getDailyVerse,
  type ScriptureItem, type ScriptureSituation,
} from '@/data/healingData';
import { todayStr } from '@/data/healingData';
import { useHealingSave } from '@/hooks/useHealingSave';
import CultivationCalendar from '@/components/healing/CultivationCalendar';

// 设备语音合成朗读（带可用性守卫，重复点击先 cancel 避免叠读）
function speakText(text: string): void {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 0.85;
    u.pitch = 1;
    synth.speak(u);
  } catch {
    /* 不支持语音合成则静默跳过，文字仍可见 */
  }
}

// ============================================================================
// 每日一偈 · 取一句今日智慧（首屏仪式感钩子）
// 每天稳定一句（按日期 seed），可换一句 / 听读。合规口径：照见与体悟，非求签算命。
// ============================================================================
function DailyVerse() {
  const today = todayStr();
  const [verse, setVerse] = useState(() => getDailyVerse(today));
  const [flipping, setFlipping] = useState(false);

  const change = () => {
    if (flipping) return;
    let next;
    do {
      next = DAILY_VERSE_POOL[Math.floor(Math.random() * DAILY_VERSE_POOL.length)];
    } while (next.text === verse.text && DAILY_VERSE_POOL.length > 1);
    setFlipping(true);
    window.setTimeout(() => { setVerse(next); setFlipping(false); }, 420);
  };

  return (
    <div className="daily-verse">
      <div className="daily-verse-label">📜 今日一偈 · 取一句智慧</div>
      <div className={'daily-verse-card' + (flipping ? ' flipping' : '')}>
        <div className="daily-verse-text">「{verse.text}」</div>
        <div className="daily-verse-source">—— {verse.source}</div>
      </div>
      <div className="daily-verse-actions">
        <button className="daily-verse-btn" onClick={change}>🎴 换一句</button>
        <button className="daily-verse-btn" onClick={() => speakText(verse.text)}>🔊 听读</button>
      </div>
      <div className="daily-verse-tomorrow">明天同一刻，小玄会为你留一句 🌙</div>
    </div>
  );
}

// ============================================================================
// 你今晚怎么了 · 情境选择器（按"痛"排，而非按"书"排）
// 选中情境 → 经典文库筛出相关经典；这是"从痛走到经"的入口。
// ============================================================================
function SituationBar({ value, onChange, count }: {
  value: ScriptureSituation | 'all';
  onChange: (v: ScriptureSituation | 'all') => void;
  count: number;
}) {
  return (
    <div className="situation-bar">
      <div className="situation-title">🌿 你今晚怎么了？</div>
      <div className="situation-chips">
        <button
          className={'situation-chip' + (value === 'all' ? ' active' : '')}
          onClick={() => onChange('all')}
        >全部</button>
        {SCRIPTURE_SITUATIONS.map(s => (
          <button
            key={s.key}
            className={'situation-chip' + (value === s.key ? ' active' : '')}
            onClick={() => onChange(s.key)}
          >{s.emoji} {s.label}</button>
        ))}
      </div>
      <div className="situation-hint">
        {value === 'all'
          ? '点一本，慢慢读 · 古圣贤的话，是一面镜子'
          : `为你筛出 ${count} 本 · 今晚，让文字慢慢接住你`}
      </div>
    </div>
  );
}

// ============================================================================
// 诵读今日心经 + 我的觉察日记（经典·读经 模块）
// 自身调用 useHealingSave 承接同一份修行存档（心经诵读 / 觉察进度与疗愈页互通）。
// ============================================================================

function dayToNum(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// 由诵读足迹算「连续天数 / 累计天数」（断更超 1 天则连续清零）
function readStat(dates?: string[]): { streak: number; total: number } {
  if (!dates || dates.length === 0) return { streak: 0, total: 0 };
  const nums = [...new Set(dates.map(dayToNum))].sort((a, b) => a - b);
  const today = dayToNum(todayStr());
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

export default function SutraSection() {
  const {
    save, sutraOpen, setSutraOpen, showFullSutra, setShowFullSutra,
    quote, setWudaoInput, wudaoInput, toast, toastType, levelup,
    handleRevealSutra, handleReadSutra, handleNextQuote, handleRecordWudao,
  } = useHealingSave();

  // 经典文库：当前选中的经典 + 展开句索引
  const [libSel, setLibSel] = useState<ScriptureItem | null>(null);
  const [libOpen, setLibOpen] = useState<number | null>(null);

  // 情境筛选（按"痛"排，而非按"书"排）
  const [situation, setSituation] = useState<ScriptureSituation | 'all'>('all');
  const library = situation === 'all'
    ? SCRIPTURE_LIBRARY
    : SCRIPTURE_LIBRARY.filter(s => s.situations.includes(situation));

  const { streak, total } = readStat(save.sutraDates);

  // 修行进度（道行 / 境界 / 连续天数）——让奖励回路在本页当场可见
  const xp = save.xp || 0;
  let ridx = 0;
  for (let i = 0; i < REALM_LEVELS.length; i++) if (xp >= REALM_LEVELS[i].min) ridx = i;
  const realm = REALM_LEVELS[ridx];
  const nextRealm = REALM_LEVELS[ridx + 1];
  const pct = nextRealm ? Math.min(100, Math.round(((xp - realm.min) / (nextRealm.min - realm.min)) * 100)) : 100;

  return (
    <>
    <DailyVerse />

    {/* 小玄导读 */}
    <div className="sutra-guide">
      <div className="sutra-guide-icon">🪷</div>
      <div className="sutra-guide-body">
        <div className="sutra-guide-title">小玄导读 · 读经，是给心留一处安静</div>
        <div className="sutra-guide-text">
          这里的经典，不用来算吉凶、不求神通。它们是一面面镜子——
          读一句，照见当下的自己：哪里紧绷，哪里安然，又有什么念头悄悄飘过。
          每天读一句，不必读懂全部，让文字慢慢沉淀就好。
        </div>
      </div>
    </div>

    {/* 修行进度条 · 本页可见的奖励回路 */}
    <div className="classics-progress">
      <div className="cp-realm">
        <span className="cp-realm-icon">{realm.icon}</span>
        <div className="cp-realm-info">
          <div className="cp-realm-name">{realm.name}</div>
          <div className="cp-realm-verse">{realm.verse}</div>
        </div>
      </div>
      <div className="cp-xp">
        <div className="cp-xp-head">
          <span className="cp-xp-label">道行 {xp}</span>
          <span className="cp-xp-pct">{pct}%</span>
        </div>
        <div className="cp-xp-bar">
          <div className="cp-xp-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="cp-xp-next">{nextRealm ? `距「${nextRealm.name}」还差 ${nextRealm.min - xp}` : '已悟道 · 道法自然'}</div>
      </div>
      <div className="cp-streak">
        <span className="cp-streak-num">{streak}</span>
        <span className="cp-streak-label">连续诵读</span>
      </div>
    </div>

    {/* 你今晚怎么了 · 情境选择器 */}
    <SituationBar value={situation} onChange={setSituation} count={library.length} />

    {/* 经典文库 */}
    <div className="scripture-library">
      <div className="healing-section-title scripture-library-title">
        <SectionIcon name="book" />
        经典文库 · 点一本，慢慢读
      </div>
      <div className="scripture-grid">
        {library.map(item => (
          <div
            key={item.id}
            className={'scripture-card' + (libSel?.id === item.id ? ' active' : '')}
            onClick={() => { setLibSel(item); setLibOpen(null); }}
          >
            <span className={'scripture-tag t-' + item.tradition}>{item.tradition}</span>
            <div className="scripture-card-title">{item.title}</div>
            <div className="scripture-card-source">{item.source}</div>
            <div className="scripture-card-intro">{item.intro}</div>
          </div>
        ))}
      </div>

      {libSel && (
        <div className="scripture-reader">
          <div className="scripture-reader-head">
            <span className={'scripture-tag t-' + libSel.tradition}>{libSel.tradition}</span>
            <div>
              <div className="scripture-reader-title">{libSel.title}</div>
              <div className="scripture-reader-source">—— {libSel.source}</div>
            </div>
          </div>
          <div className="scripture-reader-passage">
            {libSel.passage.map((p, i) => {
              const open = libOpen === i;
              return (
                <div
                  key={i}
                  className={'sutra-line' + (open ? ' open' : '')}
                  onClick={() => setLibOpen(open ? null : i)}
                >
                  <div className="sutra-text">
                    {p.text}
                    <button
                      className="sutra-line-listen"
                      title="听读此句"
                      onClick={(e) => { e.stopPropagation(); speakText(p.text); }}
                    >🔊</button>
                  </div>
                  <div className="sutra-tip">{open ? '点击收起' : '☝ 点击看白话心解'}</div>
                  <div className="sutra-body">{p.body}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>

    <div className="healing-layout healing-main">
      {/* 左：诵读今日心经 */}
      <div>
        <div className="healing-section-title sutra-section-title">
          <SectionIcon name="book" />
          诵读 · 今日心经
        </div>
        <div className="mood-tracker">
          <div className="sutra-featured-card">
            <div className="sutra-featured-text">
              {TODAY_SUTRA.text.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
            <div className="sutra-featured-source">{TODAY_SUTRA.source}</div>
          </div>

          <div className="sutra-featured-actions">
            <button
              className={'sutra-read-btn' + (save.sutraRead ? ' done' : '')}
              onClick={handleReadSutra}
            >
              {save.sutraRead ? '✅ 已诵读' : '📿 已诵读 (+20 XP)'}
            </button>
            <button className="sutra-listen-btn" onClick={() => speakText(TODAY_SUTRA.text)}>🔊 听读</button>
          </div>

          {/* 诵读足迹 */}
          <div className="sutra-footprint">
            <div className="footprint-stat">
              <span className="footprint-num">{streak}</span>
              <span className="footprint-label">连续天数</span>
            </div>
            <div className="footprint-stat">
              <span className="footprint-num">{total}</span>
              <span className="footprint-label">累计诵读</span>
            </div>
            <div className="footprint-hint">每天读一句，把安静变成习惯 🌱</div>
          </div>

          <CultivationCalendar
            dates={save.sutraDates || []}
            title="诵读足迹 · 近 84 天"
            emptyHint="每天读一句，点亮一格 🌱"
          />

          <div className="sutra-full-link" onClick={() => setShowFullSutra(!showFullSutra)}>
            {showFullSutra ? '📖 收起完整心经' : '📖 查看完整心经 · 注释'}
          </div>

          {showFullSutra && (
            <div className="sutra-full-list">
              {FULL_SUTRA.map((s, i) => {
                const open = sutraOpen === i;
                return (
                  <div
                    key={i}
                    data-index={i}
                    className={'sutra-line' + (open ? ' open' : '')}
                    onClick={() => handleRevealSutra(i)}
                  >
                    <div className="sutra-text">
                      {s.text}
                      <button
                        className="sutra-line-listen"
                        title="听读此句"
                        onClick={(e) => { e.stopPropagation(); speakText(s.text); }}
                      >🔊</button>
                    </div>
                    <div className="sutra-tip">{open ? '点击收起' : '☝ 点击看白话注释'}</div>
                    <div className="sutra-body">{s.body}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 右：我的觉察日记（原"悟道墙·今日同修"，改为诚实的个人记录） */}
      <div>
        <div className="healing-section-title wudao-section-title">
          <SectionIcon name="lightbulb" />
          我的觉察日记 · 和自己做朋友
        </div>
        <div className="mood-tracker">
          <div className="quote-box" id="quoteBox">
            <div className="quote-text" id="quoteText">「{quote.text}」</div>
            <div className="quote-source" id="quoteSource">—— {quote.source}</div>
          </div>
          <button className="nav-btn btn-ghost heal-quote-btn" onClick={handleNextQuote}>
            🔄 换一句
          </button>
          <div className="wudao-input-area">
            <textarea
              className="form-input field-pill wudao-input"
              id="wudaoInput"
              placeholder="记录今日一丝感悟…（写给自己，+30 XP）"
              value={wudaoInput}
              onChange={e => setWudaoInput(e.target.value)}
            />
            <button className="btn-submit wudao-btn" onClick={handleRecordWudao}>🌸 写下觉察</button>
          </div>

          {save.wudao.length > 0 && (
            <div className="wudao-diary-echo">
              你已在此留下 {save.wudao.length} 次觉察 · 每一次，都是和自己的对话 🌿
            </div>
          )}

          <div className="wudao-wall" id="wudaoList">
            {save.wudao.length === 0 ? (
              <div className="wudao-empty">还没有觉察记录 —— 今晚读到哪句戳中了你？写下来，和自己说说话。</div>
            ) : (
              save.wudao.map((w, i) => (
                <div key={i} className="wudao-wall-item">
                  <div className="wudao-wall-head">
                    <span className="wudao-wall-name">我</span>
                    <span className="wudao-wall-time">{w.time}</span>
                  </div>
                  <div className="wudao-wall-text">「{w.text}」</div>
                  <div className="wudao-wall-meta">{w.src}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>

    {/* 小玄陪聊入口 · 把孤立的阅读器接回对话生态 */}
    <Link href="/healing" className="xuan-chat-cta">
      <span className="xuan-chat-cta-icon">💬</span>
      <span className="xuan-chat-cta-text">想和小玄聊聊这句？去心斋，把今晚的触动说给听得懂的人</span>
      <span className="xuan-chat-cta-arrow">→</span>
    </Link>

    <div className={'xp-toast' + (toast ? ' show' : '') + (toastType ? ' ' + toastType : '')}>{toast}</div>
    <div className={'levelup-banner' + (levelup ? ' show' : '')}>
      {levelup && (
        <>
          <div className="levelup-icon">{levelup.icon}</div>
          <div className="levelup-title">🎉 恭喜晋升「{levelup.name}」境界</div>
          <div className="levelup-verse">{levelup.verse}</div>
        </>
      )}
    </div>
    </>
  );
}
