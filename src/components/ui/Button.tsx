import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 按钮风格：primary（主色渐变）/ ghost（描边）/ submit（通栏渐变）/ gold（金色强调）/ member（会员金卡）/ default（裸按钮） */
  variant?: 'primary' | 'ghost' | 'submit' | 'gold' | 'member' | 'default';
  /** 大尺寸（btn-large） */
  large?: boolean;
  children?: ReactNode;
}

/**
 * 轻量 Button —— 基于原型 btn-primary / btn-ghost / btn-submit / wudao-btn / member-btn 提取
 */
export default function Button({
  variant = 'default',
  large = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const cls = [
    variant === 'primary' ? 'btn-primary' : '',
    variant === 'ghost' ? 'btn-ghost' : '',
    variant === 'submit' ? 'btn-submit' : '',
    variant === 'gold' ? 'wudao-btn' : '',
    variant === 'member' ? 'member-btn' : '',
    large ? 'btn-large' : '',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={cls || undefined} {...rest}>
      {children}
    </button>
  );
}
