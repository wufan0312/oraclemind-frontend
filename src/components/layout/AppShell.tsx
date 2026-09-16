'use client';

import TopNav from './TopNav';
import Footer from './Footer';
import BirthConsentBanner from './BirthConsentBanner';

/**
 * 应用外壳：全站统一显示顶部导航（首页 + 其余页面），导航含「首页」入口
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      {children}
      <Footer />
      <BirthConsentBanner />
    </>
  );
}
