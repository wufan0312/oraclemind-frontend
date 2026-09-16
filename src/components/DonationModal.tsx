'use client';

import { useEffect, useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { createDonation, fetchDonation, type DonationOrder } from '@/lib/api';
import { useRegion } from '@/lib/useRegion';
import type { Offering } from '@/data/healingData';

const POLL_INTERVAL = 3000;
const POLL_TIMEOUT = 5 * 60 * 1000;

/**
 * 随喜供养弹层（疗愈心斋接入用）。
 * 复刻 report 页捐赠弹层：下单 → 收款引导 → 轮询 → 成功。
 * stub 渠道无真实收款码，展示占位文案 + 订单号，用户可继续免费查看。
 */
export default function DonationModal({
  open,
  onClose,
  offering,
  visitorId,
}: {
  open: boolean;
  onClose: () => void;
  offering: Offering | null;
  visitorId: string;
}) {
  const [order, setOrder] = useState<DonationOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [customAmount, setCustomAmount] = useState(19.9);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { isCN } = useRegion();

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

  const submit = async () => {
    if (!offering) return;
    setLoading(true);
    stop();
    try {
      const payload: { tier: string; visitorId: string; amountFen?: number } = {
        tier: offering.tier,
        visitorId,
      };
      if (offering.tier === '自定义') payload.amountFen = Math.round(customAmount * 100);
      const o = await createDonation(payload);
      setOrder(o);
      if (o.status === 'paid') return;
      const started = Date.now();
      pollRef.current = setInterval(async () => {
        try {
          const cur = await fetchDonation(o.outTradeNo, visitorId);
          setOrder(cur);
          if (cur.status !== 'pending' || Date.now() - started > POLL_TIMEOUT) {
            stop();
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

  if (!offering) return null;
  const priceLabel = offering.tier === '自定义' ? `¥${customAmount}` : offering.price;

  return (
    <Modal open={open} onClose={close} icon="🙏" title="随喜供养">
      {isCN ? (
        /* 境内合规版：不提供任何付费/供养入口 */
        <div className="report-donate report-donate-cn">
          <div className="report-donate-tip">
            根据当地规则，玄镜在此区域不开放付费或供养功能。所有解读与内容均可免费使用，欢迎体验。
          </div>
          <Button variant="ghost" onClick={close}>关闭</Button>
        </div>
      ) : !order ? (
        <div className="report-donate">
          <div className="report-donate-amount">
            供养：<strong className="tc-gold">{offering.name}</strong>
            <span className="report-donate-tier">{priceLabel}</span>
          </div>
          {offering.tier === '自定义' && (
            <input
              className="offering-amount-input"
              type="number"
              min={1}
              step={0.1}
              value={customAmount}
              onChange={(e) => setCustomAmount(Number(e.target.value) || 0)}
            />
          )}
          <div className="report-donate-tip">深度解读永远免费，供养纯属自愿。</div>
          <Button variant="member" disabled={loading} onClick={() => void submit()}>
            {loading ? '正在生成订单…' : '确认供养'}
          </Button>
        </div>
      ) : order.status === 'paid' ? (
        <div className="report-donate-success">
          <div className="report-donate-success-icon">🙏</div>
          <div className="report-donate-success-title">感恩供养，功德无量</div>
          <div className="report-donate-success-amount">¥{order.amountYuan}</div>
          <div className="report-donate-tip">玄镜将一直免费开放，愿你所愿皆成。</div>
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
            <span className="report-donate-tier">（{order.tier}）</span>
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
