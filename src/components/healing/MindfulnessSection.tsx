'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SectionIcon from '@/components/ui/SectionIcon';
import CrossPageLink from '@/components/ui/CrossPageLink';
import {
  MEDITATION_SESSIONS, AMBIENT_OPTIONS, SLEEP_TIMER_OPTIONS,
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
// 情绪打卡 + 14 天趋势 + 跨页联动（一行三栏，置于供养心斋上方）
// ============================================================================
export function MoodQuickSection({ moods, onLog, onDone }: {
  moods: MoodEntry[];
  onLog: (e: MoodEntry) => void;
  onDone: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [todayLogged, setTodayLogged] = useState(false);

  // 今日是否已打卡
  useEffect(() => {
    const t = new Date();
    const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    setTodayLogged(moods.some(m => m.date === key));
  }, [moods]);

  // 构建最近 14 天趋势（key/label 用各天自身的日期 d）
  const days: { date: string; label: string; entry?: MoodEntry }[] = [];
  const moodByDate = new Map(moods.map(m => [m.date, m]));
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({ date: key, label: `${d.getMonth() + 1}/${d.getDate()}`, entry: moodByDate.get(key) });
  }

  const submit = () => {
    if (picked === null) return;
    const t = new Date();
    const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    const opt = MOOD_OPTIONS[picked];
    const entry: MoodEntry = { date: key, score: opt.score, mood: opt.label, emoji: opt.emoji, note: note.trim() || undefined };
    onLog(entry);
    setTodayLogged(true);
    setNote('');
    setPicked(null);
    onDone();
  };

  return (
    <div className="mood-quick-section">
      <div className="healing-section-title"><SectionIcon name="heart" /> 此刻心绪 · 跨页联动</div>
      <div className="mood-quick-grid">
        {/* 此刻，你感觉怎么样？ */}
        <div className="mood-quick-card">
          <div className="mood-today-title"><SectionIcon name="heart" /> 此刻，你感觉怎么样？</div>
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
            placeholder="想写下点什么吗？（可选）"
            value={note}
            onChange={e => setNote(e.target.value)}
            disabled={todayLogged}
          />
          <button className="btn-submit mood-submit" onClick={submit} disabled={picked === null || todayLogged}>
            {todayLogged ? '✅ 今日已打卡' : '🌈 记录此刻心情'}
          </button>
        </div>

        {/* 近 14 天情绪走势 */}
        <div className="mood-quick-card">
          <div className="mood-trend-title">近 14 天情绪走势</div>
          <div className="mood-bars">
            {days.map(d => {
              const h = d.entry ? 20 + d.entry.score * 14 : 4;
              return (
                <div key={d.date} className="mood-bar-col" title={d.entry ? `${d.label} ${d.entry.emoji} ${d.entry.mood}` : d.label}>
                  <div className="mood-bar" style={{ height: `${h}px` }}>{d.entry ? <span className="mood-bar-emoji">{d.entry.emoji}</span> : null}</div>
                  <div className="mood-bar-label">{d.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 跨页联动 */}
        <CrossPageLink
          description="想看完整的数据和解读？综合报告汇集八字、紫微、六爻等多术数交叉验证结论。"
          links={[
            { icon: '☯️', label: '前往卜卦排盘', href: '/bugua' },
            { icon: '📊', label: '查看综合报告', href: '/report', variant: 'primary' },
          ]}
        />
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
