'use client';

/**
 * 玄镜 · 通知中心（消息/通知中心）
 * --------------------------------------------------------------------------
 * 纯前端实现：种子通知（欢迎 + 功能引导）+ 运行时可新增（如签到成功）。
 * 持久化在 om_notifications（可上云），记录已读/删除状态。
 * 与真实后端推送不同——本作无推送通道，通知由应用内事件驱动生成。
 */

import { setCloudItem, removeCloudItem } from '@/lib/cloudStore';

const NOTIF_KEY = 'om_notifications';

export type NotifType = 'system' | 'feature' | 'growth' | 'tip';

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: string; // ISO 时间
  read: boolean;
  link?: string; // 点击跳转
}

// 首次进入时的种子通知
const SEED_NOTIFICATIONS: Omit<AppNotification, 'read'>[] = [
  {
    id: 'seed-welcome',
    type: 'system',
    title: '欢迎来到玄镜 OracleMind 👋',
    body: 'AI 驱动的多术数文化体验平台。卜卦、塔罗、星座、数字密码、解梦、风水、疗愈，一站式体验。',
    time: new Date().toISOString(),
    link: '/',
  },
  {
    id: 'seed-growth',
    type: 'growth',
    title: '开启你的修行成长',
    body: '每日签到累积灵修值，使用各模块越多境界越高。首页底部可查看等级与进度。',
    time: new Date().toISOString(),
    link: '/',
  },
  {
    id: 'seed-feature-search',
    type: 'feature',
    title: '全局搜索已上线',
    body: '顶部搜索框可快速定位功能入口与你的占卜记录。',
    time: new Date().toISOString(),
    link: '/search',
  },
  {
    id: 'seed-tip-privacy',
    type: 'tip',
    title: '关于你的隐私',
    body: '出生信息等敏感资料在登录后由后端加密存储；匿名态仅存于本机。测算结果仅供娱乐参考。',
    time: new Date().toISOString(),
    link: '/profile',
  },
];

function loadRaw(): AppNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(NOTIF_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveRaw(list: AppNotification[]): void {
  try {
    const val = JSON.stringify(list);
    window.localStorage.setItem(NOTIF_KEY, val);
    setCloudItem(NOTIF_KEY, val);
    // 通知未读数变化（监听方：TopNav 昵称右上角的未读徽章；
    // 原 NotificationBell 铃铛已移除，归档在 .archive/2026-09-10-notification-bell/）
    window.dispatchEvent(new CustomEvent('om:notif-change'));
  } catch {
    /* 忽略 */
  }
}

/** 首次访问注入种子通知（若尚未初始化） */
export function ensureSeeded(): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage.getItem(NOTIF_KEY) !== null) return;
  } catch {
    return;
  }
  const seeded: AppNotification[] = SEED_NOTIFICATIONS.map((n) => ({ ...n, read: false }));
  saveRaw(seeded);
}

export function getNotifications(): AppNotification[] {
  ensureSeeded();
  return loadRaw();
}

export function unreadCount(): number {
  return getNotifications().filter((n) => !n.read).length;
}

export function markRead(id: string): void {
  const list = loadRaw().map((n) => (n.id === id ? { ...n, read: true } : n));
  saveRaw(list);
}

export function markAllRead(): void {
  saveRaw(loadRaw().map((n) => ({ ...n, read: true })));
}

export function removeNotification(id: string): void {
  saveRaw(loadRaw().filter((n) => n.id !== id));
}

export function clearAll(): void {
  saveRaw([]);
  try {
    removeCloudItem(NOTIF_KEY);
  } catch {
    /* 忽略 */
  }
}

/** 运行时新增一条通知（如签到成功） */
export function pushNotification(n: Omit<AppNotification, 'read' | 'time'> & { time?: string }): void {
  const list = loadRaw();
  list.unshift({ ...n, read: false, time: n.time || new Date().toISOString() });
  saveRaw(list);
}

export { NOTIF_KEY };
