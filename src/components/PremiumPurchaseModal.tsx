'use client';

import { useEffect, useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { createPremiumOrder, fetchPremiumOrder, type PremiumOrder } from '@/lib/api';
import { recordUnlock, planOf, type PremiumItemId } from '@/lib/premium';

const POLL_INTERVAL = 3000;
const POLL_TIMEOUT = 5 * 60 * 1000;

/**
 * 进阶内容付费弹层（心斋会员 / 解梦会员 接入用）。
 * 下单 → 收款引导 → 轮询；支付成功（含 stub 渠道本地解锁）写本地解锁记录并广播 om:premium-change。
 */
export default function PremiumPurchaseModal({
  open,
  onClose,
  itemId,
  visitorId,
  onPaid,
}: {
  open: boolean;
  onClose: () => void;
  itemId: PremiumItemId;
  visitorId: string;
  onPaid?: () => void;
}) {
  const [order, setOrder] = useState<PremiumOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };
  useEffect(() => stop, [stop]);
  useEffect(() => {
    if (!open) {
      setOrder(null);
      setLoading(false);
    }
  }, [open]);

  const plan = planOf(itemId);

  const unlock = (o: PremiumOrder) => {
    recordUnlock({
      item: itemId,
      orderNo: o.outTradeNo,
      channel: o.channel,
      amountFen: o.amountFen,
      at: new Date().toISOString(),
    });
    onPaid?.();
  };

  const submit = async () => {
    setLoading(true);
    stop();
    try {
      const o = await createPremiumOrder({ itemId, visitorId });
      setOrder(o);
      if (o.status === 'paid') {
        unlock(o);
        return;
      }
      const started = Date.now();
      pollRef.current = setInterval(async () => {
        try {
          const cur = await fetchPremiumOrder(o.outTradeNo, visitorId);
          setOrder(cur);
          if (cur.status !== 'pending' || Date.now() - started > POLL_TIMEOUT) {
            stop();
            if (cur.status === 'paid') unlock(cur);
          }
        } catch {
          /* 单次轮询失败不打断 */
        }
      }, POLL_INTERVAL);
    } catch (e: any) {
      alert(e?.message || '下单失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    stop();
    setOrder(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={close} icon={plan.icon} title={plan.name}>
      {!order ? (
        <div className="report-donate">
          <div className="report-donate-amount">{plan.tagline}</div>
          <div className="member-benefits">
            {plan.perks.map((p, i) => (
              <div className="member-benefit" key={i}>{p}</div>
            ))}
          </div>
          <div className="report-donate-amount">
            价格：<strong className="tc-gold">¥{plan.priceYuan}</strong>
            <span className="report-donate-tier">（一次性解锁）</span>
          </div>
          <Button variant="member" disabled={loading} onClick={() => void submit()}>
            {loading ? '正在生成订单…' : `购买 · ¥${plan.priceYuan}`}
          </Button>
        </div>
      ) : order.status === 'paid' ? (
        <div className="report-donate-success">
          <div className="report-donate-success-icon">✨</div>
          <div className="report-donate-success-title">解锁成功，感恩支持</div>
          <div className="report-donate-success-amount">¥{order.amountYuan}</div>
          <div className="report-donate-tip">权益已生效，可前往对应模块体验。</div>
          <div className="poster-actions">
            <Button variant="ghost" onClick={close}>关闭</Button>
          </div>
        </div>
      ) : order.status === 'expired' ? (
        <div className="report-donate-expired">
          <div>⌛ 订单已过期</div>
          <Button variant="ghost" onClick={() => { setOrder(null); void submit(); }}>重新发起</Button>
        </div>
      ) : (
        <div className="report-donate">
          <div className="report-donate-amount">
            应付：<strong className="tc-gold">¥{order.amountYuan}</strong>
          </div>
          {order.payUrl ? (
            <div className="report-donate-qr">
              <img src={order.payUrl} alt="收款码" />
              <div className="report-donate-qr-tip">请用微信扫码支付</div>
            </div>
          ) : (
            <div className="report-donate-qr report-donate-qr-stub">
              <div className="report-donate-qr-placeholder">{order.qrText}</div>
              <div className="report-donate-qr-tip">支付通道正在接入中，订单已记录</div>
            </div>
          )}
          {order.message && <div className="report-donate-tip">{order.message}</div>}
          <div className="report-donate-order">
            订单号 {order.outTradeNo}
            <span className="report-donate-poll">{order.status === 'pending' ? '⏳ 等待支付结果…' : order.status}</span>
          </div>
          <div className="poster-actions">
            <Button variant="ghost" onClick={close}>关闭</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
