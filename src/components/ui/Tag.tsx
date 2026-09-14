import type { HTMLAttributes, ReactNode } from 'react';

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  /** 标签风格：good（绿）/ warn（金）/ bad（红）/ star-* / score-* /
   * 以及语义别名 auspicious（吉）/ inauspicious（凶）/ neutral（中）/ muted（弱） */
  variant?:
    | 'good'
    | 'warn'
    | 'bad'
    | 'star-good'
    | 'star-bad'
    | 'score-good'
    | 'score-mid'
    | 'score-warn'
    | 'auspicious'
    | 'inauspicious'
    | 'neutral'
    | 'muted';
  /** 基础类（如 dream-tag / star-tag / score-badge / tip-tag） */
  baseClass?: string;
  children?: ReactNode;
}

const VARIANTS: Record<string, string> = {
  good: 'tag-good',
  warn: 'tag-warn',
  bad: 'tag-bad',
  'star-good': 'star-tag-good',
  'star-bad': 'star-tag-bad',
  'score-good': 'score-badge-good',
  'score-mid': 'score-badge-mid',
  'score-warn': 'score-badge-warn',
  // 语义别名：吉凶/中性/弱，复用既有配色，便于各页统一表达
  auspicious: 'tag-good',
  inauspicious: 'tag-bad',
  neutral: 'tag-warn',
  muted: 'tag-muted'
};

/**
 * 轻量 Tag —— 基于原型 dream-tag / star-tag / score-badge / tip-tag 提取
 */
export default function Tag({ variant = 'good', baseClass = 'dream-tag', className = '', children, ...rest }: TagProps) {
  const cls = [baseClass, VARIANTS[variant], className].filter(Boolean).join(' ');
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}
