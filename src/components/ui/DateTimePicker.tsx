'use client';

import { useMemo, useState, useRef, useEffect, type ChangeEvent, type KeyboardEvent } from 'react';

/**
 * Ant Design 风格日期选择器
 * 单输入框 + 日历下拉面板，替代三段式 select
 * 支持两种录入方式：
 *   1. 直接键入（宽松格式：YYYY-MM-DD / YYYY-M-D / YYYYMMDD / YYYY.MM.DD / YYYY/MM/DD）
 *   2. 点击输入框或日历图标展开面板点选
 */
export interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  minYear?: number;
  maxYear?: number;
  className?: string;
  placeholder?: string;
  /** 自定义输入框显示值。面板仍按 value（公历）定位，适用于农历模式显示「1987年3月12日」等场景。 */
  displayValue?: string;
  /** 自定义输入解析器：把用户键入的文本转成 YYYY-MM-DD；默认用公历 loose parser。农历模式可传入农历解析器。 */
  parseInput?: (text: string) => string | null;
  /** 禁止展开日历面板（仅支持键入）。农历模式用它避免「点日历把公历误当农历」的歧义。 */
  disablePanel?: boolean;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

/** 校验年月日并格式化为 YYYY-MM-DD；非法（如 2 月 30 日）返回 null */
function normalizeDate(y: number, m: number, d: number): string | null {
  if (y < 1000 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  // 用 Date 的自动进位反查非法日期：2025-02-30 → 3 月 2 日，回读不一致即判非法
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * 宽松解析用户键入的日期文本 → 规范化 YYYY-MM-DD；无法识别返回 null。
 * 支持：1987-04-09 | 1987-4-9 | 19870409 | 1987/04/09 | 1987.4.9
 */
function parseLooseDate(text: string): string | null {
  const s = (text ?? '').trim();
  if (!s) return null;

  // 8 位连续数字：19870409
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return normalizeDate(Number(m[1]), Number(m[2]), Number(m[3]));

  // 带分隔符：1987-04-09 / 1987/4/9 / 1987.4.9（允许分隔符两侧空格）
  m = /^(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})$/.exec(s);
  if (m) return normalizeDate(Number(m[1]), Number(m[2]), Number(m[3]));

  return null;
}

export function DatePicker({ value, onChange, minYear = 1940, maxYear, className, placeholder, displayValue, parseInput, disablePanel }: DatePickerProps) {
  const max = maxYear ?? new Date().getFullYear();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** 输入框原始文本（可含用户半途输入的中间态，如 "1987-0"）
   *  若传了 displayValue（农历模式），初始化优先用它，避免显示 value（公历） */
  const [draft, setDraft] = useState(displayValue !== undefined ? (displayValue || '') : (value || ''));
  /** 键入内容无法解析 / 超出年份范围 → 红色错误态（不阻断输入，失焦时回滚） */
  const [invalid, setInvalid] = useState(false);

  const [y, m, d] = useMemo(() => {
    const parts = value.split('-');
    return [Number(parts[0]) || new Date().getFullYear(), Number(parts[1]) || 1, Number(parts[2]) || 1];
  }, [value]);

  // 日历面板显示的年月（独立于已选日期，用于翻页）
  const [viewY, setViewY] = useState(y);
  const [viewM, setViewM] = useState(m);

  useEffect(() => {
    if (open) {
      setViewY(y);
      setViewM(m);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * 外部 value / displayValue 变化 → 同步 draft。
   * 关键：
   * 1. 若 draft 已能解析成同一个日期（仅书写格式不同，如键入 "1987-4-9" 而 value 是 "1987-04-09"），
   *    则保留用户输入原文，避免边打字边被格式化打断光标。
   * 2. 若传了 displayValue（农历模式显示「1987-03-12」），只在输入框未聚焦时回写；
   *    用户键入过程中输入框聚焦，displayValue 字符串的引用变化不应打断半途文本。
   */
  useEffect(() => {
    if (displayValue !== undefined) {
      // 农历模式：用户正在输入时不覆盖；失焦/切 Tab/档案回填时才同步
      if (inputRef.current !== document.activeElement) {
        setDraft(displayValue || '');
      }
    } else {
      setDraft((prev) => (parseLooseDate(prev) !== value ? (value || '') : prev));
    }
    setInvalid(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, displayValue]);

  /** 年份是否在允许范围内 */
  const inRange = (iso: string) => {
    const py = Number(iso.slice(0, 4));
    return py >= minYear && py <= max;
  };

  /** 输入解析器：默认公历 loose parser；农历模式由父组件注入。 */
  const parse = parseInput ?? parseLooseDate;

  /** 校验并提交 draft：成功 → onChange(规范化值) 且规整文本；失败 → 回滚为当前 value */
  const commitDraft = () => {
    if (!draft.trim()) {
      setDraft('');
      setInvalid(false);
      if (value) onChange('');
      return;
    }
    const parsed = parse(draft);
    if (!parsed || !inRange(parsed)) {
      setDraft(value || ''); // 回滚，不破坏已有数据
      setInvalid(false);
      return;
    }
    // 自定义解析器（如农历）可能不规整书写，只对外同步 value，draft 由 useEffect/displayValue 接管
    setDraft(parsed);
    setInvalid(false);
    if (parsed !== value) onChange(parsed);
  };

  /** 键入中：能解析就实时同步给父组件，不打断用户书写 */
  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setDraft(text);
    if (!text.trim()) {
      setInvalid(false);
      if (value) onChange('');
      return;
    }
    const parsed = parse(text);
    if (!parsed) {
      setInvalid(true);
      return;
    }
    const ok = inRange(parsed);
    setInvalid(!ok);
    if (ok && parsed !== value) onChange(parsed);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitDraft();
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
    }
  };

  /** 清空：用 onMouseDown + preventDefault，避免先触发 input blur 导致状态错乱 */
  const clearValue = () => {
    setDraft('');
    setInvalid(false);
    if (value) onChange('');
    inputRef.current?.focus();
  };

  // 点击外部关闭（同时提交一次校验，防半途内容残留）
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        commitDraft();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft, value]);

  // 日历网格
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewY, viewM - 1, 1).getDay(); // 0=日
    const lastDate = new Date(viewY, viewM, 0).getDate();
    const today = new Date();
    const cells: { day: number; current: boolean; isToday: boolean }[] = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: 0, current: false, isToday: false });
    for (let dd = 1; dd <= lastDate; dd++) {
      cells.push({
        day: dd,
        current: true,
        isToday: today.getFullYear() === viewY && today.getMonth() + 1 === viewM && today.getDate() === dd,
      });
    }
    while (cells.length % 7 !== 0) cells.push({ day: 0, current: false, isToday: false });
    return cells;
  }, [viewY, viewM]);

  const prevMonth = () => {
    if (viewM === 1) { setViewM(12); setViewY(viewY - 1); }
    else setViewM(viewM - 1);
  };
  const nextMonth = () => {
    if (viewM === 12) { setViewM(1); setViewY(viewY + 1); }
    else setViewM(viewM + 1);
  };
  const prevYear = () => setViewY(viewY - 1);
  const nextYear = () => setViewY(viewY + 1);

  const selectDay = (dd: number) => {
    const next = `${viewY}-${String(viewM).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    setDraft(next);
    setInvalid(false);
    onChange(next);
    setOpen(false);
  };

  return (
    <div className={`antd-dp ${className ?? ''}`} ref={ref}>
      <div className={`antd-dp-input ${open ? 'antd-dp-focused' : ''} ${invalid ? 'antd-dp-invalid' : ''}`}>
        <input
          ref={inputRef}
          className="antd-dp-field"
          type="text"
          value={draft}
          onChange={onInputChange}
          onFocus={() => !disablePanel && setOpen(true)}
          onBlur={commitDraft}
          onKeyDown={onKeyDown}
          placeholder={placeholder || 'YYYY-MM-DD'}
          inputMode={parseInput ? 'text' : 'numeric'}
          autoComplete="off"
          aria-label="出生日期"
          aria-invalid={invalid || undefined}
        />
        {draft && (
          <button
            type="button"
            className="antd-dp-clear"
            onMouseDown={(e) => { e.preventDefault(); clearValue(); }}
            title="清空"
            aria-label="清空"
          >
            ×
          </button>
        )}
        {/* 图标点击：切换面板。用 onMouseDown + preventDefault 保住输入焦点、避免 blur 抢先提交 */}
        {!disablePanel && (
        <span
          className="antd-dp-icon"
          onMouseDown={(e) => { e.preventDefault(); inputRef.current?.focus(); setOpen(!open); }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="2.5" width="12" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.2" />
            <path d="M4 1v3M10 1v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="4.5" cy="9" r="0.8" fill="currentColor" />
            <circle cx="7" cy="9" r="0.8" fill="currentColor" />
            <circle cx="9.5" cy="9" r="0.8" fill="currentColor" />
          </svg>
        </span>
        )}
      </div>
      {open && (
        <div className="antd-dp-panel">
          <div className="antd-dp-header">
            <button className="antd-dp-nav" onClick={prevYear} title="上一年">«</button>
            <button className="antd-dp-nav" onClick={prevMonth} title="上个月">‹</button>
            <span className="antd-dp-title">{viewY} 年 {MONTH_NAMES[viewM - 1]}</span>
            <button className="antd-dp-nav" onClick={nextMonth} title="下个月">›</button>
            <button className="antd-dp-nav" onClick={nextYear} title="下一年">»</button>
          </div>
          <div className="antd-dp-weekdays">
            {WEEKDAYS.map((w) => <span key={w} className="antd-dp-wd">{w}</span>)}
          </div>
          <div className="antd-dp-days">
            {calendarDays.map((cell, i) => (
              <button
                key={i}
                className={`antd-dp-day ${cell.current ? '' : 'antd-dp-empty'} ${cell.isToday ? 'antd-dp-today' : ''} ${cell.current && cell.day === d && viewY === y && viewM === m ? 'antd-dp-selected' : ''}`}
                onClick={() => cell.current && selectDay(cell.day)}
                disabled={!cell.current}
              >
                {cell.day || ''}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Ant Design 风格时间选择器
 * 单输入框 + 时分下拉面板
 */
export interface TimePickerProps {
  value: string; // HH:mm
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function TimePicker({ value, onChange, className, placeholder, disabled }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [h, min] = useMemo(() => {
    const parts = value.split(':');
    return [Number(parts[0]) || 0, Number(parts[1]) || 0];
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const displayValue = value || placeholder || '选择时间';
  const hasValue = !!value;

  return (
    <div className={`antd-tp ${className ?? ''} ${disabled ? 'antd-tp-disabled' : ''}`} ref={ref}>
      <div
        className={`antd-tp-input ${open ? 'antd-tp-focused' : ''}`}
        onClick={() => { if (!disabled) setOpen(!open); }}
        aria-disabled={disabled || undefined}
      >
        <span className={`antd-tp-text ${!hasValue ? 'antd-tp-placeholder' : ''}`}>{displayValue}</span>
        <span className="antd-tp-icon">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M7 4.5v3l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      {open && (
        <div className="antd-tp-panel">
          <div className="antd-tp-cols">
            <div className="antd-tp-col">
              <div className="antd-tp-col-title">时</div>
              <div className="antd-tp-col-list">
                {Array.from({ length: 24 }, (_, i) => (
                  <button
                    key={i}
                    className={`antd-tp-opt ${h === i ? 'active' : ''}`}
                    onClick={() => { onChange(`${String(i).padStart(2, '0')}:${String(min).padStart(2, '0')}`); }}
                  >
                    {String(i).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>
            <div className="antd-tp-col">
              <div className="antd-tp-col-title">分</div>
              <div className="antd-tp-col-list">
                {Array.from({ length: 60 }, (_, i) => (
                  <button
                    key={i}
                    className={`antd-tp-opt ${min === i ? 'active' : ''}`}
                    onClick={() => { onChange(`${String(h).padStart(2, '0')}:${String(i).padStart(2, '0')}`); setOpen(false); }}
                  >
                    {String(i).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DatePicker;
