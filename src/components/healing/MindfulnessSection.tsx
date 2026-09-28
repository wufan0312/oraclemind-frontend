'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SectionIcon from '@/components/ui/SectionIcon';
import {
  MEDITATION_SESSIONS, AMBIENT_OPTIONS, SLEEP_TIMER_OPTIONS,
  MEDITATION_TIMER_OPTIONS, MINDFUL_PRACTICES,
  type MeditationSession,
} from '@/data/healingMindfulness';
import { startAmbient, type AmbientType, type AmbientHandle } from '@/lib/ambientAudio';
import { MOOD_OPTIONS, type MoodEntry } from '@/data/healingData';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ===== TTS 引导朗读（带可用性守卫）=====
function speakGuidance(text: string): void {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 0.9;
    u.pitch = 1;
    synth.speak(u);
  } catch {
    /* 不支持语音合成则静默跳过，文字引导仍可见 */
  }
}

function stopGuidance(): void {
  if (typeof window === 'undefined') return;
  try { window.speechSynthesis?.cancel(); } catch { /* */ }
}

// ============================================================================
// 引导冥想播放器
// ============================================================================
function MeditationPlayer({ session, onDone }: {
  session: MeditationSession;
  onDone: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [, force] = useState(0);

  // 用 ref 驱动计时，避免 state updater 内副作用（StrictMode 双调用导致重复朗读）
  const stepRef = useRef(0);
  const stepLeftRef = useRef(session.steps[0].sec);
  const elapsedRef = useRef(0);
  const doneRef = useRef(false);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const handle = useRef<AmbientHandle | null>(null);
  const [ambient, setAmbient] = useState<AmbientType>(session.ambient);
  const [vol, setVol] = useState(0.3);

  const total = session.duration;

  const stopEverything = useCallback(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    stopGuidance();
    if (handle.current) { handle.current.stop(); handle.current = null; }
  }, []);

  const reset = useCallback(() => {
    stepRef.current = 0;
    stepLeftRef.current = session.steps[0].sec;
    elapsedRef.current = 0;
    doneRef.current = false;
    force((x) => x + 1);
  }, [session.steps]);

  const finish = useCallback(() => {
    stopEverything();
    setPlaying(false);
    if (!doneRef.current) {
      doneRef.current = true;
      onDone();
    }
  }, [stopEverything, onDone]);

  const tick = useCallback(() => {
    stepLeftRef.current -= 1;
    elapsedRef.current += 1;
    if (stepLeftRef.current <= 0) {
      const next = stepRef.current + 1;
      if (next >= session.steps.length) {
        finish();
        return;
      }
      stepRef.current = next;
      stepLeftRef.current = session.steps[next].sec;
      speakGuidance(session.steps[next].text);
    }
    force((x) => x + 1);
  }, [session.steps, finish]);

  const startPlay = useCallback(() => {
    doneRef.current = false;
    // 已结束后再次开始 → 从头
    if (stepRef.current >= session.steps.length - 1 && elapsedRef.current > 0) reset();
    setPlaying(true);
    speakGuidance(session.steps[stepRef.current].text);
    handle.current = startAmbient(ambient, vol);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(tick, 1000);
  }, [session.steps, reset, ambient, vol, tick]);

  const pausePlay = useCallback(() => {
    setPlaying(false);
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    stopGuidance();
    if (handle.current) { handle.current.stop(); handle.current = null; }
  }, []);

  // 切换课程 / 卸载：清理并重置到该课程起点
  useEffect(() => {
    setAmbient(session.ambient);
    reset();
    return () => stopEverything();
  }, [session, reset, stopEverything]);

  // 播放中实时调音量
  useEffect(() => {
    if (playing && handle.current) handle.current.setVolume(vol);
  }, [vol, playing]);

  const pct = Math.min(100, Math.round((elapsedRef.current / total) * 100));
  const stepIdx = Math.min(stepRef.current, session.steps.length - 1);
  const stepLeft = Math.max(0, stepLeftRef.current);
  const elapsed = elapsedRef.current;
  const currentStep = session.steps[stepIdx];

  return (
    <div className="meditate-player">
      <div className="meditate-player-head">
        <div>
          <div className="meditate-player-title">{session.title}</div>
          <div className="meditate-player-meta">{session.category} · {fmt(total)} · {session.summary}</div>
        </div>
        <div className="meditate-player-time">{fmt(elapsed)} / {fmt(total)}</div>
      </div>

      <div className="meditate-progress"><div className="meditate-progress-fill" style={{ width: `${pct}%` }} /></div>

      <div className="meditate-step">
        <div className="meditate-step-count">第 {stepIdx + 1} / {session.steps.length} 段 · 余 {fmt(stepLeft)}</div>
        <div className="meditate-step-text">{currentStep.text}</div>
      </div>

      <div className="meditate-controls">
        {!playing ? (
          <button className="btn-submit meditate-play" onClick={startPlay}>▶ 开始引导</button>
        ) : (
          <button className="nav-btn btn-ghost meditate-pause" onClick={pausePlay}>⏸ 暂停</button>
        )}
        <button className="nav-btn btn-ghost" onClick={() => { pausePlay(); reset(); }}>↺ 重来</button>
      </div>

      <div className="meditate-ambient">
        <span className="meditate-ambient-label">背景声</span>
        <div className="meditate-ambient-opts">
          <button className={'meditate-ambient-opt' + (ambient === 'none' ? ' active' : '')} onClick={() => setAmbient('none')}>静默</button>
          {AMBIENT_OPTIONS.map(o => (
            <button key={o.type} className={'meditate-ambient-opt' + (ambient === o.type ? ' active' : '')} onClick={() => setAmbient(o.type)}>{o.emoji} {o.label}</button>
          ))}
        </div>
        <div className="meditate-vol">
          <span>🔈</span>
          <input type="range" min={0} max={1} step={0.05} value={vol} onChange={e => setVol(parseFloat(e.target.value))} />
        </div>
      </div>
      <div className="meditate-hint">引导语由设备语音合成朗读（可静音），背景声为实时合成，无需联网。</div>
    </div>
  );
}

// ============================================================================
// 助眠声景（白噪音 / 颂钵 + 睡眠定时）
// ============================================================================
function SleepSoundscape() {
  const [playing, setPlaying] = useState(false);
  const [type, setType] = useState<AmbientType>('brown');
  const [vol, setVol] = useState(0.35);
  const [timerIdx, setTimerIdx] = useState(1); // 默认 30 分钟
  const handle = useRef<AmbientHandle | null>(null);

  const stop = useCallback(() => {
    if (handle.current) { handle.current.stop(); handle.current = null; }
    setPlaying(false);
  }, []);

  useEffect(() => () => { if (handle.current) handle.current.stop(); }, []);

  const play = useCallback(() => {
    const opt = SLEEP_TIMER_OPTIONS[timerIdx];
    const h = startAmbient(type, vol);
    handle.current = h;
    setPlaying(true);
    if (h && opt.sec > 0) h.fadeOutAndStop(opt.sec);
  }, [type, vol, timerIdx]);

  useEffect(() => {
    if (playing && handle.current) handle.current.setVolume(vol);
  }, [vol, playing]);

  return (
    <div className="sleep-scape">
      <div className="sleep-scape-intro">
        <span className="sleep-scape-icon">🌙</span>
        <div>选一种声景，设定时长。到点会自动淡出——让声音替你守夜，你只管入睡。</div>
      </div>

      <div className="sleep-sounds">
        {AMBIENT_OPTIONS.map(o => (
          <button key={o.type} className={'sleep-sound' + (type === o.type ? ' active' : '')} onClick={() => setType(o.type)} disabled={playing}>
            <span className="sleep-sound-emoji">{o.emoji}</span>
            <span className="sleep-sound-label">{o.label}</span>
          </button>
        ))}
      </div>

      <div className="sleep-row">
        <div className="sleep-vol">
          <span>🔈 音量</span>
          <input type="range" min={0} max={1} step={0.05} value={vol} onChange={e => setVol(parseFloat(e.target.value))} disabled={playing} />
        </div>
        <div className="sleep-timer">
          <span>⏳ 定时</span>
          <select value={timerIdx} onChange={e => setTimerIdx(parseInt(e.target.value, 10))} disabled={playing}>
            {SLEEP_TIMER_OPTIONS.map((o, i) => <option key={o.label} value={i}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="sleep-controls">
        {!playing ? (
          <button className="btn-submit sleep-play" onClick={play}>🌛 播放助眠声景</button>
        ) : (
          <button className="nav-btn btn-ghost" onClick={stop}>⏹ 停止</button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 情绪打卡 + 14 天趋势 + 心情记录（置于供养心斋上方）
// ============================================================================
function todayKey(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function fmtMoodDate(key: string): string {
  const parts = key.split('-');
  return parts.length === 3 ? `${Number(parts[1])}月${Number(parts[2])}日` : key;
}

export function MoodQuickSection({ moods, onLog, onDone }: {
  moods: MoodEntry[];
  onLog: (e: MoodEntry) => void;
  onDone: (isFirstToday: boolean) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [note, setNote] = useState('');

  const todayEntry = moods.find(m => m.date === todayKey());
  const todayLogged = !!todayEntry;

  // 今日已记录时回填心情与备注，避免「打完卡就看不到」
  useEffect(() => {
    if (!todayEntry) return;
    const idx = MOOD_OPTIONS.findIndex(o => o.score === todayEntry.score);
    if (idx >= 0) setPicked(prev => (prev === null ? idx : prev));
    setNote(prev => (prev ? prev : (todayEntry.note || '')));
  }, [todayEntry?.date, todayEntry?.score, todayEntry?.note]);

  // 构建最近 14 天趋势（key/label 用各天自身的日期 d）
  const days: { date: string; label: string; entry?: MoodEntry }[] = [];
  const moodByDate = new Map(moods.map(m => [m.date, m]));
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({ date: key, label: `${d.getMonth() + 1}/${d.getDate()}`, entry: moodByDate.get(key) });
  }

  // 心情记录列表（新 → 旧，最多 8 条）
  const recent = [...moods].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  const submit = () => {
    if (picked === null) return;
    const isFirst = !todayLogged;
    const opt = MOOD_OPTIONS[picked];
    const entry: MoodEntry = {
      date: todayKey(),
      score: opt.score,
      mood: opt.label,
      emoji: opt.emoji,
      note: note.trim() || undefined,
    };
    onLog(entry);
    onDone(isFirst);
  };

  return (
    <div className="mood-quick-section">
      <div className="healing-section-title"><SectionIcon name="heart" /> 此刻心绪</div>
      <div className="mood-quick-grid">
        {/* 此刻，你感觉怎么样？ */}
        <div className="mood-quick-card">
          <div className="mood-today-title">
            <span className="mood-today-label"><SectionIcon name="heart" /> 此刻，你感觉怎么样？</span>
            {todayLogged && <span className="mood-done-badge">✅ 今日已记录</span>}
          </div>
          <div className="mood-btns-row">
            {MOOD_OPTIONS.map((o, i) => (
              <button key={o.label} className={'mood-btn' + (picked === i ? ' active' : '')} onClick={() => setPicked(i)}>
                <div className="mood-btn-emoji">{o.emoji}</div>
                <div className="mood-btn-label">{o.label}</div>
              </button>
            ))}
          </div>
          <textarea
            className="form-input field-pill mood-note"
            placeholder="想写下点什么吗？（可选，写给今天的自己）"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
          <button className="btn-submit mood-submit" onClick={submit} disabled={picked === null}>
            {todayLogged ? '📝 更新今日心情' : '🌈 记录此刻心情'}
          </button>
          <div className="mood-note-hint">写下后可在下方「我的心情记录」里随时回看与修改</div>
        </div>

        {/* 近 14 天情绪走势 */}
        <div className="mood-quick-card">
          <div className="mood-trend-head">
            <span className="mood-trend-title">近 14 天情绪走势</span>
            <span className="mood-trend-stat">{moods.length ? `已记录 ${moods.length} 天` : '还没有记录'}</span>
          </div>
          <div className="mood-bars">
            {days.map(d => (
              <div
                key={d.date}
                className="mood-bar-col"
                title={d.entry
                  ? `${d.label} ${d.entry.emoji} ${d.entry.mood}${d.entry.note ? ' · ' + d.entry.note : ''}`
                  : `${d.label} 未记录`}
              >
                <div
                  className={'mood-bar s' + (d.entry ? d.entry.score : 0)}
                  style={{ height: `${d.entry ? 26 + d.entry.score * 16 : 4}px` }}
                >
                  {d.entry ? <span className="mood-bar-emoji">{d.entry.emoji}</span> : null}
                </div>
                <div className="mood-bar-label">{d.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 我的心情记录：打卡后回看处 */}
      <div className="mood-log-card">
        <div className="mood-trend-head">
          <span className="mood-trend-title">我的心情记录</span>
          {recent.length > 0 && <span className="mood-trend-stat">最近 {recent.length} 条</span>}
        </div>
        {recent.length === 0 ? (
          <div className="mood-log-empty">还没有记录。选一个此刻的心情写下来，它就会出现在这里 🌱</div>
        ) : (
          <ul className="mood-log-list">
            {recent.map(m => (
              <li key={m.date} className="mood-log-item">
                <span className="mood-log-emoji">{m.emoji}</span>
                <div className="mood-log-body">
                  <div className="mood-log-item-head">
                    <span className="mood-log-date">{fmtMoodDate(m.date)}</span>
                    <span className="mood-log-tag">{m.mood}</span>
                  </div>
                  {m.note
                    ? <div className="mood-log-note">{m.note}</div>
                    : <div className="mood-log-note mood-log-note-empty">这天没有写备注</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 主区块：冥想 / 助眠 双 Tab + 情绪打卡
// ============================================================================
export default function MindfulnessSection({ onSessionDone }: {
  onSessionDone: () => void;
}) {
  const [tab, setTab] = useState<'meditate' | 'sleep'>('meditate');
  // 引导冥想右侧默认打开「三分钟呼吸空间」
  const [selected, setSelected] = useState<MeditationSession | null>(
    MEDITATION_SESSIONS.find(s => s.id === 'breath-space') ?? MEDITATION_SESSIONS[0]
  );

  return (
    <div className="mindfulness-section" id="mindfulnessSection">
      <div className="healing-section-title"><SectionIcon name="flower" /> 静心冥想 · 助眠</div>

      <div className="mindfulness-tabs">
        <button className={'mindfulness-tab' + (tab === 'meditate' ? ' active' : '')} onClick={() => setTab('meditate')}>🧘 引导冥想</button>
        <button className={'mindfulness-tab' + (tab === 'sleep' ? ' active' : '')} onClick={() => setTab('sleep')}>🌙 助眠声景</button>
      </div>

      {tab === 'meditate' ? (
        <div className="mindfulness-body meditate-body">
          <div className="meditate-list">
            {MEDITATION_SESSIONS.map(s => (
              <div
                key={s.id}
                className={'meditate-card' + (selected?.id === s.id ? ' active' : '')}
                onClick={() => setSelected(s)}
              >
                <div className="meditate-card-cat">{s.category}</div>
                <div className="meditate-card-title">{s.title}</div>
                <div className="meditate-card-summary">{s.summary}</div>
                <div className="meditate-card-meta">⏱ {fmt(s.duration)} · {s.steps.length} 段引导</div>
              </div>
            ))}
          </div>
          <div className="meditate-stage">
            {selected ? (
              <MeditationPlayer session={selected} onDone={onSessionDone} />
            ) : (
              <div className="meditate-empty">← 选一门冥想，小玄会用声音陪你走完这段路</div>
            )}
          </div>
        </div>
      ) : (
        <SleepSoundscape />
      )}
    </div>
  );
}

// ============================================================================
// 小玄导读 · 冥想入门
// ============================================================================
export function MeditationIntro() {
  return (
    <div className="med-intro">
      <div className="med-intro-icon">🌿</div>
      <div className="med-intro-body">
        <div className="med-intro-title">小玄导读 · 冥想不是放空，是回到此刻</div>
        <div className="med-intro-text">
          冥想不是让脑子变空白，也不是要你「修成什么」。它只是练习：
          把飘走的注意力，一次次温柔地拉回当下——拉回呼吸，拉回身体，拉回此刻这一小方天地。
          下面有引导冥想陪你走，也有自定的静坐计时和随手可做的小练习。挑一个，现在就开始。
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 静坐计时器 · 呼吸圆圈 + 时长预设 + 背景声（自定练习）
// ============================================================================
export function MeditationTimer({ onDone }: { onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const [totalSec, setTotalSec] = useState(MEDITATION_TIMER_OPTIONS[1].sec);
  const [elapsed, setElapsed] = useState(0);
  const [ambient, setAmbient] = useState<AmbientType>('none');
  const [vol, setVol] = useState(0.3);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const handle = useRef<AmbientHandle | null>(null);
  const doneRef = useRef(false);

  const stopAll = useCallback(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    if (handle.current) { handle.current.stop(); handle.current = null; }
  }, []);

  const finish = useCallback(() => {
    stopAll();
    setRunning(false);
    if (!doneRef.current && totalSec > 0) {
      doneRef.current = true;
      onDone();
    }
  }, [stopAll, onDone, totalSec]);

  const reset = useCallback(() => {
    stopAll();
    setRunning(false);
    setElapsed(0);
    doneRef.current = false;
  }, [stopAll]);

  const start = useCallback(() => {
    if (running) return;
    doneRef.current = false;
    setRunning(true);
    if (ambient !== 'none') handle.current = startAmbient(ambient, vol);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setElapsed(prev => {
        const n = prev + 1;
        if (totalSec > 0 && n >= totalSec) { finish(); return totalSec; }
        return n;
      });
    }, 1000);
  }, [running, ambient, vol, totalSec, finish]);

  const pause = useCallback(() => {
    setRunning(false);
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    if (handle.current) { handle.current.stop(); handle.current = null; }
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  useEffect(() => {
    if (running && handle.current) handle.current.setVolume(vol);
  }, [vol, running]);

  const pct = totalSec > 0 ? Math.min(100, Math.round((elapsed / totalSec) * 100)) : 0;
  const remain = Math.max(0, totalSec - elapsed);
  const finished = totalSec > 0 && elapsed >= totalSec;

  return (
    <div className="med-timer" id="meditation-timer">
      <div className="healing-section-title"><SectionIcon name="clock" /> 静坐计时 · 自定练习</div>
      <div className="med-timer-body">
        <div className="med-timer-circle-wrap">
          <div className={'med-timer-circle' + (running ? ' running' : '')} style={{ background: `conic-gradient(var(--accent-gold) ${pct}%, rgba(212,168,83,0.12) 0)` }}>
            <div className="med-timer-inner">
              <div className="med-timer-time">{totalSec > 0 ? fmt(remain) : fmt(elapsed)}</div>
              <div className="med-timer-phase">{running ? '跟随圆圈，呼吸' : (finished ? '🎉 练习完成' : '准备好就开始')}</div>
            </div>
          </div>
        </div>

        <div className="med-timer-side">
          <div className="med-timer-row">
            <span className="med-timer-label">时长</span>
            <div className="med-timer-opts">
              {MEDITATION_TIMER_OPTIONS.map((o) => (
                <button key={o.label} className={'med-timer-opt' + (totalSec === o.sec ? ' active' : '')} onClick={() => { setTotalSec(o.sec); if (running) reset(); }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="med-timer-row">
            <span className="med-timer-label">背景声</span>
            <div className="med-timer-opts">
              <button className={'med-timer-opt' + (ambient === 'none' ? ' active' : '')} onClick={() => setAmbient('none')}>静默</button>
              {AMBIENT_OPTIONS.map(o => (
                <button key={o.type} className={'med-timer-opt' + (ambient === o.type ? ' active' : '')} onClick={() => setAmbient(o.type)}>{o.emoji} {o.label}</button>
              ))}
            </div>
          </div>

          <div className="med-timer-vol">
            <span>🔈</span>
            <input type="range" min={0} max={1} step={0.05} value={vol} onChange={e => setVol(parseFloat(e.target.value))} />
          </div>

          <div className="med-timer-controls">
            {!running ? (
              <button className="btn-submit med-timer-play" onClick={start}>▶ 开始静坐</button>
            ) : (
              <button className="nav-btn btn-ghost" onClick={pause}>⏸ 暂停</button>
            )}
            <button className="nav-btn btn-ghost" onClick={reset}>↺ 重置</button>
          </div>
          <div className="med-timer-hint">计时结束会自动记一次静坐。背景声为实时合成，无需联网。</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 正念小练习 · 速览卡
// ============================================================================
export function MindfulPractices() {
  return (
    <div className="med-practices">
      <div className="healing-section-title"><SectionIcon name="sparkles" /> 正念小练习 · 随手可做</div>
      <div className="med-practices-grid">
        {MINDFUL_PRACTICES.map(p => (
          <div key={p.id} className="med-practice-card">
            <div className="med-practice-head">
              <span className="med-practice-emoji">{p.emoji}</span>
              <div>
                <div className="med-practice-title">{p.title}</div>
                <div className="med-practice-meta">约 {p.minutes} 分钟</div>
              </div>
            </div>
            <div className="med-practice-desc">{p.desc}</div>
            <ol className="med-practice-steps">
              {p.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 呼吸光球首屏 · 一分钟回到当下（冥想页入场视觉钩子）
// 进入即见随呼吸缩放的光球；点「开始」进入 60 秒引导（吸 4 · 停 4 · 呼 6 循环），
// 完成记一次静坐（breath 任务）。纯 CSS 动画 + 文字节律提示，无额外依赖。
// ============================================================================
export function BreathIntro({ onDone }: { onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'in' | 'hold' | 'out'>('idle');
  const [remain, setRemain] = useState(60);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);

  const PERIOD = 14; // 吸 4 · 停 4 · 呼 6

  const stop = useCallback(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    setRunning(false);
    setPhase('idle');
  }, []);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const start = useCallback(() => {
    if (running) return;
    doneRef.current = false;
    setRunning(true);
    setRemain(60);
    setPhase('in');
    let elapsed = 0;
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      elapsed += 1;
      const r = 60 - elapsed;
      setRemain(r > 0 ? r : 0);
      const pos = elapsed % PERIOD;
      const ph: 'in' | 'hold' | 'out' = pos < 4 ? 'in' : pos < 8 ? 'hold' : 'out';
      setPhase(ph);
      if (elapsed >= 60) {
        if (timer.current) { clearInterval(timer.current); timer.current = null; }
        setRunning(false);
        setPhase('idle');
        if (!doneRef.current) { doneRef.current = true; onDone(); }
      }
    }, 1000);
  }, [running, onDone]);

  const phaseText =
    phase === 'in' ? '缓缓吸气…' : phase === 'hold' ? '轻轻屏息…' : phase === 'out' ? '慢慢呼气…' : '跟随光球，呼吸';
  const finished = !running && remain === 0;

  return (
    <div className="breath-intro">
      <div className="breath-intro-title">一分钟，回到当下</div>
      <div className="breath-orb-wrap">
        <div className={'breath-orb' + (running ? ' running ' + phase : '')}>
          <div className="breath-orb-core" />
          <div className="breath-orb-ring" />
        </div>
      </div>
      <div className="breath-phase">{finished ? '🎉 一分钟完成，此刻更安住了' : phaseText}</div>
      {running && <div className="breath-count">剩余 {remain}s</div>}
      <div className="breath-controls">
        {!running ? (
          <button className="btn-submit breath-start" onClick={start}>🌬️ 开始 1 分钟呼吸</button>
        ) : (
          <button className="nav-btn btn-ghost" onClick={stop}>⏹ 结束</button>
        )}
      </div>
      <div className="breath-hint">吸气 4 秒 · 屏息 4 秒 · 呼气 6 秒，光球会带你走。完成即记一次静坐。</div>
    </div>
  );
}
