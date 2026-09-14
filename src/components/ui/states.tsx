import type { ReactNode } from 'react';

/**
 * 通用空 / 加载 / 错误态（此前各页用约 14 种互不相同的 className 手写）。
 * 统一视觉与语义，样式在 components.scss 的 .om-empty-state / .om-loading-state /
 * .om-error-state（全局，组件库共享）。
 */

export function EmptyState({
  icon,
  title,
  hint,
  action,
  className = '',
}: {
  icon?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`om-empty-state ${className}`.trim()}>
      {icon != null && <div className="om-empty-icon">{icon}</div>}
      <p className="om-empty-title">{title}</p>
      {hint != null && <p className="om-empty-hint">{hint}</p>}
      {action != null && <div className="om-empty-action">{action}</div>}
    </div>
  );
}

export function LoadingState({
  label,
  className = '',
}: {
  label?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`om-loading-state ${className}`.trim()}>
      <span className="om-loading-spinner" aria-hidden="true" />
      {label != null && <p className="om-loading-label">{label}</p>}
    </div>
  );
}

export function ErrorState({
  title,
  hint,
  onRetry,
  className = '',
}: {
  title?: ReactNode;
  hint?: ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={`om-error-state ${className}`.trim()}>
      <p className="om-error-title">{title ?? '出错了'}</p>
      {hint != null && <p className="om-error-hint">{hint}</p>}
      {onRetry != null && (
        <button type="button" className="om-error-retry" onClick={onRetry}>
          重试
        </button>
      )}
    </div>
  );
}
