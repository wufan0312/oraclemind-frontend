'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MOOD_OPTIONS, type MoodEntry, loadSave, persistSave } from '@/data/healingData';
import { getOrCreateVisitorId } from '@/lib/visitor';
import { trackFunnelEvent } from '@/lib/api';
import SectionIcon from '@/components/ui/SectionIcon';

type Source = 'bugua' | 'tarot';

function todayKey(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/**
 * P0 漏斗组件：占卜/塔罗解读完成后，把"刚说出口的困扰"接到情绪打卡 + 复原力测评。
 * 复用疗愈页的 MOOD_OPTIONS 与 om_healing 存档（打卡自动出现在「我的心情记录」回看），
 * 提交后推 /assessment 的 ¥9.9 付费闸门。样式走全局 emotion-bridge.scss，bu/tarot 通用。
 */
export function EmotionBridge({ source, visible, question }: { source: Source; visible: boolean; question?: string }) {
  const router = useRouter();
  const vid = getOrCreateVisitorId();
  const [picked, setPicked] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [logged, setLogged] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // 每次会话每个入口至多出现一次，避免反复打扰（漏斗观测也更干净）
  const seenKey = `om_bridge_${source}`;
  const [seen, setSeen] = useState(
    () => typeof window !== 'undefined' && window.sessionStorage.getItem(seenKey) === '1'
  );

  // 曝光埋点：解读完成（visible 翻 true）那一刻记一次，同一挂载只记一次
  const exposedRef = useRef(false);
  useEffect(() => {
    if (visible && !exposedRef.current) {
      exposedRef.current = true;
      const q = (question || '').trim();
      trackFunnelEvent(
        'bridge_exposure',
        source,
        vid,
        q ? { question: q.slice(0, 60) } : undefined,
      );
    }
  }, [visible, source, question, vid]);

  if (!visible || dismissed || seen) return null;

  const q = (question || '').trim();
  const headline = q
    ? `刚才你提到「${q.slice(0, 30)}${q.length > 30 ? '…' : ''}」——此刻，你感觉怎么样？`
    : source === 'bugua'
      ? '刚才那一卦，让你此刻有什么感受？'
      : '刚才那副牌，让你此刻有什么感受？';

  const close = () => {
    try { window.sessionStorage.setItem(seenKey, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  const submit = () => {
    if (picked === null) return;
    const opt = MOOD_OPTIONS[picked];
    const entry: MoodEntry = {
      date: todayKey(),
      score: opt.score,
      mood: opt.label,
      emoji: opt.emoji,
      note: note.trim() || undefined,
    };
    const save = loadSave();
    const others = save.moods.filter((m) => m.date !== entry.date);
    persistSave({ ...save, moods: [...others, entry] });
    try { window.sessionStorage.setItem(seenKey, '1'); } catch { /* ignore */ }
    trackFunnelEvent('bridge_mood_submit', source, vid, {
      mood: opt.label,
      score: opt.score,
      hasNote: note.trim().length > 0,
    });
    setLogged(true);
  };

  const goAssessment = () => {
    trackFunnelEvent('bridge_assessment_click', source, vid);
    router.push(`/assessment?from=${source}`);
  };

  return (
    <div className="emotion-bridge">
      <div className="eb-head">
        <SectionIcon name="heart" />
        <span>小玄陪你说两句</span>
      </div>
      <p className="eb-headline">{headline}</p>

      {!logged ? (
        <>
          <div className="eb-mood-row">
            {MOOD_OPTIONS.map((o, i) => (
              <button
                key={o.label}
                type="button"
                className={'eb-mood-btn' + (picked === i ? ' active' : '')}
                onClick={() => setPicked(i)}
              >
                <span className="eb-mood-emoji">{o.emoji}</span>
                <span className="eb-mood-label">{o.label}</span>
              </button>
            ))}
          </div>
          <textarea
            className="form-input field-pill eb-note"
            placeholder="想写下点什么吗？（可选，写给今天的自己）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="eb-actions">
            <button type="button" className="btn-submit eb-submit" onClick={submit} disabled={picked === null}>
              🌈 记录此刻心情
            </button>
            <button type="button" className="eb-skip" onClick={close}>暂时跳过</button>
          </div>
        </>
      ) : (
        <div className="eb-next">
          <p className="eb-next-tip">已记下。想更了解自己此刻的状态吗？</p>
          <button type="button" className="btn-submit eb-cta" onClick={goAssessment}>
            🧭 生成我的复原力测评报告 · ¥9.9
          </button>
          <button type="button" className="eb-skip" onClick={close}>以后再说</button>
        </div>
      )}
    </div>
  );
}

export default EmotionBridge;
