'use client';
import { useMemo } from 'react';
import type { NatalChart } from '@/lib/api';

interface Props {
  chart: NatalChart;
}

const CX = 190;
const CY = 190;
const R_SIGN_OUT = 178;
const R_SIGN_IN = 150;
const R_HOUSE_OUT = 147;
const R_HOUSE_IN = 96;
const R_PLANET = 122;
const R_HUB = 34;

// 黄经 L(0-360, 0=白羊始点) → 屏幕坐标（上升点固定于 9 点钟方向，中天固定于 12 点方向）
function chartAngle(L: number, asc: number): number {
  let a = 180 - (L - asc);
  a = ((a % 360) + 360) % 360;
  return a;
}
function pt(L: number, r: number, asc: number): [number, number] {
  const a = (chartAngle(L, asc) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
}
// 环形扇区路径（用于宫位/星座填充）
function annularSector(rIn: number, rOut: number, L0: number, L1: number, asc: number): string {
  let a0 = chartAngle(L0, asc);
  let a1 = chartAngle(L1, asc);
  // 确保沿顺时针（屏幕）方向扫过该扇区
  let sweep = a1 - a0;
  if (sweep <= 0) sweep += 360;
  const large = sweep > 180 ? 1 : 0;
  const [x0o, y0o] = pt(L0, rOut, asc);
  const [x1o, y1o] = pt(L1, rOut, asc);
  const [x1i, y1i] = pt(L1, rIn, asc);
  const [x0i, y0i] = pt(L0, rIn, asc);
  // 外弧顺时针(sweep=1)，内弧逆时针(sweep=0)
  return `M ${x0o.toFixed(2)} ${y0o.toFixed(2)} A ${rOut} ${rOut} 0 ${large} 1 ${x1o.toFixed(2)} ${y1o.toFixed(2)} L ${x1i.toFixed(2)} ${y1i.toFixed(2)} A ${rIn} ${rIn} 0 ${large} 0 ${x0i.toFixed(2)} ${y0i.toFixed(2)} Z`;
}

export default function NatalChart({ chart }: Props) {
  const asc = chart.ascendant!.longitude;

  const houses = useMemo(() => {
    const arr = chart.houses.map((h, i) => {
      const next = chart.houses[(i + 1) % 12];
      let c0 = h.cusp;
      let c1 = next.cusp;
      if (c1 <= c0) c1 += 360;
      const mid = c0 + (c1 - c0) / 2;
      return { num: h.num, name: h.name, c0, c1, mid, signGlyph: h.signGlyph, sign: h.sign };
    });
    return arr;
  }, [chart]);

  const signs = useMemo(() => {
    return Array.from({ length: 12 }, (_, s) => {
      const L0 = s * 30;
      const L1 = L0 + 30;
      const mid = L0 + 15;
      const glyph = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'][s];
      const [x, y] = pt(mid, (R_SIGN_OUT + R_SIGN_IN) / 2, asc);
      return { s, L0, L1, glyph, x, y };
    });
  }, [asc]);

  const planetEls = chart.planets.map((p, idx) => {
    const [x, y] = pt(p.longitude, R_PLANET, asc);
    // 度数小字放在行星内侧
    const [tx, ty] = pt(p.longitude, R_PLANET - 16, asc);
    return (
      <g key={p.key + idx} className={p.retrograde ? 'nc-planet nc-retro' : 'nc-planet'}>
        <text x={x} y={y + 5} textAnchor="middle" className="nc-planet-glyph">
          {p.glyph}
        </text>
        <text x={tx} y={ty + 3} textAnchor="middle" className="nc-planet-deg">
          {p.degreeInSign.replace(/['′]\s*\d+$/, '′')}
          {p.retrograde ? ' ℞' : ''}
        </text>
      </g>
    );
  });

  // 宫位分界线（从中心到外圈）
  const houseLines = houses.map((h) => {
    const [x, y] = pt(h.c0, R_HOUSE_OUT, asc);
    const [hx, hy] = pt(h.c0, R_HUB, asc);
    return <line key={'hl' + h.num} x1={hx} y1={hy} x2={x} y2={y} className="nc-house-line" />;
  });
  // 宫位编号
  const houseNums = houses.map((h) => {
    const [x, y] = pt(h.mid, (R_HOUSE_IN + R_HOUSE_OUT) / 2, asc);
    return (
      <text key={'hn' + h.num} x={x} y={y + 4} textAnchor="middle" className="nc-house-num">
        {h.num}
      </text>
    );
  });
  // 星座分隔线
  const signLines = signs.map((s) => {
    const [x0, y0] = pt(s.L0, R_SIGN_IN, asc);
    const [x1, y1] = pt(s.L0, R_SIGN_OUT, asc);
    return <line key={'sl' + s.s} x1={x0} y1={y0} x2={x1} y2={y1} className="nc-sign-line" />;
  });
  // 宫位交替底色
  const houseFills = houses.map((h, i) => (
    <path
      key={'hf' + h.num}
      d={annularSector(R_HOUSE_IN, R_HOUSE_OUT, h.c0, h.c1, asc)}
      className={i % 2 === 0 ? 'nc-house-fill nc-even' : 'nc-house-fill nc-odd'}
    />
  ));

  // ASC / MC / IC / DSC 标记
  const [ax, ay] = pt(asc, R_HOUSE_OUT + 6, asc);
  const [mx, my] = pt(chart.midheaven!.longitude, R_HOUSE_OUT + 6, asc);
  const [ix, iy] = chart.immc ? pt(chart.immc.longitude, R_HOUSE_OUT + 6, asc) : [0, 0];
  const [dx, dy] = chart.descendant ? pt(chart.descendant.longitude, R_HOUSE_OUT + 6, asc) : [0, 0];

  return (
    <svg viewBox="0 0 380 380" className="natal-chart-svg" role="img" aria-label="本命星盘">
      {/* 外圈 */}
      <circle cx={CX} cy={CY} r={R_SIGN_OUT} className="nc-ring" />
      <circle cx={CX} cy={CY} r={R_SIGN_IN} className="nc-ring" />
      <circle cx={CX} cy={CY} r={R_HOUSE_OUT} className="nc-ring" />
      <circle cx={CX} cy={CY} r={R_HOUSE_IN} className="nc-ring" />

      {houseFills}
      {signLines}
      {houseLines}

      {/* 星座符号 */}
      {signs.map((s) => (
        <text key={'sg' + s.s} x={s.x} y={s.y + 6} textAnchor="middle" className="nc-sign-glyph">
          {s.glyph}
        </text>
      ))}

      {houseNums}
      {planetEls}

      {/* 中心轮毂 */}
      <circle cx={CX} cy={CY} r={R_HUB} className="nc-hub" />
      <text x={CX} y={CY - 4} textAnchor="middle" className="nc-hub-asc">
        ASC {chart.ascendant!.signGlyph}
      </text>
      <text x={CX} y={CY + 14} textAnchor="middle" className="nc-hub-sub">
        {chart.ascendant!.sign}
      </text>

      {/* ASC / MC / IC / DSC 角标 */}
      <text x={ax} y={ay + 4} textAnchor="middle" className="nc-angle-label nc-asc">
        ASC
      </text>
      <text x={mx} y={my + 4} textAnchor="middle" className="nc-angle-label nc-mc">
        MC
      </text>
      {chart.immc && (
        <text x={ix} y={iy + 4} textAnchor="middle" className="nc-angle-label nc-ic">
          IC
        </text>
      )}
      {chart.descendant && (
        <text x={dx} y={dy + 4} textAnchor="middle" className="nc-angle-label nc-dsc">
          DSC
        </text>
      )}
    </svg>
  );
}
