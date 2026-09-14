'use client';

// 八字命盘 SVG（P2-3）：四柱 + 十神 + 大运，对标 horoscope 星盘的可视化缺失补齐。
// 数据来源：后端 /api/v1/paipan/bazi（BaziAPIResult），字段缺失时静默降级不报错。

export interface BaziChartPillar {
  label?: string;
  gan?: string;
  zhi?: string;
  el?: string;
  note?: string;
}
export interface BaziChartDayun {
  age?: string;
  gan?: string;
  note?: string;
}
export interface BaziChartData {
  dayMaster?: string;
  dayMasterWuxing?: string;
  shengxiao?: string;
  solar?: string;
  lunar?: string;
  qiyun?: { age?: number | string; date?: string; after?: string };
  pillars?: BaziChartPillar[];
  dayun?: BaziChartDayun[];
  yongshen?: { xi?: string[]; ji?: string[] };
  analysis?: string;
  shensha?: { name?: string; zhi?: string; pillar?: string; desc?: string }[];
}

const WX_COLOR: Record<string, string> = {
  金: '#8C7853',
  木: '#3E9B57',
  水: '#2E7BC4',
  火: '#D9534F',
  土: '#C98A2E',
};

/** 取天干/地支对应五行色（el 形如「金火」：首位为天干，次位为地支） */
function wxColor(ch: string | undefined, fallback = '#5B5570'): string {
  return ch ? WX_COLOR[ch] || fallback : fallback;
}

export default function BaziChart({ data }: { data: BaziChartData }) {
  const pillars = (data.pillars || []).slice(0, 4);
  const dayun = (data.dayun || []).slice(0, 8);
  if (pillars.length === 0) return null;

  const colW = 130;
  const gap = 16;
  const left = 60;
  const top = 92;
  const boxH = 96;

  const cols = pillars.map((p, i) => {
    const el = p.el || '';
    const ganWx = el[0];
    const zhiWx = el[1];
    const x = left + i * (colW + gap);
    return { p, x, ganWx, zhiWx };
  });

  const width = left * 2 + cols.length * colW + (cols.length - 1) * gap;
  const dayunY = top + boxH + 96;
  const height = dayun.length ? dayunY + 74 : top + boxH + 40;

  return (
    <div className="bazi-chart-wrap">
      <svg
        className="bazi-chart"
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label="八字命盘"
      >
        {/* 标题区 */}
        <text x={width / 2} y={28} textAnchor="middle" className="bc-title">
          八字命盘
        </text>
        <text x={width / 2} y={50} textAnchor="middle" className="bc-sub">
          {data.solar || ''}
          {data.lunar ? ` · ${data.lunar}` : ''}
          {data.shengxiao ? ` · 属${data.shengxiao}` : ''}
        </text>
        <text x={width / 2} y={70} textAnchor="middle" className="bc-sub">
          日主 {data.dayMaster || '—'}
          {data.dayMasterWuxing ? `（${data.dayMasterWuxing}）` : ''}
          {data.qiyun?.age !== undefined ? ` · 起运 ${data.qiyun.age} 岁` : ''}
        </text>

        {cols.map(({ p, x, ganWx, zhiWx }, i) => (
          <g key={i}>
            {/* 柱名 */}
            <text x={x + colW / 2} y={top - 10} textAnchor="middle" className="bc-label">
              {(p.label || '').split(' · ')[0]}
            </text>
            {/* 柱外框 */}
            <rect
              x={x}
              y={top}
              width={colW}
              height={boxH}
              rx={10}
              fill="#FFFFFF"
              stroke="#E3DFF2"
              strokeWidth={1}
            />
            {/* 十神（天干上方） */}
            <text x={x + colW / 2} y={top + 20} textAnchor="middle" className="bc-shishen">
              {(p.note || '').split(/[，,]/)[0]}
            </text>
            {/* 天干 */}
            <text
              x={x + colW / 2}
              y={top + 50}
              textAnchor="middle"
              className="bc-gan"
              fill={wxColor(ganWx)}
            >
              {p.gan || '—'}
            </text>
            {/* 分隔线 */}
            <line
              x1={x + 12}
              y1={top + 60}
              x2={x + colW - 12}
              y2={top + 60}
              stroke="#EFECF9"
              strokeWidth={1}
            />
            {/* 地支 */}
            <text
              x={x + colW / 2}
              y={top + 84}
              textAnchor="middle"
              className="bc-zhi"
              fill={wxColor(zhiWx)}
            >
              {p.zhi || '—'}
            </text>
          </g>
        ))}

        {/* 日主高亮：第 3 柱（日柱）加底色 */}
        {cols[2] && (
          <rect
            x={cols[2].x}
            y={top}
            width={colW}
            height={boxH}
            rx={10}
            fill="rgba(124, 92, 255, 0.07)"
            stroke="#7C5CFF"
            strokeWidth={1.5}
            pointerEvents="none"
          />
        )}

        {/* 喜用神 */}
        {data.yongshen && (
          <text x={width / 2} y={top + boxH + 30} textAnchor="middle" className="bc-sub">
            喜用：{(data.yongshen.xi || []).join('、') || '—'}
            {'    '}
            忌：{(data.yongshen.ji || []).join('、') || '—'}
          </text>
        )}

        {/* 大运 */}
        {dayun.length > 0 && (
          <>
            <text x={width / 2} y={dayunY - 16} textAnchor="middle" className="bc-label">
              大运
            </text>
            {dayun.map((d, i) => {
              const w = (width - left * 2) / dayun.length;
              const x = left + i * w;
              return (
                <g key={i}>
                  <text x={x + w / 2} y={dayunY + 16} textAnchor="middle" className="bc-dayun-gan">
                    {d.gan || '—'}
                  </text>
                  <text x={x + w / 2} y={dayunY + 34} textAnchor="middle" className="bc-dayun-age">
                    {d.age || ''}
                  </text>
                  <text x={x + w / 2} y={dayunY + 50} textAnchor="middle" className="bc-dayun-note">
                    {(d.note || '').slice(0, 6)}
                  </text>
                </g>
              );
            })}
          </>
        )}
      </svg>
    </div>
  );
}
