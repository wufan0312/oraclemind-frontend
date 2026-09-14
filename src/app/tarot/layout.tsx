import type { Metadata } from 'next';

/**
 * 塔罗页级 metadata。
 *
 * 为什么单独拆一个 layout：page.tsx 带 'use client'，而 Next 的 `metadata` 只能由
 * 服务端组件导出（客户端组件导出会直接编译报错）。此前全站只有根 layout 一个
 * 兜底标题，塔罗页没有独立标题与描述，SEO 与分享卡片都拿不到有效信息。
 */
export const metadata: Metadata = {
  title: '塔罗占卜 · 玄镜 OracleMind',
  description:
    '78 张完整塔罗牌库（22 张大阿卡纳 + 56 张小阿卡纳），支持时间之流、二选一、感情关系、凯尔特十字、事业决策五种牌阵，洗牌抽牌后由 AI 结合牌位含义与分维度牌义做情境化解读。',
};

export default function TarotLayout({ children }: { children: React.ReactNode }) {
  return children;
}
