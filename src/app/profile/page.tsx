'use client';

import '@/styles/profile.scss';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useVisitor } from '@/components/visitor/VisitorProvider';
import { resetGrowth } from '@/lib/growth';
import GrowthCard from '@/components/home/GrowthCard';
import { resetOnboarded, markOnboarded } from '@/lib/onboarding';
import RequireAuth from '@/components/auth/RequireAuth';
import { fetchPremiumEntitlements } from '@/lib/api';
import { loadUnlocks } from '@/lib/premium';

/**
 * 个人中心 —— 用户资料 / 修行境界（复用首页 GrowthCard）/ 占卜档案 / 数据与引导
 *
 * 访问门槛：本页必须登录后可见。双层守卫（服务端 middleware + 客户端 RequireAuth）
 * 见 src/middleware.ts 与 src/components/auth/RequireAuth.tsx。
 */
export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileContent />
    </RequireAuth>
  );
}

function ProfileContent() {
  const router = useRouter();
  const { user, isAuthed, ready, logout } = useAuth();
  const { birth } = useVisitor();
  const [msg, setMsg] = useState<string | null>(null);
  // GrowthCard 挂载时自行 computeGrowth；清空成长数据后靠 key 强制重挂刷新
  const [growthKey, setGrowthKey] = useState(0);

  // 会员权益概览：本页是登录后页面，走 Cookie 鉴权（不传 visitorId）
  const [unlockCount, setUnlockCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const local = loadUnlocks().length;
    void (async () => {
      try {
        const ent = await fetchPremiumEntitlements();
        if (alive) setUnlockCount(Math.max(local, ent.unlocked?.length ?? 0));
      } catch {
        if (alive) setUnlockCount(local);
      }
    })();
    return () => { alive = false; };
  }, []);

  const flash = (text: string) => {
    setMsg(text);
    window.setTimeout(() => setMsg(null), 2200);
  };

  // 退出后回首页：本页受登录保护，不能原地停留。
  // 导航权在这里，RequireAuth 对「曾登录过」的会话不抢导航（见其注释）。
  const onLogout = async () => {
    await logout();
    router.replace('/');
  };

  const onReplayTour = () => {
    resetOnboarded();
    flash('新手引导已重置，回到首页将重新播放');
  };

  const onMarkTourDone = () => {
    markOnboarded();
    flash('已标记为已完成引导');
  };

  const onResetGrowth = () => {
    if (!window.confirm('确定清空成长数据（灵修值、签到记录）？修行足迹来自各模块记录，不受影响。')) return;
    resetGrowth();
    setGrowthKey((k) => k + 1);
    flash('成长数据已清空');
  };

  return (
    <div className="page active profile-page">
      <div className="profile-head">
        <h1 className="profile-title">👤 个人中心</h1>
        <div className="profile-sub">管理你的资料、成长与占卜档案</div>
      </div>

      {msg && <div className="profile-toast">{msg}</div>}

      <div className="profile-grid">
        {/* ① 修行境界（复用首页 GrowthCard；页内不再需要"查看个人中心"入口） */}
        <GrowthCard key={growthKey} hideLink />

        {/* ② 用户资料 */}
        <section className="profile-card profile-card--wide">
          <div className="profile-card-title">账号资料</div>
          {ready && isAuthed && user ? (
            <div className="profile-user">
              <div className="profile-avatar">{user.username.slice(0, 1).toUpperCase()}</div>
              <div className="profile-user-info">
                <div className="profile-username">{user.username}</div>
                <div className="profile-user-email">{user.email || '未绑定邮箱'}</div>
                <div className="profile-user-id">ID：{user.id}</div>
              </div>
              <button className="profile-logout" onClick={onLogout}>退出登录</button>
            </div>
          ) : (
            <div className="profile-guest">
              <div className="profile-guest-text">当前为<strong>访客模式</strong>，记录仅保存在本机。</div>
              <div className="profile-guest-hint">登录后可在多设备间同步占卜记录与成长数据。</div>
              <Link href="/login" className="profile-login-btn">去登录 / 注册 →</Link>
            </div>
          )}
        </section>

        {/* ③ 占卜档案 */}
        <section className="profile-card profile-card--wide">
          <div className="profile-card-title">🔮 占卜档案</div>
          {birth?.date ? (
            <div className="profile-birth">
              <div className="profile-birth-row">
                <span className="profile-birth-label">出生日期</span>
                <span className="profile-birth-val">{birth.date}</span>
              </div>
              <div className="profile-birth-row">
                <span className="profile-birth-label">出生时辰</span>
                <span className="profile-birth-val">{birth.time || '不详'}</span>
              </div>
              {birth.gender && (
                <div className="profile-birth-row">
                  <span className="profile-birth-label">性别</span>
                  <span className="profile-birth-val">{birth.gender}</span>
                </div>
              )}
              {birth.lunarYear && birth.lunarMonth && birth.lunarDay && (
                <div className="profile-birth-row">
                  <span className="profile-birth-label">农历</span>
                  <span className="profile-birth-val">
                    {birth.lunarYear}年{birth.lunarMonth < 0 ? `闰${-birth.lunarMonth}` : birth.lunarMonth}月{birth.lunarDay}日
                  </span>
                </div>
              )}
              {(birth.province || birth.city) && (
                <div className="profile-birth-row">
                  <span className="profile-birth-label">出生地</span>
                  <span className="profile-birth-val">
                    {[birth.province, birth.city].filter(Boolean).join(' / ')}
                  </span>
                </div>
              )}
              <div className="profile-birth-hint">
                出生信息用于八字、占星等排盘。
                {isAuthed ? '已登录后由后端加密存储。' : '访客模式仅保存在本机，不会上传。'}
              </div>
            </div>
          ) : (
            <div className="profile-empty">
              尚未设置出生信息。
              <Link href="/horoscope" className="profile-inline-link">去设置 →</Link>
            </div>
          )}
        </section>

        {/* ④ 会员与权益 */}
        <section className="profile-card profile-card--wide">
          <div className="profile-card-title">👑 会员与权益</div>
          <div className="profile-member">
            <span className="profile-member-text">
              {unlockCount === null
                ? '读取中…'
                : unlockCount > 0
                  ? `已解锁 ${unlockCount} 项进阶权益`
                  : '当前为免费版 · 全站基础功能永久免费'}
            </span>
            <Link href="/member" className="profile-member-link">会员中心 →</Link>
          </div>
        </section>

        {/* ⑤ 数据与引导 */}
        <section className="profile-card profile-card--wide">
          <div className="profile-card-title">⚙️ 数据与引导</div>
          <div className="profile-actions">
            <button className="profile-action-btn" onClick={onReplayTour}>重新观看新手引导</button>
            <button className="profile-action-btn" onClick={onMarkTourDone}>标记引导已完成</button>
            <button className="profile-action-btn danger" onClick={onResetGrowth}>清空成长数据</button>
          </div>
          <div className="profile-actions-hint">
            测算结果仅供娱乐参考，不构成任何决策依据。清空成长数据不会影响各模块的占卜与日记记录。
          </div>
        </section>
      </div>
    </div>
  );
}
