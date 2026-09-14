'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

// ============================================================================
// 玄镜 OracleMind · 登录守卫（客户端兜底层）
// ----------------------------------------------------------------------------
// 与 src/middleware.ts 是**两层**关系，缺一不可：
//   ① middleware：读 httpOnly Cookie，未登录直接 302，受保护页零闪屏；
//   ② 本组件：Cookie 存在但已失效/被拉黑时，/auth/me 返回 401 → isAuthed=false，
//      中间件看不出来（它不验签），由这里兜底重定向到登录页。
//
// 关键细节——「主动退出」不能被本守卫抢导航：
//   用户点「退出登录」时 isAuthed 会由 true 变 false，若守卫照常 replace('/login')，
//   就会盖掉退出方自己的 replace('/')，把用户甩到登录页。
//   故用 wasAuthedRef 记住本次挂载是否**曾经**登录过：
//   曾登录 → 视为主动退出，不重定向，导航权完全交给退出方。
// ============================================================================

interface RequireAuthProps {
  children: React.ReactNode;
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const { ready, isAuthed } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  /** 本次挂载是否曾处于登录态（区分「主动退出」与「从未登录」） */
  const wasAuthedRef = useRef(false);

  useEffect(() => {
    if (isAuthed) {
      wasAuthedRef.current = true;
      return;
    }
    if (!ready) return;
    // 曾登录过 → 主动退出，导航权交给退出方（TopNav / 页面内的退出按钮）
    if (wasAuthedRef.current) return;
    router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
  }, [ready, isAuthed, pathname, router]);

  // 校验完成前 / 未登录时只渲染占位，绝不放行受保护内容
  if (!ready || !isAuthed) {
    return (
      <div className="page active auth-guard">
        <div className="auth-guard-box">
          <span className="auth-guard-spinner" aria-hidden="true" />
          <span className="auth-guard-text">
            {ready ? '未登录，正在前往登录…' : '正在校验登录状态…'}
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
