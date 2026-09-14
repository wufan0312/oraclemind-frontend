import { NextResponse, type NextRequest } from 'next/server';

// ============================================================================
// 玄镜 OracleMind · 路由守卫（Edge Middleware）
// ----------------------------------------------------------------------------
// 作用：把「必须登录才能访问」的页面在**服务端就拦掉**，未登录直接 302 到登录页，
//      URL 上带 redirect 参数，登录成功后原路跳回。
//
// 为什么不能只靠客户端守卫（RequireAuth）：
//   客户端守卫要等 hydration + /auth/me 回来才知道未登录，这期间受保护页的
//   骨架/兜底 UI 已经闪了一帧。中间件读到 httpOnly Cookie 就能立刻重定向，零闪屏。
//
// 鉴权口径（与后端 app/api/v1/auth.py 保持一致）：
//   登录 token 由后端写入 httpOnly Cookie `om_auth`（path=/，SameSite=strict）。
//   这里只校验 Cookie **是否存在**——Edge 运行时拿不到后端密钥，不做 JWT 验签。
//   过期/被拉黑的 token 由 RequireAuth + 后端 401 兜底拦截（不会漏），
//   中间件的定位是「快速挡掉确定未登录的人」，不是唯一防线。
//
// 注意：Cookie 是 host-only（后端未设置 domain），localhost 下 3000/8000 同站，
//   浏览器会把 om_auth 一并带给 3000，所以这里读得到。
// ============================================================================

/** 认证 Cookie 名（后端 COOKIE_NAME，改动需同步） */
const AUTH_COOKIE = 'om_auth';

/** 需要登录才能访问的路由前缀（新增受保护页只改这里） */
const PROTECTED_PREFIXES = ['/profile'];

/** 判断路径是否落在受保护前缀内（精确匹配 + 子路径，避免 /profile-xxx 误伤） */
function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isProtected(pathname)) return NextResponse.next();

  // 已登录（Cookie 存在）→ 放行
  if (request.cookies.get(AUTH_COOKIE)?.value) return NextResponse.next();

  // 未登录 → 302 到登录页，记录来路用于登录后回跳
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = `?redirect=${encodeURIComponent(`${pathname}${search}`)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // 只对受保护路由生效（图片/静态资源/API 一律不经过中间件）
  matcher: ['/profile', '/profile/:path*'],
};
