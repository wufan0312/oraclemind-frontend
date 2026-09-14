/**
 * 路由级骨架屏（供各 app/*\/loading.tsx 复用）
 * ----------------------------------------------------------------
 * App Router 在没有 loading.tsx 时，客户端导航会「阻塞」等待 RSC payload：
 * 点完导航 URL 不变、页面无反应，直到目标路由编译/传输完成才整页切换，
 * 体感就是「点了半天才跳转」。
 *
 * 有了 loading.tsx，Next 会把它编译成 Suspense 边界：点击瞬间就切 UI，
 * 等待期间展示本骨架屏，感知延迟直接归零。
 *
 * 注意：这里是 Server Component（无 'use client'），导航时能立刻出 HTML，
 * 不需要等任何 JS chunk 下载，所以首帧最快。
 */
export default function RouteLoading({ label }: { label: string }) {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <div className="route-loading-inner">
        <span className="route-loading-mirror" aria-hidden="true">☯</span>
        <p className="route-loading-label">{label}</p>
        <div className="route-loading-bars" aria-hidden="true">
          <span className="route-loading-bar" />
          <span className="route-loading-bar" />
          <span className="route-loading-bar" />
        </div>
      </div>
    </div>
  );
}
