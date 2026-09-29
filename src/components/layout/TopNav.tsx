'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { unreadCount } from '@/lib/notifications';

export interface NavItem {
  href: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: '首页' },
  { href: '/bugua', label: '卜卦' },
  { href: '/tarot', label: '塔罗' },
  { href: '/horoscope', label: '星座' },
  { href: '/numerology', label: '数字密码' },
  { href: '/ming', label: '测字·起名·合婚' },
  { href: '/dream', label: '周公解梦' },
  { href: '/fengshui', label: '风水' },
  { href: '/healing', label: '疗愈' }
];

/**
 * 顶部导航 —— 复刻原型 top-nav / nav-logo / nav-links / nav-report-btn
 *
 * 右侧排列（用户指定，勿随意调整）：我的报告 → 开通会员 → 昵称/登录
 *   —— 通知铃铛已移除（2026-09-10），未读数改为昵称右上角的数字徽章。
 *
 * 登录态（AuthContext）：
 * - 未登录：昵称位置显示「登录」按钮
 * - 已登录：显示昵称（**昵称前不放头像图标**），昵称**右上角**是未读消息数徽章
 *   （未读为 0 时不显示）；鼠标滑过整块区域展开下拉菜单（消息通知 / 个人中心 / 退出登录）
 *
 * 未读数来源 `lib/notifications::unreadCount()`，靠 `om:notif-change` 事件同步
 * （原铃铛组件监听同一事件，铃铛移除后这份逻辑搬到本组件）。
 *
 * 下拉展开策略（双轨，避免只能 hover 的桌面方案在触摸端失效）：
 * - 桌面鼠标：纯 CSS `:hover` / `:focus-within` 控制（见 layout.scss），零 JS 延迟
 * - 触摸 / 键盘：React `open` 态，点击切换、Esc 关闭、点击外部关闭、路由变化自动收起
 * 两轨叠加不会打架：CSS hover 的显隐优先级与 open 类一致，鼠标场景下 open 被置 false
 * 也不会让菜单消失。
 */
export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthed, ready, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // 未读消息数：铃铛已移除（用户 2026-09-10 要求），改在昵称右上角以数字徽章呈现
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const update = () => setUnread(unreadCount());
    update();
    window.addEventListener('om:notif-change', update);
    return () => window.removeEventListener('om:notif-change', update);
  }, []);

  // 路由变化后收起（点「个人中心」跳转后不留残影）
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Esc 关闭 + 点击菜单外部关闭
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen]);

  // 退出后回首页：受保护页（个人中心）不能原地停留
  const onLogout = async () => {
    setMenuOpen(false);
    await logout();
    router.replace('/');
  };

  return (
    <nav className="top-nav">
      <Link href="/" className="nav-logo">
        <img src="/images/logo.png" alt="玄镜 OracleMind" className="logo-img" />
      </Link>
      <div className="nav-links">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={'nav-link' + (pathname === item.href ? ' active' : '')}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {/* 右侧顺序（用户指定）：我的报告 → 开通会员 → 昵称/登录（铃铛已移除） */}
      <div className="nav-right">
        <Link href="/report" className={'nav-btn nav-report-btn' + (pathname === '/report' ? ' active' : '')}>
          📊 我的报告
        </Link>
        <Link
          href="/member"
          className={'nav-btn btn-primary nav-member-btn' + (pathname === '/member' ? ' active' : '')}
        >
          开通会员
        </Link>
        {ready && isAuthed && user ? (
          <div
            ref={menuRef}
            className={'nav-user-menu' + (menuOpen ? ' open' : '')}
            onMouseLeave={() => setMenuOpen(false)}
          >
            <button
              type="button"
              className="nav-user-trigger"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="nav-username">{user.username}</span>
            </button>

            {/* 昵称右上角：未读消息数（替代原通知铃铛，点击直达通知中心） */}
            {unread > 0 && (
              <Link
                href="/notifications"
                className="nav-user-badge"
                aria-label={`${unread} 条未读消息`}
              >
                {unread > 99 ? '99+' : unread}
              </Link>
            )}

            <div className="nav-user-dropdown" role="menu" aria-label="账号菜单">
              <Link href="/notifications" className="nav-user-item" role="menuitem">
                <span className="nav-user-item-icon" aria-hidden="true">🔔</span>
                消息通知
                {unread > 0 && <span className="nav-user-item-count">{unread > 99 ? '99+' : unread}</span>}
              </Link>
              <Link href="/profile" className="nav-user-item" role="menuitem">
                <span className="nav-user-item-icon" aria-hidden="true">👤</span>
                个人中心
              </Link>
              <button
                type="button"
                className="nav-user-item nav-user-item--danger"
                role="menuitem"
                onClick={onLogout}
              >
                <span className="nav-user-item-icon" aria-hidden="true">⏻</span>
                退出登录
              </button>
            </div>
          </div>
        ) : (
          <Link href="/login" className="nav-btn btn-ghost">登录</Link>
        )}
      </div>
    </nav>
  );
}
