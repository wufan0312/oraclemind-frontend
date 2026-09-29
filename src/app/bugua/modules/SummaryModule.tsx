'use client';

import { useRef, useState } from 'react';
import type { SummaryResponse, InterpretResponse } from '@/lib/api';
import type {
  BaziAPIResult, ZiweiAPIResult, LiuyaoAPIResult, MeihuaAPIResult, QimenAPIResult,
  LiuRenAPIResult, TaiyiAPIResult,
} from '@/lib/api';
import type { ModuleKey } from '@/types';
import SectionIcon from '@/components/ui/SectionIcon';
import {
  type SummaryState, SUMMARY_VERIFY, SUMMARY_CARDS, WUXING_BG_TEXT_COLOR,
} from '../shared';

/* ============================= 常量 ============================= */

/** 共识度条配色：按维度顺序固定 */
const CONSENSUS_GRADIENTS = [
  'linear-gradient(90deg,#4ade80,#5ce1e6)',
  'linear-gradient(90deg,#d4a853,#e8c97e)',
  'linear-gradient(90deg,#ff6b9d,#ff8e53)',
  'linear-gradient(90deg,#4ade80,#a78bfa)',
  'linear-gradient(90deg,#5ce1e6,#5b8def)',
  'linear-gradient(90deg,#a78bfa,#ff6b9d)',
];
const CONSENSUS_TEXT_COLORS = ['#4ade80', '#d4a853', '#ff6b9d', '#4ade80', '#5ce1e6', '#a78bfa'];

/** 卡片分值配色 */
const CARD_SCORE_COLORS = ['var(--accent-gold)', 'var(--primary-light)', '#ff6b6b', 'var(--accent-green)'];

/** 建议卡片图标映射：AI 返回的 emoji → 项目统一紫色线性图标 */
const ADVICE_ICON_MAP: Record<string, string> = {
  '\u26A1': 'zap', '\uD83D\uDCC5': 'calendar', '\uD83D\uDE80': 'trending-up',
  '\uD83D\uDCA1': 'lightbulb', '\uD83C\uDFAF': 'target', '\u2B50': 'star',
};

/** 术数模块中文名（分歧卡片里把 bazi/ziwei 这类原始 key 翻译成人话） */
const MODULE_CN: Record<string, string> = {
  bazi: '八字', wuxing: '五行能量', ziwei: '紫微斗数', liuyao: '六爻', meihua: '梅花易数',
  qimen: '奇门遁甲', liuren: '大六壬', taiyi: '太乙神数', numerology: '数字命理',
  tarot: '塔罗', horoscope: '星座',
};

/** 术数识别关键词（用于从分维依据文本中提取被提及的术数，驱动维度钻取） */
const MODULE_KEYWORDS = ['八字', '紫微', '六爻', '梅花', '奇门', '大六壬', '太乙', '五行', '数字', '塔罗', '星座'];

/** 五行 → 实用属性映射（河洛数理 + 玄学常识，用于「实用宜忌」卡片，纯前端计算） */
const WUXING_ATTRS: Record<string, { dir: string; color: string; nums: string; trade: string }> = {
  木: { dir: '东方', color: '青绿', nums: '3、8', trade: '文教、园艺、创意' },
  火: { dir: '南方', color: '红紫', nums: '2、7', trade: '文化、餐饮、传媒' },
  土: { dir: '中央', color: '黄棕', nums: '5、0', trade: '地产、稳健、服务' },
  金: { dir: '西方', color: '白金', nums: '4、9', trade: '金融、机械、精密' },
  水: { dir: '北方', color: '黑蓝', nums: '1、6', trade: '流通、智慧、咨询' },
};


/* ============================= 各术数核心结论抽取 ============================= */

type CrossRow = { name: string; icon: string; points: string[]; summary?: string };

/** 各术数 AI 解读的本地快照（与 bugua/page.tsx 的 interps state 对齐） */
type InterpMap = Partial<Record<ModuleKey, InterpretResponse | 'loading' | 'error' | null>>;

const CROSS_ORDER: { key: string; chip: string; name: string; icon: string; interpKey: ModuleKey | 'bazi' }[] = [
  { key: 'bazi', chip: '八字', name: '八字命理', icon: 'compass', interpKey: 'bazi' },
  { key: 'wuxing', chip: '五行能量', name: '五行能量', icon: 'pentagon', interpKey: 'bazi' },
  { key: 'ziwei', chip: '紫微斗数', name: '紫微斗数', icon: 'crown', interpKey: 'ziwei' },
  { key: 'liuyao', chip: '六爻', name: '六爻起卦', icon: 'hexagram', interpKey: 'liuyao' },
  { key: 'meihua', chip: '梅花易数', name: '梅花易数', icon: 'flower', interpKey: 'meihua' },
  { key: 'qimen', chip: '奇门遁甲', name: '奇门遁甲', icon: 'orbit', interpKey: 'qimen' },
  // 三式补齐：大六壬 / 太乙神数（与奇门合称三式）
  { key: 'liuren', chip: '大六壬', name: '大六壬', icon: 'navigation', interpKey: 'liuren' },
  { key: 'taiyi', chip: '太乙神数', name: '太乙神数', icon: 'grid', interpKey: 'taiyi' },
];

/** 从 AI 解读 markdown 提取首句并截断为卡片底部的一句话解读（≤26 字） */
function extractShortSummary(text: string, max = 26): string {
  if (!text) return '';
  const clean = text
    .replace(/^#+\s*/gm, '')           // 标题
    .replace(/\*\*([^*]+)\*\*/g, '$1') // 粗体
    .replace(/\*([^*]+)\*/g, '$1')     // 斜体
    .replace(/`([^`]+)`/g, '$1')       // 行内代码
    .replace(/[>_~]+/g, '')            // 引用/下划线/删除线
    .replace(/\s+/g, ' ')
    .trim();
  const first = (clean.split(/[。！？.!?]/)[0] ?? clean).trim();
  if (!first) return '';
  return first.length > max ? first.slice(0, max) + '…' : first;
}

function buildCrossRows(apiResults: Record<string, unknown>, selChips?: Set<string>, interps?: InterpMap): CrossRow[] {
  const rows: CrossRow[] = [];
  const bazi = apiResults.bazi as BaziAPIResult | undefined;
  const ziwei = apiResults.ziwei as ZiweiAPIResult | undefined;
  const liuyao = apiResults.liuyao as LiuyaoAPIResult | undefined;
  const meihua = apiResults.meihua as MeihuaAPIResult | undefined;
  const qimen = apiResults.qimen as QimenAPIResult | undefined;
  const liuren = apiResults.liuren as LiuRenAPIResult | undefined;
  const taiyi = apiResults.taiyi as TaiyiAPIResult | undefined;

  for (const o of CROSS_ORDER) {
    if (selChips && !selChips.has(o.chip)) continue;
    const pts: string[] = [];
    if (o.key === 'bazi' && bazi) {
      pts.push(`日主 ${bazi.dayMaster}（${bazi.dayMasterWuxing}）`);
      if (bazi.yongshen?.xi?.length) pts.push(`喜用：${bazi.yongshen.xi.join('、')}`);
      if (bazi.yongshen?.ji?.length) pts.push(`忌：${bazi.yongshen.ji.join('、')}`);
      if (bazi.lacking?.length) pts.push(`五行缺：${bazi.lacking.join('、')}`);
    } else if (o.key === 'wuxing' && bazi) {
      const wx = (bazi.wuxingCount ?? []).map((c) => `${c.label}${c.count}`).join(' ');
      if (wx) pts.push(`分布：${wx}`);
      if (bazi.yongshen?.xi?.length) pts.push(`喜用：${bazi.yongshen.xi.join('、')}`);
      if (bazi.lacking?.length) pts.push(`所缺：${bazi.lacking.join('、')}`);
    } else if (o.key === 'ziwei' && ziwei) {
      const ming = ziwei.palaces?.find((p) => p.name === '命宫');
      if (ming?.star) pts.push(`命宫主星：${ming.star}`);
      if (ziwei.patterns?.length) pts.push(`格局：${ziwei.patterns.map((p) => p.name).join('、')}`);
      if (ziwei.wuxingJu) pts.push(`五行局：${ziwei.wuxingJu}`);
    } else if (o.key === 'liuyao' && liuyao?.benGua) {
      pts.push(`本卦：${liuyao.benGua.name}`);
      if (liuyao.bianGua) pts.push(`变卦：${liuyao.bianGua.name}`);
      if (liuyao.yongshen?.name) pts.push(`用神：${liuyao.yongshen.name}`);
    } else if (o.key === 'meihua' && meihua?.benGua) {
      pts.push(`本卦：${meihua.benGua.name}`);
      if (meihua.bianGua) pts.push(`变卦：${meihua.bianGua.name}`);
      if (meihua.tiYong?.relation) pts.push(`体用：${meihua.tiYong.relation}`);
    } else if (o.key === 'qimen' && qimen) {
      if (qimen.type) pts.push(`局：${qimen.type}`);
      if (qimen.jieqi) pts.push(`节气：${qimen.jieqi}`);
      const ys = qimen.yongShen as { name?: string; palace?: string } | undefined;
      if (ys?.name) pts.push(`用神：${ys.name}`);
      else if (ys?.palace) pts.push(`用神宫：${ys.palace}`);
    } else if (o.key === 'liuren' && liuren) {
      if (liuren.yueJiang) pts.push(`月将：${liuren.yueJiang}${liuren.yueJiangName ? `（${liuren.yueJiangName}）` : ''}`);
      if (liuren.jieqi) pts.push(`节气：${liuren.jieqi}`);
      if (liuren.sanChuan?.keTi) pts.push(`课体：${liuren.sanChuan.keTi}（${liuren.sanChuan.method}）`);
      const chuan = liuren.sanChuan?.items ?? [];
      if (chuan.length) pts.push(`三传：${chuan.map((c) => `${c.gan}${c.zhi}`).join(' → ')}`);
      if (liuren.sanChuan?.items?.[0]?.jiang) pts.push(`初传天将：${liuren.sanChuan.items[0].jiang}`);
      if (liuren.kongWang?.length) pts.push(`空亡：${liuren.kongWang.join('、')}`);
      if (liuren.fuYin) pts.push('伏吟课');
      if (liuren.fanYin) pts.push('反吟课');
    } else if (o.key === 'taiyi' && taiyi) {
      pts.push(`${taiyi.ganZhi}年 · 第${taiyi.ju}局(${taiyi.dun})`);
      if (taiyi.taiYiGong) pts.push(`太乙居：${taiyi.taiYiGong.gong}宫（${taiyi.taiYiGong.pos}）`);
      pts.push(`主算/客算：${taiyi.zhuSuan} / ${taiyi.keSuan}`);
      if (taiyi.wenChang?.shen) pts.push(`文昌：${taiyi.wenChang.shen}`);
      if (taiyi.shiJi?.shen) pts.push(`始击：${taiyi.shiJi.shen}`);
      if (taiyi.verdict) pts.push(taiyi.verdict);
    } else {
      continue;
    }
    if (pts.length) {
      const interp = interps?.[o.interpKey];
      const summary =
        interp && typeof interp === 'object' && 'text' in interp ? extractShortSummary(interp.text) : undefined;
      rows.push({ name: o.name, icon: o.icon, points: pts, summary });
    }
  }
  return rows;
}

/** 从单个维度的综合运势结果中抽取展示数据：概述 + 行动要点（按栏合并 items 并去重相邻） */
function extractDim(state: SummaryState | null): {
  loading: boolean; error: boolean; summaryText: string; points: string[];
} {
  if (state === 'loading') return { loading: true, error: false, summaryText: '', points: [] };
  if (!state || state === 'error') return { loading: false, error: true, summaryText: '', points: [] };
  const d = state.data;
  const summaryText = [d.summary, d.outlook].filter(Boolean).join(' ').trim();
  const points: string[] = [];
  for (const a of (d.advice ?? [])) {
    for (const it of (a.items ?? [])) {
      if (it && !points.includes(it)) points.push(it);
    }
  }
  return { loading: false, error: false, summaryText, points };
}

/* ============================= 六维共识雷达图（手写 SVG，零依赖） ============================= */

type RadarDatum = { label: string; pct: number; agreement: number; color: string };

function ConsensusRadar({ data }: { data: RadarDatum[] }) {
  if (!data.length) return null;
  const N = data.length;
  const cx = 160, cy = 170, R = 116;
  const angleOf = (i: number) => ((-90 + i * (360 / N)) * Math.PI) / 180;
  const pointAt = (i: number, ratio: number): [number, number] => [
    cx + R * ratio * Math.cos(angleOf(i)),
    cy + R * ratio * Math.sin(angleOf(i)),
  ];
  const scoreRatio = (s: number) => Math.max(0.06, Math.min(1, (s - 50) / 50));
  const agreeRatio = (a: number) => Math.max(0, Math.min(1, a / 100));

  const rings = [0.25, 0.5, 0.75, 1];
  const ringPolys = rings.map((r) => data.map((_, i) => pointAt(i, r).join(',')).join(' '));
  const axisLines = data.map((_, i) => {
    const [x, y] = pointAt(i, 1);
    return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="radar-axis" />;
  });
  const scorePts = data.map((d, i) => pointAt(i, scoreRatio(d.pct)).join(',')).join(' ');
  const agreePts = data.map((d, i) => pointAt(i, agreeRatio(d.agreement)).join(',')).join(' ');
  const labels = data.map((d, i) => {
    const [x, y] = pointAt(i, 1.17);
    const anchor = Math.abs(x - cx) < 6 ? 'middle' : x > cx ? 'start' : 'end';
    return (
      <text key={i} x={x} y={y} className="radar-label" textAnchor={anchor} dominantBaseline="middle">
        {d.label}
      </text>
    );
  });

  return (
    <div className="consensus-radar">
      <svg viewBox="0 0 320 340" className="radar-svg" role="img" aria-label="六维运势共识雷达图">
        {ringPolys.map((p, i) => (
          <polygon key={i} points={p} className="radar-ring" />
        ))}
        {axisLines}
        <polygon points={agreePts} className="radar-area radar-area-agree" />
        <polygon points={scorePts} className="radar-area radar-area-score" />
        {data.map((d, i) => {
          const [x, y] = pointAt(i, scoreRatio(d.pct));
          return <circle key={i} cx={x} cy={y} r={3.2} className="radar-dot" style={{ fill: d.color }} />;
        })}
        {labels}
      </svg>
      <div className="radar-legend">
        <span><i className="radar-swatch radar-swatch-score" /> 强度</span>
        <span><i className="radar-swatch radar-swatch-agree" /> 共识</span>
      </div>
    </div>
  );
}

/* ============================= 实用宜忌卡（喜用神指引） ============================= */

function FavorableCard({ apiResults }: { apiResults?: Record<string, unknown> }) {
  const bz = apiResults?.bazi as BaziAPIResult | undefined;
  const wx = bz?.yongshen;
  const xi = (wx?.xi || []).filter((w) => WUXING_ATTRS[w]);
  const ji = wx?.ji || [];
  if (!xi.length && !ji.length) return null;

  const xiItems = xi.map((w) => ({ w, ...WUXING_ATTRS[w] }));

  return (
    <div className="result-card summary-favorable-card">
      <div className="result-card-title">
        <SectionIcon name="compass" /> 实用宜忌 · 喜用神指引
      </div>
      <div className="summary-intro">
        基于八字喜用神，给出可落地的方位、颜色、数字与本月宜忌
      </div>
      {xiItems.length > 0 && (
        <div className="favorable-grid">
          {xiItems.map(({ w, dir, color, nums, trade }) => (
            <div className="favorable-cell" key={w}>
              <span className="favorable-wx" style={{ color: WUXING_BG_TEXT_COLOR[w] || 'var(--text-primary)' }}>{w}</span>
              <div className="favorable-detail">
                <span>方位 <b>{dir}</b></span>
                <span>颜色 <b>{color}</b></span>
                <span>数字 <b>{nums}</b></span>
                <span>行业 <b>{trade}</b></span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="favorable-tips">
        {xiItems.length > 0 && (
          <p className="favorable-tip favorable-xi">
            <b>本月宜</b>：多亲近「{xiItems.map((x) => x.w).join('、')}」属性事物，如着 {xiItems.map((x) => x.color).join('、')}色、面向{xiItems.map((x) => x.dir).join('、')}方、接触{xiItems.map((x) => x.trade).join('、')}类事务。
          </p>
        )}
        {ji.length > 0 && (
          <p className="favorable-tip favorable-ji">
            <b>本月忌</b>：规避「{ji.join('、')}」属性过旺之事，减少相关损耗与冲动决策。
          </p>
        )}
      </div>
    </div>
  );
}

/* ============================= 骨架屏 ============================= */

function StagedSkeleton() {
  const blocks = ['正在交叉验证各术数共识度', '正在提炼四张综合卡片', '正在生成分阶段行动建议', '正在撰写白话总结'];
  return (
    <div className="summary-staged" aria-busy="true" aria-label="AI 正在生成综合解读">
      {blocks.map((t, i) => (
        <div className="staged-block" key={t} style={{ animationDelay: `${i * 180}ms` }}>
          <span className="staged-dot" />
          <span className="staged-text">{t}</span>
          <span className="staged-bar" />
        </div>
      ))}
    </div>
  );
}

/* ============================= 主组件 ============================= */

export function SummaryModule({
  summary, loveSummary, careerSummary, onlineCount, moduleNames, apiResults, selChips, interps,
}: {
  summary: SummaryState;
  /** 感情维度聚焦解读（focus=love），与综合并行预取，平铺展示 */
  loveSummary?: SummaryState | null;
  /** 事业维度聚焦解读（focus=career），与综合并行预取，平铺展示 */
  careerSummary?: SummaryState | null;
  onlineCount: number;
  moduleNames?: string[];
  apiResults?: Record<string, unknown>;
  selChips?: Set<string>;
  /** 各术数 AI 解读快照，用于「各术数核心结论对照」卡片底部的一句话截短解读 */
  interps?: InterpMap;
}) {
  const crossRows = buildCrossRows(apiResults ?? {}, selChips, interps);
  const [openDim, setOpenDim] = useState<string | null>(null);
  // 维度钻取：根据分维依据文本里提及的术数，筛出相关术数的核心结论
  const drillRows = (reason: string): CrossRow[] => {
    if (!reason) return crossRows;
    const hit = crossRows.filter((r) =>
      MODULE_KEYWORDS.some((k) => r.name.includes(k) && reason.includes(k)),
    );
    return hit.length ? hit : crossRows;
  };
  const resp: SummaryResponse | null =
    summary && summary !== 'loading' && summary !== 'error' ? summary : null;

  const lastGoodRef = useRef<SummaryResponse | null>(null);
  if (resp && resp.data && resp.data.ok !== false) lastGoodRef.current = resp;

  const loading = summary === 'loading';
  const hasStale = loading && !!lastGoodRef.current;
  const shown = resp ?? (hasStale ? lastGoodRef.current : null);
  const dyn = shown ? shown.data : null;

  const dynFailed = !!dyn && dyn.ok === false;
  const isDyn = !!dyn && !dynFailed;

  const consensusData = isDyn && dyn?.consensus?.length
    ? dyn.consensus.map((c, i) => ({
        label: c.label,
        pct: Number.isFinite(c.score) ? c.score : 0,
        agreement: Number.isFinite(c.agreement) ? (c.agreement as number) : 0,
        reason: (c.reason as string) || '',
        color: CONSENSUS_TEXT_COLORS[i % CONSENSUS_TEXT_COLORS.length],
        bg: CONSENSUS_GRADIENTS[i % CONSENSUS_GRADIENTS.length],
      }))
    : SUMMARY_VERIFY.map((v, i) => ({
        label: v.label, pct: v.pct, agreement: 0, reason: '',
        color: CONSENSUS_TEXT_COLORS[i % CONSENSUS_TEXT_COLORS.length],
        bg: CONSENSUS_GRADIENTS[i % CONSENSUS_GRADIENTS.length],
      }));

  const degraded = !!shown?.meta.degraded;
  const DEGRADED_BADGE = '本地规则兜底（未真正交叉验证）';
  const badgeText = degraded ? DEGRADED_BADGE : '';
  const showBadge = !!badgeText;

  // 三维度平铺数据源：综合用主结果，感情/事业用并行预取的聚焦结果（不再切换，即时展示）
  const dimSources = [
    { key: 'general', label: '综合', icon: 'layers', state: summary },
    { key: 'love', label: '感情', icon: 'heart', state: loveSummary ?? null },
    { key: 'career', label: '事业', icon: 'target', state: careerSummary ?? null },
  ];

  /* ---------- 骨架屏 ---------- */
  if (loading && !hasStale) {
    return (
      <>
        <div className="result-card">
          <div className="result-card-title">
            <SectionIcon name="check-double" /> 多术数综合评分
          </div>
          <div className="summary-intro">
            以下结论由 {moduleNames && moduleNames.length ? moduleNames.join('、') : '多种术数'} 共同推演{fusedHint(onlineCount)}
          </div>
          <StagedSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      {/* 共识评分 */}
      <div className={'result-card' + (hasStale ? ' is-refreshing' : '')}>
        <div className="result-card-title">
          <SectionIcon name="check-double" /> 多术数综合评分 · 强度与共识
          {showBadge && <span className="summary-src-badge">{badgeText}</span>}
        </div>
        <div className="summary-intro">
          以下结论由 {moduleNames && moduleNames.length ? moduleNames.join('、') : '多种术数'} 共同推演{fusedHint(onlineCount)}
        </div>
        <div className="summary-legend">
          <b>强度</b>＝该维度运势有多好（60-95，越高越好）　<b>共识</b>＝各术数结论一致程度（0-100，越高越可信）
        </div>
        <ConsensusRadar data={consensusData} />
        {hasStale && <div className="report-loading" style={{ marginBottom: 12 }}>⏳ 正在重新推演，以下为上一次结果…</div>}
        <div className="summary-verify-enhanced">
        {consensusData.map((v) => (
          <div
            className={'verify-row' + (openDim === v.label ? ' is-open' : '')}
            key={v.label}
            onClick={() => setOpenDim(openDim === v.label ? null : v.label)}
            role="button"
            tabIndex={0}
            aria-expanded={openDim === v.label}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpenDim(openDim === v.label ? null : v.label); }}
          >
            <div className="verify-label">{v.label}<span className="verify-drill-cue">{openDim === v.label ? '收起 ▲' : '各术数怎么说 ▾'}</span></div>
            <div className="verify-bar-bg">
              <div className="verify-bar-fill" style={{ width: v.pct + '%', background: v.bg }} />
            </div>
            <div className="verify-consensus" style={{ color: v.color }}>
              <span className="verify-score">{v.pct}</span>
              <span className="verify-unit">强度</span>
              {v.agreement > 0 && <span className="verify-agree">共识 {v.agreement}%</span>}
            </div>
            {v.reason && <div className="verify-reason">{v.reason}</div>}
            {openDim === v.label && (
              <div className="verify-drill">
                <div className="drill-title">各术数怎么说</div>
                {drillRows(v.reason).map((r) => (
                  <div className="drill-row" key={r.name}>
                    <span className="drill-row-name"><SectionIcon name={r.icon} size={13} /> {r.name}</span>
                    <ul className="drill-points">
                      {r.points.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        </div>
        {degraded && (
          <div className="summary-degraded-note">
            ⚠️ AI 综合解读不可用，当前展示本地通用规则，<b>共识度未计算</b>（本地规则无法判断各术数是否一致）。
          </div>
        )}
      </div>

      {/* 各术数核心结论对照 */}
      {crossRows.length > 0 && (
        <div className="result-card summary-cross">
          <div className="result-card-title">
            <SectionIcon name="layers" /> 各术数核心结论对照
          </div>
          <div className="summary-intro">
            以下为各术数排盘提取的关键结论，横向对照可快速把握命局主线
          </div>
          <div className="summary-cross-grid">
            {crossRows.map((r) => (
              <div className="cross-card" key={r.name}>
                <div className="cross-card-head">
                  <SectionIcon name={r.icon} />
                  <span className="cross-card-name">{r.name}</span>
                </div>
                {r.summary && <div className="cross-summary">{r.summary}</div>}
                <ul className="cross-points">
                  {r.points.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 实用宜忌 · 喜用神指引 */}
      <FavorableCard apiResults={apiResults} />

      {/* 关键阶段运势时间轴（与行动建议三阶段联动） */}
      {(() => {
        const tl = isDyn && dyn?.timeline?.length ? dyn.timeline : null;
        if (!tl) return null;
        const adv = (isDyn && dyn?.advice) || [];
        const stageItems: Record<string, string[]> = { now: [], short: [], long: [] };
        for (const a of adv) {
          const title = a.title || '';
          const k = title.includes('立即') ? 'now' : title.includes('短期') ? 'short' : 'long';
          for (const it of (a.items || [])) if (it && !stageItems[k].includes(it)) stageItems[k].push(it);
        }
        const stageForNode = (i: number): 'now' | 'short' | 'long' =>
          i === 0 ? 'now' : i === tl.length - 1 ? 'long' : 'short';
        const STAGE_LABEL: Record<string, string> = {
          now: '立即行动', short: '短期（1-3月）', long: '中长期（2027+）',
        };
        return (
          <div className="result-card summary-timeline-card">
            <div className="result-card-title">
              <SectionIcon name="calendar" /> 关键阶段运势时间轴
            </div>
            <div className="summary-intro">
              按时间节点对照执行，下方锚定对应阶段的行动建议
            </div>
            <div className="summary-timeline">
              {tl.map((t, i) => {
                const stage = stageForNode(i);
                const items = stageItems[stage];
                return (
                  <div className="timeline-item" key={i}>
                    <span className="timeline-period">{t.period}</span>
                    <span className="timeline-overview">{t.overview}</span>
                    {items.length > 0 && (
                      <div className="timeline-actions">
                        <span className="timeline-actions-stage">{STAGE_LABEL[stage]}</span>
                        <ul className="timeline-actions-list">
                          {items.map((it, k) => <li key={k}>{it}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* 术数分歧与调和 */}
      {(() => {
        const dv = isDyn && dyn?.divergences?.length ? dyn.divergences : null;
        if (!dv) return null;
        return (
          <div className="result-card summary-divergence-card">
            <div className="result-card-title">
              <span className="resonance-emoji">⚖️</span> 术数分歧与调和
            </div>
            <div className="summary-intro">
              各术数偶有分歧，已据理调和，供你全面判断
            </div>
            <div className="summary-divergence-list">
              {dv.map((d, i) => (
                <div className="summary-divergence-item" key={i}>
                  <div className="summary-divergence-desc">{d.desc}</div>
                  {d.modules?.length > 0 && (
                    <div className="summary-divergence-modules">
                      {d.modules.map((m, j) => (
                        <span className="summary-divergence-chip" key={j}>{MODULE_CN[m] || m}</span>
                      ))}
                    </div>
                  )}
                  {d.resolution && (
                    <div className="summary-divergence-resolution"><strong>调和：</strong>{d.resolution}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 综合行动建议：按 综合 / 感情 / 事业 三维度平铺（去掉切换按钮，并行预取即时展示） */}
      <div className={'summary-advice' + (hasStale ? ' is-refreshing' : '')}>
        <div className="summary-advice-title">
          <SectionIcon name="list-checks" /> 综合行动建议
          {showBadge && (
            <span style={{ fontSize: '12px', marginLeft: '8px', opacity: 0.7, fontWeight: 400 }}>
              {badgeText}
            </span>
          )}
        </div>
        <div className="summary-dim-grid">
          {dimSources.map((ds) => {
            const dim = extractDim(ds.state);
            return (
              <div key={ds.key} className={`dim-card dim-${ds.key}`}>
                <div className="dim-card-head">
                  <SectionIcon name={ds.icon as never} size={15} /> {ds.label}
                </div>
                {dim.loading ? (
                  <div className="dim-loading">解读生成中…</div>
                ) : dim.error ? (
                  <div className="dim-fallback">该维度解读暂不可用，可参考综合建议</div>
                ) : (
                  <>
                    {dim.summaryText && <p className="dim-summary">{dim.summaryText}</p>}
                    <ul className="dim-points">
                      {dim.points.length
                        ? dim.points.map((p, i) => <li key={i}>{p}</li>)
                        : <li className="dim-empty">—</li>}
                    </ul>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function fusedHint(onlineCount: number): string {
  return onlineCount > 0 ? `（已融合 ${onlineCount} 种）` : '';
}

/* ============================= 侧栏专用导出组件 ============================= */

/** 跨术数共振发现（侧栏紧凑版） */
export function SummaryResonanceCard({ data, compact = false }: { data: SummaryResponse | null | undefined; compact?: boolean }) {
  const dyn = data && data.data && data.data.ok !== false ? data.data : null;
  const kf = dyn?.keyFindings?.length ? dyn.keyFindings : null;
  if (!kf) return null;
  return (
    <div className={`result-card summary-resonance-card${compact ? ' side-compact' : ''}`}>
      <div className="result-card-title">
        <SectionIcon name="star" /> 跨术数共振
      </div>
      <ul className="summary-resonance-list">
        {kf.map((f, i) => (
          <li key={i}><SectionIcon name="zap" size={14} /> <span>{f}</span></li>
        ))}
      </ul>
    </div>
  );
}

/** 综合洞察卡片（侧栏紧凑版） */
export function SummaryInsightCards({ data, compact = false }: { data: SummaryResponse | null | undefined; compact?: boolean }) {
  const dyn = data && data.data && data.data.ok !== false ? data.data : null;
  const cardData = dyn?.cards?.length
    ? dyn.cards.map((c, i) => ({
        icon: c.icon,
        name: c.name,
        score: c.score,
        scoreColor: CARD_SCORE_COLORS[i % CARD_SCORE_COLORS.length],
        desc: c.desc,
      }))
    : SUMMARY_CARDS.map((c, i) => ({
        ...c,
        scoreColor: CARD_SCORE_COLORS[i % CARD_SCORE_COLORS.length],
      }));
  return (
    <div className={`summary-grid side-insight-grid${compact ? ' side-compact' : ''}`}>
      {cardData.map((c) => (
        <div className="summary-card" key={c.name}>
          <div className="summary-card-header">
            <div><SectionIcon name={(ADVICE_ICON_MAP[c.icon ?? ''] || 'zap') as never} size={16} /> <span className="summary-card-name">{c.name}</span></div>
            <span className="summary-card-score" style={{ color: c.scoreColor }}>{c.score}</span>
          </div>
          <div className="summary-card-desc">{c.desc}</div>
        </div>
      ))}
    </div>
  );
}
