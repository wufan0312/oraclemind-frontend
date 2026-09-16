'use client';

import { useEffect, useMemo, useState } from 'react';
import { DatePicker } from './DateTimePicker';
import {
  formatLunarText,
  formatSolarText,
  lunarToSolar,
  parseLunarLooseDate,
  parseLunarToParts,
  solarToLunarParts,
} from '@/lib/lunarDate';

export type BirthDateMode = 'solar' | 'lunar';

export interface BirthDateValue {
  /** 规范化公历日期 YYYY-MM-DD；始终是最终 canonical 值 */
  date: string;
  /** 农历年 */
  lunarYear?: number;
  /** 农历月（正月=1；闰月为负，如 -8 = 闰八月） */
  lunarMonth?: number;
  /** 农历日 */
  lunarDay?: number;
  /** 当前输入模式 */
  mode: BirthDateMode;
}

export interface BirthDatePickerProps {
  value?: Partial<BirthDateValue>;
  onChange: (value: BirthDateValue) => void;
  label?: string;
  placeholder?: string;
  minYear?: number;
  maxYear?: number;
  className?: string;
  /** 是否允许切换到农历输入；默认 true */
  allowLunar?: boolean;
  /** 是否显示「公历 / 农历」标签文本；默认 true */
  showLabelText?: boolean;
}

const DEFAULT_MIN_YEAR = 1900;
const DEFAULT_MAX_YEAR = new Date().getFullYear();

function isValidDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** 解析任意 yyyy-mm-dd，返回公历分量 */
function parseSolarParts(s: string): { y: number; m: number; d: number } | null {
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

/**
 * 全站统一出生日期选择器
 * 特性：
 * - 公历 / 农历一键切换（与卜卦页 UX 一致）
 * - 对外始终输出 canonical 公历 date + 农历分量 + 当前模式
 * - 农历输入时即时换算为公历，但输入框仍显示农历原文
 * - 支持受控回填（公历或农历均可）
 */
export function BirthDatePicker({
  value,
  onChange,
  label = '出生日期',
  placeholder,
  minYear = DEFAULT_MIN_YEAR,
  maxYear = DEFAULT_MAX_YEAR,
  className = '',
  allowLunar = true,
  showLabelText = true,
}: BirthDatePickerProps) {
  // 当前输入模式：优先跟随外部 value.mode，否则内部默认公历
  const [mode, setMode] = useState<BirthDateMode>(value?.mode || 'solar');
  const [error, setError] = useState('');

  // canonical 公历值（始终以此为准）
  const date = value?.date ?? '';

  // 农历分量：从外部 value 或根据公历 date 实时算出
  const lunarParts = useMemo(() => {
    if (value?.lunarYear != null && value?.lunarMonth != null && value?.lunarDay != null) {
      return { ly: value.lunarYear, lm: value.lunarMonth, ld: value.lunarDay };
    }
    if (date && isValidDate(date)) return solarToLunarParts(date);
    return null;
  }, [date, value?.lunarYear, value?.lunarMonth, value?.lunarDay]);

  // 农历输入框显示文本：只在 lunar 模式下使用
  const [lunarText, setLunarText] = useState('');

  // 同步外部 value 变化（回填场景）
  useEffect(() => {
    if (value?.mode) setMode(value.mode);
  }, [value?.mode]);

  // 农历模式且 lunarParts 有效时，同步显示文本
  useEffect(() => {
    if (mode === 'lunar' && lunarParts) {
      setLunarText(formatLunarText(lunarParts.ly, lunarParts.lm, lunarParts.ld));
    }
  }, [mode, lunarParts]);

  const switchToSolar = () => {
    if (mode === 'solar') return;
    setMode('solar');
    setError('');
    // 若当前有农历分量，换算为公历后输出
    if (lunarParts) {
      const s = lunarToSolar(lunarParts.ly, lunarParts.lm, lunarParts.ld);
      if (s && s !== date) {
        onChange({ date: s, mode: 'solar', ...lunarParts });
        return;
      }
    }
    onChange({ date, mode: 'solar', ...(lunarParts || {}) });
  };

  const switchToLunar = () => {
    if (mode === 'lunar') return;
    setMode('lunar');
    setError('');
    if (lunarParts) {
      setLunarText(formatLunarText(lunarParts.ly, lunarParts.lm, lunarParts.ld));
    }
    onChange({ date, mode: 'lunar', ...(lunarParts || {}) });
  };

  const handleSolarChange = (v: string) => {
    setError('');
    if (!v) {
      onChange({ date: '', mode });
      return;
    }
    const parsed = solarToLunarParts(v);
    onChange({ date: v, mode, ...(parsed || {}) });
  };

  const handleLunarRawChange = (raw: string) => {
    setError('');
    if (!raw) {
      setLunarText('');
      onChange({ date: '', mode: 'lunar' });
      return;
    }
    const p = parseLunarToParts(raw);
    if (!p) {
      setError('农历日期不正确');
      // 仅把当前原文还给输入框，不提交换算
      setLunarText(raw);
      return;
    }
    const s = lunarToSolar(p.ly, p.lm, p.ld);
    if (!s) {
      setError('农历日期不存在');
      setLunarText(raw);
      return;
    }
    setLunarText(formatLunarText(p.ly, p.lm, p.ld));
    onChange({ date: s, mode: 'lunar', lunarYear: p.ly, lunarMonth: p.lm, lunarDay: p.ld });
  };

  const clearValue = () => {
    setError('');
    setLunarText('');
    onChange({ date: '', mode });
  };

  // DatePicker 在农历模式下：value 用换算后的公历（定位日历），displayValue 用农历文本
  const dpValue = mode === 'lunar'
    ? (lunarParts ? lunarToSolar(lunarParts.ly, lunarParts.lm, lunarParts.ld) || date : date)
    : date;

  return (
    <div className={`birth-date-picker ${className}`}>
      {(label || allowLunar) && <div className="birth-date-picker__header">
        {label ? <span className="birth-date-picker__label">{label}</span> : <span />}
        {allowLunar && (
          <div className="birth-date-picker__toggle" role="tablist" aria-label="日期输入模式">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'solar'}
              className={`birth-date-picker__mode ${mode === 'solar' ? 'active' : ''}`}
              onClick={switchToSolar}
              title="公历"
            >
              <span className="mode-icon">☀</span>
              {showLabelText && <span>公历</span>}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'lunar'}
              className={`birth-date-picker__mode ${mode === 'lunar' ? 'active' : ''}`}
              onClick={switchToLunar}
              title="农历"
            >
              <span className="mode-icon">🌙</span>
              {showLabelText && <span>农历</span>}
            </button>
          </div>
        )}
      </div>}
      <div className="birth-date-picker__input">
        {mode === 'solar' ? (
          <DatePicker
            key="solar"
            value={date}
            onChange={handleSolarChange}
            placeholder={placeholder || '选择公历日期'}
            minYear={minYear}
            maxYear={maxYear}
          />
        ) : (
          <DatePicker
            key="lunar"
            value={dpValue}
            onChange={handleLunarRawChange}
            placeholder={placeholder || '选择农历日期'}
            minYear={minYear}
            maxYear={maxYear}
            displayValue={lunarText}
            parseInput={parseLunarLooseDate}
          />
        )}
      </div>
      {error && <div className="birth-date-picker__error">{error}</div>}
      {date && (
        <div className="birth-date-picker__summary">
          <span>📅 公历：{formatSolarText(date)}</span>
          <span>🌗 农历：{lunarParts ? formatLunarText(lunarParts.ly, lunarParts.lm, lunarParts.ld) : '—'}</span>
        </div>
      )}
    </div>
  );
}

export default BirthDatePicker;
