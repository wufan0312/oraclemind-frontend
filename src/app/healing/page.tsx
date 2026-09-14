'use client';

import '@/styles/healing.scss';
import { useCallback, useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import SectionIcon from '@/components/ui/SectionIcon';
import {
  HEALING_QUOTES, XUAN_GREETING, XUAN_SUGGESTIONS,
  MIRROR_CARDS, REALM_LEVELS, DAILY_QUESTS, SUTRA_LINES, TODAY_SUTRA, FULL_SUTRA, OFFERINGS,
  HealingSave, defaultSave, loadSave, persistSave, todayStr,
  type MoodEntry
} from '@/data/healingData';
import MindfulnessSection, { MoodQuickSection } from '@/components/healing/MindfulnessSection';
import DonationModal from '@/components/DonationModal';
import PremiumPurchaseModal from '@/components/PremiumPurchaseModal';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useChat } from '@/hooks/useChat';
import AiChatWindow from '@/components/ai-chat/AiChatWindow';
import { requestGenericChatStream } from '@/lib/api';
import { mdToHtml } from '@/lib/markdown';
import { useVisitor } from '@/components/visitor/VisitorProvider';

// ===== 工具：由道行求境界 =====
function getRealmIndex(xp: number): number {
  let idx = 0;
  for (let i = 0; i < REALM_LEVELS.length; i++) if (xp >= REALM_LEVELS[i].min) idx = i;
  return idx;
}

interface ChatMsg { role: 'xuan' | 'user'; text: string }

// ============================================================================
// ① 小玄私语 · 左栏修行面板 + 同修圈入口
// ============================================================================
function RealmPanel({ save, onQuestClick }: {
  save: HealingSave;
  onQuestClick: (id: string) => void;
}) {
  const idx = getRealmIndex(save.xp);
  const lv = REALM_LEVELS[idx];
  const next = REALM_LEVELS[idx + 1];
  const pct = next ? Math.min(100, Math.round(((save.xp - lv.min) / (next.min - lv.min)) * 100)) : 100;

  return (
    <>
      <div className="xuan-realm-card" id="xuanRealmCard">
        <div className="realm-name-row">
          <div className="realm-avatar" id="realmAvatar">旅</div>
          <div className="realm-user-info">
            <div className="realm-name" id="realmName">旅人</div>
            <div className="realm-verse" id="realmVerse">{lv.icon} {lv.name} · {lv.verse}</div>
          </div>
        </div>
        <div className="realm-xp-block">
          <div className="realm-xp-head">
            <span className="realm-xp-label">道行</span>
            <span className="realm-xp-num" id="realmXpText">
              {next ? `${save.xp} / ${next.min}` : `${save.xp} · 已悟道`}
            </span>
            <span className="realm-xp-pct" id="realmXpPct">{pct}%</span>
          </div>
          <div className="realm-xp-bar">
            <div className="realm-xp-fill" id="realmXpFill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="realm-quests">
          <div className="realm-quests-title"><SectionIcon name="footprint" /> 今日修行 · 积道行</div>
          <div className="realm-quest-list" id="realmQuestList">
            {DAILY_QUESTS.map(q => {
              const done = !!save.quests[q.id];
              const progress = q.target
                ? <span className="quest-progress">{Math.min(q.target, save.chatCount)}/{q.target}</span>
                : null;
              const state = done ? '✅' : (q.id === 'breath' ? '▶' : '⏳');
              return (
                <div
                  key={q.id}
                  className={'realm-quest-item' + (done ? ' done' : '')}
                  onClick={() => onQuestClick(q.id)}
                >
                  <span className="quest-icon">{q.icon}</span>
                  <div className="quest-info">
                    <div className="quest-label">{q.label}<span className="quest-xp">+{q.xp}</span></div>
                    <div className="quest-desc">{q.desc}{progress}</div>
                  </div>
                  <span className="quest-state">{state}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 同修圈入口 */}
      <div className="xuan-community-card">
        <div className="xuan-community-head" onClick={() => onQuestClick('community')}>
          <div className="xuan-community-icon">🪷</div>
          <div className="xuan-community-main">
            <div className="xuan-community-title"><SectionIcon name="users" /> 心斋 · 同修圈</div>
            <div className="xuan-community-desc">修行路上，与同修共行</div>
          </div>
          <div className="xuan-community-arrow">›</div>
        </div>
        <div className="xuan-community-tags">
          {['今日同修', '共修小组', '悟道墙'].map(t => (
            <span key={t} className="xuan-community-tag" onClick={() => onQuestClick('community')}>🫧 {t}</span>
          ))}
        </div>
      </div>
    </>
  );
}

// ============================================================================
// ① 小玄私语 · 右栏对话
// ============================================================================
function XuanChat({ save, onAddXp, onChatCount }: {
  save: HealingSave;
  onAddXp: (n: number, reason: string) => void;
  onChatCount: () => void;
}) {
  const {
    messages,
    input,
    setInput,
    send,
    streaming,
    stop,
    clear,
    scrollRef,
  } = useChat({
    // 真 AI 流式：module=healing（小玄疗愈陪伴），context 暂留空（后续可传入心镜综合报告增强个性化）
    request: async (history, question, opts) => {
      const res = await requestGenericChatStream('healing', '', history, question, {
        signal: opts.signal,
        onDelta: opts.onDelta,
      });
      return { text: res.text };
    },
    initialMessages: [
      {
        id: 'xuan-welcome',
        role: 'assistant',
        content: XUAN_GREETING,
        welcome: true,
        quickPrompts: XUAN_SUGGESTIONS.map((s) => ({ label: s.q, kw: s.q })),
      },
    ],
    // 聊天互动：每句 +2 道行，聊满 3 句完成任务（仅首次触发）
    onSend: () => {
      if (!save.quests.chat) {
        onChatCount();
        onAddXp(2, '与小玄聊天');
      }
    },
  });

  return (
    <AiChatWindow
      title="小玄私语"
      status="在线 · 心斋的门永远为你开着"
      messages={messages}
      input={input}
      onInputChange={setInput}
      onSend={send}
      inputPlaceholder="和小玄说说你的心里话…"
      inputDisabled={streaming}
      onClear={clear}
      onQuickPrompt={(p) => send(p.kw)}
      scrollRef={scrollRef}
      aboveMessages={
        streaming ? (
          <button
            type="button"
            className="ai-interp-stop-btn"
            onClick={stop}
            title="停止生成（保留已输出内容）"
          >
            ■ 停止生成
          </button>
        ) : null
      }
      belowMessages={
        <div className="xuan-chat-foot">与小玄每聊一句，道行 +2 · 每个问题小玄都会认真听</div>
      }
      renderContent={(msg) => (
        <div dangerouslySetInnerHTML={{ __html: mdToHtml(msg.content) }} />
      )}
    />
  );
}

// ============================================================================
// ② 心镜 · 小玄为你照见（4 张卡 + 查看综合报告）
// ============================================================================
function HeartMirror() {
  return (
    <div className="heart-mirror" id="heartMirror">
      <div className="healing-section-title"><SectionIcon name="eye" /> 心镜 · 小玄为你照见</div>
      <div className="mirror-intro">
        <div className="mirror-intro-icon">🔮</div>
        <div>
          <div className="mirror-intro-text">小玄读了你的综合报告，以阳明心学为镜，为你写下这些话。</div>
          <div className="mirror-intro-hint">不是定论，是一面镜子 —— 照见，而非定义。</div>
        </div>
      </div>
      <div className="mirror-grid" id="mirrorGrid">
        {MIRROR_CARDS.map((c, i) => (
          <div key={i} className="mirror-card">
            <div className="mirror-card-header">
              <div className="mirror-card-icon">{c.icon}</div>
              <div className="mirror-card-title">{c.title}</div>
              <div className="mirror-card-source">{c.source}</div>
            </div>
            <div className="mirror-card-data">{c.data}</div>
            <div className="mirror-card-yangming"><strong>阳明心学：</strong>{c.yangming}</div>
            <div className="mirror-card-action">
              <span className="mirror-card-action-icon">✦</span>
              <div>{c.action}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// ③ 诵读今日心经 + 悟道墙 · 今日同修
// ============================================================================
function SutraAndQuote({ save, sutraOpen, setSutraOpen, onRevealSutra, onReadSutra, showFullSutra, setShowFullSutra, quote, onNextQuote, wudaoInput, setWudaoInput, onRecordWudao }: {
  save: HealingSave;
  sutraOpen: number | null;
  setSutraOpen: (i: number | null) => void;
  onRevealSutra: (i: number) => void;
  onReadSutra: () => void;
  showFullSutra: boolean;
  setShowFullSutra: (v: boolean) => void;
  quote: { text: string; source: string };
  onNextQuote: () => void;
  wudaoInput: string;
  setWudaoInput: (v: string) => void;
  onRecordWudao: () => void;
}) {
  return (
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

          <button
            className={'sutra-read-btn' + (save.sutraRead ? ' done' : '')}
            onClick={onReadSutra}
          >
            {save.sutraRead ? '✅ 已诵读' : '📿 已诵读 (+20 XP)'}
          </button>

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
                    onClick={() => onRevealSutra(i)}
                  >
                    <div className="sutra-text">{s.text}</div>
                    <div className="sutra-tip">{open ? '点击收起' : '☝ 点击看白话注释'}</div>
                    <div className="sutra-body">{s.body}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 右：悟道墙 · 今日同修 */}
      <div>
        <div className="healing-section-title wudao-section-title">
          <SectionIcon name="lightbulb" />
          悟道墙 · 今日同修
        </div>
        <div className="mood-tracker">
          <div className="quote-box" id="quoteBox">
            <div className="quote-text" id="quoteText">「{quote.text}」</div>
            <div className="quote-source" id="quoteSource">—— {quote.source}</div>
          </div>
          <button className="nav-btn btn-ghost heal-quote-btn" onClick={onNextQuote}>
            🔄 换一句
          </button>
          <div className="wudao-input-area">
            <textarea
              className="form-input field-pill wudao-input"
              id="wudaoInput"
              placeholder="记录今日一丝感悟…（公开分享可获得 +30 XP）"
              value={wudaoInput}
              onChange={e => setWudaoInput(e.target.value)}
            />
            <button className="btn-submit wudao-btn" onClick={onRecordWudao}>🌸 写下悟道</button>
          </div>


          <div className="wudao-wall" id="wudaoList">
            {save.wudao.length === 0 ? (
              <div className="wudao-empty">还没有悟道记录 —— 第一颗珍珠，等你来采。</div>
            ) : (
              save.wudao.map((w, i) => (
                <div key={i} className="wudao-wall-item">
                  <div className="wudao-wall-head">
                    <span className="wudao-wall-name">同修</span>
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
  );
}

// ============================================================================
// ④ 供养心斋 · 随喜 + 会员卡
// ============================================================================
function OfferingSection({ onOffer, onMember }: { onOffer: (id: string) => void; onMember: () => void }) {
  return (
    <div className="offering-section" id="offeringSection">
      <div className="healing-section-title"><SectionIcon name="heart-handshake" /> 供养心斋 · 让这份照见走得更远</div>
      <div className="offering-intro">
        <div className="offering-intro-icon">🪔</div>
        <div>
          <div className="offering-intro-text">深度解读永远免费。若你曾在此处获得片刻安宁，可以随喜供养，让心斋的烛火一直亮下去。</div>
          <div className="offering-intro-hint">随喜随心，不设门槛 —— 你的每一次供养，都是对同修之路的照见。</div>
        </div>
      </div>
      <div className="offering-grid">
        {OFFERINGS.map(o => (
          <div key={o.id} className={'offering-item' + (o.featured ? ' featured' : '')} title={'随喜供养 · ' + o.name} onClick={() => onOffer(o.id)}>
            <div className="offering-item-icon">{o.icon}</div>
            <div className="offering-item-name">{o.name}</div>
            <div className="offering-item-desc">{o.desc}</div>
            <div className="offering-item-price">{o.price}</div>
            <div className="offering-item-tag">{o.tag}</div>
          </div>
        ))}
      </div>
      <div className="offering-note">🪷 供养所得将用于心斋的运营与同修圈的建设 —— 让照见，传得更远。</div>

      {/* 心斋会员卡 */}
      <div className="member-card">
        <div className="member-card-glow" />
        <div className="member-card-main">
          <div className="member-card-head">
            <div className="member-card-icon">🪷</div>
            <div className="member-card-id">
              <div className="member-card-title"><SectionIcon name="crown" /> 心斋会员</div>
              <div className="member-card-sub">把心斋的安宁，带在身边</div>
            </div>
            <div className="member-card-price">¥19</div>
          </div>
          <div className="member-benefits">
            <div className="member-benefit"><span className="member-benefit-icon">🔮</span>专属心镜 · 每月一次的深度照见</div>
            <div className="member-benefit"><span className="member-benefit-icon">🎧</span>冥想音频库 · 小玄陪伴的静心时刻</div>
            <div className="member-benefit"><span className="member-benefit-icon">🫧</span>共修回放 · 错过的心斋营都能补上</div>
          </div>
          <button className="btn-submit member-btn" onClick={onMember}>加入心斋 · 成为会员</button>
          <div className="member-note">深度解读永远免费，会员只为更深的心意陪伴</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 呼吸计时浮层
// ============================================================================
function BreathOverlay({ left, pct, onFinish }: { left: number; pct: number; onFinish: () => void }) {
  return (
    <div className="breath-overlay" id="breathOverlay">
      <div className="breath-overlay-card">
        <div className="breath-overlay-title">🌬️ 静坐 · 观息一分钟</div>
        <div
          className="breath-overlay-circle"
          id="breathCircle"
          style={{ background: `conic-gradient(var(--accent-gold) ${pct}%, rgba(212,168,83,0.12) 0)` }}
        >
          <div className="breath-overlay-num" id="breathNum">{left}</div>
        </div>
        <div className="breath-overlay-tip">吸气… 呼气… 跟着圆圈的节奏，只做一件事：回到呼吸</div>
        <button className="nav-btn btn-ghost" onClick={onFinish}>结束静坐（提前结束也算完成）</button>
      </div>
    </div>
  );
}

// ============================================================================
// 主页面
// ============================================================================
export default function HealingPage() {
  const { visitorId } = useVisitor();

  // 商业化弹层状态（疗愈供养 / 心斋会员）
  const [donateOpen, setDonateOpen] = useState(false);
  const [donateOffering, setDonateOffering] = useState<typeof OFFERINGS[number] | null>(null);
  const [memberOpen, setMemberOpen] = useState(false);

  // 修行存档
  const [save, setSave] = useState<HealingSave>(defaultSave());
  const [loaded, setLoaded] = useState(false);
  const saveRef = useRef(save);
  saveRef.current = save;

  // 心经
  const [sutraOpen, setSutraOpen] = useState<number | null>(null);
  const [showFullSutra, setShowFullSutra] = useState(false);

  // 每日一悟
  const [quoteIdx, setQuoteIdx] = useState(-1);
  const [quote, setQuote] = useState({ text: '知是行之始，行是知之成。', source: '王阳明 · 传习录' });
  const [wudaoInput, setWudaoInput] = useState('');

  // 静坐
  const [breathOpen, setBreathOpen] = useState(false);
  const [breathLeft, setBreathLeft] = useState(60);
  const breathTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // toast / 升级横幅
  const [toast, setToast] = useState('');
  const [levelup, setLevelup] = useState<{ icon: string; name: string; verse: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const levelupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offeringHinted = useRef({ sutra: false, wudao: false });

  // 初始化：加载存档 + 今日入斋自动完成
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

  // 卸载时清理所有定时器，避免离开页面后向已卸载组件 setState 造成泄漏/告警
  useEffect(() => {
    return () => {
      if (breathTimer.current) clearInterval(breathTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (levelupTimer.current) clearTimeout(levelupTimer.current);
    };
  }, []);

  const persist = useCallback((s: HealingSave) => {
    setSave(s);
    persistSave(s);
  }, []);

  // 显示道行 toast
  const [toastType, setToastType] = useState('');
  const showXpToast = useCallback((text: string, type = '') => {
    setToast(text);
    setToastType(type);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  // 升级横幅
  const showLevelUp = useCallback((lv: { icon: string; name: string; verse: string }) => {
    setLevelup(lv);
    if (levelupTimer.current) clearTimeout(levelupTimer.current);
    levelupTimer.current = setTimeout(() => setLevelup(null), 3600);
  }, []);

  // 加道行（含升级检测）
  const addXp = useCallback((n: number, reason: string) => {
    const cur = saveRef.current;
    const prev = getRealmIndex(cur.xp);
    const next = { ...cur, xp: cur.xp + n };
    persist(next);
    showXpToast(`✨ 道行 +${n} · ${reason}`);
    const now = getRealmIndex(next.xp);
    if (now > prev) showLevelUp(REALM_LEVELS[now]);
  }, [persist, showXpToast, showLevelUp]);

  // 完成任务
  const completeQuest = useCallback((id: string) => {
    const cur = saveRef.current;
    if (cur.quests[id]) return;
    const q = DAILY_QUESTS.find(x => x.id === id);
    if (!q) return;
    const next = { ...cur, quests: { ...cur.quests, [id]: true } };
    persist(next);
    addXp(q.xp, q.label);
  }, [persist, addXp]);

  // 今日修行任务点击
  const handleQuestClick = useCallback((id: string) => {
    const cur = saveRef.current;
    if (id === 'community') {
      showXpToast('🪷 同修圈正在搭建，很快就能与千万同修共行了', 'gold');
      return;
    }
    if (cur.quests[id]) { showXpToast('✅ 今日已完成，明天再来'); return; }
    if (id === 'breath') {
      setBreathOpen(true);
      setBreathLeft(60);
      if (breathTimer.current) clearInterval(breathTimer.current);
      breathTimer.current = setInterval(() => {
        setBreathLeft(prev => {
          if (prev <= 1) { finishBreathQuest(); return 0; }
          return prev - 1;
        });
      }, 1000);
      return;
    }
    if (id === 'login') { completeQuest('login'); return; }
    showXpToast('把对应的小功课做完，就会自动完成哦');
  }, [completeQuest, showXpToast]);

  // 静坐完成
  const finishBreathQuest = useCallback(() => {
    if (breathTimer.current) { clearInterval(breathTimer.current); breathTimer.current = null; }
    setBreathOpen(false);
    setBreathLeft(60);
    const cur = saveRef.current;
    if (!cur.quests.breath) completeQuest('breath');
    else showXpToast('🌬️ 静坐完成，身心都松了一点');
  }, [completeQuest, showXpToast]);

  // 聊天计数（每句 +1，满 3 完成任务）
  const handleChatCount = useCallback(() => {
    const cur = saveRef.current;
    const count = (cur.chatCount || 0) + 1;
    const next = { ...cur, chatCount: count };
    persist(next);
    if (count >= 3) completeQuest('chat');
  }, [persist, completeQuest]);

  // 心经诵读（完成 sutra 任务）
  const handleReadSutra = useCallback(() => {
    const cur = saveRef.current;
    if (cur.sutraRead) { showXpToast('✅ 今日已诵读，明天再来'); return; }
    const next = { ...cur, sutraRead: true };
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

  // 记录悟道
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
    // 第二条悟道 → 提示供养（每会话一次）
    if (next.wudao.length >= 2 && !offeringHinted.current.wudao) {
      offeringHinted.current.wudao = true;
      setTimeout(highlightOffering, 900);
      showXpToast('🪷 你已记下两条悟道 —— 若心有触动，可去下方随喜供养');
    }
  }, [wudaoInput, quote, persist, completeQuest, showXpToast]);

  // 供养 / 会员 → 接真后端（donations / premium）
  const handleOffer = useCallback((id: string) => {
    const o = OFFERINGS.find(x => x.id === id);
    if (!o) return;
    setDonateOffering(o);
    setDonateOpen(true);
  }, []);

  const handleMember = useCallback(() => {
    setMemberOpen(true);
  }, []);

  // 冥想完成 → 完成 meditate 任务
  const handleMeditateDone = useCallback(() => {
    completeQuest('meditate');
    showXpToast('🧘 冥想完成，心更静了一分');
  }, [completeQuest, showXpToast]);

  // 情绪打卡 → 存 moods + 完成 mood 任务
  const handleLogMood = useCallback((entry: MoodEntry) => {
    const cur = saveRef.current;
    const filtered = cur.moods.filter(m => m.date !== entry.date);
    persist({ ...cur, moods: [entry, ...filtered] });
  }, [persist]);

  const handleMoodLogged = useCallback(() => {
    completeQuest('mood');
    showXpToast('🌈 已记录此刻心情 +10 道行');
  }, [completeQuest, showXpToast]);

  // 点亮供养模块
  const highlightOffering = useCallback(() => {
    const sec = document.getElementById('offeringSection');
    if (!sec) return;
    sec.classList.remove('offering-pulse');
    void sec.offsetWidth;
    sec.classList.add('offering-pulse');
    setTimeout(() => sec.classList.remove('offering-pulse'), 2800);
  }, []);

  // 卸载清理计时器
  useEffect(() => () => {
    if (breathTimer.current) clearInterval(breathTimer.current);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (levelupTimer.current) clearTimeout(levelupTimer.current);
  }, []);

  const breathPct = Math.max(0, ((60 - breathLeft) / 60) * 100);

  return (
    <div className="page active" id="page-healing">
      <div className="page-header">
        <div>
          <div className="page-title"><SectionIcon name="heart" className="page-title-icon" />疗愈心斋</div>
          <div className="page-subtitle">心镜 · 心经 · 每日一悟 · 小玄对话 · 供养心斋</div>
        </div>
        <div className="page-actions">
          <Button variant="primary" onClick={() => setMemberOpen(true)}>
            💎 开通心斋会员
          </Button>
        </div>
      </div>

      {/* ① 小玄私语 */}
      <div className="healing-section-title"><div className="realm-greet"><SectionIcon name="sparkles" /> 欢迎来到心斋</div></div>
      <div className="xuan-chat-zone">
        <div className="xuan-side">
          <RealmPanel save={save} onQuestClick={handleQuestClick} />
        </div>
        <XuanChat save={save} onAddXp={addXp} onChatCount={handleChatCount} />
      </div>

      {/* ② 心镜 */}
      <HeartMirror />

      {/* ②·5 静心冥想 · 助眠 */}
      <MindfulnessSection onSessionDone={handleMeditateDone} />

      {/* ③ 诵读今日心经 + 悟道墙 */}
      <SutraAndQuote
        save={save}
        sutraOpen={sutraOpen}
        setSutraOpen={setSutraOpen}
        onRevealSutra={handleRevealSutra}
        onReadSutra={handleReadSutra}
        showFullSutra={showFullSutra}
        setShowFullSutra={setShowFullSutra}
        quote={quote}
        onNextQuote={handleNextQuote}
        wudaoInput={wudaoInput}
        setWudaoInput={setWudaoInput}
        onRecordWudao={handleRecordWudao}
      />

      {/* ③·5 此刻心绪 + 跨页联动（一行三栏） */}
      <MoodQuickSection moods={save.moods} onLog={handleLogMood} onDone={handleMoodLogged} />

      {/* ④ 供养心斋 + 会员卡 */}
      <OfferingSection onOffer={handleOffer} onMember={handleMember} />

      {/* 呼吸计时浮层 */}
      {breathOpen && <BreathOverlay left={breathLeft} pct={breathPct} onFinish={finishBreathQuest} />}

      {/* 道行 toast + 升级横幅 */}
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

      {/* 商业化弹层：疗愈供养（donations）/ 心斋会员（premium） */}
      <DonationModal
        open={donateOpen}
        onClose={() => setDonateOpen(false)}
        offering={donateOffering}
        visitorId={visitorId}
      />
      <PremiumPurchaseModal
        open={memberOpen}
        onClose={() => setMemberOpen(false)}
        itemId="xinzhai_member"
        visitorId={visitorId}
      />
    </div>
  );
}
