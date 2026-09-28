'use client';

import '@/styles/healing.scss';
import { useCallback, useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import SectionIcon from '@/components/ui/SectionIcon';
import {
  XUAN_GREETING, XUAN_SUGGESTIONS,
  MIRROR_CARDS, OFFERINGS,
  type HealingSave, type MoodEntry,
} from '@/data/healingData';
import { MoodQuickSection } from '@/components/healing/MindfulnessSection';
import { RealmPanel } from '@/components/healing/RealmPanel';
import { XuanChat } from '@/components/healing/XuanChat';
import DonationModal from '@/components/DonationModal';
import PremiumPurchaseModal from '@/components/PremiumPurchaseModal';
import { useHealingSave } from '@/hooks/useHealingSave';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useVisitor } from '@/components/visitor/VisitorProvider';

interface ChatMsg { role: 'xuan' | 'user'; text: string }

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
  const h = useHealingSave();

  // 商业化弹层状态（疗愈供养 / 心斋会员）
  const [donateOpen, setDonateOpen] = useState(false);
  const [donateOffering, setDonateOffering] = useState<typeof OFFERINGS[number] | null>(null);
  const [memberOpen, setMemberOpen] = useState(false);

  // 静坐（疗愈页专属：呼吸任务从修行面板触发）
  const [breathOpen, setBreathOpen] = useState(false);
  const [breathLeft, setBreathLeft] = useState(60);
  const breathTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 卸载时清理所有定时器，避免离开页面后向已卸载组件 setState 造成泄漏/告警
  useEffect(() => {
    return () => {
      if (breathTimer.current) clearInterval(breathTimer.current);
    };
  }, []);

  // 今日修行任务点击（呼吸 / 同修圈 为疗愈页本地态，其余任务走共享 hook）
  const handleQuestClick = useCallback((id: string) => {
    if (id === 'community') {
      h.showXpToast('🪷 同修圈正在搭建，很快就能与千万同修共行了', 'gold');
      return;
    }
    if (h.save.quests[id]) { h.showXpToast('✅ 今日已完成，明天再来'); return; }
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
    h.showXpToast('把对应的小功课做完，就会自动完成哦');
  }, [h.showXpToast, h.save.quests]);

  // 静坐完成
  const finishBreathQuest = useCallback(() => {
    if (breathTimer.current) { clearInterval(breathTimer.current); breathTimer.current = null; }
    setBreathOpen(false);
    setBreathLeft(60);
    if (!h.save.quests.breath) h.completeQuest('breath');
    else h.showXpToast('🌬️ 静坐完成，身心都松了一点');
  }, [h.completeQuest, h.showXpToast, h.save.quests.breath]);

  // 供养 / 会员
  const handleOffer = useCallback((id: string) => {
    const o = OFFERINGS.find(x => x.id === id);
    if (!o) return;
    setDonateOffering(o);
    setDonateOpen(true);
  }, []);

  const handleMember = useCallback(() => {
    setMemberOpen(true);
  }, []);

  const breathPct = Math.max(0, ((60 - breathLeft) / 60) * 100);

  return (
    <div className="page active" id="page-healing">
      <div className="page-header">
        <div>
          <div className="page-title"><SectionIcon name="heart" className="page-title-icon" />疗愈心斋</div>
          <div className="page-subtitle">心镜 · 小玄对话 · 此刻心绪 · 供养心斋</div>
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
          <RealmPanel save={h.save} onQuestClick={handleQuestClick} />
        </div>
        <XuanChat
          save={h.save}
          onAddXp={h.addXp}
          onChatCount={h.handleChatCount}
          module="healing"
          title="小玄私语"
          status="在线 · 心斋的门永远为你开着"
          greeting={XUAN_GREETING}
          suggestions={XUAN_SUGGESTIONS}
          placeholder="和小玄说说你的心里话…"
          belowText="与小玄每聊一句，道行 +2 · 每个问题小玄都会认真听"
        />
      </div>

      {/* ② 心镜 */}
      <HeartMirror />

      {/* ③·5 此刻心绪（情绪打卡 + 14 天走势 + 心情记录） */}
      <MoodQuickSection moods={h.save.moods} onLog={h.handleLogMood} onDone={h.handleMoodLogged} />

      {/* ④ 供养心斋 + 会员卡 */}
      <OfferingSection onOffer={handleOffer} onMember={handleMember} />

      {/* 呼吸计时浮层 */}
      {breathOpen && <BreathOverlay left={breathLeft} pct={breathPct} onFinish={finishBreathQuest} />}

      {/* 道行 toast + 升级横幅 */}
      <div className={'xp-toast' + (h.toast ? ' show' : '') + (h.toastType ? ' ' + h.toastType : '')}>{h.toast}</div>
      <div className={'levelup-banner' + (h.levelup ? ' show' : '')}>
        {h.levelup && (
          <>
            <div className="levelup-icon">{h.levelup.icon}</div>
            <div className="levelup-title">🎉 恭喜晋升「{h.levelup.name}」境界</div>
            <div className="levelup-verse">{h.levelup.verse}</div>
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
