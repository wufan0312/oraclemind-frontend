'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Modal from '@/components/ui/Modal';
import { useVisitor } from '@/components/visitor/VisitorProvider';
import { createDonation, fetchDonation, type DonationOrder } from '@/lib/api';
import {
  PREMIUM_PLANS,
  FREE_PERKS,
  PAY_QR_URL,
  PAY_QR_STEPS,
  planOf,
  isUnlocked,
  recordUnlock,
  type PremiumItemId,
} from '@/lib/premium';

/**
 * 付费墙弹窗 —— 权益说明 + 套餐选择 + 下单 + 支付引导
 *
 * 两种渠道表现：
 * - stub（未配置凭证，当前默认）：显示「支付通道接入中」占位卡 + 「继续免费查看」，
 *   点击后本地记录解锁 —— 与后端语义一致，不产生真实交易。
 * - wechat（凭证配置后自动切换）：展示支付链接/二维码并轮询订单，paid 后自动解锁。
 */
export default function PaywallModal({
  open,
  item,
  onClose,
  onUnlocked,
}: {
  open: boolean;
  item: PremiumItemId;
  onClose: () => void;
  onUnlocked?: () => void;
}) {
  const { visitorId } = useVisitor();
  const [selected, setSelected] = useState<PremiumItemId>(item);
  const [unlocked, setUnlocked] = useState(false);
  const [order, setOrder] = useState<DonationOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // 收款码图片是否可用（个人收款码为静态图片，缺图时回退到占位卡，避免用户卡住）
  const [qrOk, setQrOk] = useState(true);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  const plan = planOf(selected);

  useEffect(() => {
    if (open) {
      setSelected(item);
      setUnlocked(isUnlocked(item));
      setOrder(null);
      setErr(null);
      setQrOk(true);
    }
  }, [open, item]);

  // 关闭/卸载时停掉轮询
  useEffect(() => {
    return () => {
      if (polling.current) {
        clearInterval(polling.current);
        polling.current = null;
      }
    };
  }, []);

  const finishUnlock = useCallback(
    (o: DonationOrder | null, channel?: string) => {
      recordUnlock({
        item: selected,
        orderNo: o?.outTradeNo || '',
        channel: channel || o?.channel || 'manual',
        amountFen: o?.amountFen ?? plan.priceYuan * 100,
        at: new Date().toISOString(),
      });
      setUnlocked(true);
      onUnlocked?.();
    },
    [selected, plan.priceYuan, onUnlocked]
  );

  /** 轮询订单（真实渠道） */
  const startPolling = useCallback(
    (outTradeNo: string) => {
      if (polling.current) clearInterval(polling.current);
      polling.current = setInterval(async () => {
        try {
          const o = await fetchDonation(outTradeNo, visitorId);
          if (o.status === 'paid') {
            if (polling.current) clearInterval(polling.current);
            polling.current = null;
            finishUnlock(o);
          } else if (o.status === 'expired' || o.status === 'failed') {
            if (polling.current) clearInterval(polling.current);
            polling.current = null;
            setErr('订单已失效，请重新发起');
            setOrder(null);
          }
        } catch {
          /* 轮询失败保持静默，下一轮再试 */
        }
      }, 3000);
    },
    [visitorId, finishUnlock]
  );

  const onSubmit = async () => {
    setLoading(true);
    setErr(null);
    try {
      const o = await createDonation({
        tier: '自定义',
        amountFen: plan.priceYuan * 100,
        visitorId,
      });
      setOrder(o);
      if (o.channel === 'wechat') startPolling(o.outTradeNo);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '下单失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="🔓 解锁进阶内容" icon="✨">
      <div className="paywall">
        {/* 免费权益：先说清楚什么不要钱 */}
        <div className="paywall-free">
          <div className="paywall-free-title">以下能力永久免费，无需解锁</div>
          <ul className="paywall-free-list">
            {FREE_PERKS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>

        {unlocked ? (
          <div className="paywall-unlocked">
            <div className="paywall-unlocked-icon">✅</div>
            <div className="paywall-unlocked-text">已解锁「{plan.name}」，可直接查看完整内容</div>
            <button className="paywall-btn primary" onClick={onClose}>好的</button>
          </div>
        ) : (
          <>
            <div className="paywall-plans">
              {PREMIUM_PLANS.map((p) => (
                <button
                  key={p.id}
                  className={'paywall-plan' + (p.id === selected ? ' active' : '')}
                  onClick={() => setSelected(p.id)}
                >
                  <div className="paywall-plan-head">
                    <span className="paywall-plan-icon">{p.icon}</span>
                    <span className="paywall-plan-name">{p.name}</span>
                    <span className="paywall-plan-price">¥{p.priceYuan}</span>
                  </div>
                  <div className="paywall-plan-tagline">{p.tagline}</div>
                  <ul className="paywall-plan-perks">
                    {p.perks.map((k) => (
                      <li key={k}>{k}</li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            {!order ? (
              <button className="paywall-btn primary" onClick={onSubmit} disabled={loading}>
                {loading ? '正在创建订单…' : `解锁「${plan.name}」 ¥${plan.priceYuan}`}
              </button>
            ) : order.channel === 'wechat' ? (
              <div className="paywall-pay">
                <div className="paywall-pay-title">请使用微信扫码支付 ¥{plan.priceYuan}</div>
                {order.payUrl ? (
                  <div className="paywall-pay-code">
                    {/* TODO(支付接入)：引入二维码库或由后端直接返回二维码图片，当前展示支付链接 */}
                    <code>{order.payUrl}</code>
                  </div>
                ) : (
                  <div className="paywall-pay-code">支付链接生成中…</div>
                )}
                <div className="paywall-pay-hint">支付完成后页面会自动解锁，无需刷新</div>
                <button className="paywall-btn ghost" onClick={onClose}>稍后再说</button>
              </div>
            ) : qrOk ? (
              /* 个人微信收款码：静态码 + 核对码，无自动回调，用户确认后即时解锁 */
              <div className="paywall-qr">
                <div className="paywall-qr-title">微信扫码支付 <strong>¥{plan.priceYuan}</strong></div>
                <div className="paywall-qr-box">
                  <img
                    src={PAY_QR_URL}
                    alt="微信收款码"
                    className="paywall-qr-img"
                    onError={() => setQrOk(false)}
                  />
                </div>
                <div className="paywall-qr-check">
                  <span className="paywall-qr-check-label">付款备注核对码</span>
                  <code className="paywall-qr-check-code">{order.outTradeNo.slice(-8)}</code>
                </div>
                <ol className="paywall-qr-steps">
                  {PAY_QR_STEPS.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <button className="paywall-btn primary" onClick={() => finishUnlock(order, 'qrcode')}>
                  我已完成支付，立即解锁
                </button>
                <button className="paywall-btn ghost" onClick={onClose}>稍后再说</button>
                <div className="paywall-qr-hint">
                  个人收款码无自动回调：点击上方按钮即刻解锁，后台会按核对码与金额对账。
                </div>
              </div>
            ) : (
              <div className="paywall-stub">
                <div className="paywall-stub-icon">🛠️</div>
                <div className="paywall-stub-title">支付通道正在接入中</div>
                <div className="paywall-stub-body">
                  订单已记录（{order.outTradeNo.slice(-8)}），当前未配置支付凭证，
                  <strong>可直接免费查看完整内容</strong>。凭证到位后此处将自动切换为微信扫码支付。
                </div>
                <button className="paywall-btn primary" onClick={() => finishUnlock(order)}>
                  继续免费查看 →
                </button>
              </div>
            )}

            {err && <div className="paywall-err">{err}</div>}

            <div className="paywall-note">
              玄镜坚持基础功能永久免费，进阶内容自愿解锁；付费仅为自愿支持创作，不影响任何免费测算与解读。所有结果仅供娱乐参考，不构成决策依据。
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
