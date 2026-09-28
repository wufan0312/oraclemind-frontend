'use client';

/**
 * 风水模块 · 合规下线迁移提示页（2026-09-18）
 * ----------------------------------------------------------------------------
 * 合规整改「断要件②」（消灾方法 / 开运物品）：风水/九星场景的结构化
 * 「化解方案 + 开运好物」内容整页下线（refactor/compliance-reposition）。
 *
 * 本页不再渲染任何风水排盘 / 化解 / 开运内容，仅保留迁移提示：
 * - 告知老用户功能已调整及原因；
 * - 引导到仍在合规范围内的自我觉察工具（疗愈 / 测评）。
 *
 * 注意：`@/data/fengshuiData` 中的 saveBaziLink / findLuckyDates 等工具函数
 * 仍被 bugua / ming 页引用，数据文件保留；但风水专属的内容数据表不再被任何
 * 页面消费。Compass.tsx / fengshui.scss 随本页下线成为未使用资源，留待后续
 * 归档清理。
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import SectionTitle from '@/components/ui/SectionTitle';

export default function FengshuiOffboardedPage() {
  const router = useRouter();

  // 顶栏在路由变化时会收起菜单，这里无需额外状态；进入页面即上滚，避免停留在旧锚点
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="page active" id="page-fengshui-offboarded">
      <div className="page-title">🧭 模块调整通知</div>

      <div className="result-card">
        <SectionTitle icon="compass">风水模块已下线</SectionTitle>
        <p>
          原风水堪舆（九宫飞星 / 八宅 / 形煞化解 / 开运物品推荐）模块已按平台内容规范
          <strong className="tc-text-primary">整体下线</strong>，不再提供测算与布局建议服务。
        </p>
        <p>
          玄镜正在转向「<strong className="tc-text-primary">自我觉察与疗愈</strong>」方向：
          关注你此刻的压力结构、资源与可以行动的一小步，而非对环境吉凶下判断。
        </p>
        <p className="tc-text-secondary" style={{ fontSize: 13 }}>
          你已有的解读记录未受影响，仍可在「我的报告」中查看。
        </p>

        <SectionTitle icon="sparkles">接下来可以做什么</SectionTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Button variant="primary" onClick={() => router.push('/healing')}>
            去疗愈·心斋歇一歇 →
          </Button>
          <Button variant="ghost" onClick={() => router.push('/assessment')}>
            试试复原力测评 →
          </Button>
        </div>
      </div>
    </div>
  );
}
