import type { CSSProperties } from 'react';

export interface ProgressProps {
  /** 进度 0-100 */
  value?: number;
  /** 兼容别名：percent（与 value 等价，部分调用方沿用原型命名） */
  percent?: number;
  /** 进度条高度（覆盖轨道默认高度，填充层 height:100% 自动跟随） */
  height?: number;
  /** 轨道类（wuxing-bar-bg / verify-bar-bg / realm-xp-bar 等） */
  trackClass?: string;
  /** 填充类（wuxing-bar-fill / verify-bar-fill / realm-xp-fill 等） */
  fillClass?: string;
  /** 填充颜色（内联覆盖，如五行色） */
  color?: string;
  /** 额外容器类（布局用，如 flex:1） */
  className?: string;
  /** 额外容器样式 */
  style?: CSSProperties;
}

/**
 * 轻量 Progress —— 基于原型 wuxing-bar / verify-bar / realm-xp-bar 提取
 * 用法：
 * <Progress value={80} trackClass="wuxing-bar-bg" fillClass="wuxing-bar-fill" color="#4ade80" />
 */
export default function Progress({ value, percent, height, trackClass = 'wuxing-bar-bg', fillClass = 'wuxing-bar-fill', color, className = '', style }: ProgressProps) {
  const v = value ?? percent ?? 0;
  const cls = [trackClass, className].filter(Boolean).join(' ');
  return (
    <div className={cls} style={height != null ? { ...style, height } : style}>
      <div
        className={fillClass}
        style={{ width: Math.max(0, Math.min(100, v)) + '%', ...(color ? { ['--fill' as string]: color } : {}) }}
      />
    </div>
  );
}
