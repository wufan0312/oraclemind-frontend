import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** 卡片风格：panel（result-card 默认面板）/ side（侧边栏）/ fs（风水面板）/ mood（今日能量卡） */
  variant?: 'panel' | 'side' | 'fs' | 'mood';
  /** 可选的标题（渲染为 result-card-title，含紫色圆点） */
  title?: ReactNode;
  /** 标题右侧点缀（如 emoji 图标） */
  titleIcon?: ReactNode;
  children?: ReactNode;
}

const VARIANTS: Record<string, string> = {
  panel: 'result-card',
  side: 'side-card',
  fs: 'fs-card',
  mood: 'mood-tracker'
};

/**
 * 轻量 Card —— 基于原型 result-card / side-card / fs-card / mood-tracker 提取
 */
export default function Card({ variant = 'panel', title, titleIcon, className = '', children, ...rest }: CardProps) {
  const cls = [VARIANTS[variant] || 'result-card', className].filter(Boolean).join(' ');
  return (
    <div className={cls} {...rest}>
      {title != null && (
        <div className="result-card-title">
          {title}
          {titleIcon != null && <span className="card-title-icon">{titleIcon}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
