'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 单级下拉选择器
 * 复用 Cascader 的视觉类（.cascader-wrap / .cascader-input / .cascader-dropdown / .cascader-option），
 * 使展开面板与「出生地区」级联选择器 100% 风格统一（背景、圆角、hover/选中高亮、箭头、勾选标记）。
 * 适用于选项少、无需联动的场景（如宫制）。
 */
export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function Select({ value, options, onChange, placeholder = '请选择', className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const displayText = selected ? selected.label : placeholder;

  return (
    <div className={`cascader-wrap ${className ?? ''}`} ref={ref}>
      <div
        className={`cascader-input ${open ? 'cascader-input-active' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <span className={`cascader-text ${!selected ? 'cascader-placeholder' : ''}`}>{displayText}</span>
        <span className={`cascader-arrow ${open ? 'cascader-arrow-up' : ''}`}>
          <svg width="10" height="6" viewBox="0 0 10 6">
            <path fill="currentColor" d="M0 0l5 6 5-6z" />
          </svg>
        </span>
      </div>
      {open && (
        <div className="cascader-dropdown cascader-dropdown-single">
          <div className="cascader-column">
            {options.map((o) => (
              <div
                key={o.value}
                className={`cascader-option ${value === o.value ? 'cascader-option-selected' : ''}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
