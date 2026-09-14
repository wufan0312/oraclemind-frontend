'use client';

import { useMemo } from 'react';
import { CHINA_REGIONS, type RegionCity } from '@/data/chinaRegions';

/**
 * 省份 — 城市 级联选择器
 * 选省份后动态加载对应城市列表，选城市后返回城市信息（含经纬度）
 */
export interface RegionPickerProps {
  /** 当前选中的省份名（如 "浙江省"） */
  province: string;
  /** 当前选中的城市名（如 "杭州"） */
  city: string;
  /** 省份变化回调，返回省份名 */
  onProvinceChange: (province: string) => void;
  /** 城市变化回调，返回城市名 + 经纬度 */
  onCityChange: (city: string, lat: number, lng: number) => void;
  className?: string;
}

export default function RegionPicker({
  province,
  city,
  onProvinceChange,
  onCityChange,
  className,
}: RegionPickerProps) {
  // 当前省份下的城市列表（选省份后动态获取）
  const cities: RegionCity[] = useMemo(() => {
    const prov = CHINA_REGIONS.find((p) => p.name === province);
    return prov ? prov.cities : [];
  }, [province]);

  const handleProvince = (provName: string) => {
    onProvinceChange(provName);
    // 自动选中新省份的第一个城市
    const prov = CHINA_REGIONS.find((p) => p.name === provName);
    if (prov && prov.cities.length > 0) {
      const c = prov.cities[0];
      onCityChange(c.name, c.lat, c.lng);
    }
  };

  const handleCity = (cityName: string) => {
    const c = cities.find((c) => c.name === cityName);
    if (c) {
      onCityChange(c.name, c.lat, c.lng);
    }
  };

  return (
    <div className={`rp-group ${className ?? ''}`}>
      <select
        className="rp-select"
        value={province}
        onChange={(e) => handleProvince(e.target.value)}
      >
        {CHINA_REGIONS.map((p) => (
          <option key={p.name} value={p.name}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        className="rp-select rp-select-mid"
        value={city}
        onChange={(e) => handleCity(e.target.value)}
      >
        {cities.map((c) => (
          <option key={c.name} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
