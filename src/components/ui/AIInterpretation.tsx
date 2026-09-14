import type { ReactNode } from 'react';

export interface AIInterpretationProps {
  /** 招呼语（大标题，温暖共情，默认「小玄陪你看看」） */
  greeting?: ReactNode;
  /** 副标题（小字，如「八字命理 · AI 解读」） */
  subtitle?: ReactNode;
  /** 正文内容（支持 HTML 字符串或 ReactNode，与 children 二选一） */
  content?: ReactNode;
  /** 头像（默认 小玄） */
  avatar?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/**
 * AI 解读卡 —— 原型 ai-interpretation / ai-interp-header / ai-interp-avatar / ai-interp-text
 * 顶部招呼语统一以「小玄」开头，提供情绪价值。
 */
export default function AIInterpretation({
  greeting = '小玄陪你看看',
  subtitle,
  content,
  avatar = <img src="/images/spirit_avatar.png" alt="小玄" />,
  className = '',
  children,
}: AIInterpretationProps) {
  return (
    <div className={'ai-interpretation result-card ' + className}>
      <div className="ai-interp-header">
        <div className="ai-interp-avatar">{avatar}</div>
        <div className="ai-interp-header-title">{greeting}</div>
      </div>
      {subtitle && <div className="ai-interp-subtitle">{subtitle}</div>}
      <div className="ai-interp-text">{content ?? children}</div>
    </div>
  );
}

function AiAvatar() {
  return (
    <div className="ai-avatar">
      <img src="/images/spirit_avatar.png" alt="小玄" className="ai-avatar-img" />
    </div>
  );
}
export {
  AiAvatar,
}