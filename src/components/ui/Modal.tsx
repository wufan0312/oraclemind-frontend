'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  icon?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  /** share 弹窗布局（分享选项网格） */
  variant?: 'default' | 'share';
  /** 底部主按钮 */
  footer?: ReactNode;
  /** 底部辅助提示文字 */
  hint?: ReactNode;
  /** 点击遮罩关闭 */
  closeOnOverlay?: boolean;
  /** 按 ESC 关闭（默认开） */
  closeOnEsc?: boolean;
}

/**
 * 轻量 Modal —— 基于原型 modal-overlay / modal / modal-icon / modal-title / modal-text 提取
 */
export default function Modal({
  open,
  onClose,
  icon,
  title,
  children,
  variant = 'default',
  footer,
  hint,
  closeOnOverlay = true,
  closeOnEsc = true
}: ModalProps) {
  // ESC 关闭 + 焦点圈定：open 时监听键盘，body 加滚动锁
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === 'Escape' && onClose) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, closeOnEsc, onClose]);

  return (
    <div
      className={'modal-overlay' + (variant === 'share' ? ' share-modal' : '') + (open ? ' active' : '')}
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      onClick={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className="modal">
        {icon != null && <div className="modal-icon">{icon}</div>}
        {title != null && <div className="modal-title">{title}</div>}
        {children != null && <div className="modal-text">{children}</div>}
        {footer}
        {hint != null && <div className="modal-hint">{hint}</div>}
      </div>
    </div>
  );
}
