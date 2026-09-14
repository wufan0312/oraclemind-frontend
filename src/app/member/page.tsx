'use client';

import '@/styles/member.scss';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SectionIcon from '@/components/ui/SectionIcon';
import PremiumPurchaseModal from '@/components/PremiumPurchaseModal';
import { useVisitor } from '@/components/visitor/VisitorProvider';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchPremiumPlans, fetchPremiumEntitlements,
  type PremiumPlanOut, type PremiumEntitlementItem,
} from '@/lib/api';
import {
  PREMIUM_PLANS, FREE_PERKS, loadUnlocks,
  type PremiumItemId, type UnlockRecord,
} from '@/lib/premium';

/** 会员类商品（site 生效，一次开通长期有效） */
const MEMBER_ITEMS: PremiumItemId[] = ['xinzhai_member', 'dream_member', 'all_access'];
/** 单次解锁类商品（绑定某一局牌面 / 某一张星盘） */
const SINGLE_ITEMS: PremiumItemId[] = ['tarot_deep', 'astro_full'];

const KNOWN_IDS = new Set<string>(PREMIUM_PLANS.map((p) => p.id));

function asItemId(id: string): PremiumItemId | null {
  return KNOWN_IDS.has(id) ? (id as PremiumItemId) : null;
}

/** 展示用套餐视图：后端目录优先，缺失时回落前端常量，保证后端不可用时页面仍完整 */
interface PlanView {
  id: PremiumItemId;
  name: string;
  icon: string;
  price: string;
  tagline: string;
  perks: string[];
  scope: string;
}

function fallbackPlans(): PlanView[] {
  return PREMIUM_PLANS.map((p) => ({
    id: p.id,
    name: p.name,
    icon: p.icon,
    price: String(p.priceYuan),
    tagline: p.tagline,
    perks: p.perks,
    scope: p.id === 'tarot_deep' || p.id === 'astro_full' ? 'single' : 'site',
  }));
}

function toPlanView(p: PremiumPlanOut): PlanView {
  const id = asItemId(p.itemId);
  return {
    id: id ?? 'all_access',
    name: p.name,
    icon: p.icon,
    // 后端 priceYuan 是 "39.00"，整元时去掉小数尾巴更清爽
    price: /\.00$/.test(p.priceYuan) ? p.priceYuan.slice(0, -3) : p.priceYuan,
    tagline: p.tagline,
    perks: p.perks ?? [],
    scope: p.scope ?? 'site',
  };
}

const FAQ: { q: string; a: string }[] = [
  {
    q: '基础功能要钱吗？',
    a: '不要。卜卦、塔罗、星座、数字命理、解梦、风水、疗愈的全部基础功能与 AI 解读永久免费，会员只提供更深、更长的进阶内容。',
  },
  {
    q: '会员和单次解锁有什么区别？',
    a: '会员（心斋会员 / 解梦会员 / 全站通卡）一次开通长期有效，全站生效；单次解锁只针对当前这一局牌面或这一张星盘。全站通卡已包含全部进阶内容。',
  },
  {
    q: '换了设备还能用吗？',
    a: '登录后购买的权益绑定账号，可在多设备同步。访客状态下购买的记录只保存在当前浏览器，建议先登录再开通。',
  },
  {
    q: '支付通道是什么状态？',
    a: '目前处于接入期：下单后按页面引导完成支付即可即时解锁，订单会留痕用于人工对账。若未收到权益，可凭订单号联系我们补发。',
  },
];

export default function MemberPage() {
  const { visitorId } = useVisitor();
  const { isAuthed, ready: authReady } = useAuth();

  const [plans, setPlans] = useState<PlanView[]>(fallbackPlans);
  const [freePerks, setFreePerks] = useState<string[]>(FREE_PERKS);
  const [serverUnlocked, setServerUnlocked] = useState<string[]>([]);
  const [entitlements, setEntitlements] = useState<PremiumEntitlementItem[]>([]);
  const [localUnlocks, setLocalUnlocks] = useState<UnlockRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyItem, setBuyItem] = useState<PremiumItemId | null>(null);

  /** 拉取商品目录 + 权益；后端不可用时静默回落本地数据，不阻塞页面 */
  const reload = useCallback(async () => {
    setLocalUnlocks(loadUnlocks());
    const idParam = isAuthed ? undefined : visitorId;
    try {
      const [plansRes, entRes] = await Promise.all([
        fetchPremiumPlans().catch(() => null),
        fetchPremiumEntitlements(idParam).catch(() => null),
      ]);
      if (plansRes?.plans?.length) {
        setPlans(plansRes.plans.map(toPlanView));
        if (plansRes.freePerks?.length) setFreePerks(plansRes.freePerks);
      }
      setServerUnlocked(entRes?.unlocked ?? []);
      setEntitlements(entRes?.items ?? []);
    } catch {
      /* 网络异常时保持兜底数据 */
    } finally {
      setLoading(false);
    }
  }, [isAuthed, visitorId]);

  useEffect(() => {
    if (!authReady) return;
    void reload();
  }, [authReady, reload]);

  // 解锁记录变化（本页下单成功 / 其它页面开通）时即时刷新
  useEffect(() => {
    const onChange = () => { void reload(); };
    window.addEventListener('om:premium-change', onChange);
    return () => window.removeEventListener('om:premium-change', onChange);
  }, [reload]);

  const planById = useMemo(() => {
    const m = new Map<PremiumItemId, PlanView>();
    plans.forEach((p) => m.set(p.id, p));
    return m;
  }, [plans]);

  /** 权益判定：后端真源（只认已支付） ∪ 本地解锁记录（stub 渠道下单后的即时解锁） */
  const isUnlocked = useCallback(
    (id: PremiumItemId) => {
      if (serverUnlocked.includes(id) || serverUnlocked.includes('all_access')) return true;
      return localUnlocks.some((r) => r.item === id || r.item === 'all_access');
    },
    [serverUnlocked, localUnlocks],
  );

  const unlockedIds = useMemo(
    () => plans.filter((p) => isUnlocked(p.id)).map((p) => p.id),
    [plans, isUnlocked],
  );
  const hasAllAccess = isUnlocked('all_access');
  const activeCount = hasAllAccess ? plans.length : unlockedIds.length;

  const pick = (ids: PremiumItemId[]) => ids.map((id) => planById.get(id)).filter((p): p is PlanView => !!p);

  const memberPlans = pick(MEMBER_ITEMS);
  const singlePlans = pick(SINGLE_ITEMS);

  return (
    <div className="page active member-page">
      <div className="member-head">
        <h1 className="member-title">
          <SectionIcon name="crown" /> 会员中心
        </h1>
        <div className="member-sub">
          玄镜全站基础功能永久免费，会员只提供更深、更长的进阶陪伴
        </div>
      </div>

      {/* 当前状态 */}
      <section className="member-status">
        <div className="member-status-main">
          <span className="member-status-label">当前状态</span>
          <span className={'member-status-value' + (activeCount > 0 ? ' is-active' : '')}>
            {loading ? '读取中…' : activeCount > 0 ? `已解锁 ${activeCount} 项` : '尚未开通'}
          </span>
          {!isAuthed && authReady && (
            <span className="member-status-guest">
              访客模式下权益仅存本机，<Link href="/login">登录后</Link>可跨设备同步
            </span>
          )}
        </div>
        <div className="member-status-tags">
          {loading ? null : activeCount > 0 ? (
            plans
              .filter((p) => isUnlocked(p.id))
              .map((p) => (
                <span className="member-tag is-on" key={p.id}>
                  {p.icon} {p.name}
                </span>
              ))
          ) : (
            <span className="member-tag">免费版</span>
          )}
        </div>
      </section>

      {/* 免费权益（写清楚，避免误以为基础功能收费） */}
      <section className="member-card">
        <div className="member-card-title">
          <SectionIcon name="gift" /> 免费已包含
        </div>
        <ul className="member-perk-list">
          {freePerks.map((f, i) => (
            <li key={i}><SectionIcon name="check-double" size={14} /> <span>{f}</span></li>
          ))}
        </ul>
      </section>

      {/* 会员套餐 */}
      <section className="member-section">
        <div className="member-section-title">
          <SectionIcon name="star" /> 会员套餐
          <span className="member-section-hint">一次开通 · 长期有效</span>
        </div>
        <div className="member-plan-grid">
          {memberPlans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              unlocked={isUnlocked(p.id)}
              onBuy={() => setBuyItem(p.id)}
            />
          ))}
        </div>
      </section>

      {/* 单次解锁 */}
      <section className="member-section">
        <div className="member-section-title">
          <SectionIcon name="sparkles" /> 单次深度解读
          <span className="member-section-hint">针对当前这一局 · 独立计费</span>
        </div>
        <div className="member-plan-grid">
          {singlePlans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              unlocked={isUnlocked(p.id)}
              onBuy={() => setBuyItem(p.id)}
            />
          ))}
        </div>
      </section>

      {/* 我的权益记录 */}
      <section className="member-card">
        <div className="member-card-title">
          <SectionIcon name="history" /> 我的权益记录
        </div>
        {entitlements.length === 0 && localUnlocks.length === 0 ? (
          <div className="member-empty">还没有开通记录，选择上方套餐即可开启更深照见。</div>
        ) : (
          <div className="member-record-list">
            {entitlements.map((e) => {
              const pv = asItemId(e.itemId) ? planById.get(e.itemId as PremiumItemId) : undefined;
              return (
                <div className="member-record" key={e.orderNo}>
                  <span className="member-record-icon">{pv?.icon ?? '🎁'}</span>
                  <span className="member-record-name">{pv?.name ?? e.itemId}</span>
                  <span className="member-record-no">{e.orderNo}</span>
                  <span className="member-record-time">
                    {e.paidAt ? new Date(e.paidAt).toLocaleString('zh-CN', { hour12: false }) : '—'}
                  </span>
                  <span className="member-record-state is-paid">已生效</span>
                </div>
              );
            })}
            {/* stub 渠道下后端不记 paid，本地解锁记录兜底展示，避免用户「付了却看不到」 */}
            {localUnlocks
              .filter((r) => !entitlements.some((e) => e.orderNo === r.orderNo))
              .map((r) => {
                const pv = planById.get(r.item);
                return (
                  <div className="member-record is-local" key={r.orderNo}>
                    <span className="member-record-icon">{pv?.icon ?? '🎁'}</span>
                    <span className="member-record-name">{pv?.name ?? r.item}</span>
                    <span className="member-record-no">{r.orderNo}</span>
                    <span className="member-record-time">
                      {new Date(r.at).toLocaleString('zh-CN', { hour12: false })}
                    </span>
                    <span className="member-record-state">本机已解锁</span>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {/* 常见问题 */}
      <section className="member-card">
        <div className="member-card-title">
          <SectionIcon name="book-open" /> 常见问题
        </div>
        <div className="member-faq">
          {FAQ.map((f, i) => (
            <div className="member-faq-item" key={i}>
              <div className="member-faq-q">{f.q}</div>
              <div className="member-faq-a">{f.a}</div>
            </div>
          ))}
        </div>
      </section>

      <PremiumPurchaseModal
        open={!!buyItem}
        onClose={() => setBuyItem(null)}
        itemId={buyItem ?? 'all_access'}
        visitorId={visitorId}
        onPaid={() => { void reload(); }}
      />
    </div>
  );
}

function PlanCard({ plan, unlocked, onBuy }: { plan: PlanView; unlocked: boolean; onBuy: () => void }) {
  return (
    <div className={'member-plan' + (unlocked ? ' is-unlocked' : '') + (plan.id === 'all_access' ? ' is-featured' : '')}>
      {plan.id === 'all_access' && <div className="member-plan-ribbon">最超值</div>}
      <div className="member-plan-head">
        <span className="member-plan-icon">{plan.icon}</span>
        <div className="member-plan-heading">
          <div className="member-plan-name">{plan.name}</div>
          <div className="member-plan-tagline">{plan.tagline}</div>
        </div>
      </div>
      <div className="member-plan-price">
        <span className="member-plan-currency">¥</span>
        <span className="member-plan-amount">{plan.price}</span>
        <span className="member-plan-unit">{plan.scope === 'single' ? '/ 次' : '/ 永久'}</span>
      </div>
      <ul className="member-plan-perks">
        {plan.perks.map((k, i) => (
          <li key={i}><SectionIcon name="check-double" size={13} /> <span>{k}</span></li>
        ))}
      </ul>
      {unlocked ? (
        <div className="member-plan-btn is-done">✓ 已解锁</div>
      ) : (
        <button type="button" className="member-plan-btn" onClick={onBuy}>
          立即开通
        </button>
      )}
    </div>
  );
}
