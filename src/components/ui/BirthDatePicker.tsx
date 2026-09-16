'use client';

import { useEffect, useState } from 'react';
import { DatePicker } from './DateTimePicker';
import {
  solarToLunarParts,
  lunarToSolarISO,
  formatLunarText,
  parseLunarInput,
  parseLunarToParts,
  LUNAR_YEAR_MIN,
  LUNAR_YEAR_MAX,
} from '@/lib/lunar';

/**
 * 出生日期录入（全站唯一入口）
 * ============================================================
 * 从卜卦页抽取而来，统一「公历 / 农历」双模式录入与落地：
 *   - 公历模式：日历点选或键入 YYYY-MM-DD，自动换算并回填农历分量
 *   - 农历模式：用户直接写农历（1987年3月12日 / 1987-3-12 / 19870312 / 闰月），系统换算公历
 *   - 两种模式对外都同时产出「公历 date」+「农历 lunarYear/lunarMonth/lunarDay」，
 *     即 VisitorBirth 的「农历录入、阳历推算、两者同存」策略，
 *     命理算法（八字/生肖/数字命理）一律以农历口径推算。
 *
 * 农历月以负数表示闰月（如 -8 = 闰八月）；展示文本闰月写作 YYYY--MM-DD。
 * ⚠️ 农历模式下日历面板被禁用（disablePanel），只允许键入：
 *    否则「点日历拿到的公历日期」会被误解析成农历日期，导致换算错误。
 */
export type BirthMode = 'solar' | 'lunar';

export interface BirthValue {
  /** 公历（阳历）出生日期 YYYY-MM-DD，排盘 / 算法统一使用此值 */
  date: string;
  /** 农历出生年 */
  lunarYear?: number;
  /** 农历出生月（1-12，闰月用负数） */
  lunarMonth?: number;
  /** 农历出生日 */
  lunarDay?: number;
  /** 当前录入模式 */
  mode?: BirthMode;
}

export interface BirthDatePickerProps {
  value?: BirthValue;
  onChange?: (v: BirthValue) => void;
  minYear?: number;
  maxYear?: number;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  /** 是否显示 公历/农历 切换（默认 true） */
  showModeToggle?: boolean;
  /** 默认录入模式（默认 solar） */
  defaultMode?: BirthMode;
}

export function BirthDatePicker({
  value,
  onChange,
  minYear = LUNAR_YEAR_MIN,
  maxYear = LUNAR_YEAR_MAX,
  className,
  placeholder,
  disabled,
  showModeToggle = true,
  defaultMode = 'solar',
}: BirthDatePickerProps) {
  const [mode, setMode] = useState<BirthMode>(value?.mode ?? defaultMode);

  // 外部 mode 变化（如云档案回填为农历录入）→ 同步内部模式
  useEffect(() => {
    if (value?.mode) setMode(value.mode);
  }, [value?.mode]);

  /** 日历面板永远按公历定位；农历模式用它把已选日期定位到对应的公历月份 */
  const solar = value?.date || '';
  /** 农历模式输入框显示文本（YYYY-MM-DD，闰月写作 -MM） */
  const lunarText =
    value?.lunarYear && value?.lunarMonth && value?.lunarDay
      ? formatLunarText(value.lunarYear, value.lunarMonth, value.lunarDay)
      : '';

  /** 公历录入：拿到的就是公历日期，换算农历分量一并回传 */
  const handleSolarChange = (iso: string) => {
    if (!iso) {
      onChange?.({ date: '', mode: 'solar' });
      return;
    }
    const lp = solarToLunarParts(iso);
    onChange?.({
      date: iso,
      lunarYear: lp?.ly,
      lunarMonth: lp?.lm,
      lunarDay: lp?.ld,
      mode: 'solar',
    });
  };

  /** 农历录入：拿到的是农历文本，换算成公历后再回传（保证 date 恒为公历） */
  const handleLunarChange = (text: string) => {
    if (!text.trim()) {
      onChange?.({ date: '', mode: 'lunar' });
      return;
    }
    const p = parseLunarToParts(text);
    if (!p) return;
    const iso = lunarToSolarISO(p.ly, p.lm, p.ld);
    if (!iso) return;
    onChange?.({
      date: iso,
      lunarYear: p.ly,
      lunarMonth: p.lm,
      lunarDay: p.ld,
      mode: 'lunar',
    });
  };

  return (
    <div className={`birth-dp ${className ?? ''} ${disabled ? 'birth-dp-disabled' : ''}`}>
      {showModeToggle && (
        <div className="birth-dp-modes" role="tablist" aria-label="历法模式">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'solar'}
            className={`birth-dp-mode ${mode === 'solar' ? 'active' : ''}`}
            onClick={() => setMode('solar')}
          >
            公历
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'lunar'}
            className={`birth-dp-mode ${mode === 'lunar' ? 'active' : ''}`}
            onClick={() => setMode('lunar')}
          >
            农历
          </button>
        </div>
      )}
      {mode === 'solar' ? (
        <DatePicker
          value={solar}
          onChange={handleSolarChange}
          minYear={minYear}
          maxYear={maxYear}
          placeholder={placeholder || 'YYYY-MM-DD'}
        />
      ) : (
        <DatePicker
          value={solar}
          displayValue={lunarText}
          parseInput={parseLunarInput}
          onChange={handleLunarChange}
          minYear={minYear}
          maxYear={maxYear}
          placeholder={placeholder || '农历 YYYY-MM-DD'}
          disablePanel
        />
      )}
    </div>
  );
}

export default BirthDatePicker;
