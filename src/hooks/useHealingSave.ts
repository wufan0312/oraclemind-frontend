'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  REALM_LEVELS, DAILY_QUESTS, HEALING_QUOTES,
  defaultSave, loadSave, persistSave,
  type HealingSave, type MoodEntry,
} from '@/data/healingData';

// ============================================================================
// 修行存档共享 hook —— 疗愈 / 经典·读经 / 冥想 三页复用同一份 localStorage 存档
// （键 om_healing，含道行、心经诵读、悟道墙、情绪打卡、冥想完成等任务进度）。
// 拆出本 hook 是为了把这团 XP / 任务 / 存档逻辑从 healing/page.tsx 单一巨组件里
// 解耦出来，让经典、冥想独立成页后仍能延续同一套修行进度，避免复制粘贴。
// ============================================================================

function getRealmIndex(xp: number): number {
  let idx = 0;
  for (let i = 0; i < REALM_LEVELS.length; i++) if (xp >= REALM_LEVELS[i].min) idx = i;
  return idx;
}

export function useHealingSave() {
  const [save, setSave] = useState<HealingSave>(defaultSave());
  const [loaded, setLoaded] = useState(false);
  const saveRef = useRef(save);
  saveRef.current = save;

  // 心经展开 / 完整心经 / 每日一悟 / 悟道输入 —— 读经区块的 UI 态
  const [sutraOpen, setSutraOpen] = useState<number | null>(null);
  const [showFullSutra, setShowFullSutra] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(-1);
  const [quote, setQuote] = useState({ text: '知是行之始，行是知之成。', source: '王阳明 · 传习录' });
  const [wudaoInput, setWudaoInput] = useState('');

  // toast / 升级横幅
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState('');
  const [levelup, setLevelup] = useState<{ icon: string; name: string; verse: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const levelupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初始化：加载存档 + 今日入斋自动完成（每页首次进入即记一次，仅首次发道行）
  useEffect(() => {
    const s = loadSave();
    if (!s.quests.login) {
      s.quests.login = true;
      s.xp += 10;
      persistSave(s);
    }
    setSave(s);
    setLoaded(true);
  }, []);

  // 卸载清理定时器
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (levelupTimer.current) clearTimeout(levelupTimer.current);
  }, []);

  // 写入存档：以 saveRef 为权威快照并立即同步（避免同一事件内多次 persist 互相覆盖）
  const persist = useCallback((updater: HealingSave | ((prev: HealingSave) => HealingSave)) => {
    const prev = saveRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    saveRef.current = next;
    setSave(next);
    persistSave(next);
  }, []);

  const showXpToast = useCallback((text: string, type = '') => {
    setToast(text);
    setToastType(type);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  const showLevelUp = useCallback((lv: { icon: string; name: string; verse: string }) => {
    setLevelup(lv);
    if (levelupTimer.current) clearTimeout(levelupTimer.current);
    levelupTimer.current = setTimeout(() => setLevelup(null), 3600);
  }, []);

  const addXp = useCallback((n: number, reason: string) => {
    const cur = saveRef.current;
    const prev = getRealmIndex(cur.xp);
    const next = { ...cur, xp: cur.xp + n };
    persist(next);
    showXpToast(`✨ 道行 +${n} · ${reason}`);
    const now = getRealmIndex(next.xp);
    if (now > prev) showLevelUp(REALM_LEVELS[now]);
  }, [persist, showXpToast, showLevelUp]);

  const completeQuest = useCallback((id: string) => {
    const cur = saveRef.current;
    if (cur.quests[id]) return;
    const q = DAILY_QUESTS.find(x => x.id === id);
    if (!q) return;
    const next = { ...cur, quests: { ...cur.quests, [id]: true } };
    persist(next);
    addXp(q.xp, q.label);
  }, [persist, addXp]);

  // 聊天计数（每句 +1，满 3 完成任务）
  const handleChatCount = useCallback(() => {
    const cur = saveRef.current;
    const count = (cur.chatCount || 0) + 1;
    const next = { ...cur, chatCount: count };
    persist(next);
    if (count >= 3) completeQuest('chat');
  }, [persist, completeQuest]);

  // 心经诵读（完成 sutra 任务 + 记录诵读足迹）
  const handleReadSutra = useCallback(() => {
    const cur = saveRef.current;
    if (cur.sutraRead) { showXpToast('✅ 今日已诵读，明日再来'); return; }
    const today = todayStr();
    const dates = cur.sutraDates ? cur.sutraDates.filter(d => d !== today) : [];
    dates.push(today);
    const next = { ...cur, sutraRead: true, sutraDates: dates };
    persist(next);
    completeQuest('sutra');
  }, [persist, completeQuest, showXpToast]);

  // 心经展开（查看完整心经注释）
  const handleRevealSutra = useCallback((i: number) => {
    const cur = saveRef.current;
    const opening = sutraOpen !== i;
    setSutraOpen(opening ? i : null);
    if (opening && !cur.sutraOpened[i]) {
      const opened = [...cur.sutraOpened];
      opened[i] = true;
      persist({ ...cur, sutraOpened: opened });
    }
  }, [sutraOpen, persist]);

  // 换一句每日一悟
  const handleNextQuote = useCallback(() => {
    let idx = quoteIdx;
    let next;
    do { next = Math.floor(Math.random() * HEALING_QUOTES.length); }
    while (next === idx && HEALING_QUOTES.length > 1);
    setQuoteIdx(next);
    setQuote(HEALING_QUOTES[next]);
  }, [quoteIdx]);

  // 记录悟道（完成 wudao 任务）
  const handleRecordWudao = useCallback(() => {
    const text = wudaoInput.trim();
    if (!text) {
      showXpToast('✍️ 先写下你的悟，再点记录哦');
      return;
    }
    const cur = saveRef.current;
    const src = `「${quote.text}」 —— ${quote.source}`;
    const d = new Date();
    const time = `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const next = { ...cur, wudao: [{ text, src, time }, ...cur.wudao] };
    persist(next);
    setWudaoInput('');
    completeQuest('wudao');
  }, [wudaoInput, quote, persist, completeQuest, showXpToast]);

  // 冥想完成 → 完成 meditate 任务 + 记录静坐足迹
  const handleMeditateDone = useCallback(() => {
    const cur = saveRef.current;
    const today = todayStr();
    const dates = cur.meditationDates ? cur.meditationDates.filter(d => d !== today) : [];
    dates.push(today);
    persist({ ...cur, meditationDates: dates });
    completeQuest('meditate');
    showXpToast('🧘 冥想完成，心更静了一分');
  }, [persist, completeQuest, showXpToast]);

  // 一分钟呼吸完成 → 完成 breath 任务 + 记录静坐足迹
  const handleBreathDone = useCallback(() => {
    const cur = saveRef.current;
    const today = todayStr();
    const dates = cur.meditationDates ? cur.meditationDates.filter(d => d !== today) : [];
    dates.push(today);
    persist({ ...cur, meditationDates: dates });
    completeQuest('breath');
    showXpToast('🌬️ 一分钟呼吸完成，此刻更安住了');
  }, [persist, completeQuest, showXpToast]);

  // 情绪打卡 → 存 moods + 完成 mood 任务
  const handleLogMood = useCallback((entry: MoodEntry) => {
    const cur = saveRef.current;
    const filtered = cur.moods.filter(m => m.date !== entry.date);
    persist({ ...cur, moods: [entry, ...filtered] });
  }, [persist]);

  // 首次打卡才结算任务
  const handleMoodLogged = useCallback((isFirstToday: boolean) => {
    if (isFirstToday) {
      completeQuest('mood');
      showXpToast('🌈 已记录此刻心情，可在「我的心情记录」里回看');
    } else {
      showXpToast('📝 已更新今日心情');
    }
  }, [completeQuest, showXpToast]);

  return {
    save, loaded,
    sutraOpen, setSutraOpen, showFullSutra, setShowFullSutra,
    quoteIdx, quote, setQuoteIdx, wudaoInput, setWudaoInput,
    toast, toastType, levelup, showXpToast,
    addXp, completeQuest,
    handleChatCount,
    handleReadSutra, handleRevealSutra,
    handleNextQuote, handleRecordWudao,
    handleMeditateDone, handleBreathDone,
    handleLogMood, handleMoodLogged,
  };
}
