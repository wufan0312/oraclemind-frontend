import { useState, useEffect, useCallback } from 'react';
import { storage } from '@/lib/storage';
import { setCloudItem, removeCloudItem } from '@/lib/cloudStore';
import { tarotDeck, SUIT_LABEL, type TarotSuit } from '@/data/tarotData';
import SectionIcon from '@/components/ui/SectionIcon';

/** 一条日记的牌面引用（不冗余存完整牌义，展示时回查 tarotDeck） */
export interface DiaryCardRef {
  name: string;
  isRev: boolean;
}

/** 塔罗日记条目 */
export interface TarotDiaryEntry {
  id: string;
  /** 占卜/记录日期 YYYY-MM-DD */
  date: string;
  question: string;
  spreadName?: string;
  cards: DiaryCardRef[];
  /** 心情 emoji */
  mood?: string;
  /** 个人感悟 / 后续验证 */
  note: string;
  createdAt: number;
}

/** 从最近一次占卜快速导入的结构（页面侧构造，避免耦合内部类型） */
export interface TarotDiarySeed {
  question: string;
  spreadName?: string;
  cards: DiaryCardRef[];
}

const DIARY_KEY = 'om_tarot_diary';
const MOODS = ['😊', '😌', '😐', '😟', '🌟', '🔮'];

function loadEntries(): TarotDiaryEntry[] {
  if (typeof window === 'undefined') return [];
  const raw = storage.getItem(DIARY_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? (list as TarotDiaryEntry[]) : [];
  } catch {
    return [];
  }
}

function todayStr(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function emptyDraft(seed?: TarotDiarySeed | null): Omit<TarotDiaryEntry, 'id' | 'createdAt'> {
  return {
    date: todayStr(),
    question: seed?.question || '',
    spreadName: seed?.spreadName,
    cards: seed ? seed.cards.map((c) => ({ ...c })) : [],
    mood: undefined,
    note: '',
  };
}

export default function TarotDiary({ seed }: { seed?: TarotDiarySeed | null }) {
  const [entries, setEntries] = useState<TarotDiaryEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Omit<TarotDiaryEntry, 'id' | 'createdAt'>>(() => emptyDraft(seed));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [cardPicker, setCardPicker] = useState('');

  // 首次挂载 + 云同步后读取
  useEffect(() => {
    setEntries(loadEntries());
  }, []);

  const persist = useCallback((next: TarotDiaryEntry[]) => {
    setEntries(next);
    setCloudItem(DIARY_KEY, JSON.stringify(next));
  }, []);

  const save = useCallback(() => {
    if (!draft.question.trim() && draft.cards.length === 0) return;
    const entry: TarotDiaryEntry = {
      ...draft,
      question: draft.question.trim(),
      id: 'td' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      createdAt: Date.now(),
    };
    persist([entry, ...entries]);
    setDraft(emptyDraft(seed));
    setOpen(false);
    setCardPicker('');
  }, [draft, entries, persist, seed]);

  const remove = useCallback(
    (id: string) => {
      const next = entries.filter((e) => e.id !== id);
      persist(next);
      if (expanded === id) setExpanded(null);
    },
    [entries, persist, expanded]
  );

  const importSeed = useCallback(() => {
    if (!seed) return;
    setDraft(emptyDraft(seed));
    setOpen(true);
  }, [seed]);

  const addCard = (name: string) => {
    if (!name || draft.cards.some((c) => c.name === name)) return;
    setDraft((d) => ({ ...d, cards: [...d.cards, { name, isRev: false }] }));
    setCardPicker('');
  };
  const toggleRev = (name: string) =>
    setDraft((d) => ({
      ...d,
      cards: d.cards.map((c) => (c.name === name ? { ...c, isRev: !c.isRev } : c)),
    }));
  const removeCard = (name: string) =>
    setDraft((d) => ({ ...d, cards: d.cards.filter((c) => c.name !== name) }));

  const deckNames = Object.keys(tarotDeck);

  return (
    <div className="side-card tarot-diary">
      <div className="tarot-diary-head">
        <div className="tarot-diary-title">
          <SectionIcon name="notebook-pen" /> 塔罗日记
        </div>
        <div className="tarot-diary-actions">
          {seed && (
            <button type="button" className="tarot-diary-import" onClick={importSeed} title="把最近一次占卜记入日记">
              ＋ 记入刚才
            </button>
          )}
          <button
            type="button"
            className={'tarot-diary-new' + (open ? ' active' : '')}
            onClick={() => {
              if (!open) setDraft(emptyDraft(seed));
              setOpen((o) => !o);
            }}
          >
            {open ? '收起' : '写日记'}
          </button>
        </div>
      </div>

      {open && (
        <div className="tarot-diary-form">
          <div className="tarot-diary-row">
            <label className="tarot-diary-field">
              <span>日期</span>
              <input
                type="date"
                className="form-input mb-0"
                value={draft.date}
                max={todayStr()}
                onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
              />
            </label>
            <label className="tarot-diary-field tarot-diary-mood">
              <span>心情</span>
              <div className="tarot-diary-moods">
                {MOODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={'mood-pick' + (draft.mood === m ? ' active' : '')}
                    onClick={() => setDraft((d) => ({ ...d, mood: d.mood === m ? undefined : m }))}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </label>
          </div>

          <input
            className="form-input mb-0 tarot-diary-q"
            placeholder="当时的问题 / 心中的疑惑"
            value={draft.question}
            maxLength={120}
            onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))}
          />

          <div className="tarot-diary-cards">
            <div className="tarot-diary-cards-label">涉及的牌（可选）</div>
            <div className="tarot-diary-chips">
              {draft.cards.map((c) => (
                <span key={c.name} className={'tarot-diary-chip' + (c.isRev ? ' is-rev' : '')}>
                  {c.isRev && <em className="rev-badge">逆</em>}
                  <span>{tarotDeck[c.name]?.sym} {c.name}</span>
                  <button type="button" className="chip-rev" title="切换正逆位" onClick={() => toggleRev(c.name)}>
                    {c.isRev ? '逆' : '正'}
                  </button>
                  <button type="button" className="chip-del" onClick={() => removeCard(c.name)}>
                    ×
                  </button>
                </span>
              ))}
              {draft.cards.length === 0 && <span className="tarot-diary-empty-hint">还没添加牌</span>}
            </div>
            <select
              className="form-input mb-0 tarot-diary-picker"
              value={cardPicker}
              onChange={(e) => addCard(e.target.value)}
            >
              <option value="">＋ 添加一张牌…</option>
              {deckNames.map((n) => (
                <option key={n} value={n}>
                  {tarotDeck[n].sym} {n} · {SUIT_LABEL[tarotDeck[n].suit]}
                </option>
              ))}
            </select>
          </div>

          <textarea
            className="form-input mb-0 tarot-diary-note"
            placeholder="当下的感悟、牌面与你生活的呼应，以及之后的验证…"
            value={draft.note}
            maxLength={2000}
            rows={4}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
          />

          <div className="tarot-diary-form-actions">
            <button type="button" className="nav-btn btn-ghost" onClick={() => setOpen(false)}>
              取消
            </button>
            <button
              type="button"
              className="btn-submit"
              onClick={save}
              disabled={!draft.question.trim() && draft.cards.length === 0}
            >
              保存日记
            </button>
          </div>
        </div>
      )}

      <div className="tarot-diary-list">
        {entries.length === 0 ? (
          <div className="tarot-diary-empty">
            <div className="tarot-diary-empty-icon">📓</div>
            <div className="tarot-diary-empty-text">还没有日记</div>
            <div className="tarot-diary-empty-hint">
              {seed ? '点「＋ 记入刚才」把最近一次占卜留下来' : '抽完牌后写一句感悟，沉淀你的塔罗轨迹'}
            </div>
          </div>
        ) : (
          entries.map((e) => {
            const isOpen = expanded === e.id;
            return (
              <div key={e.id} className={'tarot-diary-item' + (isOpen ? ' open' : '')}>
                <button
                  type="button"
                  className="tarot-diary-item-head"
                  onClick={() => setExpanded(isOpen ? null : e.id)}
                >
                  <span className="tarot-diary-item-date">{e.date}</span>
                  {e.mood && <span className="tarot-diary-item-mood">{e.mood}</span>}
                  <span className="tarot-diary-item-q">{e.question || '（无问题）'}</span>
                  <span className="tarot-diary-item-caret">{isOpen ? '▾' : '▸'}</span>
                </button>
                {isOpen && (
                  <div className="tarot-diary-item-body">
                    {e.spreadName && <div className="tarot-diary-meta">牌阵：{e.spreadName}</div>}
                    {e.cards.length > 0 && (
                      <div className="tarot-diary-item-cards">
                        {e.cards.map((c) => (
                          <span key={c.name} className={'tarot-diary-mini' + (c.isRev ? ' is-rev' : '')}>
                            {c.isRev && <em className="rev-badge">逆</em>}
                            {tarotDeck[c.name]?.sym} {c.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {e.note && <div className="tarot-diary-item-note">{e.note}</div>}
                    <button type="button" className="tarot-diary-del" onClick={() => remove(e.id)}>
                      删除这条
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
