'use client';

import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import PaywallModal from './PaywallModal';
import { isUnlocked, type PremiumItemId } from '@/lib/premium';

/**
 * 付费解锁入口按钮（内含付费墙弹窗）
 * 已解锁时显示解锁态，仍可点开查看权益与订单信息。
 */
export default function PremiumUnlockButton({
  item,
  label = '🔓 解锁进阶内容',
  unlockedLabel,
  className = '',
}: {
  item: PremiumItemId;
  label?: string;
  unlockedLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const refresh = useCallback(() => setUnlocked(isUnlocked(item)), [item]);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener('om:premium-change', onChange);
    return () => window.removeEventListener('om:premium-change', onChange);
  }, [refresh]);

  return (
    <>
      <Button
        variant="ghost"
        className={'premium-unlock-btn' + (unlocked ? ' unlocked' : '') + (className ? ' ' + className : '')}
        onClick={() => setOpen(true)}
      >
        {unlocked ? unlockedLabel || '✅ 已解锁 · 查看完整版' : label}
      </Button>
      <PaywallModal open={open} item={item} onClose={() => setOpen(false)} onUnlocked={refresh} />
    </>
  );
}
