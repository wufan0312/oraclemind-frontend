'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { storage } from '@/lib/storage';

/**
 * 错误边界：子组件渲染抛错时兜底展示，避免整页白屏。
 *
 * 此前全站 0 处 componentDidCatch，任何一个数据异常（历史快照字段缺失、
 * 牌库取不到牌、localStorage 里存了脏数据）都会让整个页面变成白板，
 * 用户既看不到原因也没法自救。这里提供「重试 + 清空本地缓存」两条退路。
 *
 * 注意：错误边界只能捕获**渲染期**错误，事件回调与异步里的错误捕获不到，
 * 那些仍需各自 try/catch。
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  /** 出错区块名称，写进兜底文案，方便用户描述问题 */
  name?: string;
  /** 自定义兜底 UI（不传则用默认卡片） */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** 错误上报钩子（供埋点 / 日志接入） */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.name ? ` · ${this.props.name}` : ''}]`, error, info);
    this.props.onError?.(error, info);
  }

  /** 重置错误状态：用户点「重试」时重新渲染子树 */
  private reset = (): void => {
    this.setState({ error: null });
  };

  /**
   * 清空本页本地缓存后重载。
   * 塔罗页的脏数据（旧版本快照、损坏的历史记录）是渲染异常最常见的来源，
   * 只重试会立刻再次崩溃，必须给一条「清缓存」的退路。
   */
  private resetStorage = (): void => {
    try {
      const keys = storage.allKeys().filter((k) => k.startsWith('om-tarot'));
      keys.forEach((k) => storage.removeItem(k));
    } catch {
      /* 存储不可用则直接重载 */
    }
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary-icon">⚠️</div>
        <div className="error-boundary-title">
          {this.props.name ? `${this.props.name}出错了` : '页面出错了'}
        </div>
        <div className="error-boundary-desc">
          这部分内容没能正常显示，你的其他操作不受影响。可以重试，若反复出错请清缓存重载。
        </div>
        <pre className="error-boundary-detail">{error.message}</pre>
        <div className="error-boundary-actions">
          <button type="button" className="nav-btn btn-ghost" onClick={this.reset}>
            ↻ 重试
          </button>
          <button type="button" className="nav-btn btn-primary" onClick={this.resetStorage}>
            🧹 清空本地缓存并重载
          </button>
        </div>
      </div>
    );
  }
}
