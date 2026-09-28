'use client';

import '@/styles/report.scss';
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
// 逐文件导入，不走 components/ui/index.ts 这个 barrel：
// 否则会把 RegionPicker / Cascader 及其 53KB 的 chinaRegions 数据拖进本路由
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import CrossPageLink from '@/components/ui/CrossPageLink';
import Progress from '@/components/ui/Progress';
import Tag from '@/components/ui/Tag';
import SectionTitle from '@/components/ui/SectionTitle';
import Modal from '@/components/ui/Modal';
import ReportRadar from '@/components/ui/ReportRadar';
import { DatePicker } from '@/components/ui/DateTimePicker';
import OmLoading from '@/components/ui/OmLoading';
import { useVisitor } from '@/components/visitor/VisitorProvider';
import { computeLocalBazi } from '@/data/baziDayun';
import TrueSolarTimePanel from '@/components/report/TrueSolarTimePanel';
import BaziChart from '@/components/report/BaziChart';
import { ReportPanChart } from '@/components/report/PanCharts';
import SynastryPanel from '@/components/report/SynastryPanel';
import ExportReportModal from '@/components/report/ExportReportModal';
import { NUM_DATA, digitalRoot } from '@/data/numerologyData';
import {
  requestReportAgentStream,
  fetchReports,
  fetchReport,
  deleteReport,
  saveReport,
  requestPoster,
  updateReportFavorite,
  batchDeleteReports,
  fetchReportVersions,
  fetchAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  createDonation,
  fetchDonation,
  type SummaryResponse,
  type SummaryOutput,
  type SummaryCardItem,
  type SummaryDivergence,
  type SummaryTimelineItem,
  type ReportListItem,
  type ReportDetail,
  type ReportAnnotation,
  type DonationOrder,
  type ReportSearchParams,
} from '@/lib/api';
import { storage, registerLegacy } from '@/lib/storage';
import { getCrossReadings, clearCrossReadings, pushCrossReading, type CrossReading } from '@/lib/crossReadings';
import { printDocument } from '@/lib/print';
import { solarToLunarParts } from '@/lib/lunar';
import { mdToHtml, sanitizeAiText } from '@/lib/markdown';
import LightFollowUp from '@/components/ai-chat/LightFollowUp';
import { showToast } from '@/components/ui/Toast';

/* ============================= 命主动态提取工具 ============================= */

/** 术数 key → 中文标签 */
const MODULE_LABELS: Record<string, string> = {
  bazi: '八字',
  ziwei: '紫微斗数',
  qimen: '奇门遁甲',
  liuyao: '六爻',
  meihua: '梅花易数',
  liuren: '大六壬',
  taiyi: '太乙神数',
  numerology: '数字密码',
  tarot: '塔罗',
  horoscope: '星座',
};

/** 报告分类（后端 _classify_types 归一后的 types 值）→ 中文标签 */
const TYPE_LABELS: Record<string, string> = {
  report: '综合报告',
  tarot: '塔罗',
  bugua: '卜卦',
  other: '排盘',
};

/** types 分类值 → 展示文本（兼容旧数据的原始模块 key，逐一映射后拼接） */
function typesLabel(types: string[] | undefined | null): string {
  if (!types || types.length === 0) return '排盘';
  return types.map((t) => TYPE_LABELS[t] || MODULE_LABELS[t] || t).join(' / ');
}

/** 术数 key → 中文标签（未知 key 原样回显，防新增模块漏映射时把英文 key 亮给用户） */
const moduleLabel = (k: string): string => MODULE_LABELS[k] || k;

/** 天干五行（日主五行） */
const GAN_WUXING: Record<string, string> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};

/** 生日 → 星座名（与 horoscopeData 命名一致） */
function getConstellation(date: string): string | null {
  const [, m, d] = date.split('-').map(Number);
  if (!m || !d) return null;
  const md = m * 100 + d;
  const BOUNDS: Array<[number, number, string]> = [
    [120, 218, '水瓶座'], [219, 320, '双鱼座'], [321, 419, '白羊座'], [420, 520, '金牛座'],
    [521, 620, '双子座'], [621, 722, '巨蟹座'], [723, 822, '狮子座'], [823, 922, '处女座'],
    [923, 1022, '天秤座'], [1023, 1121, '天蝎座'], [1122, 1221, '射手座'],
    [1222, 1231, '摩羯座'], [101, 119, '摩羯座'],
  ];
  return BOUNDS.find(([s, e]) => md >= s && md <= e)?.[2] ?? null;
}

/** 加载骨架屏：推演期间主区不再空白，给出标题条 + 三段灰条 + 六维占位，缓解「30 秒白等」 */
function ReportSkeleton() {
  return (
    <div className="report-skeleton" aria-hidden="true">
      <div className="report-skeleton-title" />
      <div className="report-skeleton-line" />
      <div className="report-skeleton-line" />
      <div className="report-skeleton-line" />
      <div className="report-skeleton-dims">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="report-skeleton-dim">
            <div className="report-skeleton-dim-bar" />
            <div className="report-skeleton-dim-bar short" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================= 主页面 ============================= */

/** 综合行动建议三栏配色（与 AI 服务 advice 顺序对应：立即行动 / 短期 / 中长期） */
const ADVICE_COLORS = ['#7c5cff', '#5ce1e6', '#d4a853'];

/** 六维共识配色（与后端 consensus 顺序对应：事业/财/感情/健康/学业成长/人际贵人） */
const DIM_COLORS = ['#7c5cff', '#d4a853', '#ff6b9d', '#4ade80', '#5ce1e6', '#f59e0b'];

/** 快捷提问：新用户不知道能问什么，给可直接点的常见议题 */
const SAMPLE_QUESTIONS = [
  '整体运势综合分析',
  '今年事业运势如何',
  '财运和投资方向',
  '感情姻缘什么时候到',
  '健康需要注意什么',
  '今年适合换工作吗',
];

/* ============================= 报告模板（#11） =============================
 * 快捷提问只解决「问什么」，模板进一步解决「从哪些角度看」：
 * 每个模板预置问题 + 关注维度，选中后自动填入提问并在推演时提示 AI 侧重这些维度。
 */
interface ReportTemplate {
  id: string;
  icon: string;
  name: string;
  question: string;
  /** 关注维度（写入 params.focus，供 AI 综合时侧重） */
  focus: string[];
  desc: string;
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'yearly',
    icon: '📅',
    name: '年度运势总览',
    question: '整体运势综合分析',
    focus: ['事业', '财运', '感情', '健康'],
    desc: '六维全景扫描，适合年初做全年规划',
  },
  {
    id: 'career',
    icon: '💼',
    name: '事业转型决策',
    question: '今年适合换工作吗',
    focus: ['事业', '人际/贵人'],
    desc: '聚焦职场走向与变动窗口期',
  },
  {
    id: 'wealth',
    icon: '💰',
    name: '财运与投资',
    question: '财运和投资方向',
    focus: ['财运', '事业'],
    desc: '看进财路径与守财风险',
  },
  {
    id: 'love',
    icon: '💗',
    name: '感情走向分析',
    question: '感情姻缘什么时候到',
    focus: ['感情运'],
    desc: '姻缘时机与关系经营建议',
  },
  {
    id: 'health',
    icon: '🌿',
    name: '健康与身心',
    question: '健康需要注意什么',
    focus: ['健康', '学业/成长'],
    desc: '体质短板与调养方向',
  },
  {
    id: 'decision',
    icon: '🎯',
    name: '关键决策择时',
    question: '近期有一个重要决定，什么时候做最合适',
    focus: ['事业', '财运', '人际/贵人'],
    desc: '锁定最佳行动窗口，规避风险期',
  },
];

/* ============================= 随喜供养档位（#1） ============================= */
const DONATION_TIERS = [
  { name: '心意', fen: 660, label: '¥6.6' },
  { name: '诚意', fen: 1990, label: '¥19.9', recommend: true },
  { name: '大愿', fen: 6600, label: '¥66' },
];
/** 支付轮询间隔与总时长上限（超时后停止轮询，避免无限请求） */
const DONATE_POLL_INTERVAL = 3000;
const DONATE_POLL_TIMEOUT = 5 * 60 * 1000;

/** 报告有效期阈值（#15）：超过该天数提示「建议重新推演」 */
const REPORT_STALE_DAYS = 30;

/** 天数差 → 人类可读（用于报告时效提示） */
function daysSince(iso: string): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

/**
 * 解析中文时间标签为日期区间（#10 日历提醒）。
 * 支持：「2027春」「2026 秋」「2027年3月」「3月」「Q2」「2027」等常见写法；
 * 解析不出具体月份时退化为该年/该季度的起始月，保证 .ics 始终合法。
 */
const SEASON_START_MONTH: Record<string, number> = { 春: 2, 夏: 5, 秋: 8, 冬: 11 };

function parsePeriodToDate(period: string): { start: Date; end: Date } | null {
  if (!period) return null;
  const s = period.trim();
  let m = s.match(/(\d{4})\s*年?\s*(\d{1,2})\s*月/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    if (mo >= 0 && mo <= 11) {
      return { start: new Date(y, mo, 1), end: new Date(y, mo + 1, 0) };
    }
  }
  // 季度：Q1~Q4
  m = s.match(/(\d{4})?\s*Q([1-4])/i);
  if (m) {
    const y = m[1] ? Number(m[1]) : new Date().getFullYear();
    const q = Number(m[2]);
    const startMo = (q - 1) * 3;
    return { start: new Date(y, startMo, 1), end: new Date(y, startMo + 3, 0) };
  }
  // 「2027春」/「2027 秋」/「春」
  m = s.match(/(\d{4})?\s*年?\s*([春夏秋冬])/);
  if (m) {
    const y = m[1] ? Number(m[1]) : new Date().getFullYear();
    const startMo = SEASON_START_MONTH[m[2]] ?? 0;
    return { start: new Date(y, startMo, 1), end: new Date(y, startMo + 3, 0) };
  }
  // 「3月」（无年份，取未来最近的一个该月）
  m = s.match(/(\d{1,2})\s*月/);
  if (m) {
    const now = new Date();
    let y = now.getFullYear();
    const mo = Number(m[1]) - 1;
    if (mo < now.getMonth()) y += 1;
    if (mo >= 0 && mo <= 11) return { start: new Date(y, mo, 1), end: new Date(y, mo + 1, 0) };
  }
  // 纯年份
  m = s.match(/(\d{4})/);
  if (m) {
    const y = Number(m[1]);
    return { start: new Date(y, 0, 1), end: new Date(y, 11, 31) };
  }
  return null;
}

/** iCalendar 日期格式（本地全天事件）：YYYYMMDD */
function icsDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/** 生成 .ics 文本并触发下载（#10：关键决策期一键加入日历） */
function downloadIcs(events: { title: string; desc: string; start: Date; end: Date }[]): void {
  if (!events.length) return;
  const stamp = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}T` +
    `${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}${String(d.getUTCSeconds()).padStart(2, '0')}Z`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//玄镜 OracleMind//综合自我觉察报告//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  events.forEach((ev, i) => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:om-report-${Date.now()}-${i}@oraclemind`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART;VALUE=DATE:${icsDate(ev.start)}`,
      // iCalendar DTEND 为排他，+1 天才能覆盖最后一天
      `DTEND;VALUE=DATE:${icsDate(new Date(ev.end.getTime() + 86400000))}`,
      `SUMMARY:${ev.title.replace(/[\\;,]/g, ' ')}`,
      `DESCRIPTION:${ev.desc.replace(/[\\;,]/g, ' ')}`,
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:${ev.title.replace(/[\\;,]/g, ' ')}`,
      'END:VALARM',
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '玄镜关键节点提醒.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 导出逻辑（MD / Word / PNG / PDF）已抽离至 src/components/report/ExportReportModal.tsx */

/* ============================= 本地报告缓存 =============================
 * 综合报告走 LangGraph 五节点 + 多次 LLM 调用，同一命盘 + 同一问题重复提问
 * 会重复烧 token。这里按「访客 + 命盘 + 问题」缓存最近 8 份报告，
 * 命中则秒回（并在 UI 标注「本地缓存」），未命中才真正请求后端。
 */

/** djb2 字符串哈希：把跨页结论内容映射成稳定的缓存签名，避免 ts 抖动导致的不必要失效 */
function stableHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(36).slice(0, 10);
}

const CACHE_KEY = 'om_report_cache';
const CACHE_MAX = 20;
// 本地缓存版本：后端 report 已升级到 v2（prompt 哈希 + 温度稳定化），旧 v1 缓存直接作废
const CACHE_VERSION = 'v2';
// P2-1：旧键（oraclemind_report_cache_v2）惰性迁移到新键
registerLegacy('oraclemind_report_cache_v2', CACHE_KEY);
/** 本地缓存有效期：7 天。过期报告不再复用，避免旧命盘/旧结论误导用户 */
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

interface ReportCacheItem {
  key: string;
  question: string;
  report: any;
  disclaimer: string;
  degraded: boolean;
  degradedReason: string | null;
  contrib: string[];
  ts: number;
  elapsed?: number;
}

/** 读取全部缓存项（用于统计与清理） */
function readAllCache(): ReportCacheItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = storage.getItem(CACHE_KEY);
    const arr = raw ? (JSON.parse(raw) as ReportCacheItem[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function readCache(key: string): ReportCacheItem | null {
  const hit = readAllCache().find((x) => x.key === key) ?? null;
  if (!hit) return null;
  // 过期则视为未命中，并顺手清理该条
  if (Date.now() - hit.ts > CACHE_TTL) {
    writeCacheAll(readAllCache().filter((x) => x.key !== key));
    return null;
  }
  return hit;
}

/** 写入全部（内部用，避免重复 JSON.parse） */
function writeCacheAll(arr: ReportCacheItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    storage.setItem(CACHE_KEY, JSON.stringify(arr.slice(0, CACHE_MAX)));
  } catch {
    /* 隐私模式等存储不可用则跳过缓存，不影响主流程 */
  }
}

function writeCache(item: ReportCacheItem): void {
  if (typeof window === 'undefined') return;
  try {
    const next = [item, ...readAllCache().filter((x) => x.key !== item.key)]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, CACHE_MAX);
    storage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {
    /* 隐私模式等存储不可用则跳过缓存，不影响主流程 */
  }
}

/** 复制文本到剪贴板：优先 Clipboard API，失败回退 execCommand（http 环境） */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 继续走回退方案 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** 六维共识项（后端 consensus 结构） */
interface ConsensusDim {
  label: string;
  score: number;
  reason?: string;
}

/* ============================= LangGraph 进度条（5阶段 stepper） ============================= */

/** StateGraph 5 节点定义（与后端 reportGraph 节点名一一对应） */
const PHASE_STEPS = [
  { key: 'analyzer', label: '策略分析', icon: '🎯' },
  { key: 'paipan', label: '排盘推演', icon: '🔮' },
  { key: 'synthesizer', label: '综合交叉', icon: '🔗' },
  { key: 'reviewer', label: '审稿反思', icon: '🔍' },
  { key: 'writer', label: '报告生成', icon: '📝' },
];

/** 进度条组件：展示 graph 各节点流转状态 + 当前阶段详情 */
function ReportProgress({
  currentPhase,
  phaseDetails,
}: {
  currentPhase: string | null;
  phaseDetails: Record<string, any>;
}) {
  const currentIdx = currentPhase ? PHASE_STEPS.findIndex((s) => s.key === currentPhase) : -1;

  return (
    <div className="report-progress">
      <div className="progress-steps">
        {PHASE_STEPS.map((step, i) => {
          const status: 'done' | 'current' | 'pending' =
            currentPhase === null
              ? 'pending'
              : i < currentIdx
                ? 'done'
                : i === currentIdx
                  ? 'current'
                  : 'pending';
          return (
            <div key={step.key} className={`progress-step ${status}`}>
              <div className="progress-step-circle">
                {status === 'done' ? '✓' : status === 'current' ? step.icon : i + 1}
              </div>
              <div className="progress-step-label">{step.label}</div>
              {i < PHASE_STEPS.length - 1 && (
                <div className={`progress-step-line ${status === 'done' ? 'done' : ''}`} />
              )}
            </div>
          );
        })}
      </div>
      {/* 当前阶段详情（analyzer 选定术数 / paipan 成功术数） */}
      {currentPhase && phaseDetails[currentPhase] && (
        <div className="progress-detail">
          {phaseDetails[currentPhase]?.selectedLabels?.length ? (
            <div className="progress-detail-tags">
              <span className="progress-detail-hint">将排盘：</span>
              {phaseDetails[currentPhase].selectedLabels.map((l: string) => (
                <span key={l} className="progress-tag">{l}</span>
              ))}
            </div>
          ) : null}
          {phaseDetails[currentPhase]?.successLabels?.length ? (
            <div className="progress-detail-tags">
              <span className="progress-detail-hint">已成功：</span>
              {phaseDetails[currentPhase].successLabels.map((l: string) => (
                <span key={l} className="progress-tag progress-tag-success">{l}</span>
              ))}
              {phaseDetails[currentPhase]?.errors?.length ? (
                <span className="progress-detail-hint progress-detail-hint-warn">
                  失败 {phaseDetails[currentPhase].errors.length} 项（不阻断）
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function ReportPage() {
  const router = useRouter();
  const { birth, visitorId } = useVisitor();
  const [showShare, setShowShare] = useState(false);
  /** 导出面板：MD / Word / PNG / PDF 四选一，点击卡片触发对应下载（不再直接触发） */
  const [exportPanelOpen, setExportPanelOpen] = useState(false);

  /* ============================= 云端历史排盘（按访客ID） ============================= */
  const [cloudReports, setCloudReports] = useState<ReportListItem[] | null>(null);
  /** 云端存档详情（列表项点击后按 id 拉取完整 results 快照） */
  const [reportDetail, setReportDetail] = useState<ReportDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  /** 云端历史类型筛选（全部 / 综合报告 / 塔罗 / 卜卦 / 其他） */
  const [historyType, setHistoryType] = useState<'all' | 'report' | 'tarot' | 'bugua' | 'other'>('all');
  /** 云端列表拉取中（搜索切换时给出反馈，避免误以为没反应） */
  const [historyLoading, setHistoryLoading] = useState(false);
  /** 当前可见条数（「加载更多」逐步展开，避免长列表一次铺满） */
  const [historyVisible, setHistoryVisible] = useState(8);
  /** 历史对比：勾选最多 2 份报告，叠加雷达 + 共识分差值 */
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareData, setCompareData] = useState<ReportDetail[] | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  /* --- #2 搜索：关键词 / 日期范围 / 仅看收藏 --- */
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [favoritedOnly, setFavoritedOnly] = useState(false);
  const hasSearch = !!(searchQuery || dateFrom || dateTo || favoritedOnly);

  /* --- #7 批量管理：多选模式 + 选中集合 --- */
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);

  /* --- #8 批注：当前查看报告的批注列表 --- */
  const [annotations, setAnnotations] = useState<ReportAnnotation[]>([]);
  const [annoDraft, setAnnoDraft] = useState<{ anchor: string; label: string; quote: string } | null>(null);
  const [annoText, setAnnoText] = useState('');
  const [annoSaving, setAnnoSaving] = useState(false);
  const [editingAnnoId, setEditingAnnoId] = useState<number | null>(null);

  /* --- #12 版本链：当前报告的所有版本 --- */
  const [versions, setVersions] = useState<ReportListItem[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  /* --- #1 随喜供养：订单 + 轮询 --- */
  const [donateOpen, setDonateOpen] = useState(false);
  const [donateTier, setDonateTier] = useState(DONATION_TIERS[1].name);
  const [donation, setDonation] = useState<DonationOrder | null>(null);
  const [donateLoading, setDonateLoading] = useState(false);
  const donatePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* --- #9 跨报告趋势 --- */
  const [trendOpen, setTrendOpen] = useState(false);

  /** 当前根报告 ID（用于「换个说法」挂版本链，#12） */
  const rootReportIdRef = useRef<number | null>(null);

  const openReportDetail = useCallback(async (id: number) => {
    setReportDetail(null);
    setDetailOpen(true);
    setDetailLoading(true);
    setAnnotations([]);
    setVersions([]);
    setAnnoDraft(null);
    setAnnoText('');
    setEditingAnnoId(null);
    try {
      // 传 visitorId：后端对匿名报告做归属校验，缺失会 404（#3）
      const detail = await fetchReport(id, visitorId);
      setReportDetail(detail);
      // 批注与版本并行拉取，任一失败不阻断详情展示
      void fetchAnnotations(id, visitorId).then(setAnnotations).catch(() => setAnnotations([]));
      setVersionsLoading(true);
      void fetchReportVersions(id, visitorId)
        .then(setVersions)
        .catch(() => setVersions([]))
        .finally(() => setVersionsLoading(false));
    } catch {
      setReportDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [visitorId]);

  /** 按类型筛选后的历史列表 */
  const historyFiltered = useMemo(() => {
    const all = cloudReports ?? [];
    if (historyType === 'all') return all;
    if (historyType === 'report') return all.filter((r) => r.types.includes('report'));
    if (historyType === 'tarot') return all.filter((r) => r.types.includes('tarot'));
    if (historyType === 'bugua') return all.filter((r) => r.types.includes('bugua'));
    return all.filter((r) => !r.types.includes('report') && !r.types.includes('tarot') && !r.types.includes('bugua'));
  }, [cloudReports, historyType]);

  /** 可见分页（客户端分页，当前规模足够，避免分页接口边界问题） */
  const visibleReports = useMemo(() => historyFiltered.slice(0, historyVisible), [historyFiltered, historyVisible]);

  /** 各类型数量（筛选 tab 上展示） */
  const historyCounts = useMemo(() => {
    const all = cloudReports ?? [];
    return {
      all: all.length,
      report: all.filter((r) => r.types.includes('report')).length,
      tarot: all.filter((r) => r.types.includes('tarot')).length,
      bugua: all.filter((r) => r.types.includes('bugua')).length,
      other: all.filter((r) => !r.types.includes('report') && !r.types.includes('tarot') && !r.types.includes('bugua')).length,
    };
  }, [cloudReports]);

  /** 勾选/取消勾选对比报告（最多 2 份，超出则替换最早一个） */
  const toggleCompare = (id: number) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  /** 打开对比弹层：拉取两份存档的共识分与六维，叠加雷达并算差值 */
  const openCompare = useCallback(async () => {
    if (compareIds.length < 2) { showToast('请先勾选 2 份报告进行对比', 'info'); return; }
    setCompareOpen(true);
    setCompareLoading(true);
    setCompareData(null);
    try {
      const details = await Promise.all(compareIds.map((id) => fetchReport(id, visitorId)));
      setCompareData(details);
    } catch {
      setCompareData(null);
      showToast('对比数据加载失败，请重试', 'error');
    } finally {
      setCompareLoading(false);
    }
  }, [compareIds, visitorId]);

  /** 云端列表加载：搜索条件变化时重新拉取（关键词/日期由后端过滤，类型 tab 在前端过滤） */
  useEffect(() => {
    if (!visitorId) return;
    let cancelled = false;
    setHistoryLoading(true);
    const params: ReportSearchParams = {
      limit: 100,
      ...(searchQuery ? { q: searchQuery } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(favoritedOnly ? { favorited: true } : {}),
    };
    fetchReports(visitorId, 100, 0, params)
      .then((list) => { if (!cancelled) setCloudReports(list); })
      .catch(() => { if (!cancelled) setCloudReports(null); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [visitorId, searchQuery, dateFrom, dateTo, favoritedOnly]);

  /** 清空搜索条件 */
  const clearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setFavoritedOnly(false);
    setHistoryVisible(8);
  };

  /* ============================= AI 综合报告 Agent（LangGraph StateGraph，/api/v1/agent/report/stream） ============================= */
  const [summary, setSummary] = useState<SummaryResponse | 'loading' | 'error' | null>(null);
  const [contrib, setContrib] = useState<string[]>([]); // 实际参与融合的术数名（来自 phase 事件）
  const [question, setQuestion] = useState('整体运势综合分析');
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [phaseDetails, setPhaseDetails] = useState<Record<string, any>>({});
  /** 换个说法：第 N 次重新生成（后端 writer 换切入点），与缓存/重新推演共用 loadSummaryAgent */
  const [variant, setVariant] = useState(0);
  /** 流式思考过程（后端 writer/reviewer 阶段的 delta 文本，推演中实时打印） */
  const [reasoning, setReasoning] = useState('');
  /** 推演过程面板展开状态：推演中默认展开（避免 30 秒白等），完成后自动折叠 */
  const [reasoningOpen, setReasoningOpen] = useState(false);
  /** #11 当前选中的报告模板（仅用于高亮，实际侧重通过 question 体现） */
  const [activeTemplate, setActiveTemplate] = useState<string>('');
  /** 当前报告用的是分享者命盘（本机无档案）时展示提示，避免误以为是自己的命盘 */
  const [urlReady, setUrlReady] = useState(false);
  /** 分享深链带来的命盘参数（bd=出生日期 bt=时辰 bg=性别）：对方无本地档案时作为兜底，避免打开即空报告 */
  const [urlBirth, setUrlBirth] = useState<{ date: string; time?: string; gender?: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const savedKeyRef = useRef<string>('');
  /** 有效命盘：优先用本地访客档案，缺失时回退到分享深链参数（换设备打开不空报告） */
  const effectiveBirth = birth?.date
    ? birth
    : urlBirth?.date
      ? { date: urlBirth.date, time: urlBirth.time || '不详', gender: urlBirth.gender || '男' }
      : birth;
  /** 当前报告用的是分享者命盘（本机无档案）时展示提示，避免误以为是自己的命盘 */
  const usingSharedBirth = !birth?.date && !!urlBirth?.date;
  const hasBirth = !!effectiveBirth?.date;
  const birthKey = effectiveBirth ? `${effectiveBirth.date}|${effectiveBirth.time}|${effectiveBirth.gender}` : '';

  /** contrib 的最新值：缓存/归档要在请求完成后读取，闭包里直接拿 state 会拿到空数组 */
  const contribRef = useRef<string[]>([]);

  /** 刷新云端历史列表（保存新报告后同步，让归档立即可见） */
  const refreshCloud = useCallback(() => {
    if (!visitorId) return;
    fetchReports(visitorId, 100)
      .then(setCloudReports)
      .catch(() => { /* 列表拉取失败不打断主流程 */ });
  }, [visitorId]);

  /** 调用 Agent 接口：后端 LangGraph 编排（analyzer→paipan→synth→review→writer），流式推送 phase/token/report */
  const loadSummaryAgent = useCallback(async (q?: string, force = false, variant = 0, retries = 0) => {
    if (!effectiveBirth?.date) { setSummary(null); setContrib([]); return; }
    const [y, m, d] = effectiveBirth.date.split('-').map(Number);
    if (!y || !m || !d) { setSummary(null); setContrib([]); return; }
    const qText = (q ?? '').trim() || '整体运势综合分析';
    // 跨页测算结论（塔罗/星座/数字命理）：请求时实时读取共享池，
    // 与卜卦排盘同权交给 AI 融合；签名进缓存 key，跨页结论更新后旧缓存自动失效
    const cross = getCrossReadings();
    // 缓存 key 排除报告自身结论（type=='report'）：报告推演完会把自身结论回写跨页池，
    // 下次进入若把它算进 crossSig，key 必变 → 前端/后端缓存双双失效 → 每次重推。
    // 用内容哈希替代 ts：相同 type/label/summary 视为同一份跨页结论，避免 ts 抖动导致的不必要失效
    const crossSig = stableHash(
      cross
        .filter((r) => r.type !== 'report')
        .map((r) => `${r.type}|${r.label}|${r.summary}`)
        .join(';;')
    );
    const cacheKey = `${CACHE_VERSION}|${visitorId || 'anon'}|${birthKey}|${qText}|${crossSig}`;

    // 命中本地缓存直接复用（force=true 时强制重算，即「重新推演」）
    if (!force) {
      const hit = readCache(cacheKey);
      if (hit) {
        setSummary({
          data: hit.report,
          disclaimer: hit.disclaimer,
          meta: { degraded: hit.degraded, degradedReason: hit.degradedReason } as any,
        });
        setContrib(hit.contrib || []);
        savedKeyRef.current = cacheKey;
        // 缓存命中：思考过程无需展示
        setReasoning('');
        setReasoningOpen(false);
        return;
      }
    }

    abortRef.current?.abort(); // 上一次请求还在跑就直接掐掉，避免结果互相覆盖
    const ac = new AbortController();
    abortRef.current = ac;

    setSummary('loading');
    setCurrentPhase(null);
    setPhaseDetails({});
    setContrib([]);
    setReasoning('');
    setReasoningOpen(true);
    const t0 = Date.now();
    try {
      const resp = await requestReportAgentStream(
        qText,
        { year: y, month: m, day: d, hour: null, timeText: effectiveBirth.time || '不详', gender: effectiveBirth.gender || '男' },
        {
          signal: ac.signal,
          crossReadings: cross.map((r) => ({ type: r.type, label: r.label, summary: r.summary })),
          variant,
          onPhase: (phase, detail) => {
            if (ac.signal.aborted) return;
            setCurrentPhase(phase);
            if (detail) setPhaseDetails((prev) => ({ ...prev, [phase]: detail }));
            // 后端会把跨页结论标签追加进 selectedLabels/successLabels，contrib 直接含跨页项
            if (phase === 'analyzer' && detail?.selectedLabels) setContrib(detail.selectedLabels);
            if (phase === 'paipan' && detail?.successLabels) setContrib(detail.successLabels);
          },
          onDelta: (chunk) => {
            if (ac.signal.aborted) return;
            setReasoning((prev) => prev + chunk);
          },
        }
      );
      if (ac.signal.aborted) return;
      setSummary({
        data: resp.report,
        disclaimer: resp.disclaimer,
        meta: { degraded: resp.degraded, degradedReason: resp.degradedReason } as any,
      });
      const elapsed = Math.max(1, Math.round((Date.now() - t0) / 1000));
      setReasoningOpen(false); // 推演完成，思考过程自动折叠
      writeCache({
        key: cacheKey, question: qText, report: resp.report, disclaimer: resp.disclaimer,
        degraded: resp.degraded, degradedReason: resp.degradedReason, contrib: contribRef.current, ts: Date.now(), elapsed,
      });
      // 报告结论回写跨页共享池：让塔罗 / 星座 / 数字密码页能引用本次综合结论（双向联动）
      const repSummary = typeof resp.report?.summary === 'string' ? resp.report.summary : '';
      if (repSummary.trim()) {
        pushCrossReading({ type: 'report', label: `综合报告 · ${qText}`, summary: repSummary.slice(0, 140) });
        setCrossReadings(getCrossReadings());
      }
      // 归档到云端：换设备 / 清缓存后仍可在「云端历史」里回看。
      // force（重新推演）时跳过 savedKeyRef 去重，确保新报告覆盖云端归档，而不是永远停在初版。
      if (visitorId && (force || savedKeyRef.current !== cacheKey)) {
        savedKeyRef.current = cacheKey;
        // 版本链（#12）：「换个说法」（variant>0）挂在当前根报告下，首次生成则作为新根
        const parentId = variant > 0 ? rootReportIdRef.current : null;
        saveReport({
          visitorId,
          title: `综合报告 · ${qText}`,
          params: { year: y, month: m, day: d, hour: null, timeText: effectiveBirth.time || '不详', gender: effectiveBirth.gender || '男', question: qText },
          results: { report: resp.report, contrib: contribRef.current, question: qText } as any,
          summary: resp.report as any,
          parentId,
          variant,
        }).then((saved) => {
          // 只有根版本才更新 rootReportIdRef，保证后续「换个说法」都挂在同一条链上
          if (!variant) rootReportIdRef.current = saved.id;
          refreshCloud();
        }).catch(() => { /* 归档失败不影响本次查看 */ });
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      // 网络/流式瞬时错误：自动重试一次（退避 800ms），降低偶发失败对用户的中断
      if (retries < 1) {
        setSummary(null);
        setTimeout(() => { void loadSummaryAgent(qText, force, variant, 1); }, 800);
        return;
      }
      setSummary('error');
    } finally {
      if (!ac.signal.aborted) setCurrentPhase(null);
    }
  }, [birthKey, visitorId, refreshCloud]);

  useEffect(() => { contribRef.current = contrib; }, [contrib]);

  /** URL 深链：?q= 复现提问；?bd=&bt=&bg= 带分享者命盘（对方无本地档案时兜底） */
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get('q');
    if (q && q.trim()) setQuestion(q.trim());
    const bd = sp.get('bd');
    const bt = sp.get('bt');
    const bg = sp.get('bg');
    if (bd && /^\d{4}-\d{2}-\d{2}$/.test(bd)) setUrlBirth({ date: bd, time: bt || undefined, gender: bg || undefined });
    setUrlReady(true);
  }, []);

  const syncUrl = useCallback((q: string) => {
    const url = new URL(window.location.href);
    const v = q.trim();
    if (v && v !== '整体运势综合分析') url.searchParams.set('q', v);
    else url.searchParams.delete('q');
    // 分享深链带上命盘：对方无本地档案也能按分享者命盘复现（防止换设备打开即空报告）
    if (effectiveBirth?.date) {
      url.searchParams.set('bd', effectiveBirth.date);
      url.searchParams.set('bt', effectiveBirth.time || '不详');
      url.searchParams.set('bg', effectiveBirth.gender || '男');
    }
    window.history.replaceState({}, '', url.toString());
  }, [effectiveBirth]);

  useEffect(() => {
    if (!urlReady) return;
    loadSummaryAgent(question);
  }, [loadSummaryAgent, birthKey, urlReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => abortRef.current?.abort(), []);

  /**
   * 跨页占卜记录：读取塔罗 / 星座 / 数字命理页推送到共享池的最新结论。
   * 此前 report 页的「报告数据来源」是硬编码假数据，塔罗 push 的数据无人消费；
   * 这里真实渲染共享池内容，让跨页结论在综合报告里可见。
   */
  const [crossReadings, setCrossReadings] = useState<CrossReading[]>([]);
  useEffect(() => {
    setCrossReadings(getCrossReadings());
    const onStorage = () => setCrossReadings(getCrossReadings());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /** 清空跨页记录：旧结论会污染新的综合判断，用户需要能一键清干净 */
  const handleClearCross = () => {
    if (!window.confirm('清空全部跨页解读记录？清空后综合报告将不再引用这些结论。')) return;
    clearCrossReadings();
    setCrossReadings([]);
    showToast('跨页记录已清空', 'success');
  };

  /** 删除云端存档（传 visitorId 让后端做归属校验，#3） */
  const handleDeleteReport = async (id: number) => {
    if (!window.confirm('删除这条排盘存档？删除后不可恢复。')) return;
    try {
      await deleteReport(id, visitorId);
      setCloudReports((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
      setCompareIds((prev) => prev.filter((x) => x !== id));
      showToast('存档已删除', 'success');
    } catch {
      showToast('删除失败，请稍后重试', 'error');
    }
  };

  /** 收藏 / 置顶（#5）：乐观更新，失败回滚 */
  const handleToggleFlag = async (id: number, field: 'favorited' | 'pinned') => {
    const prevList = cloudReports;
    const target = prevList?.find((r) => r.id === id);
    if (!target) return;
    const nextVal = !target[field];
    setCloudReports((prev) =>
      prev ? prev.map((r) => (r.id === id ? { ...r, [field]: nextVal } : r)) : prev,
    );
    try {
      const updated = await updateReportFavorite(id, { [field]: nextVal }, visitorId);
      setCloudReports((prev) =>
        prev ? prev.map((r) => (r.id === id ? { ...r, favorited: updated.favorited, pinned: updated.pinned } : r)) : prev,
      );
    } catch {
      setCloudReports(prevList);
      showToast('操作失败，请稍后重试', 'error');
    }
  };

  /** 批量删除（#7） */
  const handleBatchDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`确认删除选中的 ${selectedIds.length} 份存档？删除后不可恢复。`)) return;
    setBatchDeleting(true);
    try {
      const res = await batchDeleteReports(selectedIds, visitorId);
      const removed = new Set(selectedIds);
      setCloudReports((prev) => (prev ? prev.filter((r) => !removed.has(r.id)) : prev));
      setCompareIds((prev) => prev.filter((x) => !removed.has(x)));
      setSelectedIds([]);
      setSelectMode(false);
      showToast(
        res.skipped > 0
          ? `已删除 ${res.deleted} 份，${res.skipped} 份跳过（无权限或已删除）`
          : `已删除 ${res.deleted} 份存档`,
        'success',
      );
    } catch {
      showToast('批量删除失败，请稍后重试', 'error');
    } finally {
      setBatchDeleting(false);
    }
  };

  /** 切换批量选中（#7） */
  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  /* ---------------- 批注（#8） ---------------- */

  /** 打开批注输入：记录锚点（定位到报告的具体区块）与被批注原文 */
  const startAnnotation = (anchor: string, label: string, quote: string) => {
    setEditingAnnoId(null);
    setAnnoDraft({ anchor, label, quote: quote.slice(0, 200) });
    setAnnoText('');
  };

  const submitAnnotation = async () => {
    const text = annoText.trim();
    if (!text) { showToast('请输入批注内容', 'info'); return; }
    if (!reportDetail) return;
    setAnnoSaving(true);
    try {
      if (editingAnnoId != null) {
        const updated = await updateAnnotation(editingAnnoId, text, visitorId);
        setAnnotations((prev) => prev.map((a) => (a.id === editingAnnoId ? updated : a)));
        showToast('批注已更新', 'success');
      } else {
        const created = await createAnnotation({
          reportId: reportDetail.id,
          visitorId,
          anchor: annoDraft?.anchor || '',
          anchorLabel: annoDraft?.label || '整篇',
          quote: annoDraft?.quote || '',
          content: text,
        });
        setAnnotations((prev) => [...prev, created]);
        showToast('批注已保存', 'success');
      }
      setAnnoDraft(null);
      setAnnoText('');
      setEditingAnnoId(null);
    } catch {
      showToast('批注保存失败，请稍后重试', 'error');
    } finally {
      setAnnoSaving(false);
    }
  };

  const removeAnnotation = async (id: number) => {
    if (!window.confirm('删除这条批注？')) return;
    const prev = annotations;
    setAnnotations((p) => p.filter((a) => a.id !== id));
    try {
      await deleteAnnotation(id, visitorId);
      showToast('批注已删除', 'success');
    } catch {
      setAnnotations(prev);
      showToast('删除失败，请稍后重试', 'error');
    }
  };

  /* ---------------- 随喜供养（#1） ---------------- */

  /** 停止订单轮询（组件卸载 / 关闭弹层 / 支付完成） */
  const stopDonatePoll = useCallback(() => {
    if (donatePollRef.current) {
      clearInterval(donatePollRef.current);
      donatePollRef.current = null;
    }
  }, []);

  useEffect(() => stopDonatePoll, [stopDonatePoll]);

  /** 下单 → 展示收款引导 → 轮询支付结果 */
  const handleCreateDonation = async () => {
    setDonateLoading(true);
    stopDonatePoll();
    try {
      const order = await createDonation({ tier: donateTier, visitorId });
      setDonation(order);
      if (order.status === 'paid') { showToast('感恩供养 🙏', 'success'); return; }
      const started = Date.now();
      donatePollRef.current = setInterval(async () => {
        try {
          const cur = await fetchDonation(order.outTradeNo, visitorId);
          setDonation(cur);
          if (cur.status !== 'pending' || Date.now() - started > DONATE_POLL_TIMEOUT) {
            stopDonatePoll();
            if (cur.status === 'paid') showToast('感恩供养，功德无量 🙏', 'success');
          }
        } catch {
          /* 单次轮询失败不打断，等待下一轮 */
        }
      }, DONATE_POLL_INTERVAL);
    } catch (e: any) {
      showToast(e?.message || '下单失败，请稍后重试', 'error');
    } finally {
      setDonateLoading(false);
    }
  };

  const closeDonate = () => {
    stopDonatePoll();
    setDonateOpen(false);
    setDonation(null);
  };

  /* ============================= 分享（此前弹层里 4 个选项全是死按钮） ============================= */
  const [posterOpen, setPosterOpen] = useState(false);
  const [posterLoading, setPosterLoading] = useState(false);
  const [poster, setPoster] = useState<{ shareText: string; imageUrl: string | null } | null>(null);

  /** 生成分享长图：复用 AI 服务 /api/v1/poster（与数字密码页同款） */
  const handlePoster = async () => {
    const rep: any = summary && summary !== 'loading' && summary !== 'error' ? summary.data : null;
    const head = lord ? `命主 ${lord.dayGan}${lord.dayWx} · ${lord.sign || ''} · 灵数${lord.num}` : '玄镜综合自我觉察报告';
    const body = rep?.summary ? String(rep.summary).replace(/\*\*/g, '') : '综合自我觉察报告';
    setPosterOpen(true);
    setPosterLoading(true);
    setPoster(null);
    try {
      const p = await requestPoster('综合自我觉察报告', `${head}\n${body}\n—— 玄镜 OracleMind`);
      setPoster({ shareText: p.shareText, imageUrl: p.imageUrl });
    } catch {
      setPoster({ shareText: `${head}\n${body}`, imageUrl: null });
    } finally {
      setPosterLoading(false);
    }
  };

  /** 复制报告链接（带 ?q= 深链，对方打开直接复现同一次提问） */
  const handleCopyLink = async () => {
    syncUrl(question);
    const ok = await copyText(window.location.href);
    showToast(ok ? '链接已复制，可直接分享' : '复制失败，请手动复制地址栏', ok ? 'success' : 'error');
  };

  /** 复制报告全文（纯文本 Markdown，方便粘贴到微信/备忘录） */
  const handleCopyText = async () => {
    const ok = await copyText(buildReportMarkdown());
    showToast(ok ? '报告全文已复制' : '复制失败，请重试', ok ? 'success' : 'error');
  };

  /** 朋友圈短文案：区别于「复制给好友」的全量 MD，给一句共振发现 + 引导语，适合朋友圈长图配文 */
  const handleCopySocial = async () => {
    const rep: any = summary && summary !== 'loading' && summary !== 'error' ? summary.data : null;
    const who = lord ? `${lord.dayGan}${lord.dayWx}命主` : '我';
    const one =
      Array.isArray(rep?.keyFindings) && rep.keyFindings.length
        ? rep.keyFindings[0]
        : typeof rep?.summary === 'string' && rep.summary
          ? rep.summary.split('\n')[0]
          : '用玄镜做了一次综合自我觉察报告';
    const text = `【玄镜 · 综合自我觉察报告】\n${who}问了「${question || '整体运势'}」：${one}\n—— 多术数交叉验证，打开玄镜也能测你的 ✨`;
    const ok = await copyText(text);
    showToast(ok ? '朋友圈文案已复制' : '复制失败，请重试', ok ? 'success' : 'error');
  };

  /** 命主信息：从访客档案（birth，缺失时回退分享深链）动态提取 —— 日主 / 星座 / 生命灵数（跨页面自动同步） */
  const lord = useMemo(() => {
    if (!effectiveBirth?.date) return null;
    const [y, m, d] = effectiveBirth.date.split('-').map(Number);
    if (!y || !m || !d) return null;
    const local = computeLocalBazi({ date: effectiveBirth.date, time: effectiveBirth.time || '不详', gender: effectiveBirth.gender || '男' });
    // 生命灵数统一走农历口径：先转农历年月日再求和，与 numerology 页 / synastry 保持一致。
    // ⚠️ 历史坑（2026-09-16 修复）：此处原用「公历 y+m+d」直算，导致报告卡与其他页的灵数不一致。
    const lp = solarToLunarParts(effectiveBirth.date);
    const num = lp ? digitalRoot(lp.ly + lp.lm + lp.ld) : digitalRoot(y + m + d);
    return {
      dayGan: local.dayGan,
      dayWx: GAN_WUXING[local.dayGan] || '',
      num,
      numName: NUM_DATA[num]?.name || '',
      sign: getConstellation(effectiveBirth.date),
    };
  }, [effectiveBirth]);

  /* ============================= 报告数据派生（后端字段此前完全没被消费） ============================= */
  const rep: any = summary && summary !== 'loading' && summary !== 'error' ? summary.data : null;
  const dims: ConsensusDim[] = useMemo(() => {
    const raw = rep?.consensus;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((d: any) => d && typeof d.label === 'string' && Number.isFinite(Number(d.score)))
      .map((d: any) => ({ label: d.label, score: Number(d.score), reason: d.reason ? String(d.reason) : '' }));
  }, [rep]);
  /** 跨术数共振发现（后端 writer 产出，此前前端未消费 → 交叉验证最有价值的一块被丢弃） */
  const keyFindings: string[] = useMemo(() => {
    const raw = rep?.keyFindings;
    if (!Array.isArray(raw)) return [];
    return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim());
  }, [rep]);

  /** 术数间分歧与调和方案（有则展示，无则不渲染该区块） */
  const divergences: SummaryDivergence[] = useMemo(() => {
    const raw = rep?.divergences;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((d: any) => d && typeof d.desc === 'string' && d.desc.trim())
      .map((d: any) => ({
        desc: String(d.desc).trim(),
        modules: Array.isArray(d.modules) ? d.modules.map((m: unknown) => String(m)) : [],
        resolution: d.resolution ? String(d.resolution).trim() : '',
      }));
  }, [rep]);

  /** 时间轴（#4）：后端 writer 产出 3~4 段，前端此前从未渲染 */
  const timeline: SummaryTimelineItem[] = useMemo(() => {
    const raw = rep?.timeline;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((t: any) => t && typeof t.period === 'string' && t.period.trim())
      .map((t: any) => ({ period: String(t.period).trim().slice(0, 16), overview: String(t.overview || '').trim() }));
  }, [rep]);

  const cards: SummaryCardItem[] = useMemo(() => {
    const raw = rep?.cards;
    if (!Array.isArray(raw)) return [];
    return raw.filter((c: any) => c && c.name).map((c: any) => ({
      icon: String(c.icon || '•'), name: String(c.name), score: String(c.score ?? ''), desc: String(c.desc || ''),
    }));
  }, [rep]);

  /** 关键决策期卡片（用于日历提醒，#10） */
  const decisionCard = useMemo(
    () => cards.find((c) => c.name.includes('关键决策期')) || null,
    [cards],
  );
  /** 共识分 = 六维均值（此前是写死的 84） */
  const consensusScore = dims.length
    ? Math.round(dims.reduce((s, d) => s + d.score, 0) / dims.length)
    : null;
  const degraded = !!(summary && summary !== 'loading' && summary !== 'error' && (summary.meta as any)?.degraded);

  /** 报告全文 Markdown：导出 PDF 与「复制全文」共用同一份内容，保证两处一致 */
  function buildReportMarkdown(): string {
    const L: string[] = [];
    L.push('# 玄镜 · 综合自我觉察报告');
    L.push('');
    if (lord) {
      L.push(`- 命主：日主 **${lord.dayGan}${lord.dayWx}**　本命盘 ${lord.sign || '—'}　生命灵数 ${lord.num}（${lord.numName}）`);
      L.push(`- 出生：${effectiveBirth?.date || ''} ${effectiveBirth?.time && effectiveBirth.time !== '不详' ? effectiveBirth.time : ''}${effectiveBirth?.gender ? ` · ${effectiveBirth.gender}命` : ''}`);
    } else {
      L.push('- 命主：未填写出生信息');
    }
    L.push(`- 提问：**${question || '整体运势综合分析'}**`);
    if (contrib.length) L.push(`- 参与融合：${contrib.map(moduleLabel).join('、')}`);
    if (consensusScore != null) {
      L.push('');
      L.push('## 六维共识');
      dims.forEach((d) => L.push(`- ${d.label}：**${d.score}**${d.reason ? ` —— ${d.reason}` : ''}`));
    }
    if (keyFindings.length) {
      L.push('');
      L.push('## 跨术数共振发现');
      keyFindings.forEach((f) => L.push(`- ${f}`));
    }
    if (divergences.length) {
      L.push('');
      L.push('## 术数分歧与调和');
      divergences.forEach((d) => {
        L.push(`- ${d.desc}${d.modules.length ? `（${d.modules.map((m) => MODULE_LABELS[m] || m).join('、')}）` : ''}`);
        if (d.resolution) L.push(`  - 调和：${d.resolution}`);
      });
    }
    if (timeline.length) {
      L.push('');
      L.push('## 运势时间轴');
      timeline.forEach((t) => L.push(`- **${t.period}**：${t.overview}`));
    }
    if (cards.length) {
      L.push('');
      L.push('## 关键提醒');
      cards.forEach((c) => L.push(`- ${c.icon} **${c.name}**（${c.score}）：${c.desc}`));
    }
    if (rep?.summary) { L.push(''); L.push('## 综合结论'); L.push(String(rep.summary)); }
    if (rep?.outlook) { L.push(''); L.push('## 近期趋势'); L.push(String(rep.outlook)); }
    if (Array.isArray(rep?.advice) && rep.advice.length) {
      L.push('');
      L.push('## 行动建议');
      rep.advice.forEach((col: any) => {
        L.push(`### ${col?.title || ''}`);
        (col?.items || []).forEach((it: string) => L.push(`- ${it}`));
      });
    }
    if (crossReadings.length) {
      L.push('');
      L.push('## 跨页占卜记录');
      crossReadings.forEach((r) => L.push(`- ${r.label}：${r.summary}`));
    }
    L.push('');
    L.push(`> ${(summary && summary !== 'loading' && summary !== 'error' ? summary.disclaimer : '') || '本报告由 AI 融合多术数推演生成，仅供娱乐与自我觉察参考。'}`);
    return L.join('\n');
  }


  /** 关键决策期加入日历（#10）：解析中文时间标签 → 生成 .ics */
  const handleAddCalendar = () => {
    const events: { title: string; desc: string; start: Date; end: Date }[] = [];
    // 优先用关键决策期卡片，其次用时间轴首段
    if (decisionCard?.score) {
      const range = parsePeriodToDate(decisionCard.score);
      if (range) {
        events.push({
          title: `玄镜 · 关键决策期（${decisionCard.score}）`,
          desc: decisionCard.desc || '综合自我觉察报告提示的关键决策窗口',
          start: range.start,
          end: range.end,
        });
      }
    }
    if (!events.length && timeline.length) {
      const first = timeline[0];
      const range = parsePeriodToDate(first.period);
      if (range) {
        events.push({ title: `玄镜 · ${first.period}`, desc: first.overview || '', start: range.start, end: range.end });
      }
    }
    // 时间轴后续节点一并加入，形成完整提醒链
    if (decisionCard?.score) {
      timeline.forEach((t) => {
        const range = parsePeriodToDate(t.period);
        if (range) {
          events.push({ title: `玄镜 · ${t.period}`, desc: t.overview || '', start: range.start, end: range.end });
        }
      });
    }
    if (!events.length) {
      showToast('未识别到可添加的时间节点', 'info');
      return;
    }
    downloadIcs(events);
    showToast(`已生成 ${events.length} 个日历提醒，请打开 .ics 文件导入`, 'success');
  };

  /** 随喜供养（#1）：打开支付弹层，走「下单 → 引导 → 轮询」完整链路 */
  const handleDonate = () => {
    setDonation(null);
    setDonateOpen(true);
  };

  /* ============================= 批注面板（#8） =============================
   * 报告是单向输出，用户需要把个人理解挂到具体结论旁。
   * 这里按报告区块给出「加批注」入口，锚点定位到具体段落，回看时能对照原文。
   */
  const annotationSections = useMemo(() => {
    if (!reportDetail) return [];
    const r = reportDetail.results?.report as Partial<SummaryOutput> | undefined;
    const list: { anchor: string; label: string; quote: string }[] = [];
    if (r?.summary) list.push({ anchor: 'summary', label: '综合结论', quote: String(r.summary).slice(0, 160) });
    if (Array.isArray(r?.consensus)) {
      r.consensus.forEach((c: any, i: number) => {
        if (c?.label) list.push({ anchor: `dims.${i}`, label: `六维 · ${c.label}`, quote: String(c.reason || `评分 ${c.score}`).slice(0, 160) });
      });
    }
    if (Array.isArray(r?.timeline)) {
      r.timeline.forEach((t: any, i: number) => {
        if (t?.period) list.push({ anchor: `timeline.${i}`, label: `时间轴 · ${t.period}`, quote: String(t.overview || '').slice(0, 160) });
      });
    }
    (Array.isArray(r?.cards) ? r.cards : []).forEach((c: any, i: number) => {
      if (c?.name) list.push({ anchor: `cards.${i}`, label: `关键提醒 · ${c.name}`, quote: String(c.desc || String(c.score ?? '')).slice(0, 160) });
    });
    if (r?.outlook) list.push({ anchor: 'outlook', label: '近期趋势', quote: String(r.outlook).slice(0, 160) });
    list.push({ anchor: '', label: '整篇', quote: '' });
    return list;
  }, [reportDetail]);

  const renderAnnotations = (d: ReportDetail) => (
    <div className="report-annotations">
      <div className="report-annotations-head">
        <span>📝 我的批注{annotations.length ? `（${annotations.length}）` : ''}</span>
        {!annoDraft && (
          <select
            className="report-anno-select"
            value=""
            onChange={(e) => {
              const idx = Number(e.target.value);
              const sec = annotationSections[idx];
              if (sec) startAnnotation(sec.anchor, sec.label, sec.quote);
            }}
          >
            <option value="">＋ 添加批注…</option>
            {annotationSections.map((s, i) => (
              <option key={s.anchor || 'all'} value={i}>{s.label}</option>
            ))}
          </select>
        )}
      </div>
      {annoDraft && (
        <div className="report-anno-editor">
          <div className="report-anno-target">
            批注位置：<strong>{annoDraft.label}</strong>
            {annoDraft.quote && <div className="report-anno-quote">「{annoDraft.quote}」</div>}
          </div>
          <textarea
            className="report-anno-input"
            value={annoText}
            maxLength={2000}
            rows={3}
            placeholder="写下你的想法（例：届时关注 XX 项目进展）"
            onChange={(e) => setAnnoText(e.target.value)}
          />
          <div className="report-anno-actions">
            <Button variant="primary" disabled={annoSaving || !annoText.trim()} onClick={() => void submitAnnotation()}>
              {annoSaving ? '保存中…' : '保存批注'}
            </Button>
            <Button variant="ghost" onClick={() => { setAnnoDraft(null); setAnnoText(''); setEditingAnnoId(null); }}>取消</Button>
          </div>
        </div>
      )}
      {annotations.length === 0 && !annoDraft && (
        <div className="report-anno-empty">还没有批注。看到有共鸣的结论，可以随手记一笔。</div>
      )}
      {annotations.map((a) => (
        <div key={a.id} className="report-anno-item">
          <div className="report-anno-meta">
            <span className="report-anno-anchor">{a.anchorLabel || '整篇'}</span>
            <span className="report-anno-time">{new Date(a.created_at).toLocaleString('zh-CN', { hour12: false })}</span>
            <span className="report-anno-ops">
              <button
                type="button"
                className="report-link-btn"
                onClick={() => { setEditingAnnoId(a.id); setAnnoText(a.content); setAnnoDraft({ anchor: a.anchor, label: a.anchorLabel, quote: a.quote }); }}
              >编辑</button>
              <button type="button" className="report-del-btn" onClick={() => void removeAnnotation(a.id)}>删除</button>
            </span>
          </div>
          {a.quote && <div className="report-anno-quote">「{a.quote}」</div>}
          <div className="report-anno-content">{a.content}</div>
        </div>
      ))}
      {!d.results?.report && annotations.length === 0 && (
        <div className="report-anno-empty">
          当前存档类型为 {typesLabel(d.types)}，暂不支持批注。
        </div>
      )}
    </div>
  );

  return (
    <div className="page active" id="page-report">
      {/* 页面头部 */}
      <div className="page-header">
        <div><div className="page-title">📋 综合自我觉察报告</div><div className="page-subtitle">{contrib.length ? `${contrib.map(moduleLabel).join(' × ')} · 交叉验证` : '多术数 · 交叉验证'}</div></div>
        <div className="page-actions">
          <Button variant="ghost" onClick={()=>setShowShare(true)}>📤 分享报告</Button>
          <Button variant="ghost" onClick={()=>setExportPanelOpen(true)}>⬇️ 导出</Button>
        </div>
      </div>

      {/* 命主模块：从访客档案动态提取（跨页面自动同步） */}
      <div className={`report-hero${dims.length === 0 ? ' report-hero-compact' : ''}`}>
        <div className="report-hero-left">
          <div className="report-score-ring">
            <div className="report-score-inner">
              <div className="report-score-num">{consensusScore ?? '—'}</div>
              <div className="report-score-label">共识分</div>
            </div>
          </div>
          <div>
            {lord ? (
              <>
                <div className="report-hero-name">🌸 命主 · 日主{lord.dayGan}{lord.dayWx}</div>
                <div className="report-hero-meta">
                  生于 <strong>{effectiveBirth!.date}</strong>
                  {effectiveBirth!.time && effectiveBirth!.time !== '不详' ? ` ${effectiveBirth!.time}` : ''}
                  {effectiveBirth!.gender ? ` · ${effectiveBirth!.gender}命` : ''}
                  {(birth?.province || birth?.city) ? ` · ${[birth?.province, birth?.city].filter(Boolean).join(' / ')}` : ''}
                  {' '}<Tag variant="good">{lord.dayWx}命</Tag><br/>
                  本命盘：<strong>{lord.sign || '—'}</strong> · 生命灵数 <strong>{lord.num}</strong>（{lord.numName}）
                </div>
              </>
            ) : (
              <>
                <div className="report-hero-name">🌸 命主档案未填写</div>
                <div className="report-hero-meta">在卜卦页或数字密码页填写出生信息后，自动生成你的专属命主报告</div>
                <Button variant="primary" onClick={() => router.push('/bugua')}>☯️ 去填写出生信息</Button>
              </>
            )}
          </div>
        </div>
        {dims.length > 0 && (
          <div className="report-hero-bars">
            {dims.map((d, i) => {
              const c = DIM_COLORS[i % DIM_COLORS.length];
              return (
                <div key={d.label} className="report-bar-row">
                  <span className="report-bar-label">{d.label}</span>
                  <Progress value={d.score} color={c} trackClass="verify-bar-bg" fillClass="verify-bar-fill" className="report-bar-progress"/>
                  <span className="report-bar-val" style={{ ['--c' as string]: c }}>{d.score}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {usingSharedBirth && (
        <div className="report-shared-note">
          🔗 你正在查看<strong>分享者</strong>的命盘报告（本机未填写出生信息）。前往卜卦页填写你的出生信息后，将自动切换为你自己的专属报告。
        </div>
      )}
      <div className="result-layout">
        <div className="result-main">
          <Card>
            <SectionTitle icon="target">{hasBirth && summary && summary !== 'loading' && summary !== 'error' ? `${contrib.length || 0} 种术数 · 交叉验证结论` : '多术数 · 交叉验证结论'}</SectionTitle>
            {!hasBirth && <div className="report-empty">填写出生信息后，自动融合多术数推演你的专属结论。</div>}
            {hasBirth && (
              <>
                <div className="report-question">
                  <div className="report-question-integrated">
                    <input
                      className="report-question-input"
                      type="text"
                      value={question}
                      placeholder="输入你想问的问题（例：今年事业运势）"
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { syncUrl(question); loadSummaryAgent(question); } }}
                    />
                    <Button
                      variant="primary"
                      className="report-question-submit"
                      disabled={summary === 'loading'}
                      onClick={() => { syncUrl(question); loadSummaryAgent(question); }}
                    >{summary === 'loading' ? '推演中…' : '推演'}</Button>
                  </div>
                  {summary === 'loading' ? (
                    <Button variant="ghost" onClick={() => { abortRef.current?.abort(); setSummary(null); }}>取消</Button>
                  ) : rep ? (
                    <>
                      <Button variant="ghost" onClick={() => loadSummaryAgent(question, true)} title="忽略本地缓存，重新推演">重新推演</Button>
                      <Button variant="ghost" onClick={() => { const nv = variant + 1; setVariant(nv); loadSummaryAgent(question, true, nv); }} title="换全新切入点重新解读（结论与综合分析一致）">换个说法</Button>
                    </>
                  ) : null}
                </div>
                <div className="report-samples">
                  {SAMPLE_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={'report-sample' + (question === q ? ' active' : '')}
                      disabled={summary === 'loading'}
                      onClick={() => { setQuestion(q); syncUrl(q); loadSummaryAgent(q); }}
                    >{q}</button>
                  ))}
                </div>
                {/* #11 报告模板：预设问题 + 关注维度，解决「不知道从哪个角度问」 */}
                <div className="report-templates">
                  <div className="report-templates-head">
                    <span>📐 报告模板</span>
                    <span className="report-templates-hint">选一个场景，自动填好提问与分析侧重</span>
                  </div>
                  <div className="report-template-grid">
                    {REPORT_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        className={'report-template' + (activeTemplate === tpl.id ? ' active' : '')}
                        disabled={summary === 'loading'}
                        title={tpl.desc}
                        onClick={() => {
                          setActiveTemplate(tpl.id);
                          setQuestion(tpl.question);
                          syncUrl(tpl.question);
                          void loadSummaryAgent(tpl.question);
                        }}
                      >
                        <span className="report-template-icon">{tpl.icon}</span>
                        <span className="report-template-name">{tpl.name}</span>
                        <span className="report-template-focus">{tpl.focus.join(' · ')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            {hasBirth && summary === 'loading' && (
              <>
                <ReportProgress currentPhase={currentPhase} phaseDetails={phaseDetails} />
                <OmLoading label={`AI 正在融合 ${contrib.length || '多'} 种术数视角，交叉推演综合结论…`} mode="inline" />
                {reasoning && (
                  <div className="report-reasoning">
                    <button
                      type="button"
                      className="report-reasoning-head"
                      onClick={() => setReasoningOpen((o) => !o)}
                      aria-expanded={reasoningOpen}
                    >
                      <span>🧠 推演过程</span>
                      <span className="report-reasoning-toggle">{reasoningOpen ? '收起 ▲' : '展开 ▼'}</span>
                    </button>
                    {reasoningOpen && <pre className="report-reasoning-body" ref={(el) => { if (el && reasoningOpen) el.scrollTop = el.scrollHeight; }}>{reasoning}</pre>}
                  </div>
                )}
                <ReportSkeleton />
              </>
            )}
            {hasBirth && summary === 'error' && (
              <div className="report-error">
                ⚠️ 综合结论生成失败，请稍后重试。
                <Button variant="ghost" onClick={() => loadSummaryAgent(question)}>重新生成</Button>
              </div>
            )}
            {hasBirth && summary && summary !== 'loading' && summary !== 'error' && (
              <>
                <div className="verify-contrib">
                  {contrib.map((name) => (
                    <span key={name} className="verify-chip">{moduleLabel(name)}</span>
                  ))}
                  <span className="verify-chip verify-chip-muted">已融合 {contrib.length} 种术数</span>
                </div>
                <div className="verify-summary">
                  {sanitizeAiText(summary.data.summary).split('\n').filter(Boolean).map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
                {dims.length > 0 && (
                  <div className="report-consensus">
                    <div className="report-consensus-title">六维共识评分</div>
                    {/* 雷达图取代与 hero 重复的条形网格（可视化全貌）；下方保留逐维 reason 作「分维解读」 */}
                    <ReportRadar dims={dims} />
                    <div className="report-consensus-reasons">
                      {dims.map((dim) => {
                        const color = dim.score >= 85 ? '#4ade80' : dim.score >= 75 ? '#d4a853' : '#ff6b6b';
                        return (
                          <div key={dim.label} className="report-consensus-reason-item">
                            <span className="report-consensus-reason-label" style={{ ['--c' as string]: color }}>
                              {dim.label} · {dim.score}
                            </span>
                            {dim.reason && <div className="report-consensus-reason">{dim.reason}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {degraded && (
                  <div className="summary-degraded-note">
                    ⚠️ AI 综合推演不可用，当前为本地规则兜底，六维评分与建议仅供参考。
                    {(summary.meta as any)?.degradedReason ? `（${(summary.meta as any).degradedReason}）` : ''}
                  </div>
                )}
                {summary.disclaimer && <div className="report-disclaimer">※ {summary.disclaimer}</div>}
              </>
            )}
          </Card>
          {/* 关键提醒四卡：后端 report.cards（近期趋势/关键决策期/风险提示/天赋优势）此前从未渲染 */}
          {hasBirth && summary && summary !== 'loading' && summary !== 'error' && cards.length > 0 && (
            <Card>
              <SectionTitle icon="sparkles">关键提醒</SectionTitle>
              <div className="report-cards">
                {cards.map((c, i) => (
                  <div key={i} className="report-mini-card">
                    <div className="report-mini-icon">{c.icon}</div>
                    <div className="report-mini-name">{c.name}</div>
                    <div className="report-mini-score">{c.score}</div>
                    <div className="report-mini-desc">{c.desc}</div>
                  </div>
                ))}
              </div>
              {/* #10：关键决策期是时间敏感信息，给一个落到日历的出口 */}
              <div className="report-cards-action">
                <Button variant="ghost" onClick={handleAddCalendar}>📅 把关键节点加入日历</Button>
                <span className="report-cards-action-hint">下载 .ics 后可导入系统日历 / 手机日历，到期自动提醒</span>
              </div>
            </Card>
          )}
          <Card>
            <SectionTitle icon="list-checks">AI 综合行动建议</SectionTitle>
            {!hasBirth && <div className="report-empty">填写出生信息后生成。</div>}
            {hasBirth && summary === 'loading' && <OmLoading label="正在生成可执行行动建议…" mode="inline" />}
            {hasBirth && summary === 'error' && (
              <div className="report-error">⚠️ 建议生成失败。<Button variant="ghost" onClick={() => loadSummaryAgent(question)}>重试</Button></div>
            )}
            {hasBirth && summary && summary !== 'loading' && summary !== 'error' && (
              <div className="stack">
                {summary.data.advice.length === 0 && <div className="report-empty">暂无具体建议。</div>}
                {summary.data.advice.map((col, ci) => {
                  const color = ADVICE_COLORS[ci % ADVICE_COLORS.length];
                  return (
                    <div key={ci} className="advice-group">
                      <div className="advice-group-title" style={{ ['--c' as string]: color }}>{col.title}</div>
                      <div className="stack">
                        {(col.items || []).map((it, ii) => (
                          <div key={ii} className="action-item">
                            <span className="action-badge" style={{ ['--bg' as string]: color + '22', ['--c' as string]: color }}>{col.title.slice(0, 4)}</span>
                            <span className="action-text">{it}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          {hasBirth && summary && summary !== 'loading' && summary !== 'error' && (
            <LightFollowUp
              module="summary"
              context={buildReportMarkdown()}
              chips={['能说得再具体一点吗？', '这和我的事业有关吗？', '感情方面怎么看？', '有什么需要特别注意的？']}
              title="还想深入聊聊这份报告？"
            />
          )}
          <section className="report-history-section">
            <Card>
              <SectionTitle icon="cloud">云端历史排盘</SectionTitle>
              {cloudReports === null ? (
                <div className="report-empty">暂无云端存档（卜卦页排盘后自动保存）。</div>
              ) : (cloudReports.length === 0) ? (
                <div className="report-empty">
                  {hasSearch ? (
                    <>没有匹配的报告。试试更换关键词，或<button type="button" className="report-link-btn" onClick={clearSearch}>清除筛选</button></>
                  ) : '还没有档案记录，去卜卦页生成你的专属觉察档案吧。'}
                </div>
              ) : (
                <div className="report-history">
                  {/* #2 搜索：关键词 + 日期范围 + 仅看收藏 */}
                  <div className="report-history-search">
                    <div className="report-search-row">
                      <input
                        className="report-search-input"
                        type="search"
                        value={searchInput}
                        placeholder="搜索标题 / 提问内容…"
                        maxLength={64}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { setSearchQuery(searchInput.trim()); setHistoryVisible(8); } }}
                      />
                      <Button variant="ghost" onClick={() => { setSearchQuery(searchInput.trim()); setHistoryVisible(8); }}>搜索</Button>
                    </div>
                    <div className="report-search-row report-search-row-dates">
                      <DatePicker
                        className="report-history-date"
                        value={dateFrom}
                        onChange={setDateFrom}
                        placeholder="起始日期"
                        maxYear={new Date().getFullYear()}
                      />
                      <span className="report-search-sep">至</span>
                      <DatePicker
                        className="report-history-date"
                        value={dateTo}
                        onChange={setDateTo}
                        placeholder="结束日期"
                        maxYear={new Date().getFullYear()}
                      />
                      <label className="report-search-fav">
                        <input
                          type="checkbox"
                          checked={favoritedOnly}
                          onChange={(e) => setFavoritedOnly(e.target.checked)}
                        />
                        <span>仅看收藏</span>
                      </label>
                    </div>
                    {(hasSearch || historyLoading) && (
                      <div className="report-search-status">
                        {historyLoading ? (
                          <span>⏳ 搜索中…</span>
                        ) : (
                          <span>🔍 已筛选，命中 {historyCounts.all} 份{searchQuery ? `（关键词「${searchQuery}」）` : ''}</span>
                        )}
                        <button type="button" className="report-link-btn" onClick={clearSearch}>清除筛选</button>
                      </div>
                    )}
                  </div>
                  {/* 类型筛选 tab（全部 / 综合报告 / 塔罗 / 卜卦 / 其他），带数量 */}
                  <div className="report-history-tabs">
                    {([
                      ['all', '全部', historyCounts.all],
                      ['report', '综合报告', historyCounts.report],
                      ['tarot', '塔罗', historyCounts.tarot],
                      ['bugua', '卜卦', historyCounts.bugua],
                      ['other', '其他', historyCounts.other],
                    ] as const).map(([key, label, count]) => (
                      <button
                        key={key}
                        type="button"
                        className={'report-history-tab' + (historyType === key ? ' active' : '')}
                        onClick={() => { setHistoryType(key); setHistoryVisible(8); }}
                      >
                        {label}<span className="report-history-tab-count">{count}</span>
                      </button>
                    ))}
                  </div>
                  {/* 勾选 2 份即可对比共识分变化与六维雷达叠加 */}
                  <div className="report-history-compare-bar">
                    <div className="report-history-compare-left">
                      <span className="report-history-compare-hint">
                        已选 {compareIds.length}/2 份
                      </span>
                      {compareIds.length > 0 && (
                        <button
                          type="button"
                          className="report-history-action-btn report-history-action-btn-subtle"
                          onClick={() => setCompareIds([])}
                        >清空选择</button>
                      )}
                    </div>
                    <div className="report-history-compare-actions">
                      <Button
                        variant="ghost"
                        className="report-history-action-btn"
                        disabled={compareIds.length < 2}
                        onClick={() => void openCompare()}
                      >⇄ 对比</Button>
                      {/* #9 跨报告趋势：回答「我的运势整体是在变好吗」 */}
                      <Button
                        variant="ghost"
                        className="report-history-action-btn"
                        disabled={(cloudReports?.length ?? 0) < 2}
                        onClick={() => setTrendOpen(true)}
                        title="按时间查看六维共识分的变化曲线"
                      >📈 趋势</Button>
                      {/* #7 批量管理入口 */}
                      <button
                        type="button"
                        className="report-history-action-btn report-history-action-btn-subtle"
                        onClick={() => { setSelectMode((m) => !m); setSelectedIds([]); }}
                      >{selectMode ? '退出批量' : '批量管理'}</button>
                    </div>
                  </div>
                  {selectMode && (
                    <div className="report-history-batch-bar">
                      <div className="report-history-batch-left">
                        <label className="report-batch-selectall">
                          <input
                            type="checkbox"
                            checked={visibleReports.length > 0 && selectedIds.length === visibleReports.length}
                            onChange={(e) => setSelectedIds(e.target.checked ? visibleReports.map((r) => r.id) : [])}
                          />
                          <span>全选当前 {visibleReports.length} 份</span>
                        </label>
                        <span className="report-history-batch-hint">已选 {selectedIds.length} 份</span>
                      </div>
                      <button
                        type="button"
                        className="report-history-action-btn report-history-action-btn-danger"
                        disabled={!selectedIds.length || batchDeleting}
                        onClick={() => void handleBatchDelete()}
                      >{batchDeleting ? '删除中…' : '🗑️ 批量删除'}</button>
                    </div>
                  )}
                  <div className="source-list">
                    {visibleReports.map((r) => {
                      const checked = compareIds.includes(r.id);
                      return (
                        <div
                          key={r.id}
                          className={'source-item report-cloud-item' + (checked ? ' selected' : '')}
                        >
                          {/* 批量模式下左侧换成多选勾选框（#7） */}
                          {selectMode ? (
                            <label className="report-cloud-check">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(r.id)}
                                onChange={() => toggleSelected(r.id)}
                                aria-label={`选中 ${r.title}`}
                              />
                            </label>
                          ) : (
                            <label className="report-cloud-check">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCompare(r.id)}
                                aria-label={`选择 ${r.title} 参与对比`}
                              />
                            </label>
                          )}
                          <div
                            className="report-cloud-main"
                            role="button"
                            tabIndex={0}
                            title="点击查看当时的排盘结果"
                            onClick={() => { if (!selectMode) void openReportDetail(r.id); }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                if (!selectMode) void openReportDetail(r.id);
                              }
                            }}
                          >
                            <div className="source-head">
                              <strong className="source-name">
                                {r.pinned && <span className="report-flag-icon" title="已置顶">📌</span>}
                                {r.title}
                              </strong>
                              <span className="report-list-actions">
                                {/* #5 收藏 / 置顶 */}
                                <button
                                  type="button"
                                  className={'report-flag-btn' + (r.favorited ? ' on' : '')}
                                  aria-label={r.favorited ? '取消收藏' : '收藏'}
                                  title={r.favorited ? '取消收藏' : '收藏'}
                                  onClick={(e) => { e.stopPropagation(); void handleToggleFlag(r.id, 'favorited'); }}
                                >{r.favorited ? '★' : '☆'}</button>
                                <button
                                  type="button"
                                  className={'report-flag-btn' + (r.pinned ? ' on' : '')}
                                  aria-label={r.pinned ? '取消置顶' : '置顶'}
                                  title={r.pinned ? '取消置顶' : '置顶'}
                                  onClick={(e) => { e.stopPropagation(); void handleToggleFlag(r.id, 'pinned'); }}
                                >📌</button>
                                <span className="report-cloud-open">查看 ›</span>
                                <button
                                  type="button"
                                  className="report-del-btn"
                                  aria-label={`删除存档 ${r.title}`}
                                  onClick={(e) => { e.stopPropagation(); void handleDeleteReport(r.id); }}
                                >删除</button>
                              </span>
                            </div>
                            <div className="source-meta">
                              {typesLabel(r.types)} · {(r.created_at || '').slice(0, 10).replace(/-/g, '/')}
                              {r.variant ? <span className="report-variant-badge">v{r.variant + 1}</span> : null}
                              {/* #15 时效性提示：超过阈值提醒重新推演 */}
                              {daysSince(r.created_at) >= REPORT_STALE_DAYS && (
                                <span className="report-stale-badge" title="流年流月已变化，建议重新推演获取最新运势">
                                  {daysSince(r.created_at)} 天前
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {historyFiltered.length === 0 && hasSearch && (
                    <div className="report-empty">
                      没有匹配的报告。试试更换关键词，或
                      <button type="button" className="report-link-btn" onClick={clearSearch}>清除筛选</button>
                    </div>
                  )}
                  {historyFiltered.length > historyVisible && (
                    <button
                      type="button"
                      className="report-history-more"
                      onClick={() => setHistoryVisible((v) => v + 8)}
                    >
                      加载更多（还有 {historyFiltered.length - historyVisible} 份）
                    </button>
                  )}
                </div>
              )}
            </Card>
          </section>

        </div>
        <div className="result-sidebar">
          <Card variant="side">
            <SectionTitle icon="shield-check">报告数据来源</SectionTitle>
            {/* 真实来源统计：本次融合的术数 + 跨页记录 + 云端存档，取代原先写死的 8 项百分比 */}
            <div className="source-list">
              <div className="source-item">
                <div className="source-head">
                  <strong className="source-name">本次融合术数</strong>
                  <Tag variant={contrib.length >= 3 ? 'good' : contrib.length ? 'warn' : 'bad'} baseClass="star-tag">
                    {contrib.length} 种
                  </Tag>
                </div>
                <div className="source-meta">
                  {contrib.length ? contrib.map(moduleLabel).join('、') : '尚未推演，暂无融合记录'}
                </div>
                <Progress value={Math.min(100, contrib.length * 25)} color="#7c5cff" trackClass="verify-bar-bg" fillClass="verify-bar-fill" />
              </div>
              <div className="source-item">
                <div className="source-head">
                  <strong className="source-name">跨页解读记录</strong>
                  <Tag variant={crossReadings.length ? 'good' : 'bad'} baseClass="star-tag">{crossReadings.length} 条</Tag>
                </div>
                <div className="source-meta">
                  {crossReadings.length
                    ? crossReadings.map((r) => r.label).join('、')
                    : '塔罗 / 星座 / 数字密码页测算后自动汇总'}
                </div>
                <Progress value={Math.min(100, crossReadings.length * 34)} color="#5ce1e6" trackClass="verify-bar-bg" fillClass="verify-bar-fill" />
              </div>
              <div className="source-item">
                <div className="source-head">
                  <strong className="source-name">云端排盘存档</strong>
                  <Tag variant={(cloudReports?.length ?? 0) ? 'good' : 'bad'} baseClass="star-tag">
                    {cloudReports?.length ?? 0} 份
                  </Tag>
                </div>
                <div className="source-meta">卜卦页与各页排盘后自动保存，可在下方历史中回看</div>
                <Progress value={Math.min(100, (cloudReports?.length ?? 0) * 20)} color="#d4a853" trackClass="verify-bar-bg" fillClass="verify-bar-fill" />
              </div>
              <div className="source-item">
                <div className="source-head">
                  <strong className="source-name">命主档案</strong>
                  <Tag variant={lord ? 'good' : 'bad'} baseClass="star-tag">{lord ? '已完善' : '未填写'}</Tag>
                </div>
                <div className="source-meta">
                  {lord
                    ? `日主${lord.dayGan}${lord.dayWx} · ${lord.sign || '—'} · 灵数${lord.num}`
                    : '填写出生日期后，八字/星座/灵数自动参与融合'}
                </div>
                <Progress value={lord ? 100 : 0} color={lord ? '#4ade80' : '#ff6b6b'} trackClass="verify-bar-bg" fillClass="verify-bar-fill" />
              </div>
            </div>
          </Card>
          {hasBirth && summary && summary !== 'loading' && summary !== 'error' && keyFindings.length > 0 && (
            <Card variant="side">
              <SectionTitle icon="link">跨术数共振发现</SectionTitle>
              <div className="report-findings">
                {keyFindings.map((f, i) => (
                  <div key={i} className="report-finding-item">
                    <span className="report-finding-icon">✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card variant="side" className="report-tools-card">
            <SectionTitle icon="compass">专业排盘工具</SectionTitle>
            <div className="report-tools-card-sub">校正时辰 · 两人合参</div>
            <TrueSolarTimePanel />
            <SynastryPanel />
          </Card>
          {hasBirth && summary && summary !== 'loading' && summary !== 'error' && divergences.length > 0 && (
            <Card variant="side">
              <SectionTitle icon="layers">术数分歧与调和</SectionTitle>
              <div className="report-divergence">
                {divergences.map((d, i) => (
                  <div key={i} className="report-divergence-item">
                    <div className="report-divergence-desc">{d.desc}</div>
                    {d.modules.length > 0 && (
                      <div className="report-divergence-modules">
                        {d.modules.map((m) => (
                          <span key={m} className="report-divergence-chip">{MODULE_LABELS[m] || m}</span>
                        ))}
                      </div>
                    )}
                    {d.resolution && (
                      <div className="report-divergence-resolution">
                        <strong>调和：</strong>{d.resolution}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
          {hasBirth && summary && summary !== 'loading' && summary !== 'error' && timeline.length > 0 && (
            <Card variant="side">
              <SectionTitle icon="calendar-days">运势时间轴</SectionTitle>
              <div className="report-timeline">
                {timeline.map((t, i) => (
                  <div key={`${t.period}-${i}`} className="report-timeline-item">
                    <div className="report-timeline-dot" style={{ ['--c' as string]: DIM_COLORS[i % DIM_COLORS.length] }} />
                    <div className="report-timeline-period">{t.period}</div>
                    <div className="report-timeline-overview">{t.overview || '—'}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card variant="side">
            <SectionTitle icon="trending-up">近期趋势展望</SectionTitle>
            {!hasBirth && <div className="report-empty">填写出生信息后生成。</div>}
            {hasBirth && summary === 'loading' && <OmLoading label="正在推演近期趋势…" mode="inline" />}
            {hasBirth && summary === 'error' && (
              <div className="report-error">⚠️ 趋势生成失败。<Button variant="ghost" onClick={() => loadSummaryAgent(question)}>重试</Button></div>
            )}
            {hasBirth && summary && summary !== 'loading' && summary !== 'error' && (
              <div className="trend-outlook">{summary.data.outlook || '暂无趋势数据。'}</div>
            )}
          </Card>
          <Card variant="side" className="report-donate-card">
            <SectionTitle icon="heart-handshake">随喜供养</SectionTitle>
            <div className="report-donate-text">
              报告生成消耗 AI Token & 排盘算力。<br/>
              一分心意，一份功德；<strong className="tc-gold">不供养也能完整查看本报告</strong>。
            </div>
            <div className="pricing-cards report-donate-pricing">
              {DONATION_TIERS.map((t) => (
                <div
                  key={t.name}
                  role="button"
                  tabIndex={0}
                  className={'pricing-card' + (donateTier === t.name ? ' selected' : '')}
                  onClick={() => setDonateTier(t.name)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDonateTier(t.name); }
                  }}
                >
                  <div className="pricing-name">{t.name}</div>
                  <div className="pricing-price">{t.label}</div>
                  {t.recommend && <div className="pricing-period">推荐</div>}
                </div>
              ))}
            </div>
            <Button variant="member" onClick={handleDonate}>微信支付 · 随喜供养</Button>
          </Card>
        </div>
      </div>
      <Modal open={showShare} onClose={()=>setShowShare(false)} variant="share" icon="📤" title="分享你的自我觉察报告">
        <div className="share-options">
          {/* 微信/朋友圈无 JS SDK，统一走「复制文案」：用户粘贴即可发送 */}
          <div className="share-option" role="button" tabIndex={0} onClick={handleCopyText}
               onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); void handleCopyText(); }}}>
            <span className="share-icon">💬</span><span className="share-label">复制给好友</span>
          </div>
          <div className="share-option" role="button" tabIndex={0} onClick={handleCopySocial}
               onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); void handleCopySocial(); }}}>
            <span className="share-icon">📷</span><span className="share-label">朋友圈文案</span>
          </div>
          <div className="share-option" role="button" tabIndex={0} onClick={()=>{ setShowShare(false); void handlePoster(); }}
               onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); setShowShare(false); void handlePoster(); }}}>
            <span className="share-icon">🐦</span><span className="share-label">生成长图</span>
          </div>
          <div className="share-option" role="button" tabIndex={0} onClick={handleCopyLink}
               onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); void handleCopyLink(); }}}>
            <span className="share-icon">🔗</span><span className="share-label">复制链接</span>
          </div>
        </div>
        <div className="share-hint">微信/朋友圈需手动粘贴；复制链接可让对方直接打开同一次推演。</div>
        <Button variant="submit" onClick={()=>setShowShare(false)}>完成</Button>
      </Modal>

      {/* 导出面板：统一封装的导出组件（MD / Word / PNG / PDF 四选一，点击直接下载） */}
      <ExportReportModal
        open={exportPanelOpen}
        onClose={()=>setExportPanelOpen(false)}
        title={`综合自我觉察报告 · ${question || '整体运势'}`}
        markdown={buildReportMarkdown()}
      />

      {/* 分享长图：复用 AI 服务 /api/v1/poster，与数字密码页同款 */}
      <Modal open={posterOpen} onClose={()=>setPosterOpen(false)} icon="🐦" title="分享长图">
        {posterLoading && <div className="poster-loading">⏳ 正在生成分享长图…</div>}
        {!posterLoading && poster && (
          <div className="poster-result">
            {poster.imageUrl
              ? <img className="poster-img" src={poster.imageUrl} alt="分享长图" loading="lazy" decoding="async" />
              : <div className="report-empty">图片生成不可用，可复制下方文案分享。</div>}
            <div className="poster-text">{poster.shareText}</div>
            <div className="poster-actions">
              {poster.imageUrl && (
                <Button variant="ghost" onClick={() => printDocument({
                  title: '综合报告海报',
                  html: `<img src="${poster.imageUrl}" alt="分享长图" />`,
                })}>⬇️ 导出 PDF</Button>
              )}
              <Button variant="ghost" onClick={async () => {
                const ok = await copyText(poster.shareText);
                showToast(ok ? '文案已复制' : '复制失败，请重试', ok ? 'success' : 'error');
              }}>📋 复制文案</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 云端存档详情 —— 此前列表项只渲染标题、点了没反应，存档等于存了看不了 */}
      <Modal
        open={detailOpen}
        onClose={()=>setDetailOpen(false)}
        icon="📋"
        title={reportDetail?.title || '排盘详情'}
      >
        {detailLoading && <div className="poster-loading">⏳ 正在加载存档…</div>}
        {!detailLoading && !reportDetail && (
          <div className="report-error">⚠️ 存档加载失败，请稍后重试。</div>
        )}
        {!detailLoading && reportDetail && (
          <>
            {/* #15 报告时效提示：流年流月变化后旧结论可能不再适用 */}
            {daysSince(reportDetail.created_at) >= REPORT_STALE_DAYS && (
              <div className="report-stale-note">
                ⏳ 此报告生成于 <strong>{daysSince(reportDetail.created_at)} 天前</strong>（{(reportDetail.created_at || '').slice(0, 10)}），
                流年流月已变化，建议重新推演获取最新运势。
              </div>
            )}
            {/* #12 版本切换：「换个说法」的历史版本可来回回溯 */}
            {versions.length > 1 && (
              <div className="report-versions">
                <div className="report-versions-head">
                  <span>🔄 历史版本（{versions.length}）</span>
                  {versionsLoading && <span className="report-versions-hint">加载中…</span>}
                </div>
                <div className="report-versions-list">
                  {versions.map((v, i) => (
                    <button
                      key={v.id}
                      type="button"
                      className={'report-version-chip' + (v.id === reportDetail.id ? ' active' : '')}
                      onClick={() => void openReportDetail(v.id)}
                    >
                      {i === 0 ? '初版' : `第 ${v.variant ?? i} 次改版`}
                      <span className="report-version-date">{(v.created_at || '').slice(5, 10)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {renderReportBody(reportDetail)}
            {renderAnnotations(reportDetail)}
            <div className="poster-actions">
              <Button variant="ghost" onClick={() => printDocument({
                title: reportDetail.title || '排盘存档',
                html: mdToHtml(`# ${reportDetail.title || '排盘存档'}\n\n- 类型：${typesLabel(reportDetail.types)}\n- 时间：${(reportDetail.created_at || '').slice(0, 10)}\n\n${renderReportPlain(reportDetail)}`),
              })}>⬇️ 导出 PDF</Button>
              <Button variant="ghost" onClick={async () => {
                const ok = await copyText(`${reportDetail.title}\n${renderReportPlain(reportDetail)}`);
                showToast(ok ? '存档内容已复制' : '复制失败，请重试', ok ? 'success' : 'error');
              }}>📋 复制内容</Button>
            </div>
          </>
        )}
      </Modal>

      {/* 历史对比弹层：叠加两份存档的六维雷达，并给出共识分与分维差值 */}
      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        icon="⇄"
        title="历史报告对比"
      >
        {compareLoading && <div className="poster-loading">⏳ 正在加载对比数据…</div>}
        {!compareLoading && !compareData && (
          <div className="report-error">⚠️ 对比数据加载失败，请稍后重试。</div>
        )}
        {!compareLoading && compareData && compareData.length === 2 && (
          <ReportCompareBody data={compareData} />
        )}
      </Modal>

      {/* 随喜供养（#1）：下单 → 收款引导 → 轮询状态 → 成功页 */}
      <Modal open={donateOpen} onClose={closeDonate} icon="🙏" title="随喜供养">
        {!donation && (
          <div className="report-donate">
            <div className="report-donate-amount">
              供养金额：<strong className="tc-gold">¥{(DONATION_TIERS.find((t) => t.name === donateTier)?.fen ?? 0) / 100}</strong>
              <span className="report-donate-tier">（{donateTier}）</span>
            </div>
            <div className="pricing-cards report-donate-pricing">
              {DONATION_TIERS.map((t) => (
                <div
                  key={t.name}
                  role="button"
                  tabIndex={0}
                  className={'pricing-card' + (donateTier === t.name ? ' selected' : '')}
                  onClick={() => setDonateTier(t.name)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDonateTier(t.name); }
                  }}
                >
                  <div className="pricing-name">{t.name}</div>
                  <div className="pricing-price">{t.label}</div>
                  {t.recommend && <div className="pricing-period">推荐</div>}
                </div>
              ))}
            </div>
            <div className="report-donate-tip">
              一分心意，一份功德。<strong>不供养也能完整查看本报告</strong>，供养纯属自愿。
            </div>
            <Button variant="member" disabled={donateLoading} onClick={() => void handleCreateDonation()}>
              {donateLoading ? '正在生成订单…' : '确认供养'}
            </Button>
          </div>
        )}
        {donation && (
          <div className="report-donate">
            {donation.status === 'paid' ? (
              <div className="report-donate-success">
                <div className="report-donate-success-icon">🙏</div>
                <div className="report-donate-success-title">感恩供养，功德无量</div>
                <div className="report-donate-success-amount">¥{donation.amountYuan}</div>
                <div className="report-donate-tip">玄镜将一直免费开放，愿你所愿皆成。</div>
              </div>
            ) : donation.status === 'expired' ? (
              <div className="report-donate-expired">
                <div>⌛ 订单已过期</div>
                <Button variant="ghost" onClick={() => { setDonation(null); void handleCreateDonation(); }}>重新发起</Button>
              </div>
            ) : (
              <>
                <div className="report-donate-amount">
                  应付：<strong className="tc-gold">¥{donation.amountYuan}</strong>
                  <span className="report-donate-tier">（{donation.tier}）</span>
                </div>
                {donation.payUrl ? (
                  <div className="report-donate-qr">
                    {/* 真实渠道返回收款码图片；stub 渠道无图，展示文案引导 */}
                    <img src={donation.payUrl} alt="收款码" />
                    <div className="report-donate-qr-tip">请用微信扫码支付</div>
                  </div>
                ) : (
                  <div className="report-donate-qr report-donate-qr-stub">
                    <div className="report-donate-qr-placeholder">{donation.qrText}</div>
                    <div className="report-donate-qr-tip">支付通道正在接入中，订单已记录</div>
                  </div>
                )}
                {donation.message && <div className="report-donate-tip">{donation.message}</div>}
                <div className="report-donate-order">
                  订单号 {donation.outTradeNo}
                  <span className="report-donate-poll">{donation.status === 'pending' ? '⏳ 等待支付结果…' : donation.status}</span>
                </div>
              </>
            )}
            <div className="poster-actions">
              <Button variant="ghost" onClick={closeDonate}>关闭</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 跨报告趋势（#9）：六维共识分随时间的演变，回答「我的运势在变好吗」 */}
      <Modal open={trendOpen} onClose={() => setTrendOpen(false)} icon="📈" title="运势趋势">
        <TrendBody
          reports={cloudReports ?? []}
          visitorId={visitorId}
          onOpenDetail={(id) => { setTrendOpen(false); void openReportDetail(id); }}
        />
      </Modal>

      {/* 专业工具：真太阳时校正 + 合婚合盘（补齐报告页「专业度」缺口） */}
    </div>
  );
}

/** 从云端存档里抽取六维共识（用于历史对比雷达叠加，模块级复用） */
function extractDims(d: ReportDetail): { label: string; score: number; reason?: string }[] {
  const rep = d.results?.report as any;
  const raw = rep?.consensus;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((dm: any) => dm && typeof dm.label === 'string' && Number.isFinite(Number(dm.score)))
    .map((dm: any) => ({ label: String(dm.label), score: Number(dm.score), reason: dm.reason ? String(dm.reason) : '' }));
}

/** 历史对比弹层正文：叠加两份存档的六维雷达，并给出共识分与分维差值 */
function ReportCompareBody({ data }: { data: ReportDetail[] }) {
  const [da, db] = data;
  const dimsA = extractDims(da);
  const dimsB = extractDims(db);
  const scoreOf = (dims: { score: number }[]) =>
    dims.length ? Math.round(dims.reduce((s, x) => s + x.score, 0) / dims.length) : null;
  const sa = scoreOf(dimsA);
  const sb = scoreOf(dimsB);
  const delta = sa != null && sb != null ? sa - sb : null;

  // #6：文本层面的对比（概述 / 趋势 / 共振发现 / 行动建议）
  const fa = flattenReport(da);
  const fb = flattenReport(db);
  const newOnly = fb.findings.filter((x) => !fa.findings.includes(x));
  const goneOnly = fa.findings.filter((x) => !fb.findings.includes(x));
  return (
    <div className="report-compare">
      <ReportRadar dims={dimsA} compareDims={dimsB} compareLabel={db.title.slice(0, 8)} />
      <div className="report-compare-summary">
        <div className="report-compare-score">
          <span>{da.title.slice(0, 10) || '报告A'}</span>
          <strong>{sa ?? '—'}</strong>
        </div>
        <div className="report-compare-delta">
          共识分差
          <strong className={delta != null && delta !== 0 ? (delta > 0 ? 'up' : 'down') : ''}>
            {delta == null ? '—' : delta > 0 ? `+${delta}` : `${delta}`}
          </strong>
        </div>
        <div className="report-compare-score">
          <span>{db.title.slice(0, 10) || '报告B'}</span>
          <strong>{sb ?? '—'}</strong>
        </div>
      </div>
      <div className="report-compare-table">
        {dimsA.map((a) => {
          const b = dimsB.find((x) => x.label === a.label);
          const bd = b ? b.score : null;
          const dd = bd != null ? a.score - bd : null;
          return (
            <div key={a.label} className="report-compare-row">
              <span className="report-compare-dim">{a.label}</span>
              <span className="report-compare-val">{a.score}</span>
              <span className="report-compare-val">{bd ?? '—'}</span>
              <span className={'report-compare-diff' + (dd != null && dd !== 0 ? (dd > 0 ? ' up' : ' down') : '')}>
                {dd == null ? '—' : dd > 0 ? `+${dd}` : `${dd}`}
              </span>
            </div>
          );
        })}
      </div>
      <div className="report-compare-legend">紫 = 第一份　青 = 第二份；右列「差」= 第一份 − 第二份</div>
      {/* #6：对比不只比分数，还给结论文本的增减与调整 */}
      <div className="report-compare-text">
        {textDiffBlock('综合概述', fa.summary, fb.summary)}
        {textDiffBlock('近期趋势', fa.outlook, fb.outlook)}
        <div className="report-compare-block">
          <div className="report-compare-block-title">🔗 跨术数共振发现</div>
          <div className="report-compare-cols">
            <div className="report-compare-col">
              <div className="report-compare-col-head">{da.title.slice(0, 12)}（{fa.findings.length}）</div>
              {fa.findings.length ? fa.findings.map((x, i) => <div key={i} className="report-compare-line">· {x}</div>) : <div className="report-compare-line dim">无</div>}
            </div>
            <div className="report-compare-col">
              <div className="report-compare-col-head">{db.title.slice(0, 12)}（{fb.findings.length}）</div>
              {fb.findings.length ? fb.findings.map((x, i) => <div key={i} className="report-compare-line">· {x}</div>) : <div className="report-compare-line dim">无</div>}
            </div>
          </div>
          {(newOnly.length > 0 || goneOnly.length > 0) && (
            <div className="report-compare-delta-list">
              {newOnly.map((x, i) => <div key={`n${i}`} className="report-compare-line up">＋ 新增：{x}</div>)}
              {goneOnly.map((x, i) => <div key={`g${i}`} className="report-compare-line down">－ 消失：{x}</div>)}
            </div>
          )}
        </div>
        {(fa.advice.length > 0 || fb.advice.length > 0) && (
          <div className="report-compare-block">
            <div className="report-compare-block-title">✅ 行动建议</div>
            <div className="report-compare-cols">
              <div className="report-compare-col">
                <div className="report-compare-col-head">{da.title.slice(0, 12)}</div>
                {fa.advice.map((x, i) => <div key={i} className="report-compare-line">· {x}</div>)}
              </div>
              <div className="report-compare-col">
                <div className="report-compare-col-head">{db.title.slice(0, 12)}</div>
                {fb.advice.map((x, i) => <div key={i} className="report-compare-line">· {x}</div>)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 对比弹层里的「文本前后对比」小区块 */
function textDiffBlock(title: string, a: string, b: string) {
  if (!a && !b) return null;
  const same = a && b && a === b;
  return (
    <div className="report-compare-block">
      <div className="report-compare-block-title">
        {title}{same && <span className="report-compare-same">未变化</span>}
      </div>
      <div className="report-compare-cols">
        <div className="report-compare-col"><div className="report-compare-line">{a || '—'}</div></div>
        <div className="report-compare-col"><div className="report-compare-line">{b || '—'}</div></div>
      </div>
    </div>
  );
}

/** 把报告里的关键结论拍平成一行行文本，用于对比 */
function flattenReport(d: ReportDetail) {
  const r = (d.results?.report || {}) as Partial<SummaryOutput>;
  const findings = (Array.isArray(r.keyFindings) ? r.keyFindings : []).filter((x) => typeof x === 'string' && x.trim());
  const advice: string[] = [];
  (Array.isArray(r.advice) ? r.advice : []).forEach((col) => {
    (col.items || []).forEach((it) => advice.push(it));
  });
  return {
    summary: String(r.summary || '').trim(),
    outlook: String(r.outlook || '').trim(),
    findings,
    advice,
  };
}

/** 跨报告趋势（#9）：六维共识分随时间的变化曲线 */
function TrendBody({
  reports,
  visitorId,
  onOpenDetail,
}: {
  reports: ReportListItem[];
  visitorId: string;
  onOpenDetail: (id: number) => void;
}) {
  const [series, setSeries] = useState<
    { id: number; title: string; date: string; dims: { label: string; score: number }[] }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  /** 参与趋势的维度：默认全部六维，太多线时用户可只留关注的 */
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    // 只取综合报告（含 consensus 六维），最多 12 份，避免一次拉太多详情
    const targets = reports.filter((r) => r.types.includes('report')).slice(0, 12);
    if (targets.length < 2) {
      setSeries([]);
      setLoading(false);
      return () => { cancelled = true; };
    }
    setLoading(true);
    setErr(false);
    Promise.all(targets.map((r) => fetchReport(r.id, visitorId)))
      .then((details) => {
        if (cancelled) return;
        const mapped = details
          .map((d) => ({ id: d.id, title: d.title, date: d.created_at, dims: extractDims(d) }))
          .filter((x) => x.dims.length > 0)
          .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
        setSeries(mapped);
      })
      .catch(() => { if (!cancelled) setErr(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // reports 每次刷新都是新数组，用 id 序列做依赖避免重复拉取
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports.map((r) => r.id).join(','), visitorId]);

  if (loading) return <div className="poster-loading">⏳ 正在计算趋势…</div>;
  if (err) return <div className="report-error">⚠️ 趋势数据加载失败，请稍后重试。</div>;
  if (series.length < 2) {
    return (
      <div className="report-empty">
        至少需要 2 份综合报告才能看趋势。当前可用于趋势分析的报告不足 2 份。
      </div>
    );
  }

  const labels = series[series.length - 1].dims.map((d) => d.label);
  const W = 640;
  const H = 260;
  const PAD_L = 36;
  const PAD_B = 40;
  const PAD_T = 16;
  const innerW = W - PAD_L - 16;
  const innerH = H - PAD_B - PAD_T;
  const x = (i: number) => PAD_L + (series.length === 1 ? innerW / 2 : (innerW * i) / (series.length - 1));
  // Y 轴固定在 40~100：运势分本身的合理区间，跨报告可比（自适应会让微小波动看起来很剧烈）
  const y = (v: number) => PAD_T + innerH * (1 - (Math.min(100, Math.max(40, v)) - 40) / 60);

  const avgOf = (dims: { score: number }[]) =>
    dims.length ? Math.round(dims.reduce((s, d) => s + d.score, 0) / dims.length) : 0;
  const first = avgOf(series[0].dims);
  const last = avgOf(series[series.length - 1].dims);
  const delta = last - first;

  return (
    <div className="report-trend">
      <div className="report-trend-summary">
        <span>共 {series.length} 份综合报告</span>
        <span className="report-trend-delta">
          共识分 {first} → <strong>{last}</strong>
          <strong className={delta !== 0 ? (delta > 0 ? 'up' : 'down') : ''}>
            {delta > 0 ? ` ↑${delta}` : delta < 0 ? ` ↓${Math.abs(delta)}` : ' 持平'}
          </strong>
        </span>
      </div>
      <svg className="report-trend-svg" viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="六维共识分趋势">
        {/* 网格与刻度 */}
        {[40, 55, 70, 85, 100].map((v) => (
          <g key={v}>
            <line x1={PAD_L} y1={y(v)} x2={W - 16} y2={y(v)} stroke="#e5e7eb" strokeWidth="1" />
            <text x={4} y={y(v) + 4} fontSize="10" fill="#9ca3af">{v}</text>
          </g>
        ))}
        {series.map((s, i) => (
          <text key={s.id} x={x(i)} y={H - 18} fontSize="10" fill="#6b7280" textAnchor="middle">
            {(s.date || '').slice(5, 10)}
          </text>
        ))}
        {labels.map((label, li) => {
          if (hidden[label]) return null;
          const color = DIM_COLORS[li % DIM_COLORS.length];
          const pts = series
            .map((s, i) => {
              const dim = s.dims.find((d) => d.label === label);
              return dim ? `${x(i)},${y(dim.score)}` : null;
            })
            .filter(Boolean) as string[];
          if (!pts.length) return null;
          return (
            <g key={label}>
              <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
              {pts.map((p, i) => {
                const [cx, cy] = p.split(',');
                return <circle key={i} cx={cx} cy={cy} r="3" fill={color} />;
              })}
            </g>
          );
        })}
      </svg>
      <div className="report-trend-legend">
        {labels.map((label, li) => (
          <button
            key={label}
            type="button"
            className={'report-trend-legend-item' + (hidden[label] ? ' off' : '')}
            style={{ ['--c' as string]: DIM_COLORS[li % DIM_COLORS.length] }}
            onClick={() => setHidden((h) => ({ ...h, [label]: !h[label] }))}
          >
            <span className="report-trend-dot" />{label}
          </button>
        ))}
      </div>
      <div className="report-trend-list">
        {series.map((s, i) => (
          <button key={s.id} type="button" className="report-trend-item" onClick={() => onOpenDetail(s.id)}>
            <span className="report-trend-item-date">{(s.date || '').slice(0, 10)}</span>
            <span className="report-trend-item-score">{avgOf(s.dims)}</span>
            <span className="report-trend-item-title">{s.title}</span>
            {i === series.length - 1 && <span className="report-trend-item-latest">最新</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 云端存档纯文本（导出/复制用，与弹层渲染内容保持一致） */
function renderReportPlain(d: ReportDetail): string {
  const report = d.results?.report as Partial<SummaryOutput> | undefined;
  if (report) {
    const L: string[] = [];
    if (d.results?.question) L.push(`问题：${d.results.question}`);
    if (Array.isArray(d.results?.contrib) && d.results.contrib.length) {
      L.push(`融合术数：${(d.results.contrib as string[]).map((m) => MODULE_LABELS[m] || m).join('、')}`);
    }
    if (report.summary) L.push('', '## 综合概述', report.summary);
    if (Array.isArray(report.keyFindings) && report.keyFindings.length) {
      L.push('', '## 跨术数共振发现');
      report.keyFindings.forEach((f) => L.push(`- ${f}`));
    }
    if (Array.isArray(report.divergences) && report.divergences.length) {
      L.push('', '## 术数分歧与调和');
      report.divergences.forEach((dv: any) => {
        L.push(`- ${dv.desc || ''}`);
        if (Array.isArray(dv.modules) && dv.modules.length) L.push(`  涉及：${dv.modules.map((m: unknown) => MODULE_LABELS[String(m)] || String(m)).join('、')}`);
        if (dv.resolution) L.push(`  调和：${dv.resolution}`);
      });
    }
    if (Array.isArray(report.consensus) && report.consensus.length) {
      L.push('', '## 六维共识评分');
      report.consensus.forEach((c: any) => L.push(`- ${c.label || '—'}：${c.score ?? '—'}${c.reason ? `（${c.reason}）` : ''}`));
    }
    if (report.outlook) L.push('', '## 近期趋势展望', report.outlook);
    if (Array.isArray(report.advice) && report.advice.length) {
      L.push('', '## AI 综合行动建议');
      report.advice.forEach((col) => {
        L.push(`### ${col.title || '建议'}`);
        (col.items || []).forEach((it) => L.push(`- ${it}`));
      });
    }
    return L.filter((x) => x !== '' || true).join('\n');
  }
  const tarot = d.results?.tarot as
    | { spreadName?: string; question?: string; text?: string; cards?: { pos: string; name: string; isRev: boolean }[] }
    | undefined;
  if (tarot) {
    const cards = (tarot.cards || []).map((c) => `- ${c.pos}：${c.isRev ? '逆位' : '正位'}·${c.name}`).join('\n');
    return [
      `牌阵：${tarot.spreadName || '—'}`,
      `问题：${tarot.question || '（未填写）'}`,
      cards,
      tarot.text || '',
    ].filter(Boolean).join('\n');
  }
  return [
    `${typesLabel(d.types)} · ${(d.created_at || '').slice(0, 10)}`,
    Object.keys(d.results || {}).join('、') || '该存档没有可展示的结果数据',
  ].join('\n');
}

/** 云端存档正文：综合报告有专属渲染（复用主视图样式），塔罗有专属渲染（牌面 + 解读全文），其余类型退化为 results 摘要 */
function renderReportBody(d: ReportDetail) {
  const report = d.results?.report as Partial<SummaryOutput> | undefined;
  if (report) {
    const rq = typeof d.results?.question === 'string' ? d.results.question : '';
    const contrib = Array.isArray(d.results?.contrib) ? (d.results!.contrib as string[]) : [];
    const dims = (Array.isArray(report.consensus) ? report.consensus : [])
      .filter((dm: any) => dm && typeof dm.label === 'string' && Number.isFinite(Number(dm.score)))
      .map((dm: any) => ({ label: String(dm.label), score: Number(dm.score), reason: dm.reason ? String(dm.reason) : '' }));
    const findings = (Array.isArray(report.keyFindings) ? report.keyFindings : []).filter((x) => typeof x === 'string' && x.trim());
    const divergences: SummaryDivergence[] = (Array.isArray(report.divergences) ? report.divergences : [])
      .filter((dv: any) => dv && typeof dv.desc === 'string' && dv.desc.trim())
      .map((dv: any) => ({
        desc: String(dv.desc).trim(),
        modules: Array.isArray(dv.modules) ? dv.modules.map((m: unknown) => String(m)) : [],
        resolution: dv.resolution ? String(dv.resolution).trim() : '',
      }));
    return (
      <div className="report-detail-body">
        {(rq || contrib.length > 0) && (
          <div className="report-detail-meta">
            {rq && <span>问题：{rq}</span>}
            {contrib.length > 0 && <span>融合：{contrib.map(moduleLabel).join('、')}</span>}
          </div>
        )}
        {report.summary && (
          <div className="verify-summary">
            {sanitizeAiText(String(report.summary)).split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
          </div>
        )}
        {findings.length > 0 && (
          <div className="report-findings">
            <div className="report-findings-title">🔗 跨术数共振发现</div>
            {findings.map((f, i) => (
              <div key={i} className="report-finding-item">
                <span className="report-finding-icon">✓</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        )}
        {divergences.length > 0 && (
          <div className="report-divergence">
            <div className="report-divergence-title">⚖️ 术数分歧与调和</div>
            {divergences.map((dv, i) => (
              <div key={i} className="report-divergence-item">
                <div className="report-divergence-desc">{dv.desc}</div>
                {dv.modules.length > 0 && (
                  <div className="report-divergence-modules">
                    {dv.modules.map((m) => <span key={m} className="report-divergence-chip">{MODULE_LABELS[m] || m}</span>)}
                  </div>
                )}
                {dv.resolution && (
                  <div className="report-divergence-resolution"><strong>调和：</strong>{dv.resolution}</div>
                )}
              </div>
            ))}
          </div>
        )}
        {dims.length > 0 && (
          <div className="report-consensus">
            <div className="report-consensus-title">六维共识评分</div>
            <div className="report-consensus-grid">
              {dims.map((dim) => {
                const color = dim.score >= 85 ? '#4ade80' : dim.score >= 75 ? '#d4a853' : '#ff6b6b';
                return (
                  <div key={dim.label} className="report-consensus-item">
                    <div className="report-consensus-head">
                      <span className="report-consensus-label">{dim.label}</span>
                      <span className="report-consensus-score" style={{ ['--c' as string]: color }}>{dim.score}</span>
                    </div>
                    <Progress value={dim.score} color={color} trackClass="verify-bar-bg" fillClass="verify-bar-fill" />
                            {dim.reason && <div className="report-consensus-reason">{dim.reason}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {report.outlook && <div className="trend-outlook">{report.outlook}</div>}
        {Array.isArray(report.advice) && report.advice.length > 0 && (
          <div className="stack">
            {report.advice.map((col, ci) => (
              <div key={ci} className="advice-group">
                <div className="advice-group-title">{col.title}</div>
                <div className="stack">
                  {(col.items || []).map((it, ii) => (
                    <div key={ii} className="action-item">
                      <span className="action-badge">{col.title.slice(0, 4)}</span>
                      <span className="action-text">{it}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const tarot = d.results?.tarot as
    | { spreadName?: string; question?: string; text?: string; cards?: { pos: string; name: string; isRev: boolean }[] }
    | undefined;

  if (tarot) {
    return (
      <div className="report-detail-body">
        <div className="report-detail-meta">
          <span>牌阵：{tarot.spreadName || '—'}</span>
          <span>问题：{tarot.question || '（未填写）'}</span>
        </div>
        {!!tarot.cards?.length && (
          <div className="report-detail-cards">
            {tarot.cards.map((c, i) => (
              <span key={i} className="report-detail-chip">
                {c.pos}：{c.isRev ? '逆位' : '正位'}·{c.name}
              </span>
            ))}
          </div>
        )}
        {tarot.text && <div className="report-detail-text">{tarot.text}</div>}
      </div>
    );
  }

  // 三式 / 紫微盘式可视化（P2-5）：报告盘式按 module 类型分发渲染
  const panKinds = ['qimen', 'ziwei', 'liuren', 'taiyi'] as const;
  for (const kind of panKinds) {
    const pd = (d.results as Record<string, unknown> | undefined)?.[kind];
    if (pd && typeof pd === 'object') {
      return (
        <div className="report-detail-body">
          <ReportPanChart kind={kind} data={pd} />
        </div>
      );
    }
  }

  // 八字存档：渲染传统四柱盘式（P2-3），补齐此前只有文本摘要的缺口
  const bazi = d.results?.bazi as import('@/components/report/BaziChart').BaziChartData | undefined;
  if (bazi?.pillars?.length) {
    return (
      <div className="report-detail-body">
        <BaziChart data={bazi} />
        <div className="report-detail-meta">
          <span>日主：{bazi.dayMaster || '—'}（{bazi.dayMasterWuxing || '—'}）</span>
          {bazi.qiyun?.age !== undefined && <span>起运：{bazi.qiyun.age} 岁</span>}
          {bazi.shengxiao && <span>属{bazi.shengxiao}</span>}
        </div>
        {!!bazi.shensha?.length && (
          <div className="report-detail-cards">
            {bazi.shensha.slice(0, 8).map((s, i) => (
              <span key={i} className="report-detail-chip">
                {s.name}
                {s.zhi ? `·${s.zhi}` : ''}
                {s.pillar ? `（${s.pillar}）` : ''}
              </span>
            ))}
          </div>
        )}
        {bazi.analysis && <div className="report-detail-text">{bazi.analysis}</div>}
      </div>
    );
  }

  return (
    <div className="report-detail-body">
      <div className="source-meta">
        {typesLabel(d.types)} · {(d.created_at || '').slice(0, 10).replace(/-/g, '/')}
      </div>
      <div className="report-detail-text">
        {Object.keys(d.results || {}).join('、') || '该存档没有可展示的结果数据'}
      </div>
    </div>
  );
}
