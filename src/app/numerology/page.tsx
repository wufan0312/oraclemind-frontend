'use client';

import '@/styles/numerology.scss';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Solar } from 'lunar-typescript';
import { solarToLunarParts } from '@/lib/lunar';
import SectionIcon from '@/components/ui/SectionIcon';
// numerology 出生日期统一走 BirthDatePicker（内建公历/农历双模式）；旧 DatePicker 不再直接使用
import BirthDatePicker from '@/components/ui/BirthDatePicker';
import OmLoading from '@/components/ui/OmLoading';
import { useVisitor } from '@/components/visitor/VisitorProvider';
import { getVisitorBirth } from '@/lib/visitor';
import { calculateNumerology, requestInterpretStream, requestPoster, saveReport, fetchReports, fetchReport, type NumerologyAPIResult, type InterpretMeta, type PaipanRequest, type PosterResult } from '@/lib/api';
import LightFollowUp from '@/components/ai-chat/LightFollowUp';
import { mdToHtml, sanitizeAiText } from '@/lib/markdown';
import { printDocument } from '@/lib/print';
import { parseAiSections, type AiSection } from '@/lib/aiSections';
import Modal from '@/components/ui/Modal';
import { showToast } from '@/components/ui/Toast';
import {
  NUM_DATA, YEAR_MEANING, YEAR_GUIDE, NUM_COLORS, NUM_HEX, MONTH_GUIDE, DAY_GUIDE, digitalRoot, numGridCounts,
  computeCore, computeSynastry, computeLingCode, CHALLENGE_DATA, CORE_META,
  type NumDetail, type NumCore, type SynastryResult, type LingCode,
} from '@/data/numerologyData';
import { pushCrossReading } from '@/lib/crossReadings';
import { storage, registerLegacy } from '@/lib/storage';
import { setCloudItem, removeCloudItem } from '@/lib/cloudStore';
import AngelNumberCard from '@/components/numerology/AngelNumberCard';

// ===== 计算模型（与原型 app.js calculateNumerology 一致） =====
interface YearInfo { yr: number; py: number; tag: string; isCurrent: boolean }
interface NumResult {
  lifePath: number;
  birthdayNum: number;
  counts: Record<number, number>;
  missing: number[];
  years: YearInfo[];
  data: NumDetail;
  /** 出生月/日（农历口径，与流年同源），供流月/流日计算；老云存档可能缺失 */
  bm?: number;
  bd?: number;
  /** 核心数字（老云存档可能缺失，渲染时需容错） */
  core?: NumCore;
}

/** 流年跨度：覆盖一个完整数字周期 1-9（与后端 YEAR_SPAN 一致） */
const YEAR_SPAN = 9;

function computeNum(y: number, m: number, d: number, name = ''): NumResult {
  // keepMaster=true：生命灵数保留 11/22/33 大师数不化简
  const lifePath = digitalRoot(y + m + d, true);
  const birthdayNum = digitalRoot(d, true);
  const counts = numGridCounts(y, m, d);
  const missing = Object.keys(counts).filter(k => counts[+k] === 0).map(Number);
  const now = new Date().getFullYear();
  const years: YearInfo[] = Array.from({ length: YEAR_SPAN }, (_, i) => {
    const yr = now + i;
    const sum = m + d + String(yr).split('').reduce((a, b) => a + +b, 0);
    const py = digitalRoot(sum);
    return { yr, py, tag: YEAR_MEANING[py].split('：')[0], isCurrent: i === 0 };
  });
  return { lifePath, birthdayNum, counts, missing, years, data: NUM_DATA[lifePath], bm: m, bd: d, core: computeCore(y, m, d, lifePath, name) };
}

// 默认日期为空：让用户主动填写，不再预填样例生日
const DEFAULT_SOLAR = '';

const SAMPLES = [
  { solar: '1995-06-15', name: '李小龙' },
  { solar: '1994-08-04', name: '王菲' },
  { solar: '2001-02-04', name: '周杰伦' },
];

// 数字小知识（原型静态 5 条）
const NUM_FACTS = [
  { icon: '🧮', html: '「数字根」：所有数字逐位相加到个位数，就是这个数字的<strong class="tc-text-primary">灵魂</strong>——所以 38 和 11 都是 2' },
  { icon: '🌟', html: '11 / 22 / 33 是<strong class="tc-text-primary">大师数</strong>，能量翻倍不化简 —— 本页已原生支持（如生命灵数算到 11，则展示大师数解读）' },
  { icon: '🪐', html: '灵数与行星对应：1 太阳 · 2 月亮 · 3 木星 · 4 天王星 · 5 水星 · 6 金星 · 7 海王星 · 8 土星 · 9 火星' },
  { icon: '🏛️', html: '源头是毕达哥拉斯的<strong class="tc-text-primary">「万物皆数」</strong>——古希腊人认为数字是宇宙的底层语言' },
  { icon: '🎨', html: '缺哪个数字可以补哪个颜色：缺 3 补橙 · 缺 6 补蓝 · 缺 8 补红' }
];

// 洛书（Lo Shu）排列：3×3 网格的数字位置（非 1-9 顺序）
const LO_SHU_ORDER = [4, 9, 2, 3, 5, 7, 8, 1, 6];
// 数字在 30×30 SVG viewBox 中的中心坐标（grid 为 square，gap:0 + cell 对称 margin 使中心恰在 1/3 处）
const CELL_CENTER: Record<number, [number, number]> = {
  4: [5, 5], 9: [15, 5], 2: [25, 5],
  3: [5, 15], 5: [15, 15], 7: [25, 15],
  8: [5, 25], 1: [15, 25], 6: [25, 25],
};
// 天赋连线：组成数字全部出现（count>0）才点亮
const TALENT_LINES: { key: string; nums: number[]; label: string; meaning: string }[] = [
  { key: 'think', nums: [4, 9, 2], label: '思维线', meaning: '理性清晰、条理分明，擅长分析规划' },
  { key: 'feel', nums: [3, 5, 7], label: '情感线', meaning: '感受力丰富，直觉与情绪流动顺畅' },
  { key: 'act', nums: [8, 1, 6], label: '行动线', meaning: '执行力强，能把想法稳稳落地' },
  { key: 'will', nums: [4, 3, 8], label: '意志线', meaning: '内在坚定，目标感与韧性强' },
  { key: 'wisdom', nums: [9, 5, 1], label: '智慧线', meaning: '洞察本质，知行合一的灵性通道' },
  { key: 'art', nums: [2, 7, 6], label: '艺术线', meaning: '审美与表达天赋，富有创造力' },
  { key: 'plan', nums: [4, 5, 6], label: '规划线', meaning: '擅长布局与长远安排，谋定后动' },
  { key: 'balance', nums: [2, 5, 8], label: '平衡线', meaning: '能在矛盾间找到中道，收放自如' },
];

/** 挑战数四项的展示顺序与阶段说明 */
const CHALLENGE_ROWS: { key: 'c1' | 'c2' | 'c3' | 'c4'; label: string; stage: string }[] = [
  { key: 'c1', label: '第一挑战', stage: '早年 · 0-35 岁' },
  { key: 'c2', label: '第二挑战', stage: '中年 · 35-55 岁' },
  { key: 'c3', label: '第三挑战', stage: '贯穿一生 · 底层课题' },
  { key: 'c4', label: '第四挑战', stage: '对外 · 面对世界的方式' },
];

// ===== 本地测算历史（N2）：云存档只恢复「最近一条」，历史快照让用户回看任意一次 =====
const HISTORY_KEY = 'om_numerology_history';
const HISTORY_LIMIT = 6;
const HISTORY_SCHEMA = 1;
// P2-1：旧键（om-numerology-history）惰性迁移到新键
registerLegacy('om-numerology-history', HISTORY_KEY);

/** 相对时间：历史列表只关心「多久以前」，精确到分钟足够，不显示绝对时间戳 */
function fmtAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}

/** 一次测算的完整本地快照（本命 / 配对共用同一结构，历史回放 = 刷新生效的同一套字段） */
interface NumSnapshot {
  /** 数据结构版本：读取时按版本丢弃旧结构，避免脏数据串场 */
  v: number;
  ts: number;
  mode: 'natal' | 'synastry';
  solarDate: string;
  name: string;
  partnerDate: string;
  partnerName: string;
  result: NumResult;
  partnerResult: NumResult | null;
  synastry: SynastryResult | null;
}

/** 当前日期 YYYY-MM-DD（客户端本地时间，仅用于「无访客缓存时」的兜底默认值） */
function todayStr(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function NumerologyPage() {
  const { birth, setBirth, visitorId } = useVisitor();
  /** 顶部模式：本命解读 / 数字配对 */
  const [mode, setMode] = useState<'natal' | 'synastry'>('natal');

  /** 公历生日 YYYY-MM-DD（与 horoscope / bugua 一致；后端按公历→农历转换后的农历年月日计算） */
  const [solarDate, setSolarDate] = useState('');
  /** 中文姓名（可选，用于表现数 / 内驱数 / 人格数 / 成熟数） */
  const [name, setName] = useState('');

  const [result, setResult] = useState<NumResult | null>(null);
  const [detailNum, setDetailNum] = useState<number>(0);
  const [introOpen, setIntroOpen] = useState(true);
  const [error, setError] = useState('');
  /** 计算来源：loading=排盘中 / online=后端排盘服务 / local=降级本地算法 / idle=尚未计算 */
  const [calcMode, setCalcMode] = useState<'idle' | 'loading' | 'online' | 'local'>('idle');
  /** 流年 tab 选中索引（0 = 今年） */
  const [activeYearIdx, setActiveYearIdx] = useState(0);
  /** 流月/流日周期切换（G2） */
  const [periodMode, setPeriodMode] = useState<'year' | 'month' | 'day'>('year');
  /** 流月 tab 选中索引（0 = 1 月） */
  const [activeMonthIdx, setActiveMonthIdx] = useState(() => new Date().getMonth());
  /** 流日偏移（0 = 今天，最多 +6） */
  const [dayOffset, setDayOffset] = useState(0);
  /** 云端存档恢复记录（展示提示条） */
  const [restoredRec, setRestoredRec] = useState<{ id: number; at: string } | null>(null);
  const restoredRef = useRef(false);

  // ===== 数字配对（P2-1）=====
  const [partnerDate, setPartnerDate] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [partnerResult, setPartnerResult] = useState<NumResult | null>(null);
  const [synastry, setSynastry] = useState<SynastryResult | null>(null);
  const [syncCalcMode, setSyncCalcMode] = useState<'idle' | 'loading' | 'online' | 'local'>('idle');

  // ===== AI 解读 =====
  const [aiText, setAiText] = useState('');
  const [aiMeta, setAiMeta] = useState<InterpretMeta | null>(null);
  const [aiDisclaimer, setAiDisclaimer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  /** 「换个说法」计数：作为 focus 的一部分传入，既换缓存键又指导 AI 换角度 */
  const [aiSalt, setAiSalt] = useState(0);
  const aiAbortRef = useRef<AbortController | null>(null);
  const MANDATORY_DISCLAIMER = '以上内容由 AI 生成，仅供娱乐与传统文化参考，不构成任何决策、医疗、法律或投资依据。';

  // ===== 分享海报（G1：补齐 P2-2 的图片导出）=====
  const [poster, setPoster] = useState<PosterResult | null>(null);
  const [posterLoading, setPosterLoading] = useState(false);
  /** 海报弹层开关：生成中也要打开，让用户在弹层里看到「生成中」而不是干等 */
  const [posterOpen, setPosterOpen] = useState(false);

  // 今日数（个人日灵数）：当年月日数字之和化到个位，让「今日数字能量」真正随日期变化
  const dayNumber = useMemo(() => {
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    return digitalRoot(ymd.split('').reduce((a, c) => a + Number(c), 0));
  }, []);

  /** 解析公历生日取出生月/日（农历口径由 result.bm/bd 提供，这里仅作兜底） */
  const parseSolarMD = (s: string): { m: number; d: number } => {
    const p = s?.split('-');
    if (p?.length === 3) {
      const m = +p[1], d = +p[2];
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return { m, d };
    }
    return { m: 0, d: 0 };
  };

  // 流月 / 流日（G2）：与流年同源的 Personal Year/Month/Day 时序体系
  //   流月数 = digitalRoot(出生月 + 出生日 + 当前年 + 当前月)
  //   流日数 = digitalRoot(出生月 + 出生日 + 当前年 + 当前月 + 当前日)
  const periodData = useMemo(() => {
    if (!result) return null;
    const bmd = result.bm != null && result.bd != null
      ? { m: result.bm, d: result.bd }
      : parseSolarMD(solarDate);
    if (!bmd.m || !bmd.d) return null;
    const now = new Date();
    const yr = now.getFullYear();
    const curMo = now.getMonth() + 1;
    const months = Array.from({ length: 12 }, (_, i) => {
      const mo = i + 1;
      const pm = digitalRoot(bmd.m + bmd.d + yr + mo);
      return { mo, pm, isCurrent: mo === curMo, guide: MONTH_GUIDE[pm] };
    });
    const days = Array.from({ length: 7 }, (_, k) => {
      const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k);
      const pd = digitalRoot(bmd.m + bmd.d + dt.getFullYear() + (dt.getMonth() + 1) + dt.getDate());
      return { date: dt, pd, isToday: k === 0, guide: DAY_GUIDE[pd] };
    });
    return { months, days, curMo };
  }, [result, solarDate]);

  /** 复制色值到剪贴板（G4 补色卡） */
  const copyHex = (hex: string) => {
    try { navigator.clipboard?.writeText(hex); } catch { /* 忽略：剪贴板不可用时仅视觉反馈 */ }
  };

  // 首页小玄引导跳转：?q= 带来的问题，顶部提示条承接
  const [incomingQ, setIncomingQ] = useState('');

  /**
   * 公历 'YYYY-MM-DD' → 农历年月日。
   * 统一复用 @/lib/lunar 的单一实现（避免本页与 bugua/fengshui 各自重复实现导致口径漂移）。
   * 内部毕达哥拉斯计算（生命灵数/九宫格/流年）仍按农历年月日入参，与历史原型 app.js 的 NUM_DATA 行为一致。
   */
  const solarToLunar = solarToLunarParts;

  /** 把当前公历生日写回访客档案（展开已有 birth，保留 province/city/gender/lat/lng/time） */
  const syncBirthToVisitor = (solar: string) => {
    if (!solar) return;
    setBirth({ ...birth, date: solar, time: birth?.time || '不详' });
  };

  // ===== URL 状态持久化（P2-5）：生日 / 姓名 / 模式 / 配对入参都进地址栏 =====
  const urlReadyRef = useRef(false);
  /** 挂载时 URL 自带的 d/pd（若有）：用户没改过就原样保留，避免「分享链接进来 → 参数被清空」 */
  const urlInitialRef = useRef<{ d: string; pd: string }>({ d: '', pd: '' });
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get('q');
    if (q) setIncomingQ(q);
    const d = sp.get('d');
    const n = sp.get('n');
    const m = sp.get('mode');
    const pd = sp.get('pd');
    const pn = sp.get('pn');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setSolarDate(d);
    if (n) setName(n);
    if (pd && /^\d{4}-\d{2}-\d{2}$/.test(pd)) setPartnerDate(pd);
    if (pn) setPartnerName(pn);
    if (m === 'synastry') setMode('synastry');
    urlInitialRef.current = { d: d ?? '', pd: pd ?? '' };
    // 清掉 ?q=，其余参数保留在地址栏里供刷新恢复
    if (q) {
      sp.delete('q');
      const rest = sp.toString();
      window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : ''));
    }
    urlReadyRef.current = true;
  }, []);

  // 参数变化后回写地址栏（首次挂载前不写，避免覆盖刚读到的状态）
  // 仅「用户主动操作」后才把生日写进 URL，避免默认（缓存/今天）被自动写回、造成粘性假默认
  const userTouchedRef = useRef(false);
  /** 用户是否手动改过「对方出生日期」：区分「刷新恢复」与「正在输入」，避免刚选完日期就被自动配对打断 */
  const partnerTouchedRef = useRef(false);
  useEffect(() => {
    if (!urlReadyRef.current) return;
    // 防止首次渲染（URL init 的 setState 尚未 flush）就把地址栏参数清掉
    if (solarDate === '' && name === '' && partnerDate === '' && partnerName === '' && mode === 'natal') return;
    const sp = new URLSearchParams();
    // 用户主动改过 → 写当前值；没改过但 URL 本就有该参数（分享链接进入）→ 原样保留，可刷新恢复
    if (solarDate && (userTouchedRef.current || urlInitialRef.current.d === solarDate)) sp.set('d', solarDate);
    if (name.trim()) sp.set('n', name.trim());
    if (mode === 'synastry') {
      sp.set('mode', 'synastry');
      if (partnerDate && (userTouchedRef.current || urlInitialRef.current.pd === partnerDate)) sp.set('pd', partnerDate);
      if (partnerName.trim()) sp.set('pn', partnerName.trim());
    }
    const qs = sp.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, [solarDate, name, mode, partnerDate, partnerName]);

  // 默认出生日期（仅挂载时一次）：URL 参数 > 访客缓存 > 今天
  // 直接同步读 localStorage / 当前 URL，避免依赖尚未 flush 的 state（URL 参数 setSolarDate 不会立即生效）
  const defaultDateSetRef = useRef(false);
  useEffect(() => {
    if (defaultDateSetRef.current) return;
    defaultDateSetRef.current = true;
    // URL 自带 d 时直接尊重 URL，不注入默认（避免把 URL 分享结果覆盖成今天）
    if (new URLSearchParams(window.location.search).has('d')) return;
    if (solarDate) return;
    const cached = getVisitorBirth();
    if (cached?.date) {
      setSolarDate(cached.date);
    } else {
      setSolarDate(todayStr());
    }
  }, []);

  // 云存档恢复（照搬 bugua）：挂载后拉取该访客最近一条数字命理存档，直接重建结果，不重跑排盘
  const [restoreSettled, setRestoreSettled] = useState(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    // 同步置 settled：StrictMode 下 effect 会双调用，若只依赖异步 finally 会在第二次提前 return 后永远不触发，
    // 导致首屏自动出盘卡死。同步置位可保证 auto-calc 一定触发；查到云存档会在下方覆盖 result。
    setRestoreSettled(true);
    if (!visitorId) { return; }
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchReports(visitorId, 5);
        if (cancelled) return;
        const rec = list?.find((r) => (r.types || []).includes('numerology')) || list?.[0];
        if (!rec) return;
        const detail = await fetchReport(rec.id, visitorId);
        if (cancelled) return;
        const r = detail?.results?.numerology as NumResult | undefined;
        if (!r || typeof r.lifePath !== 'number') return;
        const params = (detail.params ?? {}) as Record<string, unknown>;
        const solar = params.solar as string | undefined;
        const savedName = params.name as string | undefined;
        // G3 恢复：合盘存档里另存了对方命盘 + 契合度（老存档没有这两个字段，需容错）
        const partner = (detail.results as Record<string, unknown> | undefined)?.partner as NumResult | undefined;
        const syn = (detail.results as Record<string, unknown> | undefined)?.synastry as SynastryResult | undefined;
        const partnerSolar = params.partnerSolar as string | undefined;
        const partnerSavedName = params.partnerName as string | undefined;
        const hasSynastry = !!(partner && syn && partnerSolar);
        const urlSp = new URLSearchParams(window.location.search);
        // 已有 URL 参数时以 URL 为准（用户可能是点分享链接进来的）
        if (urlSp.has('d')) {
          // 但 URL 只带「本人」生日，合盘时对方信息仍要从云存档补回，否则刷新后配对内容全丢
          if (hasSynastry && urlSp.get('mode') === 'synastry' && !urlSp.has('pd')) {
            setPartnerDate(partnerSolar as string);
            if (partnerSavedName) setPartnerName(partnerSavedName);
            setPartnerResult(partner as NumResult);
            setSynastry(syn as SynastryResult);
          }
          return;
        }
        if (solar) setSolarDate(solar);
        if (savedName) setName(savedName);
        setResult(r);
        setDetailNum(r.lifePath);
        setCalcMode('online');
        if (hasSynastry) {
          setMode('synastry');
          setPartnerDate(partnerSolar as string);
          if (partnerSavedName) setPartnerName(partnerSavedName);
          setPartnerResult(partner as NumResult);
          setSynastry(syn as SynastryResult);
        }
        setRestoredRec({ id: rec.id, at: rec.created_at });
      } catch {
        // 静默回退：保留默认结果
      } finally {
        if (!cancelled) setRestoreSettled(true);
      }
    })();
    return () => { cancelled = true; };
  }, [visitorId]);

  // 首屏自动出盘：存档恢复流程结束后仍无结果 → 用默认日期（URL > 访客缓存 > 今天）自动算一次，
  // 保证未登录 / 新访客首屏就能看到灵码、生命灵数、核心数字与流年运势（auto 模式不写档案、不落云存档）
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (autoRanRef.current) return;
    if (!restoreSettled) return;
    if (result) return;
    if (!solarDate) return;
    autoRanRef.current = true;
    void calculate({ auto: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreSettled, result, solarDate]);

  const runAiInterpret = useCallback(async (payload: unknown, focus?: string) => {
    aiAbortRef.current?.abort();
    const ac = new AbortController();
    aiAbortRef.current = ac;
    setAiLoading(true);
    setAiText('');
    setAiMeta(null);
    setAiDisclaimer('');
    try {
      await requestInterpretStream('numerology', payload, {
        signal: ac.signal,
        focus,
        onDelta: (_chunk, full) => setAiText(full),
        onMeta: (meta, disc) => {
          setAiMeta(meta);
          if (disc) setAiDisclaimer(disc);
        },
      });
    } catch {
      // 静默降级：保留静态结果，不暴露错误；免责声明仍兜底展示
    } finally {
      if (!ac.signal.aborted) setAiLoading(false);
    }
  }, []);

  // AI 解读文本 → 结构化小节：概述作通栏强调卡，其余进 2 列卡片网格
  // 后端 formatter 固定输出 `**标题**\n\n正文`，流式期间是已格式化 Markdown 的前缀，逆解析安全
  const aiSections = useMemo(() => {
    const all = parseAiSections(aiText);
    const leadIdx = all.findIndex((s) => /概述|总结|总览/.test(s.title));
    if (leadIdx >= 0) {
      return { lead: all[leadIdx], rest: all.filter((_, i) => i !== leadIdx) };
    }
    // 无明确「概述」小节时：首个无标题块（引言）作 lead，其余进网格
    const first = all[0];
    if (first && !first.title) {
      return { lead: first, rest: all.slice(1) };
    }
    return { lead: null as AiSection | null, rest: all };
  }, [aiText]);

  // 计算结果 / 模式变化（含首屏默认结果）自动触发 AI 解读
  useEffect(() => {
    if (mode === 'synastry') {
      if (synastry && result && partnerResult) {
        void runAiInterpret(
          { mode: 'synastry', a: result, b: partnerResult, synastry },
          // focus 以 'synastry' 开头 → AI 端切到合盘专属输出结构（换个说法时也要保留该前缀）
          aiSalt > 0 ? `synastry | 换个说法（第 ${aiSalt} 次）：换一个切入点、换一批例子，重新解读这对组合` : 'synastry'
        );
      }
      return;
    }
    if (result) {
      void runAiInterpret(result, aiSalt > 0 ? `换个说法（第 ${aiSalt} 次）：换一个切入点、换一批例子重新解读` : undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, mode, synastry, partnerResult, aiSalt, runAiInterpret]);

  // 计算成功后落云端存档（按访客ID隔离，失败静默不打断用户）
  const persistResult = (res: NumResult, solar: string, lunar: { ly: number; lm: number; ld: number }) => {
    if (!visitorId) return;
    void saveReport({
      visitorId,
      title: `生命灵数 ${res.lifePath} · ${res.data?.name ?? ''}`,
      params: { type: 'numerology', solar, name: name.trim() || undefined, year: lunar.ly, month: lunar.lm, day: lunar.ld } as PaipanRequest,
      results: { numerology: res },
    }).catch(() => {});
  };

  /** 数字配对结果落云存档（G3）：results.numerology 保留本人盘以兼容本命恢复，另存 partner + synastry */
  const persistSynastry = (
    self: NumResult, partner: NumResult, syn: SynastryResult,
    selfSolar: string, partnerSolar: string,
    selfLunar: { ly: number; lm: number; ld: number }, partnerLunar: { ly: number; lm: number; ld: number }
  ) => {
    if (!visitorId) return;
    void saveReport({
      visitorId,
      title: `数字配对 · 灵数${self.lifePath} × ${partner.lifePath}（契合度 ${syn.score}）`,
      params: {
        type: 'numerology', solar: selfSolar, name: name.trim() || undefined,
        partnerSolar, partnerName: partnerName.trim() || undefined,
        year: selfLunar.ly, month: selfLunar.lm, day: selfLunar.ld,
      } as PaipanRequest,
      results: { numerology: self, partner, synastry: syn },
    }).catch(() => {});
  };

  /** 统一的「在线优先 + 本地降级」排盘（本命与配对共用） */
  const runPaipan = useCallback(async (
    solar: string,
    who: 'self' | 'partner'
  ): Promise<{ res: NumResult; mode: 'online' | 'local' }> => {
    const lunar = solarToLunar(solar);
    if (!lunar) throw new Error('日期格式不正确');
    const { ly, lm, ld } = lunar;
    const nm = who === 'self' ? name : partnerName;
    try {
      const r = await calculateNumerology(ly, lm, ld, nm);
      const res: NumResult = {
        lifePath: r.lifePath,
        birthdayNum: r.birthdayNum,
        counts: r.counts as unknown as Record<number, number>,
        missing: r.missing,
        years: r.years,
        data: r.data,
        bm: lm, bd: ld,
        core: r.core,
      };
      return { res, mode: 'online' };
    } catch {
      // 后端不可达 → 本地算法（离线可用，结果与在线一致）
      return { res: computeNum(ly, lm, ld, nm), mode: 'local' };
    }
  }, [name, partnerName]);

  const calculate = async (opts?: { auto?: boolean }) => {
    const auto = opts?.auto === true;
    if (!solarDate) { if (!auto) setError('请选择出生日期'); return; }
    if (!solarToLunar(solarDate)) { if (!auto) setError('日期格式不正确'); return; }
    setError('');
    // 自动出盘（首屏演示）不写访客档案、不算用户主动操作，避免默认日期被误存成生日
    if (!auto) {
      syncBirthToVisitor(solarDate);
      userTouchedRef.current = true;
    }
    setCalcMode('loading');
    const { res, mode: m } = await runPaipan(solarDate, 'self');
    setResult(res);
    setDetailNum(res.lifePath);
    setCalcMode(m);
    pushCrossReading({ type: 'numerology', label: '数字密码', summary: `生命灵数 ${res.lifePath} · ${res.data?.name ?? ''}（天赋：${res.data?.talent ?? ''}）` });
    if (!auto) {
      const lunar = solarToLunar(solarDate)!;
      persistResult(res, solarDate, { ly: lunar.ly, lm: lunar.lm, ld: lunar.ld });
      persistSnapshot({ mode: 'natal', solarDate, name, partnerDate: '', partnerName: '', result: res, partnerResult: null, synastry: null });
      setRestoredRec(null);
      setPoster(null);
      setAiSalt(0);
    }
  };

  const sample = async (s: { solar: string; name: string }) => {
    setSolarDate(s.solar);
    setName(s.name);
    userTouchedRef.current = true;
    syncBirthToVisitor(s.solar);
    const lunar = solarToLunar(s.solar);
    if (!lunar) return;
    setCalcMode('loading');
    // 注意：这里不能用闭包里的 solarDate/name（setState 异步，会拿到旧值），直接用样例值
    try {
      const r = await calculateNumerology(lunar.ly, lunar.lm, lunar.ld, s.name);
      const res: NumResult = {
        lifePath: r.lifePath, birthdayNum: r.birthdayNum,
        counts: r.counts as unknown as Record<number, number>,
        missing: r.missing, years: r.years, data: r.data, bm: lunar.lm, bd: lunar.ld, core: r.core,
      };
      setResult(res);
      setDetailNum(res.lifePath);
      setCalcMode('online');
      pushCrossReading({ type: 'numerology', label: '数字密码', summary: `生命灵数 ${res.lifePath} · ${res.data?.name ?? ''}（天赋：${res.data?.talent ?? ''}）` });
      persistResult(res, s.solar, { ly: lunar.ly, lm: lunar.lm, ld: lunar.ld });
      persistSnapshot({ mode: 'natal', solarDate: s.solar, name: s.name, partnerDate: '', partnerName: '', result: res, partnerResult: null, synastry: null });
    } catch {
      const local = computeNum(lunar.ly, lunar.lm, lunar.ld, s.name);
      setResult(local);
      setDetailNum(local.lifePath);
      setCalcMode('local');
      pushCrossReading({ type: 'numerology', label: '数字密码', summary: `生命灵数 ${local.lifePath} · ${local.data?.name ?? ''}` });
      persistResult(local, s.solar, { ly: lunar.ly, lm: lunar.lm, ld: lunar.ld });
      persistSnapshot({ mode: 'natal', solarDate: s.solar, name: s.name, partnerDate: '', partnerName: '', result: local, partnerResult: null, synastry: null });
    }
    setRestoredRec(null);
    setPoster(null);
    setAiSalt(0);
  };

  /** 数字配对：双方各排一次盘，再算契合度 */
  const runSynastry = async () => {
    if (!solarDate || !partnerDate) { setError('请填写双方的出生日期'); return; }
    setError('');
    // 用户主动配对：标记后才会把双方生日写进 URL，刷新时靠 URL 恢复（与 calculate() 口径一致）
    userTouchedRef.current = true;
    setSyncCalcMode('loading');
    try {
      const [a, b] = await Promise.all([runPaipan(solarDate, 'self'), runPaipan(partnerDate, 'partner')]);
      setResult(a.res);
      setPartnerResult(b.res);
      setSyncCalcMode(a.mode === 'online' && b.mode === 'online' ? 'online' : 'local');
      // 老存档兼容：core 缺失时按当前入参补算挑战数，避免合盘拿到 undefined
      const ca = a.res.core ?? computeCore(0, 0, 0, a.res.lifePath, '');
      const cb = b.res.core ?? computeCore(0, 0, 0, b.res.lifePath, '');
      const syn = computeSynastry(
        { lifePath: a.res.lifePath, challenge: ca.challenge, counts: a.res.counts },
        { lifePath: b.res.lifePath, challenge: cb.challenge, counts: b.res.counts }
      );
      setSynastry(syn);
      setAiSalt(0);
      setPoster(null);
      // G3：合盘结果落云存档（含双方命盘 + 契合度，不影响本命恢复）
      const selfL = solarToLunar(solarDate);
      const partnerL = solarToLunar(partnerDate);
      if (selfL && partnerL) persistSynastry(a.res, b.res, syn, solarDate, partnerDate, selfL, partnerL);
      persistSnapshot({
        mode: 'synastry', solarDate, name,
        partnerDate, partnerName,
        result: a.res, partnerResult: b.res, synastry: syn,
      });
    } catch {
      setSyncCalcMode('idle');
      setError('配对计算失败，请检查日期后重试');
    }
  };

  // 刷新后自动补算合盘：URL / 云存档只能恢复双方生日，契合度是「计算结果」不会进 URL，
  // 所以本命自动出盘之外，合盘也要有同等的自动重算兜底，否则换回配对 tab 只剩空表单。
  const synastryAutoRanRef = useRef(false);
  useEffect(() => {
    if (synastryAutoRanRef.current) return;
    if (!restoreSettled) return;
    if (mode !== 'synastry') return;
    if (!solarDate || !partnerDate) return;
    if (synastry) return; // 云存档已直接恢复出契合度，无需重算
    if (partnerTouchedRef.current) return; // 用户正在手动填，交给「开始配对」按钮，不抢戏
    synastryAutoRanRef.current = true;
    void runSynastry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreSettled, mode, solarDate, partnerDate, synastry]);

  // ===== 导出报告（P2-2）=====
  const exportReport = () => {
    if (!result) return;
    const lines: string[] = [];
    if (mode === 'synastry' && synastry && partnerResult) {
      lines.push('# 数字配对合盘报告');
      lines.push('');
      lines.push(`- 甲方：${solarDate}${name.trim() ? ` · ${name.trim()}` : ''}　生命灵数 ${result.lifePath}（${result.data.name}）`);
      lines.push(`- 乙方：${partnerDate}${partnerName.trim() ? ` · ${partnerName.trim()}` : ''}　生命灵数 ${partnerResult.lifePath}（${partnerResult.data.name}）`);
      lines.push(`- 契合度：**${synastry.score} / 100** —— ${synastry.headline}`);
      lines.push('');
      lines.push('## 契合度拆解');
      synastry.dims.forEach((d) => lines.push(`- ${d.label}：${d.score}/${d.max} —— ${d.desc}`));
      lines.push('');
      lines.push('## 优势');
      synastry.strengths.forEach((s) => lines.push(`- ${s}`));
      lines.push('');
      lines.push('## 需注意');
      synastry.frictions.forEach((s) => lines.push(`- ${s}`));
    } else {
      lines.push('# 数字密码 · 生命灵数报告');
      lines.push('');
      lines.push(`出生日期：${solarDate}${name.trim() ? `　姓名：${name.trim()}` : ''}`);
      lines.push(`生命灵数：**${result.lifePath} · ${result.data.name}**${result.lifePath > 9 ? '（大师数）' : ''}`);
      lines.push(`关键词：${result.data.keywords}`);
      lines.push(`天赋：${result.data.talent}　人生课题：${result.data.lesson}`);
      lines.push(`适配职业：${result.data.career}　合拍数字：${result.data.mate}`);
      lines.push(`正位能量：${result.data.posi}　阴影面：${result.data.nega}`);
      lines.push(`幸运色：${result.data.color}`);
      lines.push('');
      lines.push('## 九宫格能量分布');
      LO_SHU_ORDER.forEach((_, i) => {
        const n = [4, 9, 2, 3, 5, 7, 8, 1, 6][i];
        lines.push(`- ${n}：${result.counts[n]} 次`);
      });
      lines.push(`缺失数字：${result.missing.length ? result.missing.join('、') : '无（能量均衡）'}`);
      const activeLines = TALENT_LINES.filter((l) => l.nums.every((x) => (result.counts[x] ?? 0) > 0));
      lines.push(`天赋连线：${activeLines.length ? activeLines.map((l) => `${l.label}（${l.meaning}）`).join('；') : '暂未凑齐任一条'}`);
      if (result.core) {
        lines.push('');
        lines.push('## 核心数字');
        const c = result.core;
        if (c.expression != null) lines.push(`- 表现数 Expression：**${c.expression}** —— ${NUM_DATA[c.expression].name}，${NUM_DATA[c.expression].talent}`);
        if (c.soulUrge != null) lines.push(`- 内驱数 Soul Urge：**${c.soulUrge}** —— ${NUM_DATA[c.soulUrge].name}，内心真正渴望：${NUM_DATA[c.soulUrge].keywords}`);
        if (c.personality != null) lines.push(`- 人格数 Personality：**${c.personality}** —— ${NUM_DATA[c.personality].name}，外界印象：${NUM_DATA[c.personality].posi}`);
        if (c.maturity != null) lines.push(`- 成熟数 Maturity：**${c.maturity}** —— ${NUM_DATA[c.maturity].name}（生命灵数 + 表现数）`);
        lines.push('');
        lines.push('## 挑战数');
        CHALLENGE_ROWS.forEach((r) => {
          const v = c.challenge[r.key];
          lines.push(`- ${r.label}（${r.stage}）：${v} · ${CHALLENGE_DATA[v].name} —— ${CHALLENGE_DATA[v].desc}`);
        });
      }
      lines.push('');
      lines.push('## 未来流年');
      result.years.forEach((yi) => lines.push(`- ${yi.yr}${yi.isCurrent ? '（今年）' : ''}：流年数 ${yi.py} ${yi.tag}`));
      if (periodData) {
        const mi = periodData.months[periodData.months.findIndex((x) => x.isCurrent)];
        const di = periodData.days[0];
        if (mi) lines.push(`- 本月（${mi.mo}月）流月数 ${mi.pm} · ${MONTH_GUIDE[mi.pm]?.brief ?? ''}；本月行动：${(MONTH_GUIDE[mi.pm]?.actions ?? []).join('、')}`);
        if (di) lines.push(`- 今日流日数 ${di.pd} · ${DAY_GUIDE[di.pd]?.brief ?? ''}；宜：${(DAY_GUIDE[di.pd]?.dos ?? []).join('、')}；忌：${(DAY_GUIDE[di.pd]?.donts ?? []).join('、')}`);
      }
    }
    if (aiText) {
      lines.push('');
      lines.push('## 小玄说数');
      lines.push(aiText);
    }
    lines.push('');
    lines.push('> ' + (aiDisclaimer || MANDATORY_DISCLAIMER));
    const title = mode === 'synastry'
      ? `数字配对合盘报告 · ${solarDate}${partnerDate ? ` × ${partnerDate}` : ''}`
      : `数字密码 · 生命灵数 ${result.lifePath} 报告 · ${solarDate}`;
    printDocument({ title, html: mdToHtml(lines.join('\n')) });
  };

  // ===== 分享海报（G1）=====
  /** 拼接海报文案：本命用灵码 + 生命灵数；合盘用契合度三维 */
  const buildPosterText = (): string => {
    if (mode === 'synastry' && synastry && partnerResult && result) {
      const head = `数字配对 · 灵数${result.lifePath}(${result.data.name}) × ${partnerResult.lifePath}(${partnerResult.data.name})`;
      const dims = synastry.dims.map((d) => `${d.label} ${d.score}/${d.max}`).join('｜');
      const body = `契合度 ${synastry.score}/100 —— ${synastry.headline}\n${dims}`;
      return `${head}\n${body}\n${aiText ? aiText.replace(/\*\*/g, '') : ''}\n—— 玄镜 OracleMind`;
    }
    if (!result) return '数字密码 · 玄镜 OracleMind';
    const head = `生命灵数 ${result.lifePath} · ${result.data.name}${result.lifePath > 9 ? '（大师数）' : ''}`;
    const body = lingCode ? `灵码 ${lingCode.codeText}` : '';
    return `${head}\n${body}\n${aiText ? aiText.replace(/\*\*/g, '') : ''}\n—— 玄镜 OracleMind`;
  };

  /** 生成分享海报（调 AI 服务的 /api/v1/poster），失败本地兜底文案 */
  const handlePoster = async () => {
    if (!result) return;
    const kw = mode === 'synastry' && partnerResult
      ? `数字配对 · 灵数${result.lifePath} × ${partnerResult.lifePath}`
      : `生命灵数 ${result.lifePath}`;
    const text = buildPosterText();
    setPosterOpen(true); // 立刻弹出弹层，生成过程在弹层内可见
    setPosterLoading(true);
    setPoster(null);
    try {
      const p = await requestPoster(kw, text || (mode === 'synastry' ? '数字配对' : '数字密码'));
      setPoster(p);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setPoster({
        shareText: `「${kw}」—— 数字有灵，顺势而为。`,
        imagePrompt: '', imageUrl: null, imageError: e?.message || '生成失败', fallback: true,
      });
    } finally {
      setPosterLoading(false);
    }
  };

  /** 导出 AI 生成的海报为 PDF（图片内嵌，用户另存为 PDF） */
  const handleDownloadPoster = async () => {
    if (!poster?.imageUrl) return;
    const title = mode === 'synastry'
      ? `数字配对海报 · ${solarDate}${partnerDate ? ` × ${partnerDate}` : ''}`
      : `数字密码海报 · 生命灵数 ${result?.lifePath} · ${solarDate}`;
    printDocument({ title, html: `<img src="${poster.imageUrl}" alt="${title}" />` });
  };

  /** 复制海报里的文字描述 */
  const copyPosterText = () => {
    if (!poster?.shareText) return;
    try {
      navigator.clipboard?.writeText(poster.shareText);
      showToast('📋 海报文案已复制', 'success');
    } catch {
      showToast('复制失败，请手动选择文案', 'error');
    }
  };

  // ===== 本地测算历史（N2）：云存档只恢复「最近一条」，历史快照让用户回看任意一次 =====
  const [history, setHistory] = useState<NumSnapshot[]>([]);
  /** 历史列表弹层开关 */
  const [historyOpen, setHistoryOpen] = useState(false);
  // 挂载后从 localStorage 读取（不放进 useState 初始化：避免 SSR / CSR 首帧不一致触发 hydration 告警）
  useEffect(() => {
    try {
      const raw = storage.getItem(HISTORY_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw) as NumSnapshot[];
      // 版本不符或结构残缺（旧算法 / 坏数据）直接丢弃，避免脏数据串场
      if (Array.isArray(arr)) {
        const ok = arr.filter((s) => s && s.v === HISTORY_SCHEMA && s.result && typeof s.result.lifePath === 'number');
        if (ok.length) setHistory(ok);
      }
    } catch { /* ignore */ }
  }, []);

  /** 写入本地历史：同一入参（生日+姓名+模式+对方生日/姓名）原地刷新首条时间，否则新增，超限截断 */
  const persistSnapshot = (snap: Omit<NumSnapshot, 'v' | 'ts'>) => {
    try {
      const key = `${snap.mode}|${snap.solarDate}|${snap.name}|${snap.partnerDate}|${snap.partnerName}`;
      const head = history[0];
      const sameAsHead = head && `${head.mode}|${head.solarDate}|${head.name}|${head.partnerDate}|${head.partnerName}` === key;
      const next: NumSnapshot[] = [
        { ...snap, v: HISTORY_SCHEMA, ts: Date.now() },
        ...(sameAsHead ? history.slice(1) : history),
      ].slice(0, HISTORY_LIMIT);
      setCloudItem(HISTORY_KEY, JSON.stringify(next));
      setHistory(next);
    } catch {
      // localStorage 不可用（隐私模式等）：历史仅本次会话内有效，不阻塞主流程
    }
  };

  /** 删除单条历史 */
  const removeHistory = (ts: number) => {
    try {
      const next = history.filter((s) => s.ts !== ts);
      setCloudItem(HISTORY_KEY, JSON.stringify(next));
      setHistory(next);
      showToast('🗑️ 已删除该条记录', 'success');
    } catch { /* ignore */ }
  };

  /** 清空全部历史 */
  const clearHistory = () => {
    try {
      removeCloudItem(HISTORY_KEY);
      setHistory([]);
      setHistoryOpen(false);
      showToast('🗑️ 历史已清空', 'success');
    } catch { /* ignore */ }
  };

  /** 回放某次历史：回填全部字段。契合度 / AI 解读是「计算结果」，由既有 effect 随 result/mode 自动重新生成 */
  const restoreSnapshot = (snap: NumSnapshot) => {
    userTouchedRef.current = true; // 恢复结果写回 URL，刷新后可继续恢复（与手动计算同口径）
    setMode(snap.mode);
    setSolarDate(snap.solarDate);
    setName(snap.name);
    setPartnerDate(snap.partnerDate);
    setPartnerName(snap.partnerName);
    setResult(snap.result);
    setDetailNum(snap.result.lifePath);
    setPartnerResult(snap.partnerResult);
    setSynastry(snap.synastry);
    setCalcMode('online');
    setSyncCalcMode('idle');
    setError('');
    setRestoredRec(null);
    setPoster(null);
    setAiSalt(0);
    setHistoryOpen(false);
    showToast('🕘 已恢复该次测算', 'success');
  };

  // ===== 复制链接（N1）：显式按当前参数拼 URL —— 自动出盘不写地址栏时，也能分享到真实结果 =====
  const buildShareUrl = (): string => {
    const sp = new URLSearchParams();
    if (solarDate) sp.set('d', solarDate);
    if (name.trim()) sp.set('n', name.trim());
    if (mode === 'synastry') {
      sp.set('mode', 'synastry');
      if (partnerDate) sp.set('pd', partnerDate);
      if (partnerName.trim()) sp.set('pn', partnerName.trim());
    }
    const qs = sp.toString();
    return `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ''}`;
  };

  const copyShareUrl = () => {
    const url = buildShareUrl();
    try {
      navigator.clipboard?.writeText(url);
      showToast('🔗 链接已复制，好友打开即可看到同盘结果', 'success');
    } catch {
      // 剪贴板不可用（非 https / 无权限）：退回旧 API 兜底
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('🔗 链接已复制', 'success');
      } catch {
        showToast('复制失败，请手动复制地址栏链接', 'error');
      }
    }
  };

  const detail = result ? NUM_DATA[detailNum] : null;
  const colorTip = result
    ? result.missing.length
      ? '本命盘缺 ' + result.missing.join('、') + '，可针对性补色'
      : '本命盘 1-9 数字齐全，能量均衡'
    : '';

  /** 核心数字条目（姓名缺失时只展示挑战数） */
  const core = result?.core ?? null;
  const coreItems = core
    ? CORE_META.map((m) => ({ ...m, value: core[m.key] })).filter((it) => it.value != null)
    : [];
  /** 挑战数按数字分组：相同数字的多个阶段合并为一条，避免「三张一样」 */
  const challengeGroups = useMemo(() => {
    if (!core) return [];
    const byVal = new Map<number, typeof CHALLENGE_ROWS>();
    for (const r of CHALLENGE_ROWS) {
      const v = core.challenge?.[r.key];
      if (v == null) continue;
      const arr = byVal.get(v);
      if (arr) arr.push(r);
      else byVal.set(v, [r]);
    }
    return Array.from(byVal.entries()).map(([v, rows]) => ({ v, rows }));
  }, [core]);
  const activeLines = result
    ? TALENT_LINES.filter((l) => l.nums.every((x) => (result.counts[x] ?? 0) > 0))
    : [];

  /** 灵码：生命灵数 + 生日数 + 姓名四码 的组合码（纯展示，无额外请求） */
  const lingCode: LingCode | null = useMemo(
    () => (result ? computeLingCode(result.core, result.lifePath, result.birthdayNum) : null),
    [result]
  );
  /** 配对模式下对方的灵码 */
  const partnerLingCode: LingCode | null = useMemo(
    () => (mode === 'synastry' && partnerResult
      ? computeLingCode(partnerResult.core, partnerResult.lifePath, partnerResult.birthdayNum)
      : null),
    [mode, partnerResult]
  );
  // 流年 tab 越界保护（存档可能是旧版 5 年）
  const safeYearIdx = result?.years.length ? Math.min(activeYearIdx, result.years.length - 1) : 0;
  const safeMonthIdx = periodData ? Math.min(activeMonthIdx, periodData.months.length - 1) : 0;
  const safeDayIdx = periodData ? Math.min(dayOffset, periodData.days.length - 1) : 0;

  return (
    <div className="page active" id="page-numerology">
      <div className="page-header">
        <div>
          <div className="page-title">🔢 数字密码 · 生命灵数</div>
          <div className="page-subtitle">选择你的出生日期，解码你的天赋、课题与人生节奏</div>
        </div>
      </div>

      {incomingQ && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent-gold)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <span style={{ fontSize: 20, lineHeight: 1.2 }}>🌟</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 }}>小玄为你带来了一个问题</div>
            <div style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>{incomingQ}</div>
          </div>
          <button onClick={() => setIncomingQ('')} aria-label="关闭" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* 模式切换：本命解读 / 数字配对 */}
      <div className="num-mode-nav">
        <button type="button" className={'num-mode-btn' + (mode === 'natal' ? ' active' : '')} onClick={() => setMode('natal')}>
          🔢 本命解读
        </button>
        <button type="button" className={'num-mode-btn' + (mode === 'synastry' ? ' active' : '')} onClick={() => setMode('synastry')}>
          💞 数字配对
        </button>
      </div>

      {/* 输入 + 说明：单一圆角面板（表单样式对齐 horoscope 的 birth-form） */}
      <div className="num-top-panel">
        <div className="num-top-grid">
          <div className="birth-form num-form">
            <div className="birth-field num-field-title">
              {/* <label>{mode === 'natal' ? '选择你的出生日期' : '填写双方的出生日期'}</label> */}
            </div>
            <div className="birth-field num-field-solar">
              <label>{mode === 'natal' ? '出生日期' : '你的出生日期'}</label>
              <div className="num-date-hint">可填<strong>公历（阳历）</strong>或切换<strong>农历</strong>录入，生命灵数统一按<strong>农历</strong>计算</div>
              <BirthDatePicker
                value={{ date: solarDate }}
                onChange={(v) => { setSolarDate(v.date); userTouchedRef.current = true; syncBirthToVisitor(v.date); }}
                placeholder="选择公历日期"
                minYear={1900}
                maxYear={new Date().getFullYear()}
              />
            </div>
            <div className="birth-field num-field-name">
              <label>姓名（选填）</label>
              <input
                className="num-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="填中文名可解锁表现数 / 内驱数 / 人格数"
                maxLength={20}
              />
            </div>

            {mode === 'synastry' && (
              <>
                <div className="birth-field num-field-solar">
                  <label>对方出生日期</label>
                  <div className="num-date-hint">同样可填公历或切换农历录入</div>
                  <BirthDatePicker
                    value={{ date: partnerDate }}
                    onChange={(v) => { setPartnerDate(v.date); partnerTouchedRef.current = true; }}
                    placeholder="选择公历日期"
                    minYear={1900}
                    maxYear={new Date().getFullYear()}
                  />
                </div>
                <div className="birth-field num-field-name">
                  <label>对方姓名（选填）</label>
                  <input
                    className="num-name-input"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    placeholder="填中文名可解锁对方核心数字"
                    maxLength={20}
                  />
                </div>
              </>
            )}

            <div className="birth-submit">
              {error && <div className="form-error">⚠️ {error}</div>}
              {mode === 'natal' ? (
                <button className="btn-submit" onClick={() => calculate()} disabled={calcMode === 'loading'}>
                  {calcMode === 'loading' ? '🔮 生命灵数计算中…' : '🔢 计算生命灵数'}
                </button>
              ) : (
                <button className="btn-submit" onClick={runSynastry} disabled={syncCalcMode === 'loading'}>
                  {syncCalcMode === 'loading' ? '💞 配对计算中…' : '💞 开始配对'}
                </button>
              )}
              {mode === 'natal' && (
                <div className="num-samples-row">
                  <span className="num-sample-label">试试：</span>
                  {SAMPLES.map((s, i) => (
                    <span key={i} className="num-sample" onClick={() => sample(s)}>{s.solar}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 生命灵数是什么（可折叠，默认展开） */}
          <div className="num-intro">
            <div className="num-intro-head" onClick={() => setIntroOpen(!introOpen)}>
              <span>❓ 生命灵数是什么？怎么看懂结果</span>
              <span className="num-intro-toggle">{introOpen ? '▴ 收起' : '▾ 展开'}</span>
            </div>
            {introOpen && (
              <div className="num-intro-body">
                <p>🧮 <strong>怎么算：</strong>把出生年月日的所有数字逐位相加，直到得到 1~9 的个位数，就是你的「生命灵数」。例如 1988-12-09 → 1+9+8+8+1+2+0+9 = 38 → 3+8 = 11 → 1+1 = <strong>2</strong>。这个数字是你的核心天赋与课题密码。</p>
                <p>🗺️ <strong>怎么看：</strong>九宫格统计你出生日期里每个数字出现的次数——<strong className="tc-primary-light">出现 2 次以上</strong>代表能量突出，<strong className="tc-red">出现 0 次</strong>代表能量偏弱、是此生的补课方向（缺什么补什么，可结合颜色疗愈）。</p>
                <p>📅 <strong>流年怎么读：</strong>流年数 = 出生月 + 出生日 + 当年年份的各位数字之和，再化到个位。每个数字代表一种年度主题（如 7 内省年、8 收获年），帮你把握每年的节奏。</p>
                <p>🅰️ <strong>姓名数字：</strong>按毕达哥拉斯字母表（A=1…I=9 循环）把姓名拼音折算成数字：全名之和是<strong className="tc-text-primary">表现数</strong>（天生才能），元音之和是<strong className="tc-text-primary">内驱数</strong>（内心渴望），辅音之和是<strong className="tc-text-primary">人格数</strong>（外在印象）。</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 计算结果区 */}
      <div className="numerology-result fade-in">
        {result && (
          <>
        {restoredRec && (
          <div className="restored-bar">
            <span>☁️ 已加载最近一次数字密码存档（来自云端）{restoredRec.at ? ` · ${new Date(restoredRec.at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}` : ''}</span>
            <button type="button" onClick={() => { setRestoredRec(null); calculate(); }}>↻ 重新计算</button>
          </div>
        )}

        {/* 本地测算历史入口（N2）：localStorage 快照，可回看 / 切换多次测算 */}
        {history.length > 0 && (
          <button type="button" className="num-history-strip" onClick={() => setHistoryOpen(true)}>
            <span className="num-history-strip-main">
              🕘 历史记录 · 最近 {history.length} 次测算
              <span className="num-history-strip-sub">（{fmtAgo(history[0].ts)}）</span>
            </span>
            <span className="num-history-strip-cta">查看 / 回放 →</span>
          </button>
        )}

        {/* ===== 配对模式：契合度总览（通栏）===== */}
        {mode === 'synastry' && synastry && partnerResult && (
          <div className="result-card full-span num-synastry-card">
            <div className="result-card-title"><SectionIcon name="heart" /> 契合度分析 <span className="rc-title-sub">灵数同频 40 + 课题互补 30 + 能量补位 30</span></div>
            <div className="num-synastry-head">
              <div className="num-synastry-score">
                <div className="num-synastry-score-num">{synastry.score}</div>
                <div className="num-synastry-score-unit">/ 100</div>
              </div>
              <div className="num-synastry-summary">
                <div className="num-synastry-headline">{synastry.headline}</div>
                <div className="num-synastry-pair">
                  <span className="num-synastry-person">你 · 灵数 {result.lifePath}（{result.data.name}）</span>
                  <span className="num-synastry-x">×</span>
                  <span className="num-synastry-person">对方 · 灵数 {partnerResult.lifePath}（{partnerResult.data.name}）</span>
                </div>
              </div>
            </div>

            <div className="num-synastry-dims">
              {synastry.dims.map((d) => (
                <div key={d.key} className="num-sync-dim">
                  <div className="num-sync-dim-head">
                    <span className="num-sync-dim-label">{d.label}</span>
                    <span className="num-sync-dim-score">{d.score} / {d.max}</span>
                  </div>
                  <div className="num-sync-bar"><div className="num-sync-bar-fill" style={{ width: `${(d.score / d.max) * 100}%` }} /></div>
                  <div className="num-sync-dim-desc">{d.desc}</div>
                </div>
              ))}
            </div>

            <div className="num-synastry-lists">
              <div className="num-sync-list">
                <div className="num-guide-label">✨ 你们的优势</div>
                <ul className="num-guide-list">{synastry.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
              <div className="num-sync-list">
                <div className="num-guide-label warn">⚠️ 需要注意</div>
                <ul className="num-guide-list warn">{synastry.frictions.map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
            </div>
          </div>
        )}

        {/* ===== 灵码：核心数字组合码（通栏） ===== */}
        {lingCode && (
          <div className="result-card full-span num-lingcode-card">
            <div className="result-card-title">
              <SectionIcon name="hexagram" /> 你的灵码
              <span className="rc-title-sub">（生命灵数 + 生日数 + 姓名四码 → 一条代码 · 点击数字可切换详解）</span>
            </div>

            <div className="ling-str-row">
              <div className="ling-str">{lingCode.codeText}</div>
              <div className="ling-challenge">🧗 挑战 {lingCode.challengeText}</div>
            </div>

            <div className="ling-parts">
              {lingCode.parts.map((p) => (
                <div
                  key={p.abbr}
                  className={'ling-part' + (p.value == null ? ' ling-part-locked' : '')}
                  title={p.hint}
                  onClick={() => { if (p.value != null) setDetailNum(p.value); }}
                >
                  <span className="ling-abbr">{p.abbr}</span>
                  <span className="ling-val">{p.value ?? '?'}</span>
                  <span className="ling-label">{p.icon} {p.label}</span>
                </div>
              ))}
            </div>

            {lingCode.lockedCount > 0 && (
              <div className="ling-locked-tip">
                还有 {lingCode.lockedCount} 位未解锁 —— 填入<strong>中文姓名</strong>可解出表现数 / 内驱数 / 人格数 / 成熟数，灵码才完整。
              </div>
            )}

            <ul className="ling-readings">
              {lingCode.readings.map((r, i) => (
                <li key={i}>
                  <span className="ling-read-icon">{r.icon}</span>
                  <span className="ling-read-text">{r.text}</span>
                </li>
              ))}
            </ul>

            {mode === 'synastry' && partnerLingCode && (
              <div className="ling-partner">
                <span className="ling-partner-label">对方灵码</span>
                <span className="ling-partner-code">{partnerLingCode.codeText}</span>
                <span className="ling-partner-ch">挑战 {partnerLingCode.challengeText}</span>
              </div>
            )}
          </div>
        )}

        {/* 左：生命灵数 + 数字详解（单一圆角面板） */}
        <div className="num-result-panel">
          <div className="life-path-number">
            <div className="life-path-label">{mode === 'synastry' ? '你的生命灵数' : '你的生命灵数'}</div>
            <div className="life-path-big">{result.lifePath}</div>
            <div className="life-path-desc">
              <strong className="tc-text-primary">「{result.lifePath} · {result.data.name}」</strong>
              {result.lifePath > 9 && <span className="master-badge">大师数</span>}
              <br />
              {result.data.desc}
            </div>
            <div className="num-chips-row">
              <span className="num-chip num-chip-talent">🔑 天赋：{result.data.talent}</span>
              <span className="num-chip num-chip-lesson">🧘 课题：{result.data.lesson}</span>
              <span className="num-chip num-chip-birthday">🎯 生日数：{result.birthdayNum}</span>
            </div>
          </div>

          {/* 数字详解 */}
          {detail && (
            <div className="num-detail-box">
              <div className="result-card-title"><SectionIcon name="calculator" /> 数字详解 <span className="rc-title-sub">（点击九宫格或核心数字切换）</span></div>
              <div className="num-detail-head">
                <div className="num-detail-badge">{detailNum}</div>
                <div>
                  <div className="num-detail-name">数字 {detailNum} · {detail.name}</div>
                  <div className="num-detail-sub">{detail.element}元素 · 幸运色 {detail.color} · 关键词 {detail.keywords}</div>
                </div>
              </div>
              <div className="num-detail-grid">
                <div className="num-detail-item"><div className="k">✨ 天赋</div><div className="v">{detail.talent}</div></div>
                <div className="num-detail-item"><div className="k">🧘 人生课题</div><div className="v">{detail.lesson}</div></div>
                <div className="num-detail-item"><div className="k">💼 适配职业</div><div className="v">{detail.career}</div></div>
                <div className="num-detail-item"><div className="k">🤝 合拍数字</div><div className="v">{detail.mate}</div></div>
                <div className="num-detail-item"><div className="k">🌞 正位能量</div><div className="v">{detail.posi}</div></div>
                <div className="num-detail-item"><div className="k">🌑 阴影面</div><div className="v">{detail.nega}</div></div>
                <div className="num-detail-item num-detail-item-wide"><div className="k">🎨 颜色疗愈</div><div className="v">日常多穿/使用 {detail.color} 色系，能量叠加；{colorTip}</div></div>
              </div>
              <div className="num-detail-desc">{detail.desc} <strong>（点击九宫格其他数字可切换查看）</strong></div>
            </div>
          )}
        </div>

        {/* 右：九宫格能量分布（洛书排列 + 天赋连线） */}
        <div className="result-card result-card-col">
          <div className="result-card-title"><SectionIcon name="zap" /> 九宫格能量分布 <span className="rc-title-sub">（洛书排列 · 点亮的数字越多，连线越全）</span></div>
          <div className="grid-9-wrap">
            <div className="grid-9 grid-9-fill">
              {LO_SHU_ORDER.map((n) => {
                const c = result.counts[n];
                const cls = 'grid-cell' + (c > 0 ? ' active' : ' missing') + (detailNum === n ? ' selected' : '');
                return (
                  <div key={n} className={cls} onClick={() => setDetailNum(n)}>
                    <div className="grid-number">{n}</div>
                    <div className="grid-count">{c}次</div>
                  </div>
                );
              })}
            </div>
            {/* 天赋连线：仅当组成数字全部出现才点亮 */}
            <svg className="grid-9-lines" viewBox="0 0 30 30" preserveAspectRatio="none" aria-hidden="true">
              {TALENT_LINES.map((ln) => {
                const active = ln.nums.every((x) => (result.counts[x] ?? 0) > 0);
                const pts = ln.nums.map((x) => CELL_CENTER[x].join(',')).join(' ');
                return (
                  <polyline
                    key={ln.key}
                    className={'talent-line' + (active ? ' line-active' : '')}
                    points={pts}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
          </div>
          <div className="num-lines-legend">
            {activeLines.length === 0 ? (
              <div className="num-lines-hint">出生日期里暂未凑齐任一条天赋连线 —— 缺掉的数字正是此生的能量课题（见下方缺数提示）。</div>
            ) : (
              activeLines.map((l) => (
                <div key={l.key} className="num-line-chip">
                  <span className="num-line-name">✨ {l.label}</span>
                  <span className="num-line-mean">{l.meaning}</span>
                </div>
              ))
            )}
          </div>
          <div className="num-missing-note">
            {result.missing.length ? (
              <>
                <p className="num-missing-lead">⚠️ 缺少数字 <strong className="tc-pink">{result.missing.join('、')}</strong> → {result.missing.map((n) => NUM_DATA[n].name).join('、')} 能量偏弱。用下方色彩 + 日常习惯补足：</p>
                <div className="num-color-cards">
                  {result.missing.map((n) => {
                    const hexes = NUM_HEX[n] ?? [];
                    return (
                      <div key={n} className="num-color-card">
                        <div className="num-color-swatches">
                          {hexes.map((h) => (
                            <button
                              key={h}
                              type="button"
                              className="num-color-swatch"
                              style={{ background: h }}
                              title={`${NUM_COLORS[n]} · 点击复制 ${h}`}
                              onClick={() => copyHex(h)}
                            />
                          ))}
                        </div>
                        <div className="num-color-meta">
                          <span className="num-color-num">{n} · {NUM_DATA[n].name}</span>
                          <span className="num-color-hex">{hexes.join(' / ')}</span>
                        </div>
                        <div className="num-color-suggest">补色建议：多接触 <strong>{NUM_COLORS[n]}</strong>，可点缀穿戴、桌面或手机壳。</div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <p className="num-missing-lead">✅ 你的出生日期包含 1-9 全部数字，能量分布均衡。</p>
                <div className="num-color-cards">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
                    const hexes = NUM_HEX[n] ?? [];
                    return (
                      <div key={n} className="num-color-card">
                        <div className="num-color-swatches">
                          {hexes.map((h) => (
                            <button
                              key={h}
                              type="button"
                              className="num-color-swatch"
                              style={{ background: h }}
                              title={`${NUM_COLORS[n]} · 点击复制 ${h}`}
                              onClick={() => copyHex(h)}
                            />
                          ))}
                        </div>
                        <div className="num-color-meta">
                          <span className="num-color-num">{n} · {NUM_DATA[n].name}</span>
                          <span className="num-color-hex">{hexes.join(' / ')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 核心数字（P1-4）：表现 / 内驱 / 人格 / 成熟 + 四挑战 */}
        <div className="result-card full-span num-core-card">
          <div className="result-card-title">
            <SectionIcon name="sparkles" /> 核心数字
            <span className="rc-title-sub">（毕达哥拉斯体系 · 点击数字可切换详解）</span>
          </div>

          {coreItems.length > 0 ? (
            <div className="num-core-grid">
              {coreItems.map((it) => (
                <div key={it.key} className="num-core-item" onClick={() => setDetailNum(it.value as number)} title={it.hint}>
                  <div className="num-core-label">{it.icon} {it.label}</div>
                  <div className="num-core-num">{it.value}</div>
                  <div className="num-core-name">{NUM_DATA[it.value as number]?.name}</div>
                  <div className="num-core-hint">{it.hint}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="num-core-empty">
              填入<strong>中文姓名</strong>后，这里会解锁<strong>表现数</strong>（天生才能）、<strong>内驱数</strong>（内心渴望）、<strong>人格数</strong>（外在印象）与<strong>成熟数</strong>（中年方向）。
            </div>
          )}

          {core?.unmatched?.length ? (
            <div className="num-core-warn">
              ⚠️ 姓名中的「{core.unmatched.join('、')}」未在字库中找到读音，已跳过。可换用常用字或改用拼音填写。
            </div>
          ) : null}

          <div className="num-challenge-block">
            <div className="num-guide-label">🧗 挑战数（出生月 / 日 / 年化简后的差值，反映需跨越的障碍）</div>
            <div className="num-challenge-list">
              {challengeGroups.map(({ v, rows }) => {
                const multi = rows.length > 1;
                return (
                  <div key={v} className="num-challenge-item">
                    <div className="num-challenge-head">
                      <span className="num-challenge-num">{v}</span>
                      <div>
                        <div className="num-challenge-label">{multi ? rows.map((r) => r.label).join(' / ') : rows[0].label}</div>
                        <div className="num-challenge-stage">{multi ? rows.map((r) => r.stage).join(' · ') : rows[0].stage}</div>
                      </div>
                      <span className="num-challenge-name">{CHALLENGE_DATA[v]?.name}</span>
                    </div>
                    <div className="num-challenge-desc">{CHALLENGE_DATA[v]?.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 流年 · 流月 · 流日（通栏 · 周期切换 + tab + 右侧解说） */}
        <div className="result-card full-span num-period-card">
          <div className="result-card-title num-period-head">
            <span>
              <SectionIcon name="calendar-days" /> 流年 · 流月 · 流日
              <span className="rc-title-sub">生命灵数周期 = 出生月日 + 当前年月日 → 数字根</span>
            </span>
            <div className="num-period-toggle">
              <button type="button" className={'num-period-btn' + (periodMode === 'year' ? ' active' : '')} onClick={() => setPeriodMode('year')}>年</button>
              <button type="button" className={'num-period-btn' + (periodMode === 'month' ? ' active' : '')} onClick={() => setPeriodMode('month')}>月</button>
              <button type="button" className={'num-period-btn' + (periodMode === 'day' ? ' active' : '')} onClick={() => setPeriodMode('day')}>日</button>
            </div>
          </div>

          {periodMode === 'year' && (
            <div className="num-years-layout">
              {/* 左侧：年份 tab（可点击切换） */}
              <div className="num-year-tabs">
                {result.years.map((yi, i) => (
                  <button
                    key={yi.yr}
                    className={'num-year-tab' + (i === safeYearIdx ? ' active' : '')}
                    onClick={() => setActiveYearIdx(i)}
                    type="button"
                  >
                    <span className="num-year-tab-yr">{yi.yr}{yi.isCurrent ? ' · 今年' : ''}</span>
                    <span className="num-year-tab-num">{yi.py}</span>
                    <span className="num-year-tab-tag">{yi.tag}</span>
                  </button>
                ))}
              </div>
              {/* 右侧：选中年的解说内容 */}
              {result.years[safeYearIdx] && (() => {
                const y = result.years[safeYearIdx];
                const guide = YEAR_GUIDE[y.py];
                const [tag, desc] = YEAR_MEANING[y.py].split('：');
                return (
                  <div key={safeYearIdx} className="num-year-detail fade-in">
                    <div className="num-year-detail-head">
                      <div className="num-year-detail-year">{y.yr}{y.isCurrent ? ' · 今年' : ''}</div>
                      <div className="num-year-detail-num">流年数 {y.py}</div>
                    </div>
                    <div className="num-year-detail-title">{tag}</div>
                    <div className="num-year-detail-brief">{guide.brief}</div>
                    <div className="num-year-detail-desc">{desc}</div>

                    <div className="num-guide">
                      <div className="num-guide-block">
                        <div className="num-guide-label">🌐 整体氛围</div>
                        <p>{guide.overview}</p>
                      </div>
                      <div className="num-guide-grid">
                        <div className="num-guide-block">
                          <div className="num-guide-label">💼 事业财运</div>
                          <p>{guide.career}</p>
                        </div>
                        <div className="num-guide-block">
                          <div className="num-guide-label">💞 感情人际</div>
                          <p>{guide.love}</p>
                        </div>
                      </div>
                      <div className="num-guide-block">
                        <div className="num-guide-label">🌿 健康生活</div>
                        <p>{guide.health}</p>
                      </div>
                      <div className="num-guide-block">
                        <div className="num-guide-label">✅ 行动建议</div>
                        <ul className="num-guide-list">
                          {guide.actions.map((a) => <li key={a}>{a}</li>)}
                        </ul>
                      </div>
                      <div className="num-guide-block">
                        <div className="num-guide-label warn">⚠️ 注意避开</div>
                        <ul className="num-guide-list warn">
                          {guide.cautions.map((c) => <li key={c}>{c}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {periodMode === 'month' && (
            periodData ? (
              <div className="num-years-layout">
                <div className="num-year-tabs">
                  {periodData.months.map((mi, i) => (
                    <button
                      key={mi.mo}
                      type="button"
                      className={'num-year-tab' + (i === safeMonthIdx ? ' active' : '')}
                      onClick={() => setActiveMonthIdx(i)}
                    >
                      <span className="num-year-tab-yr">{mi.mo}月{mi.isCurrent ? ' · 本月' : ''}</span>
                      <span className="num-year-tab-num">{mi.pm}</span>
                      <span className="num-year-tab-tag">{YEAR_MEANING[mi.pm].split('：')[0]}</span>
                    </button>
                  ))}
                </div>
                {(() => {
                  const mi = periodData.months[safeMonthIdx];
                  const [tag] = YEAR_MEANING[mi.pm].split('：');
                  return (
                    <div key={safeMonthIdx} className="num-year-detail fade-in">
                      <div className="num-year-detail-head">
                        <div className="num-year-detail-year">{mi.mo}月{mi.isCurrent ? ' · 本月' : ''}</div>
                        <div className="num-year-detail-num">流月数 {mi.pm}</div>
                      </div>
                      <div className="num-year-detail-title">{tag}</div>
                      <div className="num-year-detail-brief">{mi.guide.brief}</div>
                      <div className="num-year-detail-desc">{mi.guide.focus}</div>
                      <div className="num-guide">
                        <div className="num-guide-grid">
                          <div className="num-guide-block">
                            <div className="num-guide-label">💼 事业财运</div>
                            <p>{mi.guide.career}</p>
                          </div>
                          <div className="num-guide-block">
                            <div className="num-guide-label">💞 感情人际</div>
                            <p>{mi.guide.love}</p>
                          </div>
                        </div>
                        <div className="num-guide-block">
                          <div className="num-guide-label">✅ 本月行动</div>
                          <ul className="num-guide-list">
                            {mi.guide.actions.map((a) => <li key={a}>{a}</li>)}
                          </ul>
                        </div>
                        <div className="num-guide-block">
                          <div className="num-guide-label warn">⚠️ 注意避开</div>
                          <ul className="num-guide-list warn">
                            {mi.guide.cautions.map((c) => <li key={c}>{c}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : <div className="num-period-empty">暂无足够信息计算流月，请填写完整出生日期。</div>
          )}

          {periodMode === 'day' && (
            periodData ? (
              <div className="num-years-layout">
                {/* 左侧：日期 tab（与流年 / 流月完全同构，保持视觉一致） */}
                <div className="num-year-tabs">
                  {periodData.days.map((di, i) => (
                    <button
                      key={i}
                      type="button"
                      className={'num-year-tab' + (i === safeDayIdx ? ' active' : '') + (di.isToday ? ' today' : '')}
                      onClick={() => setDayOffset(i)}
                    >
                      <span className="num-year-tab-yr">{di.isToday ? '今天' : `${di.date.getMonth() + 1}/${di.date.getDate()}`}</span>
                      <span className="num-year-tab-num">{di.pd}</span>
                      <span className="num-year-tab-tag">{YEAR_MEANING[di.pd].split('：')[0]}</span>
                    </button>
                  ))}
                </div>
                {/* 右侧：选中日的解说内容 */}
                {(() => {
                  const di = periodData.days[safeDayIdx];
                  const [tag] = YEAR_MEANING[di.pd].split('：');
                  return (
                    <div key={safeDayIdx} className="num-year-detail fade-in">
                      <div className="num-year-detail-head">
                        <div className="num-year-detail-year">{di.isToday ? '今天' : `${di.date.getFullYear()}年${di.date.getMonth() + 1}月${di.date.getDate()}日`}</div>
                        <div className="num-year-detail-num">流日数 {di.pd}</div>
                      </div>
                      <div className="num-year-detail-title">{tag}</div>
                      <div className="num-year-detail-brief">{di.guide.brief}</div>
                      <div className="num-year-detail-desc">{di.guide.focus}</div>
                      <div className="num-guide">
                        <div className="num-guide-grid">
                          <div className="num-guide-block">
                            <div className="num-guide-label">✅ 今日宜</div>
                            <ul className="num-guide-list">
                              {di.guide.dos.map((d) => <li key={d}>{d}</li>)}
                            </ul>
                          </div>
                          <div className="num-guide-block">
                            <div className="num-guide-label warn">🚫 今日忌</div>
                            <ul className="num-guide-list warn">
                              {di.guide.donts.map((d) => <li key={d}>{d}</li>)}
                            </ul>
                          </div>
                        </div>
                        <div className="num-guide-block">
                          <div className="num-guide-label">💡 今日提示</div>
                          <p>{di.guide.tip}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : <div className="num-period-empty">暂无足够信息计算流日，请填写完整出生日期。</div>
          )}
        </div>

        {/* AI 深度解读 */}
        <div className="num-ai-card">
          <div className="num-ai-head">
            <div className="result-card-title">
              <SectionIcon name="sparkles" /> {mode === 'synastry' ? '小玄说合盘' : '小玄说数'}
            </div>
            <div className="num-ai-actions">
              <button type="button" className="num-ai-btn" onClick={() => setAiSalt((s) => s + 1)} disabled={aiLoading}>
                🔄 换个说法
              </button>
              <button type="button" className="num-ai-btn" onClick={exportReport}>
                📄 导出 PDF
              </button>
              <button type="button" className="num-ai-btn" onClick={handlePoster} disabled={posterLoading || !result}>
                🖼️ {posterLoading ? '生成中…' : '生成海报'}
              </button>
              <button type="button" className="num-ai-btn" onClick={copyShareUrl} disabled={!solarDate && !result}>
                🔗 复制链接
              </button>
            </div>
          </div>
          {aiLoading && !aiText ? (
            <OmLoading label="小玄正在为你解读生命灵数…" mode="inline" />
          ) : (
            <div className="num-ai-body">
              {aiSections.lead && (
                <div
                  className="num-ai-lead"
                  dangerouslySetInnerHTML={{ __html: mdToHtml(aiSections.lead.body) }}
                />
              )}
              {aiSections.rest.length > 0 && (
                <div className="num-ai-grid">
                  {aiSections.rest.map((s, i) => (
                    <div className="num-ai-item" key={i}>
                      <div className="num-ai-item-head">
                        <span className="num-ai-item-icon">{s.icon}</span>
                        <span className="num-ai-item-title">{s.title}</span>
                      </div>
                      <div
                        className="num-ai-item-body"
                        dangerouslySetInnerHTML={{ __html: mdToHtml(s.body) }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {aiText && <div className="ai-interp-disclaimer">⚠️ {aiDisclaimer || MANDATORY_DISCLAIMER}</div>}
          <LightFollowUp
            module="numerology"
            context={aiText}
            chips={[
              '能说得再具体一点吗？',
              '这和我的事业运有关吗？',
              '我的感情走势怎么看？',
              '有什么需要特别注意的？',
            ]}
          />
        </div>
        </>
      )}
      </div>

      {/* 天使数字（P2-1）：通栏，置于小玄说数下方 */}
      <AngelNumberCard />

      {/* 底部三栏：今日数字能量 / 数字小知识 / 跨页联动 */}
      <div className="tarot-side-grid">
        {/* 今日数字能量 */}
        {result && (
          <div className="mood-tracker">
            <div className="result-card-title"><SectionIcon name="calendar-check" /> 今日数字能量</div>
            <div className="dream-energy-list">
              <div className="dream-energy-item"><span>🌅 今日幸运色</span><strong>{NUM_COLORS[dayNumber]}</strong></div>
              <div className="dream-energy-item"><span>🍀 今日幸运数字</span><strong>{dayNumber} · {result.lifePath}</strong></div>
              <div className="dream-energy-item"><span>🤝 最合拍数字</span><strong>{NUM_DATA[dayNumber].mate}</strong></div>
              <div className="dream-energy-item"><span>✅ 今日宜</span><strong>{NUM_DATA[dayNumber].posi}</strong></div>
              <div className="dream-energy-item"><span>⚠️ 今日忌</span><strong>{NUM_DATA[dayNumber].nega}</strong></div>
            </div>
            <div className="num-tip">💡 今日数 {dayNumber}，叠加你的生命灵数 {result.lifePath}（{result.data.name}），能量卡已为你生成。</div>
          </div>
        )}

        {/* 数字小知识 */}
        <div className="mood-tracker">
          <div className="result-card-title"><SectionIcon name="book-open" /> 数字小知识</div>
          <div className="dream-fact-list">
            {NUM_FACTS.map((f, i) => (
              <div key={i} className="dream-fact-item"><span className="dream-fact-icon">{f.icon}</span><div dangerouslySetInnerHTML={{ __html: f.html }} /></div>
            ))}
          </div>
        </div>

      </div>

      {/* 测算历史弹层（N2）：回放任意一次本地测算 / 删除单条 / 清空 */}
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} variant="share" title="🕘 测算历史">
        {history.length === 0 ? (
          <div className="poster-loading">还没有测算记录 —— 完成一次测算后会自动保存在这里。</div>
        ) : (
          <>
            <div className="num-history-list">
              {history.map((item) => {
                const isSyn = item.mode === 'synastry';
                return (
                  <div key={item.ts} className="num-history-item">
                    <button type="button" className="num-history-main" onClick={() => restoreSnapshot(item)}>
                      <span className="num-history-title">
                        {isSyn
                          ? `💞 数字配对 ${item.solarDate} × ${item.partnerDate || '未知'}`
                          : `🔢 生命灵数 ${item.result.lifePath} · ${item.result.data?.name ?? ''}`}
                      </span>
                      <span className="num-history-desc">
                        {isSyn
                          ? `契合度 ${item.synastry?.score ?? '—'} / 100${item.partnerName ? ` · 对方 ${item.partnerName}` : ''}`
                          : `${item.solarDate}${item.name ? ` · ${item.name}` : ''}`}
                      </span>
                    </button>
                    <span className="num-history-ago">{fmtAgo(item.ts)}</span>
                    <button
                      type="button"
                      className="num-history-del"
                      title="删除这条记录"
                      aria-label="删除这条记录"
                      onClick={() => removeHistory(item.ts)}
                    >✕</button>
                  </div>
                );
              })}
            </div>
            <div className="num-share-btns">
              <button type="button" className="num-ai-btn" onClick={clearHistory}>🗑️ 清空历史</button>
            </div>
          </>
        )}
      </Modal>

      {/* 分享海报弹层（G1）：图片 + 文字描述 + 下载 / 复制 / 重新生成 */}
      <Modal
        open={posterOpen}
        onClose={() => setPosterOpen(false)}
        variant="share"
        title={mode === 'synastry' ? '🖼️ 数字配对分享海报' : '🖼️ 数字密码分享海报'}
      >
        {posterLoading && <div className="poster-loading">⏳ 正在生成专属海报…</div>}
        {!posterLoading && poster && (
          <div className="poster-preview">
            {poster.imageUrl ? (
              <img className="poster-img" src={poster.imageUrl} alt="数字密码分享海报" loading="lazy" decoding="async" />
            ) : (
              <div className="poster-fallback-note">
                ⚠️ 海报图片生成失败{poster.imageError ? `（${poster.imageError}）` : ''}，可复制下方文案分享。
              </div>
            )}
            {poster.shareText && (
              <div className="poster-share-text">
                {sanitizeAiText(poster.shareText).split('\n').filter(Boolean).map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="num-share-btns">
          <button type="button" className="num-ai-btn" onClick={handleDownloadPoster} disabled={!poster?.imageUrl}>
            ⬇️ 导出 PDF
          </button>
          <button type="button" className="num-ai-btn" onClick={copyPosterText} disabled={!poster?.shareText}>
            📋 复制文案
          </button>
          <button type="button" className="num-ai-btn" onClick={handlePoster} disabled={posterLoading}>
            🔄 重新生成
          </button>
        </div>
      </Modal>
    </div>
  );
}
