'use client';

/**
 * 玄镜统一接口 Loading（'use client'）
 * ----------------------------------------------------------------
 * 视觉与 RouteLoading 保持一致：旋转太极符 + 文案 + 三脉冲条。
 * 供各页面接口请求、弹窗内加载、按钮 loading 等客户端场景复用。
 */
export interface OmLoadingProps {
  /** 提示文案，默认「加载中…」 */
  label?: string;
  /** 展示模式：
   *  - inline：只在内容区居中占位（默认）
   *  - overlay：绝对定位覆盖父容器，带半透明背景
   *  - fullscreen：fixed 覆盖整个视口
   */
  mode?: 'inline' | 'overlay' | 'fullscreen';
  /** 尺寸：sm / md / lg */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** 是否在 mode=overlay 时阻止点击穿透（默认 true） */
  preventPointer?: boolean;
}

export default function OmLoading({
  label = '加载中…',
  mode = 'inline',
  size = 'md',
  className = '',
  preventPointer = true,
}: OmLoadingProps) {
  const rootClasses = [
    'om-loading',
    `om-loading-${mode}`,
    `om-loading-${size}`,
    preventPointer ? 'om-loading-pointer' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClasses} role="status" aria-live="polite" aria-busy="true">
      <div className="om-loading-inner">
        <span className="om-loading-mirror" aria-hidden="true">☯</span>
        {label && <p className="om-loading-label">{label}</p>}
        <div className="om-loading-bars" aria-hidden="true">
          <span className="om-loading-bar" />
          <span className="om-loading-bar" />
          <span className="om-loading-bar" />
        </div>
      </div>
    </div>
  );
}
