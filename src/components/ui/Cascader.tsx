'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CHINA_REGIONS, type RegionCity } from '@/data/chinaRegions';

/**
 * Ant Design 风格级联选择器
 * 单输入框 → 点击展开省市两级面板 → 选中后回显 breadcrumb
 */
export interface CascaderOption {
  label: string;
  value: string;
  children?: { label: string; value: string; lat: number; lng: number }[];
}

export interface CascaderProps {
  /** 当前选中值 [provinceName, cityName] */
  value: [string, string];
  /** 选中回调 */
  onChange: (province: string, city: string, lat: number, lng: number) => void;
  /** 占位符 */
  placeholder?: string;
  className?: string;
}

export default function Cascader({ value, onChange, placeholder = '请选择', className }: CascaderProps) {
  const [open, setOpen] = useState(false);
  const [hoverProvince, setHoverProvince] = useState<string>('');
  const ref = useRef<HTMLDivElement>(null);

  // 初始化 hover 省份
  useEffect(() => {
    if (value[0]) setHoverProvince(value[0]);
    else if (CHINA_REGIONS[0]) setHoverProvince(CHINA_REGIONS[0].name);
  }, [value[0]]);

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const currentProvince = CHINA_REGIONS.find((p) => p.name === value[0]) ?? CHINA_REGIONS[0];
  const currentCities: RegionCity[] = useMemo(
    () => CHINA_REGIONS.find((p) => p.name === hoverProvince)?.cities ?? [],
    [hoverProvince]
  );

  const displayText = value[0] && value[1] ? `${value[0]} / ${value[1]}` : placeholder;

  const handleProvinceHover = (provName: string) => {
    setHoverProvince(provName);
  };

  const handleCityClick = (city: RegionCity) => {
    onChange(hoverProvince, city.name, city.lat, city.lng);
    setOpen(false);
  };

  return (
    <div className={`cascader-wrap ${className ?? ''}`} ref={ref}>
      <div
        className={`cascader-input ${open ? 'cascader-input-active' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <span className={`cascader-text ${!value[0] ? 'cascader-placeholder' : ''}`}>{displayText}</span>
        <span className={`cascader-arrow ${open ? 'cascader-arrow-up' : ''}`}>
          <svg width="10" height="6" viewBox="0 0 10 6">
            <path fill="currentColor" d="M0 0l5 6 5-6z" />
          </svg>
        </span>
      </div>
      {open && (
        <div className="cascader-dropdown">
          <div className="cascader-column cascader-col-province">
            {CHINA_REGIONS.map((p) => (
              <div
                key={p.name}
                className={`cascader-option ${hoverProvince === p.name ? 'cascader-option-active' : ''} ${value[0] === p.name ? 'cascader-option-selected' : ''}`}
                onClick={() => handleProvinceHover(p.name)}
                onMouseEnter={() => handleProvinceHover(p.name)}
              >
                {p.name}
              </div>
            ))}
          </div>
          <div className="cascader-column cascader-col-city">
            {currentCities.map((c) => (
              <div
                key={c.name}
                className={`cascader-option ${value[0] === hoverProvince && value[1] === c.name ? 'cascader-option-selected' : ''}`}
                onClick={() => handleCityClick(c)}
              >
                {c.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
