'use client';

import '@/styles/bugua.scss';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BirthDatePicker, type BirthDateValue } from '@/components/ui/BirthDatePicker';
import {
  solarToLunarParts, formatLunarText, formatSolarText,
} from '@/lib/lunarDate';
import OmLoading from '@/components/ui/OmLoading';
import Modal from '@/components/ui/Modal';
import CrossPageLink from '@/components/ui/CrossPageLink';
import SectionIcon from '@/components/ui/SectionIcon';
import Cascader from '@/components/ui/Cascader';
import { CHINA_REGIONS } from '@/data/chinaRegions';
import { showToast } from '@/components/ui/Toast';
import { useVisitor } from '@/components/visitor/VisitorProvider';
import { useAuth } from '@/contexts/AuthContext';
import { moduleAIContent } from '@/data/buguaData';
import { buildDayunAnalysis, buildGejuYuanwen, computeLocalBazi, type LocalDayunInput } from '@/data/baziDayun';
import {
  calculateBazi,
  calculateZiwei,
  calculateLiuyao,
  calculateMeihua,
  calculateQimen,
  calculateLiuren,
  calculateTaiyi,
  saveReport,
  fetchReport,
  fetchReports,
  type ReportListItem,
  requestInterpret,
  requestInterpretStream,
  requestSummary, requestSummaryStream,
  requestRetrieve,
  requestPoster,
  type InterpretModule,
  type InterpretResponse,
  type InterpretMeta,
  type PosterResult,
  type RetrieveResult,
  type SummaryResponse,
  type SummaryOutput,
  type SummaryAdviceColumn,
  type PaipanRequest,
  type BaziAPIResult,
  type BaziDayun,
  type ZiweiAPIResult,
  type ZiweiLiuYueItem,
  type ZiweiLiuNianYear,
  type ZiweiDafen,
  type ZiweiPalace,
  type LiuyaoAPIResult,
  type MeihuaAPIResult,
  type QimenAPIResult,
  type LiuRenAPIResult,
  type TaiyiAPIResult,
} from '@/lib/api';
import { saveBaziLink } from '@/data/fengshuiData';
import { storage } from '@/lib/storage';
import { pushTrajectory } from '@/lib/trajectory';
import type { VisitorBirth } from '@/lib/visitor';
import { useShare, shareOutToPoster } from '@/hooks/useShare';
import ShareLoginGate from '@/components/share/ShareLoginGate';

import { BaziModule } from './modules/BaziModule';
import { WuxingModule } from './modules/WuxingModule';
import { ZiweiModule } from './modules/ZiweiModule';
import { LiuyaoModule } from './modules/LiuyaoModule';
import { MeihuaModule } from './modules/MeihuaModule';
import { QimenModule } from './modules/QimenModule';
import { LiuRenModule } from './modules/LiuRenModule';
import { TaiyiModule } from './modules/TaiyiModule';
import { SummaryModule, SummaryResonanceCard, SummaryInsightCards } from './modules/SummaryModule';
import LightFollowUp from '@/components/ai-chat/LightFollowUp';
import { mdToHtml } from '@/lib/markdown';
import { printDocument } from '@/lib/print';
import {
  TAB_TO_MODULE,
  ModuleStatus,
  ModuleKey,
  SummaryState,
  stripInterpDisclaimer,
  makePlaceholderMeta,
  SUMMARY_CARDS,
  SUMMARY_ADVICE,
} from './shared';

/* ============================= 常量数据（从原型 bugua.html 提取） ============================= */

const MODULE_TABS = [
  { id: 'mod-bazi', label: '八字命理', icon: 'bazi' },
  { id: 'mod-wuxing', label: '五行能量', icon: 'wuxing' },
  { id: 'mod-ziwei', label: '紫微斗数', icon: 'ziwei' },
  { id: 'mod-liuyao', label: '六爻起卦', icon: 'liuyao' },
  { id: 'mod-meihua', label: '梅花易数', icon: 'meihua' },
  { id: 'mod-qimen', label: '奇门遁甲', icon: 'qimen' },
  // 三式补齐（P2）：大六壬 / 太乙神数
  { id: 'mod-liuren', label: '大六壬', icon: 'qimen' },
  { id: 'mod-taiyi', label: '太乙神数', icon: 'qimen' },
  { id: 'mod-summary', label: '综合运势', icon: 'summary' }
];

/** 可勾选的术数标签（三式齐备） */
const MODULE_CHIPS = ['八字', '五行能量', '紫微斗数', '六爻', '梅花易数', '奇门遁甲', '大六壬', '太乙神数'];

/**
 * 默认勾选：全部 8 项（三式齐备）。
 * 历史：三式（大六壬/太乙神数）上线时曾刻意不进默认勾选以省 AI 成本，
 * 2026-09-10 按产品要求改为默认全选——用户期望排盘结果默认就能看到全部术数。
 */
const DEFAULT_CHIPS = ['八字', '五行能量', '紫微斗数', '六爻', '梅花易数', '奇门遁甲', '大六壬', '太乙神数'];

/** 勾选标签 → 排盘模块键。此前 selChips 与模块键是两套独立字符串且从未映射，
 *  导致勾选只能控制 chip 高亮、排盘仍全量执行（综合运势虚报融合数量）。
 *  五行能量由八字排盘派生（同一份 bazi 结果），映射到 bazi，requestAll 内去重。 */
const CHIP_TO_MODULE: Record<string, ModuleKey> = {
  八字: 'bazi',
  五行能量: 'bazi',
  紫微斗数: 'ziwei',
  六爻: 'liuyao',
  梅花易数: 'meihua',
  奇门遁甲: 'qimen',
  大六壬: 'liuren',
  太乙神数: 'taiyi',
};

/** 结果 tab ↔ 勾选标签一一对应（mod-wuxing 不再挂在 八字 chip 下，独立由 五行能量 chip 控制） */
const TAB_TO_CHIP: Record<string, string> = {
  'mod-bazi': '八字',
  'mod-wuxing': '五行能量',
  'mod-ziwei': '紫微斗数',
  'mod-liuyao': '六爻',
  'mod-meihua': '梅花易数',
  'mod-qimen': '奇门遁甲',
  'mod-liuren': '大六壬',
  'mod-taiyi': '太乙神数',
};

/** 各术数中文名（聚合进综合行动建议时带名展示） */
const MODULE_NAMES: Record<ModuleKey, string> = {
  bazi: '八字',
  ziwei: '紫微斗数',
  liuyao: '六爻起卦',
  meihua: '梅花易数',
  qimen: '奇门遁甲',
  liuren: '大六壬',
  taiyi: '太乙神数',
};

/**
 * 模块键 → 勾选 chip 名（专供存档恢复回填勾选用）。
 * 必须与 MODULE_CHIPS 字面一致 —— 此前误用 MODULE_NAMES 反查，而
 * MODULE_NAMES.liuyao='六爻起卦' 与 chip 名 '六爻' 不等，
 * 导致存档含 liuyao 时「六爻」chip 永远回填不上（刷新后凭空少一项）。
 */
const MODULE_TO_CHIP: Record<ModuleKey, string> = {
  bazi: '八字',
  ziwei: '紫微斗数',
  liuyao: '六爻',
  meihua: '梅花易数',
  qimen: '奇门遁甲',
  liuren: '大六壬',
  taiyi: '太乙神数',
};

/** 后端排盘结果合集（按模块键索引；成功才写入，切页刷新后由云端存档恢复重建） */
type ModuleResults = {
  bazi?: BaziAPIResult;
  ziwei?: ZiweiAPIResult;
  liuyao?: LiuyaoAPIResult;
  meihua?: MeihuaAPIResult;
  qimen?: QimenAPIResult;
  liuren?: LiuRenAPIResult;
  taiyi?: TaiyiAPIResult;
};

/** 排盘状态持久化 key：切页/刷新后回来自动恢复结果（组件重挂载 state 丢失） */
const BUGUA_DIVINED_KEY = 'om_bugua_divined';
const BUGUA_QUESTION_KEY = 'om_bugua_question';
/** 当前选中的模块 tab：切页/刷新后回来恢复，避免每次都回到默认八字模块 */
const BUGUA_ACTIVE_MODULE_KEY = 'om_bugua_active_module';
/** 出生地（省|市）：属命主档案，刷新/切页后必须恢复，否则会回落到默认北京 */
const BUGUA_BIRTH_PLACE_KEY = 'om_bugua_birth_place';
/** 真太阳时开关偏好：用户显式关闭后不应被存档恢复逻辑重新打开 */
const BUGUA_TST_ENABLED_KEY = 'om_bugua_tst_enabled';
/** 无任何出生地记录时的兜底（历史默认值） */
const DEFAULT_BIRTH_PLACE = { province: '北京市', city: '东城区' };

// ============================================================================
// 农历生日录入 → 阳历换算工具（lunar-typescript）
// 已抽到 src/lib/lunarDate.ts 统一维护：LUNAR_YEAR_MIN/MAX、LUNAR_MONTH_NAMES、
// lunarMonthName、leapMonthOf、buildLunarMonths、lunarToSolar、solarToLunarParts、
// formatLunarText、parseLunarToParts、parseLunarLooseDate、formatSolarText。
// ============================================================================
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
/** 后端存档时间（UTC）→ 东八区可读文本 'YYYY-MM-DD HH:mm'（兜底原样返回） */
function formatArchiveAt(at: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(at || '');
  if (!m) return at;
  const [, y, mo, d, hh, mm] = m.map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, hh, mm));
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())} ${p2(dt.getHours())}:${p2(dt.getMinutes())}`;
}

// react-datepicker 中文语言包已弃用：改用项目内 DatePicker（antd-dp 风格，与 horoscope 一致）
/** 表单默认值为空：用户必须自行填写出生信息后才可排盘 */

/** 出生时辰下拉完整值（时辰名 + 时段） */
const TIME_OPTIONS = [
  '子时 (23:00-01:00)', '丑时 (01:00-03:00)', '寅时 (03:00-05:00)', '卯时 (05:00-07:00)',
  '辰时 (07:00-09:00)', '巳时 (09:00-11:00)', '午时 (11:00-13:00)', '未时 (13:00-15:00)',
  '申时 (15:00-17:00)', '酉时 (17:00-19:00)', '戌时 (19:00-21:00)', '亥时 (21:00-23:00)',
  '不详'
];

/** 时辰名（子时~亥时/不详）→ 下拉完整值（找不到时原样返回） */
function timeNameToFull(name: string): string {
  return TIME_OPTIONS.find((t) => t.startsWith(name)) || name;
}

/** 社区热议 */
const COMMUNITY = [
  '「戊土日主2026年运势讨论」 128回复',
  '「紫微天府在命宫的人后来怎样了」 86回复',
  '「奇门遁甲找最佳方位实测」 54回复',
  '「梅花易数断卦准确率探讨」 203回复'
];

const PRICING = [
  { name: '月度会员', price: '¥68', period: '/月' },
  { name: '年度会员', price: '¥398', period: '/年 · 省51%', selected: true },
  { name: '终身会员', price: '¥998', period: '一次付费' }
];

/** 常见问题预设（点击直接填入「所问之事」，降低输入成本） */
const QUESTION_PRESETS = ['今年事业运如何？', '何时遇到正缘？', '今年财运好不好？', '该不该换工作？'];

/* ============================= 六爻起卦方式 ============================= */

/** 起卦方式：time 时间起卦（默认）/ coin 摇钱法 / manual 手动逐爻 */
type LiuyaoMethod = 'time' | 'coin' | 'manual';

/** 梅花起卦方式：time 时间起卦（默认）/ number 数字起卦 / text 字数起卦 / manual 手动指定 */
type MeihuaMethod = 'time' | 'number' | 'text' | 'manual';
/** 梅花起卦方式选项 */
const MEIHUA_METHODS: { value: MeihuaMethod; label: string; hint: string }[] = [
  { value: 'time', label: '🕐 时间起卦', hint: '按起卦时的年月日时起卦（默认）' },
  { value: 'number', label: '🔢数字起卦', hint: '心中默想两个数字，上卦取其一、下卦取其二' },
  { value: 'text', label: '🔤字数起卦', hint: '以所问之事的字数平分上下卦' },
  { value: 'manual', label: '✍️ 手动指定', hint: '直接指定上卦数、下卦数与动爻（先天数）' },
];
/** 先天八卦数：乾1兑2离3震4巽5坎6艮7坤8 */
const XIANTIAN_TRIGRAMS = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];

/** 摇钱法单次投掷：三枚铜钱，背=阳面（花），字=阴面 */
type CoinFace = '背' | '字';
/** 三枚铜钱 → 爻编码：三背=老阳动(2)、三字=老阴动(3)、一背=少阳(0)、两背=少阴(1) */
function coinFacesToValue(faces: CoinFace[]): number {
  const backs = faces.filter((c) => c === '背').length;
  if (backs === 3) return 2;
  if (backs === 0) return 3;
  return backs === 1 ? 0 : 1;
}
/** 随机掷三枚铜钱 */
function tossCoins(): CoinFace[] {
  return [0, 1, 2].map(() => (Math.random() < 0.5 ? '背' : '字'));
}
/** 爻位名（自下而上：index 0 = 初爻） */
const YAO_POS_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
/** 爻编码 → 展示文案：0 少阳(阳静) / 1 少阴(阴静) / 2 老阳(阳动) / 3 老阴(阴动) */
const YAO_CODE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: '少阳 ⚊ 阳静' },
  { value: 1, label: '少阴 ⚋ 阴静' },
  { value: 2, label: '老阳 ⚊○ 阳动' },
  { value: 3, label: '老阴 ⚋× 阴动' },
];
const YAO_CODE_LABEL: Record<number, string> = { 0: '少阳', 1: '少阴', 2: '老阳动', 3: '老阴动' };

/** 校验省/市是否真实存在于行政区划表（脏数据或行政区划调整后自动丢弃） */
function isValidPlace(province?: string | null, city?: string | null): boolean {
  if (!province || !city) return false;
  const p = CHINA_REGIONS.find((x) => x.name === province);
  return !!p && p.cities.some((c) => c.name === city);
}

/** 读取本地保存的出生地（无记录 / 数据非法 → null） */
function readSavedBirthPlace(): { province: string; city: string } | null {
  try {
    const raw = storage.getItem(BUGUA_BIRTH_PLACE_KEY);
    if (!raw) return null;
    const [province, city] = raw.split('|');
    return isValidPlace(province, city) ? { province, city } : null;
  } catch {
    return null;
  }
}

/** 写入本地出生地（隐私模式等静默忽略） */
function writeSavedBirthPlace(province: string, city: string): void {
  try {
    storage.setItem(BUGUA_BIRTH_PLACE_KEY, `${province}|${city}`);
  } catch {
    /* 静默忽略 */
  }
}

/** 读取真太阳时开关偏好（无记录 → null，交由调用方决定默认值） */
function readSavedTstEnabled(): boolean | null {
  try {
    const raw = storage.getItem(BUGUA_TST_ENABLED_KEY);
    return raw === null ? null : raw === '1';
  } catch {
    return null;
  }
}

/** 写入真太阳时开关偏好（隐私模式等静默忽略） */
function writeSavedTstEnabled(on: boolean): void {
  try {
    storage.setItem(BUGUA_TST_ENABLED_KEY, on ? '1' : '0');
  } catch {
    /* 静默忽略 */
  }
}

/** 用经度反查最近的省/市（用于从旧存档恢复出生地） */
function findNearestCityByLng(lng: number): { province: string; city: string } | null {
  let best: { province: string; city: string } | null = null;
  let min = Infinity;
  for (const p of CHINA_REGIONS) {
    for (const c of p.cities) {
      const d = Math.abs(c.lng - lng);
      if (d < min) {
        min = d;
        best = { province: p.name, city: c.name };
      }
    }
  }
  return best;
}

/** 起卦方式选项（与后端 method 参数对齐） */
const LIUYAO_METHODS: { value: LiuyaoMethod; label: string }[] = [
  { value: 'time', label: '🕐 时间起卦' },
  { value: 'coin', label: '🪙 摇钱法' },
  { value: 'manual', label: '✍️ 手动逐爻' },
];

/* ============================= 页面组件 ============================= */

/**
 * 卜卦页 —— 复刻原型 bugua.html（最复杂页面）
 * 命主表单 + 精灵小玄 + 7 术数模块排盘 + 侧边栏 + 付费/分享弹窗
 */
export default function BuguaPage() {
  const router = useRouter();
  const { birth, setBirth, visitorId, mode, loading: birthLoading } = useVisitor();
  // 登录会话就绪标志：requestMe 完成前 isAuthed 不可靠，自动排盘必须等它
  const { ready: authReady } = useAuth();
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  /** 出生日期：canonical 公历 + 农历分量 + 当前输入模式；统一由 BirthDatePicker 管理 */
  const [birthValue, setBirthValue] = useState<BirthDateValue>({ date: '', mode: 'solar' });
  const [birthTime, setBirthTime] = useState('');
  const [question, setQuestion] = useState('');
  const [selChips, setSelChips] = useState<Set<string>>(new Set(DEFAULT_CHIPS));
  const [divined, setDivined] = useState(false);
  // 模块 tab 持久化：从 localStorage 恢复上次选择（仅校验 id 合法性，可见性由下方 effect 兜底）
  const [activeModule, setActiveModule] = useState<string>(() => {
    try {
      const saved = storage.getItem(BUGUA_ACTIVE_MODULE_KEY);
      if (saved && MODULE_TABS.some((t) => t.id === saved)) return saved;
    } catch { /* 隐私模式等静默忽略 */ }
    return 'mod-bazi';
  });
  /** 切换/重置模块 tab 时一并持久化，让切页回来仍停留在上次选择的模块 */
  const setActiveModulePersist = (id: string) => {
    setActiveModule(id);
    try { storage.setItem(BUGUA_ACTIVE_MODULE_KEY, id); } catch { /* 静默忽略 */ }
  };
  /** 结果 tab 与「排盘术数」勾选一一对应（tab ↔ chip 同名联动）。
   *  综合运势口径统一按「勾选的术数数量」判定：勾选 ≥2 项才展示（单项无综合意义）。
   *  注意不能按去重后的排盘模块数算——八字与五行能量共用一份 bazi 结果，
   *  那样「勾了 2 项却不出现综合运势」会让用户觉得时有时无。 */
  const visibleModuleTabs = useMemo(
    () =>
      MODULE_TABS.filter((t) =>
        t.id === 'mod-summary' ? selChips.size >= 2 : selChips.has(TAB_TO_CHIP[t.id]),
      ),
    [selChips],
  );
  // 勾选变化后，当前 tab 若已不在可见列表（如取消了奇门勾选），回落到第一个可见 tab
  useEffect(() => {
    if (!divined) return;
    if (visibleModuleTabs.some((t) => t.id === activeModule)) return;
    setActiveModule(visibleModuleTabs[0]?.id || 'mod-bazi');
  }, [divined, activeModule, visibleModuleTabs]);

  // ===== 真太阳时校正（P3-2 自动接入：默认开启，出生地随请求上送，由后端分钟级校正）=====
  // 注意：出生地/开关的本地值【不能】在 useState 初始化里读——SSR 阶段读不到 localStorage，
  // 会导致服务端渲染默认北京、客户端渲染保存值，触发 hydration 文本不一致。
  // 统一先渲染默认值，挂载后再从本地恢复（见下方 localPrefRestoredRef effect）。
  const [tstEnabled, setTstEnabled] = useState(true);
  const [birthProvince, setBirthProvince] = useState(DEFAULT_BIRTH_PLACE.province);
  const [birthCity, setBirthCity] = useState(DEFAULT_BIRTH_PLACE.city);
  /** 最近一次真太阳时校正结果（用于表单提示；取自后端回传，前端不再自行换算） */
  const [tstInfo, setTstInfo] = useState<string>('');

  /** 出生地 / 开关本地偏好恢复（仅客户端首次挂载执行一次）。
   *  刷新后不再无条件回落默认北京——这正是「选了河北、刷新回北京」的直接原因。 */
  const localPrefRestoredRef = useRef(false);
  useEffect(() => {
    if (localPrefRestoredRef.current) return;
    localPrefRestoredRef.current = true;
    const savedPlace = readSavedBirthPlace();
    if (savedPlace) {
      setBirthProvince(savedPlace.province);
      setBirthCity(savedPlace.city);
    }
    const savedTst = readSavedTstEnabled();
    if (savedTst !== null) setTstEnabled(savedTst);
  }, []);

  /** 根据省/市派生经纬度（真太阳时校正与出生档案同步共用） */
  const birthCoords = useMemo(() => {
    const prov = CHINA_REGIONS.find((p) => p.name === birthProvince);
    const c = prov?.cities.find((x) => x.name === birthCity);
    return { lat: c?.lat ?? 39.9289, lng: c?.lng ?? 116.4161 };
  }, [birthProvince, birthCity]);
  const birthLng = birthCoords.lng;

  // 出生地最新快照（ref）：排盘/存档可能由 setTimeout 延迟链路触发，
  // 直接闭包捕获会拿到用户改出生地之前的值，导致经度与存档省份对不上。
  const birthPlaceRef = useRef({ ...birthCoords, province: birthProvince, city: birthCity });
  useEffect(() => {
    birthPlaceRef.current = { ...birthCoords, province: birthProvince, city: birthCity };
  }, [birthCoords, birthProvince, birthCity]);

  /** 出生地变更统一入口：更新表单 + 落本地 + 同步命主档案。
   *  三处都写是为了覆盖所有刷新路径：未起卦刷新靠本地值，已登录/跨设备靠档案与云端存档。 */
  const changeBirthPlace = (province: string, city: string) => {
    setBirthProvince(province);
    setBirthCity(city);
    writeSavedBirthPlace(province, city);
    if (birth) {
      const c = CHINA_REGIONS.find((p) => p.name === province)?.cities.find((x) => x.name === city);
      setBirth({ ...birth, province, city, lat: c?.lat, lng: c?.lng });
    }
  };

  /** 统一构造出生档案：自动带上当前出生地，避免各处 setBirth 漏传导致出生地被抹掉。
   *  出生地取 ref 快照而非 state 闭包，保证延迟链路（setTimeout 触发）拿到最新值。 */
  const withBirthPlace = (patch: Partial<VisitorBirth>): VisitorBirth => ({
    ...(birth ?? { date: '', time: '不详' }),
    province: birthPlaceRef.current.province,
    city: birthPlaceRef.current.city,
    lat: birthPlaceRef.current.lat,
    lng: birthPlaceRef.current.lng,
    ...patch,
  });

  // 六爻起卦方式（time 默认走出生时间；coin 摇钱法；manual 手动逐爻）
  const [liuyaoMethod, setLiuyaoMethod] = useState<LiuyaoMethod>('time');
  // 摇钱法：6 次投掷的铜钱面（index 0 = 初爻，自下而上）；null = 未掷
  const [coinFaces, setCoinFaces] = useState<(CoinFace[] | null)[]>(Array(6).fill(null));
  // 手动逐爻：6 爻编码（index 0 = 初爻），默认全少阳
  const [manualLines, setManualLines] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  /** 摇钱法：掷第 i 爻 */
  const tossAt = (i: number) => {
    setCoinFaces((prev) => {
      const next = [...prev];
      next[i] = tossCoins();
      return next;
    });
  };
  /** 摇钱法：一键掷完所有未掷爻位 */
  const tossAll = () => {
    setCoinFaces((prev) => prev.map((f) => f ?? tossCoins()));
  };
  /** 切换起卦方式（摇钱法重掷时清空已有结果） */
  const switchLiuyaoMethod = (m: LiuyaoMethod) => {
    setLiuyaoMethod(m);
    if (m === 'coin') setCoinFaces(Array(6).fill(null));
  };
  // 梅花易数起卦方式（M5）
  const [meihuaMethod, setMeihuaMethod] = useState<MeihuaMethod>('time');
  // 奇门定局方式（Q10）：auto=拆补法自动；manual=手动指定阴阳遁+局数
  const [qimenJuMode, setQimenJuMode] = useState<'auto' | 'manual'>('auto');
  const [qimenYinyang, setQimenYinyang] = useState<'阳' | '阴'>('阳');
  const [qimenJuNum, setQimenJuNum] = useState<number>(1);
  // 数字起卦：两个报数
  const [mhNum1, setMhNum1] = useState<string>('');
  const [mhNum2, setMhNum2] = useState<string>('');
  // 手动指定：上卦数 1-8、下卦数 1-8、动爻 1-6
  const [mhShang, setMhShang] = useState<number>(1);
  const [mhXia, setMhXia] = useState<number>(1);
  const [mhDong, setMhDong] = useState<number>(1);
  // 应期取数类型：先天数(xian) / 后天数(hou)（M6）
  const [meihuaNumType, setMeihuaNumType] = useState<'xian' | 'hou'>('xian');
  /** 切换梅花起卦方式 */
  const switchMeihuaMethod = (m: MeihuaMethod) => {
    setMeihuaMethod(m);
  };
  /** 梅花起卦参数是否完整（数字起卦需两个数字） */
  const meihuaReady = (): boolean => {
    if (meihuaMethod === 'number') return mhNum1.trim() !== '' && mhNum2.trim() !== '';
    return true;
  };

  /** 当前起卦方式下可用的 linesInput（time 模式返回 undefined；coin 未掷完返回 null 表示无效） */
  const liuyaoLinesInput = (): number[] | null | undefined => {
    if (liuyaoMethod === 'coin') {
      if (coinFaces.some((f) => !f)) return null;
      return coinFaces.map((f) => coinFacesToValue(f as CoinFace[]));
    }
    if (liuyaoMethod === 'manual') return manualLines;
    return undefined;
  };

  // 各术数后端排盘结果与来源状态（后端不可用时降级内置演示数据）
  const [apiResults, setApiResults] = useState<ModuleResults>({});
  const [apiStatus, setApiStatus] = useState<Partial<Record<ModuleKey, ModuleStatus>>>({});

  // AI 实时解读：loading=生成中 / error=请求失败 / 响应对象=成功 / null=未请求（沿用内置文案）
  const [interps, setInterps] = useState<Partial<Record<ModuleKey, InterpretResponse | 'loading' | 'error' | null>>>({});
  // 五行能量专属 AI 解读（与八字命理分开展示）
  const [wuxingInterp, setWuxingInterp] = useState<InterpretResponse | 'loading' | 'error' | null>(null);

  // 综合行动建议（AI 结构化 /api/v1/summary）：null=未请求 / 'loading'=生成中 / 'error'=失败 / 响应对象=成功
  // 综合运势：general(综合) + love(感情) + career(事业) 三维度并行预取，平铺展示不再切换
  const [summaryState, setSummaryState] = useState<SummaryState>(null);
  const [loveState, setLoveState] = useState<SummaryState>(null);
  const [careerState, setCareerState] = useState<SummaryState>(null);
  const lastSummaryReq = useRef<{ modules: { module: string; name: string; result: unknown }[]; question?: string } | null>(null);
  // 综合运势自动重聚合的防抖定时器（勾选变化后 1s 内无再变化才发 AI）
  const summaryRegenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 实际参与融合的术数快照（在发起 summary 请求的那一刻固化）。
  // 此前综合运势在 render 时临时拼装 Object.keys(apiResults) + getCrossReadings()，
  // 与请求体可能不同步（跨页占卜新增 / 本轮部分模块失败），会虚报融合数量。
  const [fused, setFused] = useState<{ count: number; names: string[] }>({ count: 0, names: [] });
  /** 云端存档恢复提示（非 null 表示当前排盘图来自最近一次云端存档，而非本次实排） */
  const [restoredRec, setRestoredRec] = useState<{ id: number; title: string; at: string } | null>(null);

  // 起卦设置折叠面板展开状态（六爻 / 梅花 / 奇门）。默认全部收起，需要调参时才展开，
  // 避免三块配置同时铺开把表单拉得极长（原「乱」的主因）。
  const [openCfg, setOpenCfg] = useState<Record<'liuyao' | 'meihua' | 'qimen', boolean>>({
    liuyao: false,
    meihua: false,
    qimen: false,
  });
  /** 折叠面板开合 */
  const toggleCfg = (k: 'liuyao' | 'meihua' | 'qimen') =>
    setOpenCfg((p) => ({ ...p, [k]: !p[k] }));

  // 表单校验提示（内联展示在提交按钮上方，替代原精灵气泡）
  const [formError, setFormError] = useState('');
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 展示校验提示，4s 后自动消失 */
  const showFormError = (msg: string) => {
    setFormError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setFormError(''), 4000);
  };

  // 弹窗
  const [deepOpen, setDeepOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [pricing, setPricing] = useState(PRICING.findIndex((p) => p.selected));
  // 结果卡导出图片（生成海报）：复用 AI 服务 /api/v1/poster，与解梦页同款
  const [posterResult, setPosterResult] = useState<PosterResult | null>(null);
  const [posterLoading, setPosterLoading] = useState(false);
  /** 分享存档 Hook：登录守卫 + 挂载自动读库（二次进入直接展示）+ persist 落库 */
  const share = useShare('bugua');

  // 保存出生档案到ref，已登录时自动回填表单
  const savedBirthRef = useRef<typeof birth>(null);
  const birthLastKeyRef = useRef<string>('');
  useEffect(() => {
    if (!birth) return;
    const key = `${birth.date || ''}|${birth.time || ''}|${birth.gender || ''}|${birth.province || ''}|${birth.city || ''}`;
    if (key === birthLastKeyRef.current) return;
    birthLastKeyRef.current = key;
    savedBirthRef.current = birth;
    // 出生地：档案带合法出生地时同步回表单并落本地（跨设备 / 跨页一致）
    if (isValidPlace(birth.province, birth.city)) {
      setBirthProvince(birth.province as string);
      setBirthCity(birth.city as string);
      writeSavedBirthPlace(birth.province as string, birth.city as string);
    }
    // 已登录 + 有出生档案 → 自动回填表单
    if (birth.date) {
      profileUsedRef.current = true;
      const next: BirthDateValue = { date: birth.date, mode: birthValue.mode };
      if (typeof birth.lunarYear === 'number' && typeof birth.lunarMonth === 'number' && typeof birth.lunarDay === 'number') {
        next.lunarYear = birth.lunarYear;
        next.lunarMonth = birth.lunarMonth;
        next.lunarDay = birth.lunarDay;
      } else {
        const p = solarToLunarParts(birth.date);
        if (p) { next.lunarYear = p.ly; next.lunarMonth = p.lm; next.lunarDay = p.ld; }
      }
      setBirthValue(next);
      if (birth.time) setBirthTime(timeNameToFull(birth.time));
      setGender(birth.gender === '女' ? '女' : birth.gender === '男' ? '男' : '');
    }
  }, [birth]);

  // 用户是否选择使用了出生档案
  const profileUsedRef = useRef(false);

  // 用户主动使用出生档案 → 回填表单
  const applySavedProfile = () => {
    profileUsedRef.current = true;
    const sb = savedBirthRef.current;
    if (!sb) return;
    if (isValidPlace(sb.province, sb.city)) {
      setBirthProvince(sb.province as string);
      setBirthCity(sb.city as string);
      writeSavedBirthPlace(sb.province as string, sb.city as string);
    }
    if (sb.date) {
      const next: BirthDateValue = { date: sb.date, mode: birthValue.mode };
      if (typeof sb.lunarYear === 'number' && typeof sb.lunarMonth === 'number' && typeof sb.lunarDay === 'number') {
        next.lunarYear = sb.lunarYear;
        next.lunarMonth = sb.lunarMonth;
        next.lunarDay = sb.lunarDay;
      } else {
        const p = solarToLunarParts(sb.date);
        if (p) { next.lunarYear = p.ly; next.lunarMonth = p.lm; next.lunarDay = p.ld; }
      }
      setBirthValue(next);
    }
    if (sb.time) setBirthTime(timeNameToFull(sb.time));
    setGender(sb.gender === '女' ? '女' : '');
  };

  // 出生表单最新快照（ref）：自动排盘由 setTimeout 延迟触发，闭包可能捕获
  // 旧状态；parseBirth 改读该 ref（ref 对象跨渲染稳定、.current 在调用时才求值），
  // 保证延迟触发的排盘一定拿到出生档案回填后的真实出生时间。
  const birthFormRef = useRef({ date: birthValue.date, time: birthTime, gender });
  useEffect(() => {
    birthFormRef.current = { date: birthValue.date, time: birthTime, gender };
  }, [birthValue.date, birthTime, gender]);

  // 术数勾选最新快照（ref）：requestAll 由 setTimeout 延迟触发，若直接闭包捕获
  // selChips 会拿到排盘前的旧勾选；改读 ref 保证与实际勾选一致。
  const selChipsRef = useRef<Set<string>>(selChips);
  useEffect(() => {
    selChipsRef.current = selChips;
  }, [selChips]);

  const onBirthValueChange = (v: BirthDateValue) => {
    setBirthValue(v);
    setBirth(withBirthPlace({
      date: v.date,
      lunarYear: v.lunarYear,
      lunarMonth: v.lunarMonth,
      lunarDay: v.lunarDay,
      time: birthTime.split(' ')[0],
      gender,
    }));
  };
  const onBirthTimeChange = (v: string) => {
    setBirthTime(v);
    setBirth(withBirthPlace({ date: birthValue.date, time: v.split(' ')[0], gender }));
  };
  const onGenderChange = (v: string) => {
    setGender(v);
    setBirth(withBirthPlace({ date: birthValue.date, time: birthTime.split(' ')[0], gender: v }));
  };

  // 从首页 AI 问答跳转时：填入问题 + 自动排盘（原型 autodiv=1，q=问题文本）
  // 等登录会话（authReady）与出生档案（birthLoading）加载完成后再排盘：
  // 否则登录用户的八字/大运会按空值错算。
  const autodivFiredRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('autodiv') !== '1') return;
    if (!authReady || birthLoading) return;
    const q = sp.get('q') || '';
    if (q) setQuestion(q);

    // 首页 AI 助手已解析出结构化生辰时，优先回填 query 中的 date/time/gender，
    // 避免用户重复填写。未提供则保持 visitor 档案原有值。
    const dateParam = sp.get('date');
    const timeParam = sp.get('time');
    const genderParam = sp.get('gender');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const next: BirthDateValue = { date: dateParam, mode: birthValue.mode };
      const p = solarToLunarParts(dateParam);
      if (p) { next.lunarYear = p.ly; next.lunarMonth = p.lm; next.lunarDay = p.ld; }
      setBirthValue(next);
    }
    if (timeParam) setBirthTime(timeNameToFull(timeParam));
    if (genderParam === '男' || genderParam === '女') setGender(genderParam);

    const t = setTimeout(() => {
      if (autodivFiredRef.current) return; // 防止依赖变化重复排盘
      autodivFiredRef.current = true;
      runDivination(q);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, birthLoading]);

  // 恢复上次排盘状态（2026-09-03 改为「云端存档优先」）：
  // 已排过盘的访客切页再回来（组件重挂载），若后端已有该访客的存档（saveReport 落库），
  // 直接拉取最近一条存档渲染排盘图（不再重跑 5 模块排盘 + 不再白烧 AI），AI 解读/综合运势照常流式刷新；
  // 云端无记录 / 后端不可达时回退旧逻辑（自动重跑一次完整排盘）。
  // 关键：依赖 birth?.date（而不是 birth 对象），确保出生数据加载完成后一定触发。
  // 已登录 + 已建档（云端有出生信息）的用户，也会自动展开排盘模块
  const restoredRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // 首页跳转场景已由上方 autodiv effect 处理，避免重复排盘
    if (new URLSearchParams(window.location.search).get('autodiv') === '1') return;
    // 已恢复过则跳过（避免重复排盘）
    if (restoredRef.current) return;
    // 等待 birth 加载完成（birth?.date 为 undefined 时说明数据还没到）
    if (!birth?.date) return;
    // 条件1：本地已有排盘记录（访客/用户通用）
    const divinedKey = storage.getItem(BUGUA_DIVINED_KEY);
    const hasDivined = divinedKey === '1';
    // 条件2：已登录用户且已建档 → 自动展开排盘
    const hasProfile = mode === 'user';
    if (!hasDivined && !hasProfile) {
      restoredRef.current = true;
      return;
    }
    const savedQ = storage.getItem(BUGUA_QUESTION_KEY) || '';
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;
    /** 回退：云端无记录/接口失败 → 维持原「自动重跑排盘」行为 */
    const fallbackAutoRun = () => {
      if (cancelled) return;
      restoredRef.current = true;
      if (savedQ) setQuestion(savedQ);
      // 延迟执行：等 birth 回填 effect 先填好表单，再用档案最新数据排盘
      timers.push(setTimeout(() => {
        runDivination(savedQ);
        // 排盘完成后滚动到结果区
        timers.push(setTimeout(() => {
          const result = document.getElementById('divinationResult');
          if (result) result.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 600));
      }, 300));
    };
    /** 云端恢复：拉最近一条报告 → hydrateFromReport 直接渲染排盘图 */
    const restoreFromCloud = async () => {
      try {
        if (!visitorId) { fallbackAutoRun(); return; }
        const list = await fetchReports(visitorId, 1);
        if (cancelled) return;
        if (list?.length) {
          const ok = await hydrateFromReport(list[0]);
          if (cancelled) return;
          if (ok) {
            restoredRef.current = true;
            timers.push(setTimeout(() => {
              const result = document.getElementById('divinationResult');
              if (result) result.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 300));
            return;
          }
        }
        fallbackAutoRun();
      } catch {
        if (!cancelled) fallbackAutoRun();
      }
    };
    void restoreFromCloud();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birth?.date, mode, visitorId]);

  // 术数 chip 切换（原型 toggleChip）
  const toggleChip = (c: string) => {
    setSelChips((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  // 全选/全不选（原型 toggleChipAll）
  const toggleChipAll = () => {
    setSelChips((prev) => (prev.size === MODULE_CHIPS.length ? new Set<string>() : new Set(MODULE_CHIPS)));
  };

  // 开始排盘（原型 runDivination + 精灵反应）
  // qOverride：切页回来自动恢复排盘时传入持久化的问题文本（避免闭包引用旧 state）
  const runDivination = (qOverride?: string) => {
    // 表单校验：出生日期和时辰为空时提示用户填写
    if (!birthFormRef.current.date) {
      showFormError('请先填写出生日期再开始排盘');
      return;
    }
    // 摇钱法校验：六次投掷必须全部完成
    if (liuyaoMethod === 'coin' && coinFaces.some((f) => !f)) {
      setOpenCfg((p) => ({ ...p, liuyao: true }));
      showFormError('摇钱法需要完成六次投掷，展开「六爻起卦」点击卦爻或「一键摇卦」补齐');
      return;
    }
    // 梅花数字起卦校验：两个数都要填
    if (selChipsRef.current.has('梅花易数') && !meihuaReady()) {
      setOpenCfg((p) => ({ ...p, meihua: true }));
      showFormError('梅花易数数字起卦需要填写两个数字');
      return;
    }
    const effQ = qOverride ?? question;
    setFormError('');
    setRestoredRec(null); // 手动实排：清掉「云端存档恢复」提示，后续内容来自本次实排
    setDivined(true);
    // 默认落在本轮实际勾选的第一个模块 tab（新一轮起卦，重置并持久化）
    setActiveModulePersist(visibleModuleTabs[0]?.id || 'mod-bazi');
    setInterps({}); // 清空旧解读状态
    setWuxingInterp(null); // 清空五行专属解读
    wuxingInterpRequestedRef.current = false; // 重置请求标记
    setSummaryState(null); // 清空旧综合建议
    // 必须清空上一轮排盘结果：apiResults 是「成功才写入」的累积 state，
    // 若本轮只成功 2 个而上一轮成功 5 个，残留的 3 个 key 会让综合运势虚报
    // 「已融合 5 种」，而 AI 实际只融合了本轮的 2 种。
    setApiResults({});
    setApiStatus({});
    setFused({ count: 0, names: [] });
    if (effQ !== question) setQuestion(effQ);
    // 持久化排盘状态：切页/刷新后回来自动恢复结果（组件重挂载 state 会丢失）
    try {
      storage.setItem(BUGUA_DIVINED_KEY, '1');
      if (effQ) storage.setItem(BUGUA_QUESTION_KEY, effQ);
      else storage.removeItem(BUGUA_QUESTION_KEY);
    } catch { /* 隐私模式等静默忽略 */ }
    // 命运轨迹：每次起卦都留痕（竞品留存体系）
    pushTrajectory({ type: 'bugua', label: '卜卦', summary: effQ ? `卜卦：${effQ}` : '完成一次卜卦' });
    // 起卦即把命主信息写入档案（含出生地）：刷新 / 切页 / 换设备后都能恢复出生地。
    // 不能只依赖「云端存档恢复」链路——那条路径要求本地 birth 已就绪，
    // autodiv 等跳过表单交互的入口本地档案为空，出生地就会回落默认北京。
    const snap = birthFormRef.current;
    if (snap.date) {
      void setBirth(withBirthPlace({
        date: snap.date,
        time: snap.time.split(' ')[0],
        gender: snap.gender || undefined,
      }));
    }
    void requestAll(effQ);
  };

  /** 解析出生信息 -> 后端统一入参
   *  优先使用用户表单填写的数据；若表单为空但有保存的出生档案（自动排盘场景），
   *  则使用 savedBirthRef 中的档案数据。 */
  const parseBirth = (q?: string): PaipanRequest => {
    const { date, time, gender: g } = birthFormRef.current;
    const timeText = time ? (time.split(' ')[0] || '不详') : '不详';
    // 农历录入模式：把用户录入的农历分量原样上送，由后端换算公历。
    // BirthDatePicker 已保证 date 始终是规范化公历，但后端仍可能优先以 lunar 为准。
    const lunarArg =
      birthValue.mode === 'lunar' && birthValue.lunarYear && birthValue.lunarMonth && birthValue.lunarDay
        ? { year: birthValue.lunarYear, month: birthValue.lunarMonth, day: birthValue.lunarDay }
        : undefined;
    const solarDate = date || '';
    // 表单有填写 → 使用表单数据
    if (solarDate) {
      const [y, m, d] = solarDate.split('-').map(Number);
      return {
        year: y || 1995,
        month: m || 1,
        day: d || 1,
        timeText,
        gender: g,
        question: q ?? question,
        lunar: lunarArg,
      };
    }
    // 表单为空 → 使用保存的出生档案（自动排盘）
    const sb = savedBirthRef.current;
    if (sb?.date) {
      const [y, m, d] = sb.date.split('-').map(Number);
      return {
        year: y || 1995,
        month: m || 1,
        day: d || 1,
        timeText: sb.time || '不详',
        gender: sb.gender === '女' ? '女' : '男',
        question: q ?? question,
        lunar: lunarArg,
      };
    }
    // 兜底：无表单也无档案
    return { year: 1995, month: 1, day: 1, timeText: '不详', gender: g, question: q ?? question, lunar: lunarArg };
  };

  /**
   * 真太阳时校正（P3-2 自动接入）：只负责把出生地经度挂到请求上，校正本身由**后端**完成。
   *
   * 为什么不在前端换算：旧实现是「时辰 → 取区间中点 → 校正 → 再取整回时辰」的有损往返，
   * 单次量化误差可达 ±1 小时；且前端算完后端不知情，同一份生辰换个入口结果就对不上。
   * 现在后端在分钟级上校正并回传 trueSolarTime 详情，前端只做展示。
   *
   * 未开启 / 经度非法 时不挂 longitude —— 后端见不到该字段即不校正，行为与旧版完全一致。
   */
  const applyTrueSolar = (req: PaipanRequest): PaipanRequest => {
    if (!tstEnabled) return req;
    const lng = birthPlaceRef.current.lng;
    if (!Number.isFinite(lng) || lng < 73 || lng > 135) return req;
    return { ...req, longitude: lng };
  };

  /** 把后端回传的真太阳时校正详情渲染成表单提示（后端权威，前端不重算） */
  useEffect(() => {
    const t = (apiResults.bazi as BaziAPIResult | undefined)?.trueSolarTime;
    if (!t) {
      setTstInfo('');
      return;
    }
    const sign = t.totalMin > 0 ? '+' : '';
    const shift = t.dayOffset !== 0
      ? `（日期${t.dayOffset > 0 ? '+' : ''}${t.dayOffset}天）`
      : '';
    setTstInfo(
      `真太阳时校正 ${sign}${t.totalMin.toFixed(1)} 分钟：` +
        `${t.clockTime} → ${t.correctedTime}${shift}`
    );
  }, [apiResults.bazi]);

  /** 请求单个术数：成功存结果标 online + 立即请求 AI 解读；失败降级标 offline */
  const fetchModule = async (key: ModuleKey, req: PaipanRequest) => {
    setApiStatus((s) => ({ ...s, [key]: 'loading' }));
    try {
      const res = key === 'bazi' ? await calculateBazi(req)
        : key === 'ziwei' ? await calculateZiwei(req)
        : key === 'liuyao' ? await calculateLiuyao(req)
        : key === 'meihua' ? await calculateMeihua(req)
        : key === 'qimen' ? await calculateQimen(req)
        : key === 'liuren' ? await calculateLiuren(req)
        : await calculateTaiyi(req);
      setApiResults((r) => ({ ...r, [key]: res as never }));
      setApiStatus((s) => ({ ...s, [key]: 'online' }));
      // 八字排盘成功后保存到 localStorage，供风水页跨页读取喜用神
      if (key === 'bazi') {
        saveBaziLink(res as unknown as Record<string, unknown>, req);
      }
      // 成功后：立刻用 SSE 流式拉 AI 解读（逐 chunk 显示，不再等全量后才出现）
      setInterps((s) => ({ ...s, [key]: 'loading' }));
      const controller = new AbortController();
      requestInterpretStream(key, res, {
        signal: controller.signal,
        onDelta: (_chunk, fullText) => {
          setInterps((s) => ({
            ...s,
            [key]: { text: fullText, disclaimer: '', meta: makePlaceholderMeta(key) },
          }));
        },
      })
        .then((finalRes) => {
          if (finalRes?.text) setInterps((s) => ({ ...s, [key]: finalRes }));
        })
        .catch(() => setInterps((s) => ({ ...s, [key]: 'error' })));
      return { key, res };
    } catch {
      setApiStatus((s) => ({ ...s, [key]: 'offline' }));
      return null;
    }
  };

  /** 并行请求 5 个排盘接口（各自独立降级），全部完成后将在线结果自动存档为综合报告 */
  const requestAll = (q?: string) => {
    // 真太阳时校正（可选，默认关闭）：先校正再派生各模块请求体
    const req = applyTrueSolar(parseBirth(q));
    // 六爻起卦方式：仅六爻接口消费，其他模块后端忽略（schema 已兼容）
    if (liuyaoMethod !== 'time') {
      req.method = liuyaoMethod;
      const li = liuyaoLinesInput();
      if (li) req.linesInput = li;
    }
    // 梅花起卦方式（M5）：与六爻共用 req.method 字段，两者可能不同，
    // 故按模块单独派生请求体，互不覆盖。
    const meihuaReq: PaipanRequest = { ...req };
    if (meihuaMethod !== 'time') {
      meihuaReq.method = meihuaMethod;
      if (meihuaMethod === 'number') {
        meihuaReq.num1 = Number(mhNum1) || 0;
        meihuaReq.num2 = Number(mhNum2) || 0;
      } else if (meihuaMethod === 'manual') {
        meihuaReq.shangNum = mhShang;
        meihuaReq.xiaNum = mhXia;
        meihuaReq.dongNum = mhDong;
      }
    } else {
      meihuaReq.method = 'time';
    }
    meihuaReq.numType = meihuaNumType;  // M6 应期取数类型
    // 奇门手动定局（Q10）：仅 manual 模式向排盘请求注入阴阳遁+局数
    const qimenReq: PaipanRequest = { ...req };
    if (qimenJuMode === 'manual') {
      qimenReq.qimenJu = { yinyang: qimenYinyang, ju: qimenJuNum };
    }
    // 按勾选决定实际排盘范围：此前这里硬编码 5 个模块，勾选形同虚设。
    // 八字 与 五行能量 共用 bazi 排盘（后者由前者派生），去重避免重复请求。
    const chipNames = MODULE_CHIPS.filter((c) => selChipsRef.current.has(c));
    const picked = Array.from(new Set(chipNames.map((c) => CHIP_TO_MODULE[c])));
    if (picked.length === 0) {
      showFormError('请至少勾选一种排盘术数再开始排盘');
      return;
    }
    Promise.all(
      picked.map((k) => fetchModule(k, k === 'meihua' ? meihuaReq : k === 'qimen' ? qimenReq : req))
    ).then((items) => {
      const ok = items.filter(
        (it): it is { key: ModuleKey; res: BaziAPIResult | ZiweiAPIResult | LiuyaoAPIResult | MeihuaAPIResult | QimenAPIResult } =>
          it !== null
      );
      if (ok.length === 0) return; // 全部离线，不存档
      const results: Record<string, unknown> = {};
      ok.forEach(({ key, res }) => {
        results[key] = res;
      });
      const title = `${req.year}-${String(req.month).padStart(2, '0')}-${String(req.day).padStart(2, '0')} ${req.timeText}${req.gender} · 综合命盘`;
      // 存档失败静默，不打断用户（离线环境可接受）；按访客ID存云端
      if (visitorId) {
        // 存档额外带上出生地（province/city）：恢复时无需按经度反查，省/市语义完整，
        // 且在行政区划表调整后仍然准确（换设备 / 清缓存后从云端恢复出生地）。
        void saveReport({
          visitorId,
          title,
          params: { ...req, province: birthPlaceRef.current.province, city: birthPlaceRef.current.city },
          results,
        }).catch(() => {});
      }

      // 综合运势聚合不在 requestAll 里做：统一由下方「综合运势自动重聚合」effect 处理
      // （apiResults/勾选变化都会触发，保证描述与勾选永远一致）。此处只负责排盘与存档。
    });
  };

  /** 综合运势请求：复用上次聚合结果，并行预取 综合/感情/事业 三个聚焦维度（SSE 流式）。
   *  三个维度各自独立流式、互不阻塞，全部到达后平铺展示，不再有切换等待。 */
  const runSummary = () => {
    const last = lastSummaryReq.current;
    if (!last) return;
    setSummaryState('loading');
    setLoveState('loading');
    setCareerState('loading');
    const fire = (focus: string | null, setter: (s: SummaryState) => void) =>
      requestSummaryStream(last.modules, last.question, {
        focus,
        // 每个 section 到达即更新，实现"共识度→卡片→建议→总结"渐进渲染
        onSection: (partial) => setter(partial),
      })
        .then((final) => setter(final))
        .catch(() => setter('error'));
    fire(null, setSummaryState);
    fire('love', setLoveState);
    fire('career', setCareerState);
  };

  // 综合运势自动重聚合（唯一聚合入口）：
  // 勾选 ≥2 项且勾选术数的排盘结果齐备时，用现有排盘结果自动重算融合
  // （不发排盘请求，仅一次 AI 汇总，1s 防抖），保证「已融合 N 种 / 术数名单」
  // 永远与当前勾选一致——修掉「排盘后改勾选，描述还停留在旧快照」的问题。
  // 勾选不足 / 有术数还没排盘结果 → 清空综合运势，等下一次排盘。
  useEffect(() => {
    if (!divined) return;
    if (summaryRegenTimerRef.current) clearTimeout(summaryRegenTimerRef.current);
    const chips = MODULE_CHIPS.filter((c) => selChips.has(c));
    const clearSummary = () => {
      setSummaryState(null);
      setLoveState(null);
      setCareerState(null);
      setFused({ count: 0, names: [] });
      lastSummaryReq.current = null;
    };
    if (chips.length < 2) { clearSummary(); return; }
    const needMods = Array.from(new Set(chips.map((c) => CHIP_TO_MODULE[c])));
    if (needMods.some((k) => !apiResults[k])) { clearSummary(); return; }
    summaryRegenTimerRef.current = setTimeout(() => {
      const sumModules: { module: string; name: string; result: unknown }[] = needMods.map((k) => ({
        module: k,
        name: MODULE_NAMES[k],
        result: apiResults[k],
      }));
      // 五行能量：由八字排盘派生维度，仍喂给 AI 参与分析（对外计数只按勾选术数）
      const wx = apiResults.bazi as BaziAPIResult | undefined;
      if (wx) {
        const ys = wx.yongshen;
        sumModules.push({
          module: 'wuxing',
          name: '五行能量',
          result: {
            wuxing: (wx.wuxing ?? []).map((w) => `${w.label}${w.pct}%`).join(' ') || '-',
            wuxingCount: (wx.wuxingCount ?? []).map((c) => `${c.label}:${c.count}`).join(' ') || '-',
            lacking: wx.lacking?.length ? wx.lacking.join('、') : '无',
            yongshen: ys ? `喜${(ys.xi ?? []).join('/')}·忌${(ys.ji ?? []).join('/')}` : '-',
          },
        });
      }
      lastSummaryReq.current = { modules: sumModules, question };
      setFused({ count: chips.length, names: chips });
      runSummary();
    }, 1000);
    return () => {
      if (summaryRegenTimerRef.current) clearTimeout(summaryRegenTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divined, selChips, apiResults]);

  /**
   * 从云端存档恢复（2026-09-03）：
   * 用最近一次 saveReport 落库的 results 直接重建排盘图 —— 排盘接口不再重跑，
   * 出生信息/所问之事按存档 params 回填，AI 解读/综合运势照常流式刷新（与实排后的效果一致）。
   * 返回 false 表示存档无可用模块数据，调用方应回退自动重排。
   */
  const hydrateFromReport = async (rec: ReportListItem): Promise<boolean> => {
    try {
      // 带 visitorId：后端对匿名报告做归属校验，缺失会 404
      const detail = await fetchReport(rec.id, visitorId);
      if (!detail?.results) return false;
      const results: Record<string, unknown> = detail.results || {};
      const restored: Record<string, unknown> = {};
      const present: ModuleKey[] = [];
      (['bazi', 'ziwei', 'liuyao', 'meihua', 'qimen', 'liuren', 'taiyi'] as ModuleKey[]).forEach((k) => {
        if (results[k]) { restored[k] = results[k]; present.push(k); }
      });
      if (!present.length) return false;

      // 排盘入参 → 回填表单（与排盘时 parseBirth 同源，保证日期条/卡片展示与存档一致）
      const p = (detail.params || {}) as Partial<PaipanRequest> & Record<string, unknown>;
      if (p.question) setQuestion(p.question);
      const d = p.year && p.month && p.day ? `${p.year}-${pad2(p.month)}-${pad2(p.day)}` : '';
      if (d) {
        const next: BirthDateValue = { date: d, mode: birthValue.mode };
        const lp = solarToLunarParts(d);
        if (lp) { next.lunarYear = lp.ly; next.lunarMonth = lp.lm; next.lunarDay = lp.ld; }
        setBirthValue(next);
      }
      if (p.timeText) setBirthTime(timeNameToFull(p.timeText));
      if (p.gender) setGender(p.gender === '女' ? '女' : '男');

      // 真太阳时出生地恢复优先级：本地保存值（用户最近显式选择）> 存档 province/city > 经度反查（旧存档兜底）。
      // 本地值必须最高：用户改了出生地但还没重新起卦时，存档里仍是旧值，若让存档优先就会「改了又弹回去」。
      // 经度反查只作旧存档兜底：它拿不到省/市语义，行政区划表调整后会失准；新存档已直接存 province/city。
      const archivedPlace =
        typeof p.province === 'string' && typeof p.city === 'string' && isValidPlace(p.province, p.city)
          ? { province: p.province, city: p.city }
          : null;
      const restoredPlace =
        readSavedBirthPlace() ??
        archivedPlace ??
        (Number.isFinite(p.longitude) ? findNearestCityByLng(p.longitude as number) : null);
      if (restoredPlace) {
        setBirthProvince(restoredPlace.province);
        setBirthCity(restoredPlace.city);
        writeSavedBirthPlace(restoredPlace.province, restoredPlace.city);
      }
      // 开关：用户显式偏好优先；无偏好时按存档是否含出生地信息推断
      const tstPref = readSavedTstEnabled();
      setTstEnabled(tstPref !== null ? tstPref : (Number.isFinite(p.longitude) || !!archivedPlace));

      // 术数勾选恢复为存档内实际成功模块（重排/聚焦时保持一致范围）；
      // 有八字则五行能量 chip 同步勾上（tab 对应可见）。按 MODULE_CHIPS 顺序归一。
      const names = present.map((k) => MODULE_TO_CHIP[k]).filter(Boolean);
      if (present.includes('bazi')) names.push('五行能量');
      const chipNames = MODULE_CHIPS.filter((c) => names.includes(c));
      if (chipNames.length) setSelChips(new Set(chipNames));

      // 直接用存档 results 渲染排盘图：不再请求排盘接口
      setApiResults(restored as unknown as ModuleResults);
      const st: Partial<Record<ModuleKey, ModuleStatus>> = {};
      present.forEach((k) => { st[k] = 'online'; });
      setApiStatus(st);
      // 清空旧 AI 解读并重新流式刷新（与 fetchModule 成功分支一致）
      setInterps({});
      setWuxingInterp(null);
      wuxingInterpRequestedRef.current = false;
      setSummaryState(null);
      setLoveState(null);
      setCareerState(null);
      setFused({ count: 0, names: [] });
      setDivined(true);
      // 切回本页恢复存档时，优先恢复上次停留的模块 tab（从 localStorage 读取），
      // 仅当该 tab 当前不可见时才回落到第一个可见 tab；此处【不写入】LS，避免覆盖用户选择
      const savedMod = (() => {
        try { return storage.getItem(BUGUA_ACTIVE_MODULE_KEY); } catch { return null; }
      })();
      const restoredMod = (savedMod && visibleModuleTabs.some((t) => t.id === savedMod))
        ? savedMod
        : (visibleModuleTabs[0]?.id || 'mod-bazi');
      setActiveModule(restoredMod);

      // 持久化恢复标记：下次进入仍按「直接看内容」处理
      try {
        storage.setItem(BUGUA_DIVINED_KEY, '1');
        if (p.question) storage.setItem(BUGUA_QUESTION_KEY, p.question);
      } catch { /* 隐私模式等静默忽略 */ }

      // AI 解读流式刷新（各模块并行，与实排后体验一致）
      present.forEach((k) => {
        const res = restored[k];
        if (!res) return;
        setInterps((s) => ({ ...s, [k]: 'loading' }));
        requestInterpretStream(k, res, {
          onDelta: (_chunk, fullText) => {
            setInterps((s) => ({
              ...s,
              [k]: { text: fullText, disclaimer: '', meta: makePlaceholderMeta(k) },
            }));
          },
        })
          .then((finalRes) => {
            if (finalRes?.text) setInterps((s) => ({ ...s, [k]: finalRes }));
          })
          .catch(() => setInterps((s) => ({ ...s, [k]: 'error' })));
      });

      // 综合运势聚合统一由「综合运势自动重聚合」effect 处理（apiResults/勾选就绪后自动触发）
      setRestoredRec({ id: rec.id, title: rec.title || '最近一次排盘', at: rec.created_at || '' });
      return true;
    } catch {
      return false;
    }
  };

  // 模块切换：切换到五行能量时触发专属 AI 解读（focus='wuxing'）
  const wuxingInterpRequestedRef = useRef(false);
  const switchModule = (id: string) => {
    setActiveModulePersist(id);
    // 切换到五行能量且已排盘、尚未请求过专属解读时，触发流式请求
    if (id === 'mod-wuxing' && !wuxingInterpRequestedRef.current && apiResults.bazi) {
      wuxingInterpRequestedRef.current = true;
      setWuxingInterp('loading');
      const controller = new AbortController();
      requestInterpretStream('bazi', apiResults.bazi, {
        signal: controller.signal,
        focus: 'wuxing',
        onDelta: (_chunk, fullText) => {
          setWuxingInterp({ text: fullText, disclaimer: '', meta: makePlaceholderMeta('bazi') });
        },
      })
        .then((finalRes) => {
          if (finalRes?.text) setWuxingInterp(finalRes);
        })
        .catch(() => setWuxingInterp('error'));
    }
  };

  // 如果用户停留在五行能量 tab，等 bazi 数据就绪后自动触发专属解读
  useEffect(() => {
    if (activeModule !== 'mod-wuxing') return;
    if (!apiResults.bazi) return;
    if (wuxingInterpRequestedRef.current) return;
    wuxingInterpRequestedRef.current = true;
    setWuxingInterp('loading');
    const controller = new AbortController();
    requestInterpretStream('bazi', apiResults.bazi, {
      signal: controller.signal,
      focus: 'wuxing',
      onDelta: (_chunk, fullText) => {
        setWuxingInterp({ text: fullText, disclaimer: '', meta: makePlaceholderMeta('bazi') });
      },
    })
      .then((finalRes) => {
        if (finalRes?.text) setWuxingInterp(finalRes);
      })
      .catch(() => setWuxingInterp('error'));
    return () => controller.abort();
  }, [activeModule, apiResults.bazi]);

  const confirmPayment = () => {
    setDeepOpen(false);
    showToast('🎉 支付成功！正在生成深度报告…', 'success');
  };

  /** 生成结果卡海报：复用 AI 服务 /api/v1/poster（与解梦页同款），导出当前结果图片 */
  const handlePoster = async () => {
    const tab = MODULE_TABS.find((t) => t.id === activeModule);
    const keyword = tab?.label || '命理结果';
    let text = '';
    if (activeModule === 'mod-summary') {
      const s = summaryState && summaryState !== 'loading' && summaryState !== 'error' ? summaryState : null;
      if (s?.data && s.data.ok !== false) {
        const parts = [s.data.summary, s.data.outlook];
        for (const a of s.data.advice || []) parts.push(...(a.items || []));
        text = parts.filter(Boolean).join('\n');
      }
    } else {
      const key = TAB_TO_MODULE[activeModule];
      const it = activeModule === 'mod-wuxing' ? wuxingInterp : (key ? interps[key] : undefined);
      if (it && it !== 'loading' && it !== 'error') text = it.text || '';
    }

    setPosterLoading(true);
    setPosterResult(null);
    try {
      const r = await requestPoster(keyword, text || `探索${keyword}的命理全景`);
      setPosterResult(r);
      // 分享存档：首次生成直接落库；重新生成则覆盖（后端按 user+module upsert）
      void share.persist({ title: keyword, shareText: r.shareText, imageUrl: r.imageUrl, imagePrompt: r.imagePrompt });
    } catch (err: any) {
      const fallback: PosterResult = {
        shareText: `「${keyword}」—— 卜一卦，且当娱乐参考。`,
        imagePrompt: '',
        imageUrl: null,
        imageError: err?.message || '生成失败',
        fallback: true,
      };
      setPosterResult(fallback);
      void share.persist({ title: keyword, shareText: fallback.shareText, imageUrl: null, imagePrompt: '' });
    } finally {
      setPosterLoading(false);
    }
  };

  /**
   * 分享弹窗打开后的数据源决策（仅在已登录且已向库请求过存档后执行）：
   * ・库内已有存档（share.saved）→ 直接渲染库内容，省一次 AI 生成（二次进入场景）
   * ・库内无存档 → 等待用户在弹窗内点「生成海报」（保留原交互，首次生成后落库）
   */
  useEffect(() => {
    if (!shareOpen || !share.ready || !share.isAuthed || !share.loaded) return;
    if (share.saved && !posterResult) {
      setPosterResult(shareOutToPoster(share.saved));
    }
  }, [shareOpen, share.ready, share.isAuthed, share.loaded, share.saved, posterResult]);

  /** 导出 AI 生成的海报为 PDF（图片内嵌，用户另存为 PDF） */
  const handleDownloadPoster = async () => {
    if (!posterResult?.imageUrl) return;
    const title = `玄镜排盘海报 · ${MODULE_TABS.find((t) => t.id === activeModule)?.label ?? '命理结果'}`;
    printDocument({ title, html: `<img src="${posterResult.imageUrl}" alt="${title}" />` });
  };

  const ai = moduleAIContent[activeModule];
  /** 是否展示「起卦设置」步骤：只勾选了不可配置术数（八字/紫微）时整块隐藏 */
  const hasCfg = selChips.has('六爻') || selChips.has('梅花易数') || selChips.has('奇门遁甲');

  // 当前模块的 AI 解读状态（五行能量用独立 wuxingInterp，其余按模块取 interps）
  const interpKey = TAB_TO_MODULE[activeModule];
  const interp = activeModule === 'mod-wuxing'
    ? wuxingInterp
    : (interpKey ? interps[interpKey] : undefined);
  const interpMeta = interp && interp !== 'loading' && interp !== 'error' ? interp.meta : null;
  // 综合运势 AI 结构化结果（供侧栏「小玄陪你看看这张命盘」展示概述 / 兜底文案取共识维度）
  const summaryResp = summaryState && summaryState !== 'loading' && summaryState !== 'error' ? summaryState : null;
  /** 侧栏综合运势叙述稿：概述 → 趋势 → 综合卡片 → 时间轴 → 行动建议。
   *  AI 偶发漏字段（只回 summary+outlook），故卡片/建议缺位时回落到确定性兜底内容，避免侧栏只剩两行。 */
  const buildSummarySidebarMd = (r: NonNullable<typeof summaryResp>): string => {
    const d = r.data;
    const lines: string[] = [];
    if (d.summary) lines.push(d.summary);
    if (d.outlook) lines.push(`📌 近期趋势：${d.outlook}`);
    const cards = (d.cards ?? []).length
      ? (d.cards ?? []).map((c) => ({ name: c.name, desc: c.desc }))
      : SUMMARY_CARDS.map((c) => ({ name: c.name, desc: c.desc ?? '' }));
    if (cards.length) lines.push(cards.map((c) => `- **${c.name}**：${c.desc}`).join('\n'));
    // 注意：timeline 时间轴已在主内容区「关键阶段运势时间轴」卡片展示，侧栏不再重复渲染
    // advice 已在主内容区 SummaryModule 以结构化卡片展示，侧栏不再重复渲染
    return lines.filter(Boolean).join('\n\n');
  };
  /** 综合运势原始解读纯文本（轻量追问的上下文） */
  const summaryPlain = summaryResp ? buildSummarySidebarMd(summaryResp) : '';

  return (
    <div className="page active" id="page-bugua">
      {/* 页面头部 */}
      <div className="page-header">
        <div>
          <div className="page-title">☯️ 多术数排盘</div>
          <div className="page-subtitle">八字 · 五行 · 紫微 · 六爻 · 梅花 · 奇门 · 综合运势 — 命理全景</div>
        </div>
      </div>

      {/* 起卦信息（分步表单 + 右侧小玄） */}
      <div className="form-section-wrapper">
        <div className="unified-panel">
          <div className="panel-inner">
            <div className="panel-form">
              {/* 面板标题 */}
              <div className="form-section-header">
                <div className="form-section-icon">☯️</div>
                <div>
                  <div className="form-section-title">起卦信息</div>
                  <div className="form-section-sub">填写命主信息并选择术数，AI 将自动交叉验证</div>
                </div>
              </div>

              {/* ① 命主信息 */}
              <section className="cfg-step">
                <div className="cfg-step-head">
                  <span className="cfg-step-no">1</span>
                  <span className="cfg-step-title">命主信息</span>
                  <span className="cfg-step-hint">出生时辰越精确排盘越准，不确定可选「不详」</span>
                </div>
                <div className="cfg-step-body">
                  <div className="form-row form-row-4">
                    <div>
                      <label className="form-label">姓名（可选）</label>
                      <input className="form-input field-pill" placeholder="请输入姓名" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">性别</label>
                      <select className="form-select field-pill" value={gender} onChange={(e) => onGenderChange(e.target.value)}>
                        <option value="" disabled>请选择性别</option>
                        <option>男</option><option>女</option>
                      </select>
                    </div>
                    <div className="birth-field">
                      <BirthDatePicker
                        value={birthValue}
                        onChange={onBirthValueChange}
                        minYear={1900}
                        maxYear={new Date().getFullYear()}
                      />
                    </div>
                    <div>
                      <label className="form-label">出生时辰</label>
                      <select className="form-select field-pill" value={birthTime} onChange={(e) => onBirthTimeChange(e.target.value)}>
                        <option value="" disabled>请选择时辰</option>
                        {TIME_OPTIONS.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 真太阳时校正（P3-2）：默认开启，经度随请求上送，由后端分钟级校正 */}
                  <div className="tst-row">
                    <label className="tst-switch">
                      <input
                        type="checkbox"
                        checked={tstEnabled}
                        onChange={(e) => {
                          setTstEnabled(e.target.checked);
                          writeSavedTstEnabled(e.target.checked);
                          if (!e.target.checked) setTstInfo('');
                        }}
                      />
                      <span>真太阳时校正</span>
                    </label>
                    {tstEnabled && (
                      <div className="tst-lng">
                        <label className="form-label">出生地</label>
                        <Cascader
                          value={[birthProvince, birthCity]}
                          onChange={(prov, city) => changeBirthPlace(prov, city)}
                          placeholder="选择出生地（省 / 市）"
                          className="tst-cascader"
                        />
                        <span className="tst-lng-hint">东经 {birthLng.toFixed(2)}°</span>
                      </div>
                    )}
                    {tstInfo && <div className="tst-info">{tstInfo}</div>}
                  </div>

                  {/* 出生信息汇总 —— 全页仅此一处，各结果模块不再重复展示 */}
                  <div className="bugua-datetime-bar">
                    <span>📅 公历：{formatSolarText(birthValue.date)}</span>
                    <span>🌗 农历：{birthValue.date ? formatLunarText(birthValue.lunarYear ?? 0, birthValue.lunarMonth ?? 0, birthValue.lunarDay ?? 0) : '—'}</span>
                    <span>⏰ 时辰：{birthTime ? birthTime.split(' ')[0] : '—'}</span>
                  </div>
                </div>
              </section>

              {/* ② 所问之事 */}
              <section className="cfg-step">
                <div className="cfg-step-head">
                  <span className="cfg-step-no">2</span>
                  <span className="cfg-step-title">所问之事</span>
                  <span className="cfg-step-hint">选填 · AI 据此定制解读，梅花「字数起卦」也会用到</span>
                </div>
                <div className="cfg-step-body">
                  <input
                    className="form-input question-field-input"
                    placeholder="例如：今年事业运如何？何时遇到正缘？"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                  />
                  <div className="cfg-quick-chips">
                    {QUESTION_PRESETS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        className={'ai-suggestion-chip' + (question === q ? ' chip-active' : '')}
                        onClick={() => setQuestion(question === q ? '' : q)}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* ③ 排盘术数 */}
              <section className="cfg-step">
                <div className="cfg-step-head">
                  <span className="cfg-step-no">3</span>
                  <span className="cfg-step-title">排盘术数</span>
                  <span className={'cfg-step-count' + (selChips.size ? '' : ' is-empty')}>
                    {selChips.size ? `已选 ${selChips.size} 项` : '未选择'}
                  </span>
                </div>
                <div className="cfg-step-body">
                  <div className="form-chips">
                    {MODULE_CHIPS.map((c) => (
                      <button key={c} className={'ai-suggestion-chip' + (selChips.has(c) ? ' chip-active' : '')} onClick={() => toggleChip(c)}>{c}</button>
                    ))}
                    <button className="ai-suggestion-chip chip-gold" onClick={toggleChipAll}>✨ 全选/全不选</button>
                  </div>
                </div>
              </section>

              {/* ④ 起卦设置：折叠面板，只出现已勾选术数的配置，默认收起 */}
              {hasCfg && (
                <section className="cfg-step">
                  <div className="cfg-step-head">
                    <span className="cfg-step-no">4</span>
                    <span className="cfg-step-title">起卦设置</span>
                    <span className="cfg-step-hint">可选 · 默认全部按时间起卦，展开可改起卦方式</span>
                  </div>
                  <div className="cfg-step-body">
                    {selChips.has('六爻') && (
                      <div className={'cfg-acc' + (openCfg.liuyao ? ' open' : '')}>
                        <button type="button" className="cfg-acc-head" onClick={() => toggleCfg('liuyao')} aria-expanded={openCfg.liuyao}>
                          <span className="form-card-dot c-cyan" />
                          <span className="cfg-acc-name">六爻起卦</span>
                          <span className="cfg-acc-summary">{LIUYAO_METHODS.find((m) => m.value === liuyaoMethod)?.label}</span>
                          <span className="cfg-acc-arrow" aria-hidden>▾</span>
                        </button>
                        <div className="cfg-acc-body">
                          <div className="cfg-acc-inner">
                            <div className="form-chips liuyao-method-chips">
                              {LIUYAO_METHODS.map((m) => (
                                <button
                                  key={m.value}
                                  className={'ai-suggestion-chip' + (liuyaoMethod === m.value ? ' chip-active' : '')}
                                  onClick={() => switchLiuyaoMethod(m.value)}
                                >
                                  {m.label}
                                </button>
                              ))}
                            </div>

                            {liuyaoMethod === 'coin' && (
                              <div className="liuyao-coin-panel">
                                <div className="liuyao-coin-hint">
                                  三枚铜钱掷六次（自下而上）：三背为老阳（动）、三字为老阴（动）、一背为少阳、两背为少阴。
                                  <button className="liuyao-coin-tossall" onClick={tossAll}>🎲 一键摇卦</button>
                                </div>
                                <div className="liuyao-coin-row">
                                  {YAO_POS_NAMES.map((posName, i) => {
                                    const faces = coinFaces[i];
                                    return (
                                      <button
                                        key={i}
                                        className={'liuyao-coin-slot' + (faces ? ' tossed' : '')}
                                        onClick={() => tossAt(i)}
                                        title={faces ? `${posName}：${faces.join('')}，点击重掷` : `点击掷第 ${i + 1} 次`}
                                      >
                                        <span className="liuyao-coin-pos">{posName}</span>
                                        {faces ? (
                                          <>
                                            <span className="liuyao-coin-faces">{faces.join(' ')}</span>
                                            <span className="liuyao-coin-value">{YAO_CODE_LABEL[coinFacesToValue(faces)]}</span>
                                          </>
                                        ) : (
                                          <span className="liuyao-coin-empty">点击摇卦</span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {liuyaoMethod === 'manual' && (
                              <div className="liuyao-manual-panel">
                                <div className="liuyao-coin-hint">自下而上逐爻指定：静爻选少阳/少阴，动爻选老阳/老阴（动爻会生成变卦）。</div>
                                <div className="liuyao-manual-row">
                                  {YAO_POS_NAMES.map((posName, i) => (
                                    <div key={i} className="liuyao-manual-item">
                                      <label className="form-label">{posName}</label>
                                      <select
                                        className="form-select field-pill"
                                        value={manualLines[i]}
                                        onChange={(e) => {
                                          const v = Number(e.target.value);
                                          setManualLines((prev) => prev.map((x, j) => (j === i ? v : x)));
                                        }}
                                      >
                                        {YAO_CODE_OPTIONS.map((o) => (
                                          <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                      </select>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {selChips.has('梅花易数') && (
                      <div className={'cfg-acc' + (openCfg.meihua ? ' open' : '')}>
                        <button type="button" className="cfg-acc-head" onClick={() => toggleCfg('meihua')} aria-expanded={openCfg.meihua}>
                          <span className="form-card-dot c-gold" />
                          <span className="cfg-acc-name">梅花易数</span>
                          <span className="cfg-acc-summary">
                            {MEIHUA_METHODS.find((m) => m.value === meihuaMethod)?.label} · {meihuaNumType === 'xian' ? '先天数' : '后天数'}
                          </span>
                          <span className="cfg-acc-arrow" aria-hidden>▾</span>
                        </button>
                        <div className="cfg-acc-body">
                          <div className="cfg-acc-inner">
                            <div className="meihua-config-row">
                              <div className="meihua-config-col">
                                <span className="meihua-config-label">起卦方式</span>
                                <div className="qigua-method-chips">
                                  {MEIHUA_METHODS.map((m) => (
                                    <button
                                      key={m.value}
                                      className={'ai-suggestion-chip' + (meihuaMethod === m.value ? ' chip-active' : '')}
                                      onClick={() => switchMeihuaMethod(m.value)}
                                      title={m.hint}
                                    >
                                      {m.label}
                                    </button>
                                  ))}
                                </div>
                                <div className="qigua-method-hint">
                                  {MEIHUA_METHODS.find((m) => m.value === meihuaMethod)?.hint}
                                </div>
                              </div>
                              <div className="meihua-config-col meihua-config-col-right">
                                <span className="meihua-config-label">应期取数</span>
                                <div className="meihua-numtype-bar">
                                  <button
                                    type="button"
                                    className={'meihua-numtype-btn' + (meihuaNumType === 'xian' ? ' active' : '')}
                                    onClick={() => setMeihuaNumType('xian')}
                                  >先天数</button>
                                  <button
                                    type="button"
                                    className={'meihua-numtype-btn' + (meihuaNumType === 'hou' ? ' active' : '')}
                                    onClick={() => setMeihuaNumType('hou')}
                                  >后天数</button>
                                </div>
                              </div>
                            </div>

                            {meihuaMethod === 'number' && (
                              <div className="meihua-number-panel">
                                <label className="form-label">第一个数</label>
                                <input
                                  className="form-input field-pill"
                                  type="number"
                                  min={0}
                                  placeholder="如 23"
                                  value={mhNum1}
                                  onChange={(e) => setMhNum1(e.target.value)}
                                />
                                <label className="form-label">第二个数</label>
                                <input
                                  className="form-input field-pill"
                                  type="number"
                                  min={0}
                                  placeholder="如 17"
                                  value={mhNum2}
                                  onChange={(e) => setMhNum2(e.target.value)}
                                />
                                {!meihuaReady() && (
                                  <div className="meihua-panel-warn">请填写两个数字后再起卦</div>
                                )}
                              </div>
                            )}

                            {meihuaMethod === 'manual' && (
                              <div className="meihua-manual-panel">
                                <div className="meihua-manual-item">
                                  <label className="form-label">上卦</label>
                                  <select className="form-select field-pill" value={mhShang}
                                    onChange={(e) => setMhShang(Number(e.target.value))}>
                                    {XIANTIAN_TRIGRAMS.map((t, i) => (
                                      <option key={t} value={i + 1}>{t}（{i + 1}）</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="meihua-manual-item">
                                  <label className="form-label">下卦</label>
                                  <select className="form-select field-pill" value={mhXia}
                                    onChange={(e) => setMhXia(Number(e.target.value))}>
                                    {XIANTIAN_TRIGRAMS.map((t, i) => (
                                      <option key={t} value={i + 1}>{t}（{i + 1}）</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="meihua-manual-item">
                                  <label className="form-label">动爻</label>
                                  <select className="form-select field-pill" value={mhDong}
                                    onChange={(e) => setMhDong(Number(e.target.value))}>
                                    {[1, 2, 3, 4, 5, 6].map((n) => (
                                      <option key={n} value={n}>第{n}爻</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}

                            {meihuaMethod === 'text' && (
                              <div className="meihua-text-panel">
                                以你所填「所问之事」的字数起卦（当前 {question.trim().length} 字）
                                {question.trim().length === 0 && (
                                  <span className="meihua-panel-warn">　请在上方填写所问之事</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {selChips.has('奇门遁甲') && (
                      <div className={'cfg-acc' + (openCfg.qimen ? ' open' : '')}>
                        <button type="button" className="cfg-acc-head" onClick={() => toggleCfg('qimen')} aria-expanded={openCfg.qimen}>
                          <span className="form-card-dot c-purple" />
                          <span className="cfg-acc-name">奇门遁甲</span>
                          <span className="cfg-acc-summary">
                            {qimenJuMode === 'auto' ? '自动拆补法' : `手动 · ${qimenYinyang}遁${qimenJuNum}局`}
                          </span>
                          <span className="cfg-acc-arrow" aria-hidden>▾</span>
                        </button>
                        <div className="cfg-acc-body">
                          <div className="cfg-acc-inner">
                            <div className="qimen-ju-mode">
                              <button
                                type="button"
                                className={'ai-suggestion-chip' + (qimenJuMode === 'auto' ? ' chip-active' : '')}
                                onClick={() => setQimenJuMode('auto')}
                              >自动拆补法</button>
                              <button
                                type="button"
                                className={'ai-suggestion-chip' + (qimenJuMode === 'manual' ? ' chip-active' : '')}
                                onClick={() => setQimenJuMode('manual')}
                              >手动定局</button>
                            </div>

                            {qimenJuMode === 'manual' && (
                              <div className="qimen-ju-config">
                                <div className="qimen-ju-col">
                                  <label className="form-label">阴阳遁</label>
                                  <div className="qimen-ju-toggle">
                                    <button
                                      type="button"
                                      className={'qimen-ju-yy' + (qimenYinyang === '阳' ? ' active' : '')}
                                      onClick={() => setQimenYinyang('阳')}
                                    >阳遁（顺布）</button>
                                    <button
                                      type="button"
                                      className={'qimen-ju-yy' + (qimenYinyang === '阴' ? ' active' : '')}
                                      onClick={() => setQimenYinyang('阴')}
                                    >阴遁（逆布）</button>
                                  </div>
                                </div>
                                <div className="qimen-ju-col">
                                  <label className="form-label">局数</label>
                                  <div className="qimen-ju-nums">
                                    {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                                      <button
                                        key={n}
                                        type="button"
                                        className={'qimen-ju-num' + (qimenJuNum === n ? ' active' : '')}
                                        onClick={() => setQimenJuNum(n)}
                                      >{n}</button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* 操作区 */}
              <div className="form-action-card">
                {formError && <div className="form-error-bar" role="alert">⚠️ {formError}</div>}
                <button className="btn-submit btn-submit-lg" onClick={() => runDivination()}>
                  <i className="iconfont icon-input" />
                  开始排盘
                </button>
                <div className="form-action-tip">
                  <span className="tip-icon">🤖</span>
                  根据你的问题，系统将自动匹配最佳术数组合并交叉验证。出生时辰越精确，准确度越高；若不确定可选「不详」。
                </div>
              </div>
            </div>

            {/* 右侧：小玄（透明背景） */}
            <aside className="panel-spirit">
              <div className="spirit-image-wrapper" title="小玄">
                {/* webp 121KB，png 兜底（746KB）；新形象：精灵法师小玄 2026-09-04 */}
                <picture className="spirit-picture">
                  <source srcSet="/images/bugua/xuan-elf-spirit.webp" type="image/webp" />
                  <img className="spirit-img" src="/images/bugua/xuan-elf-spirit.png" alt="小玄" />
                </picture>
                <div className="spirit-aura" />
              </div>
              <div className="spirit-card">
                <div className="spirit-card-title">👋 你好呀，我是小玄</div>
                <div className="spirit-card-text">填好命主信息，选择术数后，我来帮你排盘～</div>
              </div>

              {/* 起卦概览：实时镜像左侧表单，排盘前可核对 */}
              <div className="spirit-brief">
                <div className="brief-title">📋 起卦概览</div>

                <div className="brief-block">
                  <div className="brief-block-label">命主</div>
                  <div className="brief-row">
                    <span className="brief-k">姓名</span>
                    <span className="brief-v">{name.trim() || '未填写'}</span>
                  </div>
                  <div className="brief-row">
                    <span className="brief-k">公历</span>
                    <span className="brief-v">{birthValue.date || '未选择'}</span>
                  </div>
                  <div className="brief-row">
                    <span className="brief-k">农历</span>
                    <span className="brief-v">{birthValue.date ? formatLunarText(birthValue.lunarYear ?? 0, birthValue.lunarMonth ?? 0, birthValue.lunarDay ?? 0) : '—'}</span>
                  </div>
                  <div className="brief-row">
                    <span className="brief-k">时辰</span>
                    <span className="brief-v">{birthTime ? birthTime.split(' ')[0] : '未选择'}</span>
                  </div>
                </div>

                <div className="brief-block">
                  <div className="brief-block-label">所问之事</div>
                  <div className={'brief-question' + (question.trim() ? '' : ' is-empty')}>
                    {question.trim() || '未填写（选填）'}
                  </div>
                </div>

                <div className="brief-block">
                  <div className="brief-block-label">
                    术数组合
                    <span className="brief-count">{selChips.size} / {MODULE_CHIPS.length}</span>
                  </div>
                  <div className="brief-chips">
                    {MODULE_CHIPS.map((c) =>
                      selChips.has(c) ? <span key={c} className="brief-chip">{c}</span> : null
                    )}
                    {selChips.size === 0 && <span className="brief-empty">未选择术数</span>}
                  </div>
                </div>

                {hasCfg && (
                  <div className="brief-block">
                    <div className="brief-block-label">起卦方式</div>
                    {selChips.has('六爻') && (
                      <div className="brief-row">
                        <span className="brief-k">六爻</span>
                        <span className="brief-v">{LIUYAO_METHODS.find((m) => m.value === liuyaoMethod)?.label}</span>
                      </div>
                    )}
                    {selChips.has('梅花易数') && (
                      <div className="brief-row">
                        <span className="brief-k">梅花</span>
                        <span className="brief-v">
                          {MEIHUA_METHODS.find((m) => m.value === meihuaMethod)?.label} · {meihuaNumType === 'xian' ? '先天' : '后天'}
                        </span>
                      </div>
                    )}
                    {selChips.has('奇门遁甲') && (
                      <div className="brief-row">
                        <span className="brief-k">奇门</span>
                        <span className="brief-v">
                          {qimenJuMode === 'auto' ? '自动拆补法' : `手动 ${qimenYinyang}遁${qimenJuNum}局`}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* ===== 排盘结果 ===== */}
      {divined && (
        <div id="divinationResult" className="fade-in">
          {/* 云端存档恢复提示：当前排盘图来自最近一次存档（未重跑排盘接口） */}
          {restoredRec && (
            <div className="restored-bar fade-in">
              <span className="restored-bar-icon">📋</span>
              <div className="restored-bar-main">
                <div className="restored-bar-title">
                  已加载最近一次排盘记录{restoredRec.title ? `「${restoredRec.title}」` : ''}
                </div>
                <div className="restored-bar-sub">
                  {restoredRec.at ? `存档于 ${formatArchiveAt(restoredRec.at)}` : '来自云端存档'} · 排盘图直接展示，AI 解读正在为你刷新
                </div>
              </div>
              <button type="button" className="restored-bar-btn" onClick={() => runDivination()}>↻ 重新排盘</button>
            </div>
          )}
          {/* 模块标签页导航（与「排盘术数」勾选联动；综合运势常驻） */}
          <div className="module-tabs fade-in">
            {visibleModuleTabs.map((t) => (
              <button key={t.id} className={'module-tab' + (activeModule === t.id ? ' active' : '')} onClick={() => switchModule(t.id)}>
                <img className="module-tab-icon" src={`/images/bugua-icons/${t.icon}.svg`} alt="" />
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <div className="result-layout">
            {/* 主内容区 */}
            <div className="result-main">
              <div className="module-panel active fade-in" key={activeModule}>
                {activeModule === 'mod-bazi' && <BaziModule data={apiResults.bazi} status={apiStatus.bazi} birth={{ date: birthValue.date, time: birthTime, gender }} />}
                {activeModule === 'mod-wuxing' && <WuxingModule data={apiResults.bazi} status={apiStatus.bazi} birth={{ date: birthValue.date, time: birthTime, gender }} />}
                {activeModule === 'mod-ziwei' && <ZiweiModule data={apiResults.ziwei} status={apiStatus.ziwei} />}
                {activeModule === 'mod-liuyao' && <LiuyaoModule data={apiResults.liuyao} status={apiStatus.liuyao} />}
                {activeModule === 'mod-meihua' && <MeihuaModule data={apiResults.meihua} status={apiStatus.meihua} />}
                {activeModule === 'mod-qimen' && <QimenModule data={apiResults.qimen} status={apiStatus.qimen} />}
                {activeModule === 'mod-liuren' && <LiuRenModule data={apiResults.liuren} status={apiStatus.liuren} />}
                {activeModule === 'mod-taiyi' && <TaiyiModule data={apiResults.taiyi} status={apiStatus.taiyi} />}
                {activeModule === 'mod-summary' && (
                  <SummaryModule
                    summary={summaryState}
                    loveSummary={loveState}
                    careerSummary={careerState}
                    onlineCount={fused.count}
                    moduleNames={fused.names}
                    apiResults={apiResults as Record<string, unknown>}
                    selChips={selChips}
                    interps={interps}
                  />
                )}
              </div>
            </div>

            {/* 侧边栏 */}
            <div className="result-sidebar">
              <div className="side-card ai-interpretation">
                <div className="ai-interp-header">
                  <div className="ai-interp-avatar"><img src="/images/spirit_avatar.png" alt="小玄" /></div>
                  <div>
                    <div className="side-ai-title">小玄陪你看看这张命盘</div>
                    <div className="side-ai-subtitle">
                      {interp === 'loading'
                        ? '小玄在认真梳理你的命局，别急，慢慢来…'
                        : ai.subtitle}
                    </div>
                  </div>
                </div>
                <div className="ai-interp-text">
                  {interp === 'loading' ? (
                    <OmLoading label="小玄在认真梳理你的命局…" mode="inline" />
                  ) : interp && interp !== 'error' ? (
                    <>
                      <div dangerouslySetInnerHTML={{ __html: mdToHtml(stripInterpDisclaimer(interp.text)) }} />
                      <div className="ai-interp-disclaimer">⚠️ {interp.disclaimer}</div>
                    </>
                  ) : activeModule === 'mod-summary' && summaryResp ? (
                    /* 综合运势：展示 AI 综合分析的叙述稿（概述 + 趋势 + 卡片 + 时间轴，基于用户实际勾选的术数） */
                    <>
                      {(() => {
                        const tl = summaryResp.data.timeline ?? [];
                        if (!tl.length) return null;
                        return (
                          <div className="side-timeline-alert">
                            <div className="side-tl-title">
                              <SectionIcon name="calendar" /> 最近运势窗口
                            </div>
                            {tl.slice(0, 2).map((t, i) => (
                              <div className="side-tl-item" key={i}>
                                <span className="side-tl-period">{t.period}</span>
                                <span className="side-tl-overview">{t.overview}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      <div dangerouslySetInnerHTML={{ __html: mdToHtml(stripInterpDisclaimer(buildSummarySidebarMd(summaryResp))) }} />
                      <SummaryResonanceCard data={summaryResp} compact />
                      <SummaryInsightCards data={summaryResp} compact />
                      <LightFollowUp
                        module="summary"
                        context={summaryPlain}
                        chips={[
                          '整体运势接下来怎么走？',
                          '事业上有什么提示？',
                          '感情方面要注意什么？',
                          '近期有哪些关键节点？',
                        ]}
                      />
                    </>
                  ) : (
                    <div dangerouslySetInnerHTML={{
                      __html: ai.buildHtml({
                        bazi: apiResults.bazi,
                        ziwei: apiResults.ziwei,
                        liuyao: apiResults.liuyao,
                        meihua: apiResults.meihua,
                        qimen: apiResults.qimen,
                        liuren: apiResults.liuren,
                        taiyi: apiResults.taiyi,
                        selectedNames: MODULE_CHIPS.filter((c) => selChips.has(c)),
                        summaryConsensus: summaryResp?.data.consensus?.filter((c) => (c.agreement ?? 0) > 0).map((c) => c.label),
                      })
                    }} />
                  )}
                </div>
                
              </div>

              <CrossPageLink
                links={[
                  { icon: '🃏', label: '用塔罗补充验证', href: '/tarot' },
                  { icon: '🔢', label: '看看数字命理', href: '/numerology' },
                  { icon: '🏠', label: '风水布局建议', href: '/fengshui' },
                  { icon: '🌿', label: '情绪需要疗愈？', href: '/healing' },
                  { icon: '📋', label: '查看综合报告', href: '/report', variant: 'primary' },
                ]}
              />

              <div className="side-card">
                <div className="result-card-title"><SectionIcon name="users" /> 社区热议</div>
                <div className="community-list">
                  {COMMUNITY.map((c, i) => (
                    <div key={i} className="community-item"><i className="iconfont icon-wanfatubiao-daochu"></i> {c}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 深度报告付费弹窗 */}
      <Modal
        open={deepOpen}
        onClose={() => setDeepOpen(false)}
        icon="🔓"
        title="解锁深度解读报告"
        footer={<button className="modal-btn" onClick={confirmPayment}>确认开通 →</button>}
        hint="支持微信/支付宝 · 7天无理由退款"
      >
        解锁后你将获得：
        <br />• 30页+完整命理深度分析
        <br />• 流年逐月运势详解
        <br />• 真人专家1v1答疑（30分钟）
        <br />• 专属疗愈方案推荐
        <div className="pricing-cards">
          {PRICING.map((p, i) => (
            <div key={i} className={'pricing-card' + (pricing === i ? ' selected' : '')} onClick={() => setPricing(i)}>
              <div className="pricing-name">{p.name}</div>
              <div className="pricing-price">{p.price}</div>
              <div className="pricing-period">{p.period}</div>
            </div>
          ))}
        </div>
      </Modal>

      {/* 分享弹窗 */}
      <Modal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        variant="share"
        icon="📤"
        title="分享你的报告"
        footer={<button className="modal-btn" onClick={() => setShareOpen(false)}>完成</button>}
      >
        {!share.ready ? (
          <div className="poster-loading">⏳ 正在检查登录状态…</div>
        ) : !share.isAuthed ? (
          <ShareLoginGate context="保存 / 分享结果" />
        ) : (
          <>
            选择分享方式，把这份趣味分享给好友
            <div className="share-options">
              <div className="share-option"><div className="share-icon">💬</div><div className="share-label">微信好友</div></div>
              <div className="share-option"><div className="share-icon">📱</div><div className="share-label">朋友圈</div></div>
              <div className="share-option"><div className="share-icon">🔗</div><div className="share-label">复制链接</div></div>
              <div
                className={'share-option' + (posterLoading ? ' is-loading' : '')}
                role="button"
                tabIndex={0}
                onClick={() => !posterLoading && handlePoster()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePoster(); }}
              >
                <div className="share-icon">🖼️</div>
                <div className="share-label">{posterLoading ? '生成中…' : '生成海报'}</div>
              </div>
            </div>

            {posterLoading && <div className="poster-loading">⏳ 正在生成专属海报…</div>}

            {posterResult && (
              <div className="poster-preview">
                {posterResult.imageUrl ? (
                  <img className="poster-img" src={posterResult.imageUrl} alt="玄镜排盘海报" loading="lazy" decoding="async" />
                ) : (
                  <div className="poster-fallback-note">
                    ⚠️ 海报图片生成失败{posterResult.imageError ? `（${posterResult.imageError}）` : ''}，可复制下方文案分享。
                  </div>
                )}
                {posterResult.shareText && <p className="poster-share-text">{posterResult.shareText}</p>}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
                  {posterResult.imageUrl && (
                    <button type="button" className="modal-btn poster-download" onClick={handleDownloadPoster}>
                      ⬇️ 导出 PDF
                    </button>
                  )}
                  {/* 重新生成：重跑 AI 生成 + 再次落库覆盖 */}
                  <button
                    type="button"
                    className="modal-btn poster-download"
                    onClick={() => void handlePoster()}
                    disabled={posterLoading}
                  >
                    🔄 重新生成
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
