'use client';

export interface RadarDim {
  label: string;
  score: number;
  reason?: string;
  color?: string;
}

interface ReportRadarProps {
  dims: RadarDim[];
  /** 第二组数据（对比叠加），按 label 与 dims 对齐 */
  compareDims?: RadarDim[];
  /** 第二组数据名称（图例用） */
  compareLabel?: string;
  size?: number;
  max?: number;
}

/**
 * 六维共识雷达图（无依赖纯 SVG）。
 * - 主数据用紫蓝填充；compareDims 叠加用青色描边，用于「历史对比」。
 * - 与 hero 区的紧凑条形概览区分：此处为可视化全貌 + 分维解读，解决六维重复渲染。
 */
export default function ReportRadar({
  dims,
  compareDims,
  compareLabel,
  size = 260,
  max = 100,
}: ReportRadarProps) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 42; // 留出标签空间
  const n = dims.length;
  const levels = [0.25, 0.5, 0.75, 1];

  const angleOf = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pointAt = (i: number, v: number) => {
    const a = angleOf(i);
    const r = (Math.max(0, Math.min(max, v)) / max) * R;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };
  const polygon = (scores: number[]) =>
    scores.map((v, i) => pointAt(i, v).join(',')).join(' ');

  const mainScores = dims.map((d) => Number(d.score) || 0);
  const compareScores = compareDims
    ? dims.map((d) => {
        const hit = compareDims.find((c) => c.label === d.label);
        return hit ? Number(hit.score) || 0 : 0;
      })
    : null;

  if (n === 0) return null;

  return (
    <div className="report-radar">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="六维共识雷达图">
        {/* 网格环 */}
        {levels.map((lv) => (
          <polygon
            key={lv}
            points={dims.map((_, i) => pointAt(i, lv * max).join(',')).join(' ')}
            fill="none"
            stroke="rgba(124,92,255,0.15)"
            strokeWidth={1}
          />
        ))}
        {/* 轴线 + 标签 */}
        {dims.map((d, i) => {
          const [x, y] = pointAt(i, max);
          const [lx, ly] = pointAt(i, max + 14);
          const a = angleOf(i);
          const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
          return (
            <g key={d.label}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(124,92,255,0.18)" strokeWidth={1} />
              <text
                x={lx}
                y={ly}
                fontSize={11}
                fill="#8b8ba7"
                textAnchor={anchor}
                dominantBaseline="middle"
              >
                {d.label}
              </text>
            </g>
          );
        })}
        {/* 对比数据多边形（先画，置于主数据下层） */}
        {compareScores && (
          <polygon
            points={polygon(compareScores)}
            fill="rgba(92,225,230,0.12)"
            stroke="#5ce1e6"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        )}
        {/* 主数据多边形 */}
        <polygon
          points={polygon(mainScores)}
          fill="rgba(124,92,255,0.22)"
          stroke="#7c5cff"
          strokeWidth={2}
        />
        {/* 主数据顶点 */}
        {mainScores.map((v, i) => {
          const [x, y] = pointAt(i, v);
          return <circle key={i} cx={x} cy={y} r={3} fill="#7c5cff" />;
        })}
      </svg>
      {(compareDims || compareLabel) && (
        <div className="report-radar-legend">
          <span className="report-radar-dot main" /> 本次
          {compareLabel && (
            <>
              <span className="report-radar-dot cmp" /> {compareLabel}
            </>
          )}
        </div>
      )}
    </div>
  );
}
