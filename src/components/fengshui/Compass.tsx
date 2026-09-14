'use client';

import { useState } from 'react';

// 八主方位（顺时针，0=北），对应 24 山与八卦
const DIRS_8 = [
  { key: 'N', label: '北', mountain: '子', bagua: '坎', deg: 0 },
  { key: 'NE', label: '东北', mountain: '艮', bagua: '艮', deg: 45 },
  { key: 'E', label: '东', mountain: '卯', bagua: '震', deg: 90 },
  { key: 'SE', label: '东南', mountain: '巽', bagua: '巽', deg: 135 },
  { key: 'S', label: '南', mountain: '午', bagua: '离', deg: 180 },
  { key: 'SW', label: '西南', mountain: '坤', bagua: '坤', deg: 225 },
  { key: 'W', label: '西', mountain: '酉', bagua: '兑', deg: 270 },
  { key: 'NW', label: '西北', mountain: '乾', bagua: '乾', deg: 315 },
];

// 24 山（地支+八干+四维），顺时针，每山 15°
const MOUNTAINS_24 = [
  '子', '癸', '丑', '艮', '寅', '甲', '卯', '乙', '辰', '巽', '巳', '丙',
  '午', '丁', '未', '坤', '申', '庚', '酉', '辛', '戌', '乾', '亥', '壬',
];

function mountainAt(deg: number): string {
  const idx = ((Math.round(deg / 15) % 24) + 24) % 24;
  return MOUNTAINS_24[idx];
}

function baguaAt(deg: number): string {
  const idx = ((Math.round(deg / 45) % 8) + 8) % 8;
  return DIRS_8[idx].bagua;
}

/**
 * 风水罗盘定向组件（修复 P1「罗盘功能缺失」）。
 * 纯前端、手动定向（不依赖移动端传感器权限）：转动中心指针对齐住宅正门/阳台，
 * 读取坐向（24 山 + 八卦），提示用户把九宫飞星图的「北」对齐该方向。
 */
export default function Compass() {
  const [heading, setHeading] = useState(0); // 0=北，顺时针
  const cur = mountainAt(heading);
  const opp = mountainAt(heading + 180);
  const curBagua = baguaAt(heading);

  return (
    <section className="fs-compass-card">
      <div className="fs-compass-head">
        <span className="fs-compass-ico">🧭</span>
        <h3 className="fs-compass-title">罗盘定向 · 对齐住宅坐向</h3>
      </div>
      <p className="fs-compass-tip">
        转动中心指针对准住宅<strong>正门 / 主阳台</strong>方向，读取坐向：坐 <b>{cur}</b> 向 <b>{opp}</b>（卦 <b>{curBagua}</b>）。
        再把上方九宫飞星图的「北」对齐此方向，即可把飞星布局套到你家实际空间。
      </p>
      <div className="fs-compass-dial">
        <svg viewBox="0 0 200 200" className="fs-compass-svg" aria-hidden>
          <circle cx="100" cy="100" r="94" className="fs-compass-ring" />
          <circle cx="100" cy="100" r="78" className="fs-compass-ring2" />
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (i * 15 - 90) * (Math.PI / 180);
            const x1 = 100 + 90 * Math.cos(a);
            const y1 = 100 + 90 * Math.sin(a);
            const x2 = 100 + (i % 6 === 0 ? 74 : 82) * Math.cos(a);
            const y2 = 100 + (i % 6 === 0 ? 74 : 82) * Math.sin(a);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="fs-compass-tick" />;
          })}
          {DIRS_8.map((d) => {
            const rad = ((d.deg - 90) * Math.PI) / 180;
            const x = 100 + 60 * Math.cos(rad);
            const y = 100 + 60 * Math.sin(rad);
            return (
              <text key={d.key} x={x} y={y} className="fs-compass-dir" textAnchor="middle" dominantBaseline="central">
                {d.label}
              </text>
            );
          })}
        </svg>
        <div className="fs-compass-needle" style={{ transform: `rotate(${heading}deg)` }}>
          <span className="fs-compass-needle-n" />
          <span className="fs-compass-needle-s" />
        </div>
        <span className="fs-compass-center" />
      </div>
      <input
        type="range"
        min={0}
        max={359}
        value={heading}
        onChange={(e) => setHeading(Number(e.target.value))}
        className="fs-compass-range"
        aria-label="设定住宅朝向角度"
      />
      <div className="fs-compass-btns">
        {DIRS_8.map((d) => (
          <button
            key={d.key}
            type="button"
            className={'fs-compass-btn' + (Math.round(heading / 45) * 45 % 360 === d.deg ? ' active' : '')}
            onClick={() => setHeading(d.deg)}
          >
            {d.label}
          </button>
        ))}
      </div>
    </section>
  );
}
