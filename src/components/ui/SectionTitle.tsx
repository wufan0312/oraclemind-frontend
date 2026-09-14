import type { ReactNode } from 'react';
import SectionIcon from './SectionIcon';

export interface SectionTitleProps {
  children?: ReactNode;
  /** 小标题前 SVG 图标名（SectionIcon 语义名，如 star / compass / zap） */
  icon?: string;
  /** @deprecated 已废弃，内联 SVG 不再需要目录 */
  iconDir?: string;
  /** @deprecated 已废弃，标题自带图标 */
  dotColor?: string;
}

/**
 * 章节标题 —— 标题前自带线性 SVG 图标，颜色统一紫色 var(--primary)
 */
export default function SectionTitle({ children, icon }: SectionTitleProps) {
  return (
    <div className="result-card-title">
      {icon && <SectionIcon name={icon} />}
      {children}
    </div>
  );
}
