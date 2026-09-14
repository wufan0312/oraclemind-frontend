import type { HTMLAttributes, ReactNode } from 'react';

export interface ChipProps extends HTMLAttributes<HTMLDivElement> {
  /** 胶囊风格：suggestion（首页建议）/ spread（牌阵选择）/ chat（对话建议）/ mode（吉凶筛选）/ sample（数字示例）/ toggle（双状态切换）/ realm（境界徽章） */
  variant?: 'suggestion' | 'spread' | 'chat' | 'mode' | 'sample' | 'toggle' | 'realm';
  active?: boolean;
  children?: ReactNode;
}

const VARIANTS: Record<string, string> = {
  suggestion: 'ai-suggestion-chip',
  spread: 'spread-chip',
  chat: 'chat-suggest-chip',
  mode: 'mode-btn',
  sample: 'num-sample',
  toggle: 'state-toggle-btn',
  realm: 'realm-level-chip'
};

/**
 * 轻量 Chip —— 基于原型 ai-suggestion-chip / spread-chip / chat-suggest-chip / mode-btn / state-toggle-btn 提取
 */
export default function Chip({ variant = 'suggestion', active = false, className = '', children, ...rest }: ChipProps) {
  const cls = [VARIANTS[variant] || 'ai-suggestion-chip', active ? 'active' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
