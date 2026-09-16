import type { Metadata } from 'next';
import AppShell from '@/components/layout/AppShell';
import { VisitorProvider } from '@/components/visitor/VisitorProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import ToastContainer from '@/components/ui/Toast';
import CacheSweeper from '@/components/system/CacheSweeper';
import { I18nProvider } from '@/lib/i18n';

// 全局样式（基础层，全路由共享）：设计令牌 → 基础/动画 → 布局 → 组件库
// 模块级样式（bugua/tarot/horoscope/dream/numerology/ming/fengshui/healing/report/admin/login
// 以及 AiChatWindow/LightFollowUp）已下沉到各自路由 page.tsx / 组件文件局部 import，
// 由 Next 按路由代码分割，降低首屏 CSS 体积（性能优化 P0-6）。
import '@/styles/tokens.scss';
import '@/styles/base.scss';
import '@/styles/animations.scss';
import '@/styles/layout.scss';
import '@/styles/components.scss';
// 组件库 DateTimePicker 的样式：被 bugua / horoscope / numerology / ming 多页共用，需全局加载
// （2026-09-08 从 horoscope.scss 抽出，避免拆分后仅 horoscope 有样式的局部化问题）
import '@/components/ui/DateTimePicker.scss';
// BirthDatePicker 出生日期选择器：被 bugua / horoscope / numerology / ming 多页共用，需全局加载
import '@/components/ui/BirthDatePicker.scss';
// Cascader 级联选择器：被 horoscope / bugua 多页共用，需全局加载
// （2026-09-10 从 horoscope.scss 抽出，避免仅 horoscope 有样式的局部化问题）
import '@/components/ui/Cascader.scss';
// AiAvatar 的样式：被 AiChatWindow / LightFollowUp 头部跨页共用，需全局加载
// （2026-09-08 从 home.scss 抽出——塔罗页不加载 home.scss 导致头像按原图尺寸直出）
import '@/components/ui/AIInterpretation.scss';
// 成长体系卡片（GrowthCard）只挂在个人中心 /profile，但样式仍需全局加载
// （2026-09-10 从 home.scss 抽出——个人中心不加载 home.scss 会导致卡片无样式；
//  同日首页已移除该卡片，勿因"只有一页用"就把它挪回 profile.scss）
import '@/styles/growth-card.scss';
// 付费墙（PaywallModal / PremiumUnlockButton）被 tarot / horoscope 跨页共用，需全局加载
import '@/styles/premium.scss';
// 全站页脚（隐私政策 / 数据删除入口 / 18+ 与娱乐免责）与出生信息单独同意条
import '@/styles/footer.scss';
import '@/styles/lang-switch.scss';
import '@/styles/birth-consent.scss';
// 注：iconfont 基础类与尺寸工具类已合并进 components.scss 末尾，避免新增 scss 模块导致的 module resolve 缓存问题

export const metadata: Metadata = {
  title: 'Xuanjing · AI Cultural Experience',
  description: 'AI-powered multi-system cultural experience — Bazi, Zi Wei, Tarot, astrology, numerology and fengshui.'
};

/**
 * iconfont CDN URL 配置（font-class 模式）
 * ----------------------------------------------------------------
 * 修正点（旧实现：env 未配置时回落到空串）：
 * NEXT_PUBLIC_ICONFONT_CDN 只写在 .env.local 里，而 .env*.local 被 .gitignore 忽略；
 * 也就是说**全新克隆的仓库拿不到这个变量**，回落到空串 → 全站 iconfont 图标静默失效
 * （<i class="iconfont icon-xxx"> 退化成空白/豆腐块），且不报任何错。
 *
 * 现策略：把线上已在用的官方 CDN 链接作为**代码级默认**（它只是一个公开只读样式表，
 * 不含任何凭据，硬编码无安全风险），env 变量仅用于覆盖（换图标库 / 自托管时走这条）。
 * 这样「不配任何环境变量」也能正常出图标。
 * ----------------------------------------------------------------
 */
const DEFAULT_ICONFONT_CDN = 'https://at.alicdn.com/t/c/font_5225625_q91x1qydrn.css';

const ICONFONT_CDN = (process.env.NEXT_PUBLIC_ICONFONT_CDN ?? '').trim() || DEFAULT_ICONFONT_CDN;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* iconfont font-class：有 CDN 才注入，避免 404 请求占位地址 */}
        {ICONFONT_CDN && <link rel="stylesheet" href={ICONFONT_CDN} crossOrigin="anonymous" />}
      </head>
      <body>
        <AuthProvider>
          <VisitorProvider>
            <I18nProvider>
              <AppShell>{children}</AppShell>
              <ToastContainer />
              {/* 启动后清扫本地缓存（P1-3）：清过期 + 超限淘汰，不渲染任何 UI */}
              <CacheSweeper />
            </I18nProvider>
          </VisitorProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
