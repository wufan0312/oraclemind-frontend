'use client';

import { useEffect, useCallback, useState } from 'react';

export interface ToastItem {
  id: number;
  message: string;
  type?: 'info' | 'success' | 'warn' | 'error';
}

let nextId = 0;

/** 全局 Toast 容器（挂载在 layout 里，通过 showToast 推消息） */
export default function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  // 暴露给外部调用的方法（挂到 window 上，各页面直接用）
  useEffect(() => {
    const showToast = (message: string, type: ToastItem['type'] = 'info', duration = 2200) => {
      const id = ++nextId;
      setItems((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    };
    (window as unknown as Record<string, unknown>).__showToast = showToast;
    return () => { delete (window as unknown as Record<string, unknown>).__showToast; };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="toast-stack" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={'toast-item toast-' + (t.type || 'info')}>
          <span className="toast-msg">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

/** 便捷调用：各页面 import 后直接用，不再写 window.alert */
export function showToast(message: string, type?: ToastItem['type'], duration?: number): void {
  ((window as unknown as Record<string, unknown>).__showToast as typeof showToast)?.(message, type, duration);
}
