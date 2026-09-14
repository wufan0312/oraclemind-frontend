'use client';

import '@/styles/notifications.scss';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getNotifications,
  markRead,
  markAllRead,
  removeNotification,
  clearAll,
  type AppNotification,
} from '@/lib/notifications';

const TYPE_META: Record<string, { icon: string; label: string }> = {
  system: { icon: '📢', label: '系统' },
  feature: { icon: '✨', label: '功能' },
  growth: { icon: '🪷', label: '成长' },
  tip: { icon: '💡', label: '提示' },
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const pad = (n: number) => String(n).padStart(2, '0');
  return sameDay
    ? `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`
    : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 通知中心 —— 消息列表 / 已读 / 删除 / 跳转
 */
export default function NotificationsPage() {
  const router = useRouter();
  const [list, setList] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    setList(getNotifications());
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const unread = list.filter((n) => !n.read).length;

  const onOpen = (n: AppNotification) => {
    if (!n.read) markRead(n.id);
    if (n.link) router.push(n.link);
    refresh();
  };

  return (
    <div className="page active notif-page">
      <div className="notif-head">
        <div>
          <h1 className="notif-title">🔔 通知中心</h1>
          <div className="notif-sub">
            {loaded ? (unread > 0 ? `${unread} 条未读 · 共 ${list.length} 条` : `共 ${list.length} 条，全部已读`) : '加载中…'}
          </div>
        </div>
        <div className="notif-actions">
          {list.length > 0 && (
            <>
              <button className="notif-btn" onClick={() => { markAllRead(); refresh(); }} disabled={unread === 0}>
                全部已读
              </button>
              <button
                className="notif-btn danger"
                onClick={() => {
                  if (!window.confirm('确定清空全部通知？')) return;
                  clearAll();
                  refresh();
                }}
              >
                清空
              </button>
            </>
          )}
        </div>
      </div>

      {!loaded ? (
        <div className="notif-empty">加载中…</div>
      ) : list.length === 0 ? (
        <div className="notif-empty">
          <div className="notif-empty-icon">📭</div>
          <div className="notif-empty-text">暂无通知</div>
          <div className="notif-empty-hint">有新消息时会显示在这里</div>
        </div>
      ) : (
        <div className="notif-list">
          {list.map((n) => {
            const meta = TYPE_META[n.type] || TYPE_META.system;
            return (
              <div key={n.id} className={'notif-item' + (n.read ? '' : ' unread')}>
                <div className="notif-item-icon">{meta.icon}</div>
                <button className="notif-item-main" onClick={() => onOpen(n)}>
                  <div className="notif-item-top">
                    <span className="notif-item-title">{n.title}</span>
                    <span className="notif-item-type">{meta.label}</span>
                  </div>
                  <div className="notif-item-body">{n.body}</div>
                  <div className="notif-item-time">{fmtTime(n.time)}{n.link ? ' · 点击前往' : ''}</div>
                </button>
                <button
                  className="notif-item-del"
                  onClick={() => { removeNotification(n.id); refresh(); }}
                  aria-label="删除"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
