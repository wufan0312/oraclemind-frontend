'use client';

// 报告盘式可视化（P2-5）：把排盘结果 JSON 渲染为可读的「盘式」图表。
// 与 bugua 模块不同，本报告组件为自包含、内联样式，不依赖 bugua.scss，
// 可在 report 路由下独立渲染（避免跨路由 CSS 裸奔的已知陷阱）。
// 字段缺失时静默降级，绝不抛错。

import type {
  QimenAPIResult,
  ZiweiAPIResult,
  LiuRenAPIResult,
  TaiyiAPIResult,
} from '@/lib/api';

const ACCENT = '#7C5CFF';
const MUTED = '#8c8aa0';
const BORDER = '#ece8f7';
const PANEL_BG = '#faf9fe';

const cardStyle: React.CSSProperties = {
  background: PANEL_BG,
  border: `1px solid ${BORDER}`,
  borderRadius: 14,
  padding: 14,
  marginBottom: 12,
};
const titleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: '#2b2740',
  margin: '0 0 10px',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};
const subStyle: React.CSSProperties = { color: MUTED, fontSize: 12, margin: 0 };
const chipWrap: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
};

function Chip({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: '3px 9px',
        borderRadius: 999,
        background: '#fff',
        border: `1px solid ${BORDER}`,
        color: color || '#4b4663',
      }}
    >
      {children}
    </span>
  );
}

/* ========================= 奇门九宫 ========================= */
const LUO: Record<number, [number, number]> = {
  4: [0, 0], 9: [0, 1], 2: [0, 2],
  3: [1, 0], 5: [1, 1], 7: [1, 2],
  8: [2, 0], 1: [2, 1], 6: [2, 2],
};

export function QimenChart({ data }: { data: QimenAPIResult }) {
  const grid: (QimenAPIResult['palaces'][number] | null)[][] = [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];
  for (const p of data.palaces || []) {
    const g = p.gong ?? 0;
    const pos = LUO[g];
    if (pos) grid[pos[0]][pos[1]] = p;
  }
  return (
    <div style={cardStyle}>
      <div style={titleStyle}>🔯 奇门遁甲 · 九宫盘</div>
      <div style={{ ...subStyle, marginBottom: 10 }}>
        {data.jieqi || ''} · {data.riGanZhi || ''} · 时干 {data.shiGanZhi || ''}
        {data.valueFu ? ` · ${data.valueFu}` : ''}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          maxWidth: 420,
        }}
      >
        {grid.map((row, r) =>
          row.map((p, c) => (
            <div
              key={`${r}-${c}`}
              style={{
                border: `1px solid ${p?.border || BORDER}`,
                borderRadius: 10,
                padding: 8,
                minHeight: 86,
                background: p?.bg || '#fff',
                position: 'relative',
              }}
            >
              {p ? (
                <>
                  <div style={{ fontSize: 11, color: MUTED }}>{p.dir}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{p.tianpan}</span>
                    <span style={{ fontSize: 13, color: '#6b6585' }}>{p.dipan}</span>
                  </div>
                  <div style={{ fontSize: 11, marginTop: 4, color: p.starColor || '#4b4663' }}>
                    星 {p.star}
                  </div>
                  <div style={{ fontSize: 11, color: p.doorColor || '#4b4663' }}>门 {p.door}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>
                    神 {p.god} · {p.jixiong}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 11, color: MUTED }}>中宫</div>
              )}
            </div>
          )),
        )}
      </div>
    </div>
  );
}

/* ========================= 紫微十二宫 ========================= */
export function ZiweiChart({ data }: { data: ZiweiAPIResult }) {
  return (
    <div style={cardStyle}>
      <div style={titleStyle}>🌟 紫微斗数 · 十二宫</div>
      <div style={{ ...subStyle, marginBottom: 10 }}>
        命宫 {data.mingGong || '—'} · 身宫 {data.shenGong || '—'} · {data.wuxingJu || ''}局
        {data.ziwei ? ` · 紫微落${data.ziwei}` : ''}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
        }}
      >
        {(data.palaces || []).map((p, i) => (
          <div
            key={i}
            style={{
              border: `1px solid ${p.highlight ? ACCENT : BORDER}`,
              borderRadius: 10,
              padding: '8px 10px',
              background: p.highlight ? 'rgba(124,92,255,0.07)' : '#fff',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: p.color || '#2b2740' }}>
              {p.icon} {p.name}
            </div>
            <div style={{ fontSize: 13, color: '#4b4663', marginTop: 2 }}>
              {p.star || '—'}
            </div>
            <div style={{ fontSize: 11, color: MUTED }}>{p.sub || ''}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========================= 大六壬课式 ========================= */
export function LiuRenChart({ data }: { data: LiuRenAPIResult }) {
  const { siKe = [], sanChuan, tianPan = [], kongWang = [] } = data;
  return (
    <div style={cardStyle}>
      <div style={titleStyle}>☯ 大六壬 · 课式</div>
      <div style={{ ...subStyle, marginBottom: 10 }}>
        {data.jieqi} · 月将 {data.yueJiang}（{data.yueJiangName}）· 占时 {data.zhanShi}时 · 日 {data.riGanZhi}
        {data.fuYin ? ' · 伏吟' : ''}
        {data.fanYin ? ' · 反吟' : ''}
        {kongWang.length ? ` · 空亡 ${kongWang.join('')}` : ''}
      </div>

      {/* 课体 + 三传 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>三传 · {sanChuan.method}</div>
        <div style={chipWrap}>
          <Chip color={ACCENT}>初 {sanChuan.chu}</Chip>
          <Chip>中 {sanChuan.zhong}</Chip>
          <Chip>末 {sanChuan.mo}</Chip>
          <Chip>{sanChuan.keTi}</Chip>
        </div>
      </div>

      {/* 四课 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>四课</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {siKe.map((k, i) => (
            <div
              key={i}
              style={{
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                padding: '6px 10px',
                textAlign: 'center',
                minWidth: 64,
                background: '#fff',
              }}
            >
              <div style={{ fontSize: 11, color: MUTED }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#2b2740' }}>{k.upper}</div>
              <div style={{ fontSize: 14, color: '#6b6585' }}>{k.lower}</div>
              <div style={{ fontSize: 11, color: k.relation ? '#d9534f' : MUTED }}>
                {k.relationText || '比和'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 天地盘 */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>天地盘（地支 → 天将 · 六亲）</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
          {tianPan.map((c, i) => (
            <div
              key={i}
              style={{
                border: `1px solid ${c.kongWang ? '#ffcfcf' : BORDER}`,
                borderRadius: 8,
                padding: '5px 6px',
                background: c.kongWang ? '#fff6f6' : '#fff',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: '#2b2740' }}>{c.zhi}</div>
              <div style={{ fontSize: 14, color: ACCENT }}>{c.shen}</div>
              <div style={{ fontSize: 10, color: MUTED }}>
                {c.jiang}·{c.liuqin}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ========================= 太乙神数 ========================= */
export function TaiyiChart({ data }: { data: TaiyiAPIResult }) {
  const grid: (TaiyiAPIResult['shiLiuGong'][number] | null)[][] = [
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ];
  // 十六神按传统 tertra arrangement：以 pos 顺序排 4x4（落宫位标注）
  (data.shiLiuGong || []).forEach((cell, i) => {
    const r = Math.floor(i / 4);
    const c = i % 4;
    if (grid[r]) grid[r][c] = cell;
  });
  return (
    <div style={cardStyle}>
      <div style={titleStyle}>⚛ 太乙神数 · {data.ju} 局</div>
      <div style={{ ...subStyle, marginBottom: 10 }}>
        积年 {data.jiNian} · {data.ganZhi} · {data.dun} · {data.provenance || '通用年计模型'}
      </div>
      <div style={{ ...chipWrap, marginBottom: 10 }}>
        <Chip color={ACCENT}>太乙落 {data.taiYiGong?.pos || '—'}</Chip>
        <Chip>文昌 {data.wenChang?.pos || '—'}</Chip>
        <Chip>始击 {data.shiJi?.pos || '—'}</Chip>
        <Chip>主算 {data.zhuSuan}</Chip>
        <Chip>客算 {data.keSuan}</Chip>
        <Chip>主大将 {data.zhuDaJiang?.pos || '—'}</Chip>
        <Chip>客大将 {data.keDaJiang?.pos || '—'}</Chip>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, maxWidth: 420 }}>
        {grid.flat().map((cell, i) => (
          <div
            key={i}
            style={{
              border: `1px solid ${cell?.isTaiYi ? ACCENT : BORDER}`,
              borderRadius: 8,
              padding: '6px 4px',
              textAlign: 'center',
              background: cell?.isTaiYi ? 'rgba(124,92,255,0.08)' : '#fff',
              minHeight: 44,
            }}
          >
            <div style={{ fontSize: 11, color: MUTED }}>{cell?.pos || ''}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2b2740' }}>{cell?.shen || ''}</div>
            {(cell?.stars || []).length > 0 && (
              <div style={{ fontSize: 10, color: ACCENT }}>{(cell?.stars || []).join('·')}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========================= 分发器 ========================= */
export function ReportPanChart({ kind, data }: { kind: string; data: unknown }) {
  switch (kind) {
    case 'qimen':
      return <QimenChart data={data as QimenAPIResult} />;
    case 'ziwei':
      return <ZiweiChart data={data as ZiweiAPIResult} />;
    case 'liuren':
      return <LiuRenChart data={data as LiuRenAPIResult} />;
    case 'taiyi':
      return <TaiyiChart data={data as TaiyiAPIResult} />;
    default:
      return null;
  }
}
