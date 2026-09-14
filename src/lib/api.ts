// ============================================================================
// 玄镜 OracleMind · API 客户端
// 对接 oraclemind-backend（FastAPI 排盘计算服务）
// ============================================================================

import type { NumDetail, NumCore } from '@/data/numerologyData';
import { cachedRequest, REQ_CACHE_TTL } from './requestCache';

/** 后端接口地址：.env.local 中 NEXT_PUBLIC_API_BASE 配置，默认本机后端 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

/** 数字命理排盘结果（与后端 NumerologyResponse 结构一致，字段 camelCase） */
export interface NumerologyAPIResult {
  lifePath: number;
  birthdayNum: number;
  /** JSON 对象键恒为字符串（"1"~"9"） */
  counts: Record<string, number>;
  missing: number[];
  years: { yr: number; py: number; tag: string; isCurrent: boolean }[];
  data: NumDetail;
  /** 核心数字（表现 / 内驱 / 人格 / 成熟 + 四挑战）；老存档可能缺失，前端需容错 */
  core?: NumCore;
}

/**
 * 数字命理排盘 —— 调用后端 POST /api/v1/numerology/paipan。
 * 后端算法与前端本地算法完全一致，结果可直接渲染。
 * @param name 可选中文姓名，用于计算表现数 / 内驱数 / 人格数 / 成熟数
 */
export async function calculateNumerology(
  year: number,
  month: number,
  day: number,
  name?: string,
  signal?: AbortSignal
): Promise<NumerologyAPIResult> {
  const { data } = await cachedRequest<NumerologyAPIResult>(
    'numerology',
    { year, month, day, name },
    async () => {
      const res = await fetch(`${API_BASE}/api/v1/numerology/paipan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, day, name: name?.trim() || undefined }),
        signal,
      });
      if (!res.ok) {
        throw new Error(`排盘接口响应异常：HTTP ${res.status}`);
      }
      return res.json();
    },
    REQ_CACHE_TTL.long,
  );
  return data;
}

/* ============================================================================
 * 五术数排盘（八字 / 紫微 / 六爻 / 梅花 / 奇门）
 * 后端统一入参 PaipanRequest，各接口返回异构平铺结构（BasePaipanResponse）
 * ==========================================================================*/

/** 排盘统一入参（与后端 PaipanRequest 对齐，字段 camelCase） */
export interface PaipanRequest {
  year: number;
  month: number;
  day: number;
  /** 出生小时 0-23（与 timeText 二选一；传 timeText 时可不传） */
  hour?: number | null;
  /** 时辰文本：子时~亥时 / 不详（优先级高于 hour） */
  timeText?: string;
  gender?: string;
  question?: string;
  /** 紫微流年/流月 指定年份查询（POST /api/v1/ziwei/timeline 专用，可选） */
  targetYear?: number;
  /** 起卦方式：六爻 time/coin/manual；梅花 time/number/text/manual（各接口按自身语义消费） */
  method?: 'time' | 'coin' | 'manual' | 'number' | 'text';
  /** 梅花数字起卦：第一个报数 */
  num1?: number;
  /** 梅花数字起卦：第二个报数 */
  num2?: number;
  /** 梅花手动指定：上卦数 1-8（先天数） */
  shangNum?: number;
  /** 梅花手动指定：下卦数 1-8（先天数） */
  xiaNum?: number;
  /** 梅花手动指定：动爻 1-6 */
  dongNum?: number;
  /** 梅花应期取数类型：xian 先天数 / hou 后天数（洛书） */
  numType?: string;
  /** 摇钱法/手动起卦的 6 爻编码（自下而上，index 0 = 初爻）：
   *  0 少阳(阳静) / 1 少阴(阴静) / 2 老阳(阳动) / 3 老阴(阴动) */
  linesInput?: number[];
  /** 奇门手动定局：{ yinyang: '阳'|'阴', ju: 1-9 }；为 null 时走自动拆补法 */
  qimenJu?: { yinyang: string; ju: number } | null;
  /** 农历生日（原样上送，由后端换算公历）：month 负数表示闰月（如 -8 = 闰八月）。
   *  前端只在农历录入模式附带此字段，不做农历→公历预换算；year/month/day 仍保留公历兜底值。 */
  lunar?: { year: number; month: number; day: number } | null;
  /** 出生地经度（东经为正，如北京 116.4 / 乌鲁木齐 87.6）。
   *  传入后由**后端**对生辰类排盘（八字 / 紫微）做分钟级真太阳时校正（可跨日）。
   *  缺省或超出 73~135 时不校正，行为与旧版一致 —— 即「不传 = 零风险」。
   *  问事类排盘（六爻 / 梅花 / 奇门）忽略此字段。 */
  longitude?: number | null;
  /** 出生分钟 0-59，配合 longitude 做分钟级校正；不传按整点处理。 */
  minute?: number | null;
  /** 出生地省/市（**存档专用**，便于恢复时免按经度反查；环京城市经度接近时避免误判）。
   *  排盘接口忽略此字段，真太阳时只认 longitude。 */
  province?: string;
  city?: string;
}

/** 真太阳时校正详情（后端 authoritative 计算后随排盘结果回传） */
export interface TrueSolarTimeInfo {
  /** 出生地经度 */
  lng: number;
  /** 经度时差（分钟）：(lng − 120) × 4 */
  longitudeMin: number;
  /** 真平太阳时差 EoT（分钟） */
  eotMin: number;
  /** 总修正（分钟） */
  totalMin: number;
  /** 原始钟表时间 HH:MM */
  clockTime: string;
  /** 校正后真太阳时 HH:MM */
  correctedTime: string;
  /** 跨日偏移天数（0 / +1 / -1） */
  dayOffset: number;
  /** 校正后用于定盘的年/月/日/时/分 */
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** 通用 POST 封装：请求排盘接口并解析 JSON */
async function postPaipan<T>(path: string, req: PaipanRequest, signal?: AbortSignal): Promise<T> {
  // 统一请求缓存：同参数（path + 入参）命中 localStorage 直接返回，不调后端排盘
  const { data } = await cachedRequest<T>(
    `paipan:${path}`,
    req,
    async () => {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal,
      });
      if (!res.ok) {
        throw new Error(`排盘接口响应异常：HTTP ${res.status}`);
      }
      return res.json();
    },
    REQ_CACHE_TTL.long,
  );
  return data;
}

/* ------------------------------ 八字排盘 ------------------------------ */

export interface BaziPillar {
  label: string;
  gan: string;
  zhi: string;
  el: string;
  elCls: string;
  note: string;
  gold?: boolean;
}
export interface BaziShishen {
  name: string;
  val: number;
  wuxing: string;
  color?: string;
}
export interface BaziWuxing {
  label: string;
  pct: number;
  icon: string;
}
export interface BaziDayun {
  age: string;
  gan: string;
  note: string;
  gold?: boolean;
  primary?: boolean;
  highlight?: boolean;
  pink?: boolean;
  green?: boolean;
}
export interface BaziShensha {
  /** 神煞名（天乙贵人/文昌/桃花/驿马/华盖/禄神/羊刃/空亡） */
  name: string;
  /** 目标地支 */
  zhi: string;
  /** 落点：年柱/月柱/日柱/时柱 或「待大运流年引动」 */
  pillar: string;
  /** 一句话解读 */
  desc: string;
}

export interface BaziAPIResult {
  solar: string;
  lunar: string;
  shengxiao: string;
  timeText: string;
  dayMaster: string;
  dayMasterWuxing: string;
  pillars: BaziPillar[];
  shiShen: BaziShishen[];
  wuxing: BaziWuxing[];
  wuxingCount?: { label: string; count: number }[];
  lacking?: string[];
  dayun: BaziDayun[];
  liunian: { yr: number; gan: string; note: string }[];
  /** 起运信息：公历起运时间 / 出生后时长 / 起运虚岁 */
  qiyun?: { date: string; after: string; age: number };
  analysis: string;
  yongshen: { xi: string[]; ji: string[] };
  /** 高频神煞（八字四柱模块展示，见 BaziShensha） */
  shensha: BaziShensha[];
  /** 真太阳时校正详情：仅当请求带了合法 longitude 时回传（否则缺席） */
  trueSolarTime?: TrueSolarTimeInfo;
}

/** 八字排盘 —— POST /api/v1/bazi/paipan */
export function calculateBazi(req: PaipanRequest, signal?: AbortSignal): Promise<BaziAPIResult> {
  return postPaipan('/api/v1/bazi/paipan', req, signal);
}

/* ------------------------------ 紫微斗数 ------------------------------ */

export interface ZiweiAux {
  '吉': string[];
  '煞': string[];
  '财': string[];
  '桃': string[];
}
export interface ZiweiPalace {
  name: string;
  icon: string;
  color: string;
  star: string;
  sub: string;
  pos: string;
  gan: string;
  highlight: boolean;
  isShenGong?: boolean;
  mainDesc?: string;
  bright?: string;
  aux?: ZiweiAux;
  sifang?: string[];
  /** 杂曜（孤辰/寡宿/华盖/破碎/天刑/旬空/截空） */
  misc?: string[];
  /** 长生十二神（长生/沐浴/冠带/临官/帝旺/衰/病/死/墓/绝/胎/养） */
  changsheng?: string;
  /** 空宫借星：本宫无主星时借对宫主星名（字符串数组） */
  borrow?: string[];
}
export interface ZiweiTrait {
  icon: string;
  name: string;
  stars: string;
  color: string;
}
export interface ZiweiSihua {
  star: string;
  hua: string;
  palace: string;
}
export interface ZiweiDafen {
  age: string;
  palace: string;
  star: string;
  dir: string;
}
export interface ZiweiLiuNian {
  year: number;
  zhi: string;
  mingPalace: string;
  taiPalace: string;
  star: string;
}
export interface ZiweiLiuYue {
  month: number;
  mingPalace: string;
  /** 流月命宫主星（后端自 v 增补，旧数据为 undefined 时前端降级不展示） */
  star?: string;
}
/** 流年可选年份项（liuNianRange 中每一项） */
export interface ZiweiLiuNianYear {
  year: number;
  zhi: string;
  mingPalace: string;
  taiPalace: string;
  star: string;
}
/** 流年十二宫盘（以流年命宫为基准重排十二宫，叠加太岁标注） */
export interface ZiweiLiuNianPanItem {
  name: string;       // 流年人事宫名（命宫起逆）
  pos: string;        // 该宫地支
  star: string;       // 落入星曜（取自原盘对应地支宫）
  sub: string;        // 辅星/杂曜
  isMingGong: boolean; // 流年命宫
  taiSui: boolean;     // 太岁（流年地支）标注
}
/** 流月列表项（liuYueByYear[year] 中每一项） */
export interface ZiweiLiuYueItem {
  month: number;
  mingPalace: string;
  star?: string;
}
export interface ZiweiMainStarRef {
  name: string;
  group: string;
  char: string;
}
/** 格局识别结果（命盘星曜组合命中的常见格局） */
export interface ZiweiPattern {
  name: string;
  desc: string;
}
/** 宫干四化飞星（飞星派核心）：以本宫宫干飞化禄权科忌 */
export interface ZiweiPalaceSihua {
  from: string; // 飞出宫名
  hua: string;  // 禄/权/科/忌
  star: string; // 飞化之星
  to: string;   // 飞入宫名
  self: boolean; // 是否自化（落本宫）
}
/** 小限（年支 + 虚岁）：当年小限落宫 */
export interface ZiweiXiaoXian {
  age: string;   // 如 "37岁(虚)"
  palace: string; // 小限所在宫名
  zhi: string;   // 小限地支
}
/** 运四化（流年/流月四化）：按流年/月天干飞化禄权科忌 */
export interface ZiweiYunSihua {
  hua: string;
  star: string;
  palace: string;
}
export interface ZiweiAPIResult {
  solar: string;
  lunar: string;
  timeText: string;
  mingGong: string;
  shenGong: string;
  shenGongName?: string;
  wuxingJu: string;
  ziwei: string;
  palaces: ZiweiPalace[];
  sihua: ZiweiSihua[];
  traits: ZiweiTrait[];
  analysis: string;
  mainStarsRef?: ZiweiMainStarRef[];
  dafen?: ZiweiDafen[];
  liuNian?: ZiweiLiuNian;
  liuYue?: ZiweiLiuYue;
  /** 流年可浏览年份范围（前后若干年），前端年份选择器数据源 */
  liuNianRange?: ZiweiLiuNianYear[];
  /** 各年份对应的 12 个流月：{ [year]: ZiweiLiuYueItem[] } */
  liuYueByYear?: Record<number, ZiweiLiuYueItem[]>;
  /** 格局识别（命局格局，如紫府同宫、机月同梁、杀破狼等） */
  patterns?: ZiweiPattern[];
  /** 宫干四化飞星（逐宫飞化禄权科忌，落本命盘星位） */
  palaceSihua?: ZiweiPalaceSihua[];
  /** 小限：当年小限落宫与虚岁 */
  xiaoXian?: ZiweiXiaoXian;
  /** 流年四化（按流年天干飞化，落本命盘星位） */
  liuNianSihua?: ZiweiYunSihua[];
  /** 流年四化范围（年份 -> 运四化），供年份选择器切换 */
  liuNianSihuaRange?: Record<number, ZiweiYunSihua[]>;
  /** 流月四化（当前所选年份 + 月份） */
  liuYueSihua?: ZiweiYunSihua[];
  /** 流月四化范围（年份 -> 月份 -> 运四化） */
  liuYueSihuaByYear?: Record<number, Record<number, ZiweiYunSihua[]>>;
  /** 流年十二宫盘（以流年命宫为基准重排，太岁标注） */
  liuNianPan?: ZiweiLiuNianPanItem[];
  /** 真太阳时校正详情：仅当请求带了合法 longitude 时回传 */
  trueSolarTime?: TrueSolarTimeInfo;
}

/** 紫微斗数排盘 —— POST /api/v1/ziwei/paipan */
export function calculateZiwei(req: PaipanRequest, signal?: AbortSignal): Promise<ZiweiAPIResult> {
  return postPaipan('/api/v1/ziwei/paipan', req, signal);
}

/** 紫微斗数 流年/流月 指定年份查询 —— POST /api/v1/ziwei/timeline
 *  给定出生信息与目标年份，返回该年流年命盘 + 12 流月列表（用于年份/月份切换浏览）。
 *  前端通常在 liuNianRange / liuYueByYear 覆盖范围内本地切换；此接口供超出预生成范围时按需拉取。 */
export interface ZiweiTimelineResult {
  liuNian: ZiweiLiuNian;
  liuYueList: ZiweiLiuYueItem[];
}
export function calculateZiweiTimeline(
  req: PaipanRequest,
  targetYear: number,
  signal?: AbortSignal
): Promise<ZiweiTimelineResult> {
  return postPaipan(
    '/api/v1/ziwei/timeline',
    { ...req, targetYear },
    signal
  );
}

/* ------------------------------ 六爻起卦 ------------------------------ */

export interface HexagramView {
  name: string;
  symbol: string;
  desc: string;
  gong?: string;
  gongWuxing?: string;
  upper?: string;
  lower?: string;
  shiPos?: number;
  yingPos?: number;
  guaCi?: string;         // 卦辞（G6）
}
export interface LiuyaoLine {
  pos: string;
  idx: number;
  yao: string;
  text: string;
  gan: string;
  zhi: string;
  wuxing: string;
  shishen: string;
  liushen?: string;
  name: string;
  right: string;
  gold: boolean;
  pink: boolean;
  changsheng?: string;
  yuePo?: boolean;
  anDong?: boolean;
  ruMu?: boolean;
  jinTui?: string;
  houtou?: string;
  huaMu?: boolean;
  bianGan?: string;
  bianZhi?: string;
  bianWuxing?: string;
  nayin?: string;          // 纳音五行（G8）
  shensha?: string[];      // 神煞：天乙贵人/驿马/桃花/文昌/劫煞/华盖（G7）
  fuGan?: string;          // 伏神天干（G12 京房飞伏）
  fuZhi?: string;          // 伏神地支
  fuWuxing?: string;       // 伏神五行
  fuShishen?: string;      // 伏神六亲
  yaoCi?: string;          // 本爻爻辞（仅动爻，G6）
}
export interface LiuyaoBianLine {
  pos: string;
  idx: number;
  yao: string;            // 'yang' | 'yin' | 'bian'
  text: string;
  gan: string;
  zhi: string;
  wuxing: string;
  shishen: string;        // 六亲（按本卦宫五行）
  liushen: string;        // 六神（按日干，同本卦）
  strength: string;       // 月令旺衰（旺/相/休/囚/死）
  dayRelation: string;    // 日辰关系
  isEmpty: boolean;
  emptyNote: string;
  isBian: boolean;        // 是否变爻（动爻位）
  right: string;          // 标记文案（变爻/世爻/应爻）
  nayin?: string;         // 纳音五行（G8）
  shensha?: string[];     // 神煞（G7）
}
export interface LiuyaoSpecial {
  guahun?: string;
  bianGuahun?: string;
  fan?: boolean;
  fu?: boolean;
  guashen?: {
    yangShi?: boolean;
    yuePos?: number;
    yueZhi?: string;
    riPos?: number;
    riZhi?: string;
    note?: string;
  };
  sanhe?: string[];
  sanheCheng?: Record<string, boolean>;
  liuhe?: string[];
  liuchong?: string[];
  involved?: string[];
}

/** 飞伏（G12）：用神不上卦时的飞神/伏神结构化数据 */
export interface LiuyaoFeifu {
  shiShenName: string;      // 用神六亲名
  flyPos: number;           // 飞神（本卦对应爻）位
  flyGan: string;
  flyZhi: string;
  flyWuxing: string;
  flyShishen: string;
  fuPos: number;            // 伏神（本宫）位
  fuGan: string;
  fuZhi: string;
  fuWuxing: string;
  fuShishen: string;
  gong: string;             // 本宫
}

/** 互卦/错卦/综卦视图（G9） */
export interface LiuyaoHcView {
  name: string;
  upper: string;
  lower: string;
  symbol: string;
  desc: string;
}
export interface LiuyaoGuaBianhua {
  ben: { hu: LiuyaoHcView; cuo: LiuyaoHcView; zong: LiuyaoHcView };
  bian: { hu: LiuyaoHcView; cuo: LiuyaoHcView; zong: LiuyaoHcView } | null;
}

/** 应期推断（G5） */
export interface LiuyaoYingqi {
  summary: string;
  points: { label: string; text: string }[];
}

export interface LiuyaoAPIResult {
  solar: string;
  lunar: string;
  timeText: string;
  qigua: {
    yearZhi: string;
    lunarMonth: number;
    lunarDay: number;
    timeZhi: string;
    shangNum: number;
    xiaNum: number;
    dongYao: number;
    dongYaos?: number[];
    method?: string;
    calc: string;
  };
  benGua: HexagramView;
  bianGua: HexagramView | null;
  dongYao: number;
  dongYaos?: number[];
  method?: string;
  lines: LiuyaoLine[];
  yongshen: {
    name: string;
    meaning: string;
    category?: string;
    role?: string;
    note?: string;
    wuxing?: string;
    position?: number;
    gan?: string;
    zhi?: string;
    isDong?: boolean;
    isShi?: boolean;
    isYing?: boolean;
    hostNote?: string;
    strength?: string;
    monthZhi?: string;
    dayGan?: string;
    dayZhi?: string;
    dayRelation?: string;
    isEmpty?: boolean;
    emptyNote?: string;
    yuanShen?: { wuxing?: string; shishen?: string; pos?: number; dong?: boolean; note?: string };
    jiShen?: { wuxing?: string; shishen?: string; pos?: number; dong?: boolean; note?: string };
    chouShen?: { wuxing?: string; shishen?: string; pos?: number; dong?: boolean; note?: string };
    shiNote?: string;
    yingNote?: string;
    tendency?: string;
    shiStrength?: string;
    shiStrengthNote?: string;
    shiEmpty?: boolean;
    yingStrength?: string;     // 应爻旺衰（G10）
    yingStrengthNote?: string;
    yingEmpty?: boolean;
    feifu?: LiuyaoFeifu | null; // 飞伏结构化数据（G12）
    yaoCi?: string;            // 用神爻辞（G6，仅动爻）
  };
  special?: LiuyaoSpecial;
  analysis: { title: string; text: string }[];
  bianLines?: LiuyaoBianLine[];
  guaBianhua?: LiuyaoGuaBianhua;  // 互错综（G9）
  yingqi?: LiuyaoYingqi;          // 应期（G5）
}

/** 六爻起卦 —— POST /api/v1/gua/liuyao */
export function calculateLiuyao(req: PaipanRequest, signal?: AbortSignal): Promise<LiuyaoAPIResult> {
  return postPaipan('/api/v1/gua/liuyao', req, signal);
}

/* ------------------------------ 梅花易数 ------------------------------ */

export interface TrigramView {
  name: string;
  symbol: string;
  num: number;
  wuxing: string;
  meaning: string;
  virtue: string;
  leiXiang?: TrigramLeiXiang;  // 万物类象（M3）
}
/** 八卦万物类象（梅花易数 · 邵雍） */
export interface TrigramLeiXiang {
  tianshi: string;  // 天时
  dili: string;     // 地理
  renwu: string;    // 人物
  renshi: string;   // 人事
  shenghti: string; // 身体
  dongwu: string;   // 动物
  wu: string;       // 静物
  fangwei: string;  // 方位
  shuzi: string;    // 数字
  weiwei: string;   // 五味
  se: string;       // 五色
}
export interface MeihuaHexagram {
  name: string;
  symbol: string;
  desc: string;
  gong?: string;
  guaCi?: string;   // 卦辞（M4）
  upper: TrigramView;
  lower: TrigramView;
  tag?: string;
}
/** 梅花体/用卦旺衰视图（M1） */
export interface MeihuaWang {
  name: string;
  wuxing: string;
  monthZhi: string;
  yueWang: string;      // 月令旺相休囚死
  dayRelation: string;  // 日辰作用
  strength: string;     // 极旺/偏旺/中和/偏衰/极衰
  score: number;
  note: string;
}
export interface MeihuaAPIResult {
  solar: string;
  lunar: string;
  timeText: string;
  qigua: string;
  method?: string;           // time / number / text / manual
  benGua: MeihuaHexagram;
  bianGua: MeihuaHexagram | null;
  huGua: MeihuaHexagram | null;
  cuoGua?: MeihuaHexagram | null;   // 错卦（M7）
  zongGua?: MeihuaHexagram | null;  // 综卦（M7）
  dongYao: number;
  dongYaoTitle?: string;     // 动爻爻题（如 初六）
  dongYaoCi?: string;        // 动爻爻辞（M4/M8）
  ti: TrigramView;
  yong: TrigramView;
  tiWang?: MeihuaWang;       // 体卦旺衰（M1）
  yongWang?: MeihuaWang;     // 用卦旺衰（M1）
  wangshuai?: {
    monthZhi: string; dayGan: string; dayZhi: string; dayWuxing: string;
    xunkong: string; tiEmpty: boolean; yongEmpty: boolean;
  };
  tiYong: {
    relation: string; ji: string; rawJi?: string;
    jiAdjusted?: boolean; desc: string; dongNote: string;
  };
  relationMatrix?: MeihuaRelationRow[];  // 体用互变四卦关系矩阵（M9）
  yingqi?: MeihuaYingqi;                 // 应期推断（M2）
  numType?: string;                      // 先天/后天卦数（M6）
  analysis: { title: string; text: string }[];
}
/** 梅花四卦关系矩阵一行（M9） */
export interface MeihuaRelationRow {
  from: string;   // 体 / 用
  to: string;     // 用 / 互 / 变
  ji: string;     // 吉凶
  detail: string; // 明细（如 体乾用生体兑）
}
/** 梅花应期推断（M2） */
export interface MeihuaYingqi {
  summary: string;
  points: { label: string; text: string }[];
}

/** 梅花易数起卦 —— POST /api/v1/gua/meihua */
export function calculateMeihua(req: PaipanRequest, signal?: AbortSignal): Promise<MeihuaAPIResult> {
  return postPaipan('/api/v1/gua/meihua', req, signal);
}

/* ------------------------------ 奇门遁甲 ------------------------------ */

export interface QimenPalace {
  dir: string;
  gong?: number;
  wuxing?: string;
  star: string;
  starColor: string;
  door: string;
  doorColor: string;
  god: string;
  comb: string;
  tianpan: string;
  dipan: string;
  border: string | null;
  bg: string | null;
  jixiong: string;
}
export interface QimenQi {
  title: string;
  text: string;
  color: string;
  bg: string;
  border: string;
}
export interface QimenGuide {
  icon: string;
  title: string;
  note: string;
  color: string;
  dir: string;
}
export interface QimenYongShenItem {
  name: string;
  gong: number;
  gongName: string;
  wuxing: string;
  symbol: string;
  star?: string;
  door?: string;
  god?: string;
  tianpan?: string;
  dipan?: string;
  relation: string;
  wang: string;
  jixiong: string;
  note: string;
}
export interface QimenYongShen {
  category: string;
  riGan: string;
  riWuxing: string;
  items: QimenYongShenItem[];
}
export interface QimenPattern {
  gong: number;
  gongName: string;
  tianpan: string;
  dipan: string;
  name: string;
  level: string;
  desc: string;
}
export interface QimenKongWang {
  emptyZhi: string[];
  emptyGongs: number[];
  desc: string;
}
export interface QimenMaStar {
  gong: number | null;
  gongName: string;
  desc: string;
}
export interface QimenWangShuai {
  monthWx: string;
  desc: string;
  yong: { name: string; wx: string; state: string }[];
}
export interface QimenYingqi {
  summary: string;
  points: string[];
}
export interface QimenAPIResult {
  solar: string;
  lunar: string;
  timeText: string;
  dateText: string;
  jieqi: string;
  type: string;
  valueFu: string;
  valueShi: string;
  shiGan: string;
  shiGanZhi: string;
  riGanZhi: string;
  palaces: QimenPalace[];
  qi: QimenQi[];
  guide: QimenGuide[];
  yongShen?: QimenYongShen;
  patterns?: QimenPattern[];
  kongWang?: QimenKongWang;
  maStar?: QimenMaStar;
  wangShuai?: QimenWangShuai;
  yingqi?: QimenYingqi;
}

/** 奇门遁甲排盘 —— POST /api/v1/qimen/paipan */
export function calculateQimen(req: PaipanRequest, signal?: AbortSignal): Promise<QimenAPIResult> {
  return postPaipan('/api/v1/qimen/paipan', req, signal);
}

/* ------------------------- 大六壬（三式之一） ------------------------- */

/** 大六壬 天盘一位：地盘支 + 其上天盘神 + 遁干 + 天将 */
export interface LiuRenPanCell {
  /** 地盘本位（不动的十二支） */
  zhi: string;
  /** 天盘加临之神（地支） */
  shen: string;
  /** 天盘神的月将名（如「登明」） */
  shenName: string;
  /** 天盘神的旬遁干；空亡支为 '' */
  gan: string;
  /** 六亲（以日干为准）；无遁干时为 '—' */
  liuqin: string;
  /** 该位所临天将 */
  jiang: string;
  /** 该地盘支是否落空亡 */
  kongWang: boolean;
}

/** 大六壬 四课之一 */
export interface LiuRenKe {
  label: string;
  /** 下位（一课为日干，其余为地支） */
  lower: string;
  /** 上神（天盘加临之神） */
  upper: string;
  lowerWuxing: string;
  upperWuxing: string;
  /** 克贼：'' 无克 / '克' 上克下 / '贼' 下贼上 */
  relation: '' | '克' | '贼';
  relationText: string;
  note: string;
}

/** 大六壬 三传之一（初/中/末） */
export interface LiuRenChuanItem {
  label: string;
  zhi: string;
  gan: string;
  wuxing: string;
  liuqin: string;
  jiang: string;
  shenName: string;
  kongWang: boolean;
}

/** 大六壬 三传 */
export interface LiuRenSanChuan {
  /** 九宗门取法：贼克法 / 比用法 / 涉害法 / 遥克法 / 昴星法 / 别责法 / 八专法 / 伏吟法 / 反吟法 */
  method: string;
  /** 课体名：元首课 / 重审课 / 知一课 / 涉害课 / 蒿矢课 / 弹射课 … */
  keTi: string;
  desc: string;
  /** 由第几课发用 */
  fromKe: string;
  chu: string;
  zhong: string;
  mo: string;
  items: LiuRenChuanItem[];
}

/** 大六壬 十二天将 */
export interface LiuRenTianJiang {
  zhi: string;
  jiang: string;
  jiXiong: string;
  desc: string;
}

export interface LiuRenAPIResult {
  solar: string;
  lunar: string;
  timeText: string;
  type: string;
  /** 起月将所依据的节气 */
  jieqi: string;
  /** 月将地支与其神名（登明/河魁/…） */
  yueJiang: string;
  yueJiangName: string;
  yueJiangDesc: string;
  /** 占时地支 */
  zhanShi: string;
  riGanZhi: string;
  riGan: string;
  riZhi: string;
  /** 日干寄宫 */
  jiGong: string;
  tianPan: LiuRenPanCell[];
  siKe: LiuRenKe[];
  sanChuan: LiuRenSanChuan;
  /** 旬空两支 */
  kongWang: string[];
  tianJiang: LiuRenTianJiang[];
  guiRen: { zhi: string; dayNight: string; shun: boolean };
  fuYin: boolean;
  fanYin: boolean;
  analysis: string;
  guide: { icon: string; title: string; note: string; color?: string }[];
  question?: string;
}

/** 大六壬起课 —— POST /api/v1/liuren/paipan */
export function calculateLiuren(req: PaipanRequest, signal?: AbortSignal): Promise<LiuRenAPIResult> {
  return postPaipan('/api/v1/liuren/paipan', req, signal);
}

/* ------------------------- 太乙神数（三式之一） ------------------------- */

/** 太乙 九宫位（宫数 + 卦 + 方位 + 十六宫位 + 宫神） */
export interface TaiYiGong {
  /** 1/2/3/4/6/7/8/9 —— 太乙不入中五 */
  gong: number;
  gua: string;
  fang: string;
  /** 对应的十六宫位名 */
  pos: string;
  shen: string;
}

/** 太乙 十六宫之一（固定配宫 + 本局落神） */
export interface TaiYiGongCell {
  pos: string;
  shen: string;
  desc: string;
  /** 本局落在此位的星神名（太乙 / 文昌 / 始击 …） */
  stars: string[];
  isTaiYi: boolean;
}

export interface TaiyiAPIResult {
  solar: string;
  lunar: string;
  timeText: string;
  type: string;
  /** 太乙积年 */
  jiNian: number;
  /** 七十二局序 1-72 */
  ju: number;
  /** 二十四小周序 1-24 */
  xiaoZhou: number;
  ganZhi: string;
  taiYiGong: TaiYiGong;
  /** 阳遁 / 阴遁 */
  dun: string;
  yangDun: boolean;
  wenChang: { pos: string; shen: string; desc: string };
  shiJi: { pos: string; shen: string; desc: string };
  jiShen: { pos: string; shen: string };
  heShen: { pos: string; shen: string };
  zhuSuan: number;
  keSuan: number;
  zhuDaJiang: TaiYiGong;
  keDaJiang: TaiYiGong;
  zhuCanJiang: TaiYiGong;
  keCanJiang: TaiYiGong;
  shiLiuGong: TaiYiGongCell[];
  verdict: string;
  dunDesc: string;
  analysis: string;
  guide: { icon: string; title: string; note: string; color?: string }[];
  question?: string;
  /** 流派声明：太乙各本差异极大，前端应据此后撤权威性措辞 */
  provenance: string;
}

/** 太乙神数排局 —— POST /api/v1/taiyi/paipan */
export function calculateTaiyi(req: PaipanRequest, signal?: AbortSignal): Promise<TaiyiAPIResult> {
  return postPaipan('/api/v1/taiyi/paipan', req, signal);
}

/* ============================================================================
 * 天使数字（Angel Numbers）—— POST /api/v1/angel/*
 * 后端为权威实现；前端仍保留 src/data/angelNumbers.ts 作为后端不可用时的降级兜底。
 * ==========================================================================*/

/** 单条天使数字释义（与后端 AngelEntry 同构） */
export interface AngelEntry {
  n: string;
  title: string;
  core: string;
  advice: string;
  love?: string | null;
  career?: string | null;
}

/** 单个数解析结果（与后端 AngelParseResponse 同构） */
export interface AngelParseResult {
  raw: string;
  key: string;
  entry: AngelEntry;
  isRepDigit: boolean;
  isSequence: boolean;
  digits: number[];
  repDigit: number | null;
  digitalRoot: number;
  digitMeaning: Record<string, string>;
}

/** 序列分析 · 单条频次 */
export interface AngelSequenceItem {
  raw: string;
  count: number;
  ratio: number;
  key: string;
  title: string;
  isRepDigit: boolean;
  isSequence: boolean;
}

/** 序列分析结果（与后端 AngelSequenceResponse 同构） */
export interface AngelSequenceResult {
  total: number;
  unique: number;
  invalid: string[];
  items: AngelSequenceItem[];
  top: AngelSequenceItem[];
  topKey: string;
  topEntry: AngelEntry;
  themes: string[];
  keyFrequency: Record<string, number>;
  digitFrequency: Record<string, number>;
  summary: string;
}

/** 个人天使数字结果（民俗算法） */
export interface AngelPersonalResult {
  birthDate: string;
  name: string;
  lifePath: number;
  birthdayNum: number;
  key: string;
  entry: AngelEntry;
  personalNumber: string;
  note: string;
}

/** 天使数字解析（单个数）—— POST /api/v1/angel/parse */
export async function parseAngelNumberAPI(raw: string, signal?: AbortSignal): Promise<AngelParseResult> {
  const { data } = await cachedRequest<AngelParseResult>(
    `angel:parse`,
    { raw },
    async () => {
      const res = await fetch(`${API_BASE}/api/v1/angel/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
        signal,
      });
      if (!res.ok) throw new Error(`天使数字解析失败：HTTP ${res.status}`);
      return res.json();
    },
    REQ_CACHE_TTL.long,
  );
  return data;
}

/** 天使数字序列分析 —— POST /api/v1/angel/sequence */
export async function analyzeAngelSequenceAPI(numbers: string[], signal?: AbortSignal): Promise<AngelSequenceResult> {
  const { data } = await cachedRequest<AngelSequenceResult>(
    `angel:sequence`,
    { numbers },
    async () => {
      const res = await fetch(`${API_BASE}/api/v1/angel/sequence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numbers }),
        signal,
      });
      if (!res.ok) throw new Error(`天使数字序列分析失败：HTTP ${res.status}`);
      return res.json();
    },
    REQ_CACHE_TTL.short,
  );
  return data;
}

/** 个人天使数字（民俗算法）—— POST /api/v1/angel/personal */
export async function computePersonalAngelAPI(birthDate: string, name?: string, signal?: AbortSignal): Promise<AngelPersonalResult> {
  const { data } = await cachedRequest<AngelPersonalResult>(
    `angel:personal`,
    { birthDate, name },
    async () => {
      const res = await fetch(`${API_BASE}/api/v1/angel/personal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthDate, name }),
        signal,
      });
      if (!res.ok) throw new Error(`个人天使数字计算失败：HTTP ${res.status}`);
      return res.json();
    },
    REQ_CACHE_TTL.long,
  );
  return data;
}

/* ============================================================================
 * 测字起名 · 后端排盘（/api/v1/ming，P2-4 后端化）
 * 确定性算法已下沉后端；前端调用失败时由调用方回退本地 ceming.ts（不在此处兜底，
 * 以免掩盖后端异常）。ming 计算为纯函数，走缓存。
 * ==========================================================================*/

export interface WugeResponse {
  surname: string;
  given: string;
  grids: Record<string, unknown>;
  threeTalent: Record<string, unknown>;
  score: number;
  incomplete: boolean;
}
export interface HehunResponse {
  maleZodiac: string;
  femaleZodiac: string;
  relations: Record<string, unknown>;
  verdict: string;
  level: string;
  complement: Record<string, unknown>;
  missingBoth: string[];
  score: number;
}
export interface CeziResponse {
  char: string;
  element: string;
  trigram: Record<string, unknown>;
  tendency: string;
  strokes: number | null;
  codePoint: number;
}

/** 姓名五格剖象 —— POST /api/v1/ming/wuge */
export async function calculateMingWuge(
  req: { surname: string; given: string; surnameStrokes: number[]; givenStrokes: number[] },
  signal?: AbortSignal,
): Promise<WugeResponse> {
  const { data } = await cachedRequest<WugeResponse>(
    `ming:wuge:${req.surname}:${req.given}:${req.surnameStrokes.join(',')}:${req.givenStrokes.join(',')}`,
    null,
    async () => {
      const res = await fetch(`${API_BASE}/api/v1/ming/wuge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal,
      });
      if (!res.ok) throw new Error(`五格剖象失败：HTTP ${res.status}`);
      return res.json();
    },
    REQ_CACHE_TTL.long,
  );
  return data;
}

/** 合婚（生肖 + 五行互补）—— POST /api/v1/ming/hehun */
export async function calculateMingHehun(
  req: {
    maleZhi: string;
    femaleZhi: string;
    maleGan?: string | null;
    femaleGan?: string | null;
    maleWuxing?: Record<string, number> | null;
    femaleWuxing?: Record<string, number> | null;
  },
  signal?: AbortSignal,
): Promise<HehunResponse> {
  const { data } = await cachedRequest<HehunResponse>(
    `ming:hehun:${req.maleZhi}:${req.femaleZhi}`,
    null,
    async () => {
      const res = await fetch(`${API_BASE}/api/v1/ming/hehun`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal,
      });
      if (!res.ok) throw new Error(`合婚失败：HTTP ${res.status}`);
      return res.json();
    },
    REQ_CACHE_TTL.long,
  );
  return data;
}

/** 八字合婚（日干 + 五行互补）—— POST /api/v1/ming/hehun-bazi */
export async function calculateMingHehunBazi(
  req: {
    maleDayGan: string;
    femaleDayGan: string;
    maleWuxing: Record<string, number>;
    femaleWuxing: Record<string, number>;
    maleZhi?: string | null;
    femaleZhi?: string | null;
  },
  signal?: AbortSignal,
): Promise<HehunResponse> {
  const { data } = await cachedRequest<HehunResponse>(
    `ming:hehun-bazi:${req.maleDayGan}:${req.femaleDayGan}`,
    null,
    async () => {
      const res = await fetch(`${API_BASE}/api/v1/ming/hehun-bazi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal,
      });
      if (!res.ok) throw new Error(`八字合婚失败：HTTP ${res.status}`);
      return res.json();
    },
    REQ_CACHE_TTL.long,
  );
  return data;
}

/** 测字取象 —— POST /api/v1/ming/cezi */
export async function calculateMingCezi(
  req: { char: string; strokes?: number | null },
  signal?: AbortSignal,
): Promise<CeziResponse> {
  const { data } = await cachedRequest<CeziResponse>(
    `ming:cezi:${req.char}:${req.strokes ?? ''}`,
    null,
    async () => {
      const res = await fetch(`${API_BASE}/api/v1/ming/cezi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal,
      });
      if (!res.ok) throw new Error(`测字失败：HTTP ${res.status}`);
      return res.json();
    },
    REQ_CACHE_TTL.long,
  );
  return data;
}

/* ============================================================================
 * 综合报告（报告闭环：排盘结果持久化）
 * ==========================================================================*/

/** 存档 params：内含排盘入参，各页还会附带自定义字段（type / solar / name / partnerSolar …），
 *  故用交叉索引签名放宽读取端；写入口 `SaveReportInput.params` 仍用严格的 PaipanRequest。 */
export type ReportParams = PaipanRequest & Record<string, unknown>;

/** 报告列表项（不含完整 results，含术数类型） */
export interface ReportListItem {
  id: number;
  visitorId: string;
  title: string;
  params: ReportParams;
  types: string[];
  created_at: string;
  /** 是否已收藏（#5） */
  favorited?: boolean;
  /** 是否置顶（#5） */
  pinned?: boolean;
  /** 父报告ID（#12 版本链，根为 null） */
  parentId?: number | null;
  /** 版本号：根 0，换个说法第 N 次为 N */
  variant?: number;
}

/** 报告详情（含完整 results 快照） */
export interface ReportDetail extends ReportListItem {
  results: Record<string, unknown>;
  summary?: Record<string, unknown> | null;
}

/** 保存报告入参 */
export interface SaveReportInput {
  /** 访客ID（匿名云存储标识，不做用户认证） */
  visitorId: string;
  title?: string;
  params: PaipanRequest;
  results: Record<string, unknown>;
  summary?: Record<string, unknown>;
  /** 父报告ID（「换个说法」版本链，#12） */
  parentId?: number | null;
  /** 版本号：根 0（#12） */
  variant?: number;
}

/** 报告搜索条件（#2） */
export interface ReportSearchParams {
  /** 关键词（标题/提问/术数/摘要） */
  q?: string;
  /** 起始日期 YYYY-MM-DD */
  dateFrom?: string;
  /** 结束日期 YYYY-MM-DD（含当天） */
  dateTo?: string;
  /** 仅看收藏 */
  favorited?: boolean;
  limit?: number;
  offset?: number;
}

/** 报告批注（#8） */
export interface ReportAnnotation {
  id: number;
  reportId: number;
  anchor: string;
  anchorLabel: string;
  quote: string;
  content: string;
  created_at: string;
  updated_at: string;
}

/** 随喜供养订单（#1） */
export interface DonationOrder {
  outTradeNo: string;
  tier: string;
  amountFen: number;
  amountYuan: string;
  channel: string;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  payUrl: string | null;
  qrText: string;
  createdAt: string;
  expireAt: string;
  paidAt: string | null;
  message: string;
}

/** 保存综合报告 —— POST /api/v1/reports（按身份隔离：登录归属账号，匿名按 visitorId） */
export async function saveReport(input: SaveReportInput): Promise<ReportDetail> {
  const res = await fetch(`${API_BASE}/api/v1/reports`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`保存报告失败：HTTP ${res.status}`);
  }
  return res.json();
}

/** 报告列表 —— GET /api/v1/reports（登录按账号，匿名按 visitorId；后端自动识别）
 *  支持 #2 搜索：关键词 / 日期范围 / 仅看收藏
 */
export async function fetchReports(
  visitorId: string,
  limit = 20,
  offset = 0,
  search: ReportSearchParams = {},
): Promise<ReportListItem[]> {
  const params = new URLSearchParams({
    visitorId,
    limit: String(search.limit ?? limit),
    offset: String(search.offset ?? offset),
  });
  if (search.q) params.set('q', search.q);
  if (search.dateFrom) params.set('dateFrom', search.dateFrom);
  if (search.dateTo) params.set('dateTo', search.dateTo);
  if (search.favorited) params.set('favorited', 'true');
  const res = await fetch(`${API_BASE}/api/v1/reports?${params.toString()}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`获取报告列表失败：HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * 报告详情 —— GET /api/v1/reports/{id}
 * 必须带 visitorId：后端对匿名报告做归属校验（防水平越权，#3），缺失会 404。
 */
export async function fetchReport(id: number, visitorId?: string): Promise<ReportDetail> {
  const qs = visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : '';
  const res = await fetch(`${API_BASE}/api/v1/reports/${id}${qs}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`获取报告详情失败：HTTP ${res.status}`);
  }
  return res.json();
}

/** 报告总数 —— GET /api/v1/reports/count（按身份隔离） */
export async function fetchReportCount(visitorId: string): Promise<{ total: number }> {
  const url = `${API_BASE}/api/v1/reports/count?visitorId=${encodeURIComponent(visitorId)}`;
  const res = await fetch(url, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`获取报告总数失败：HTTP ${res.status}`);
  }
  return res.json();
}

/** 删除报告 —— DELETE /api/v1/reports/{id}（带 visitorId 做归属校验，#3） */
export async function deleteReport(id: number, visitorId?: string): Promise<void> {
  const qs = visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : '';
  const res = await fetch(`${API_BASE}/api/v1/reports/${id}${qs}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`删除报告失败：HTTP ${res.status}`);
  }
}

/** 收藏/置顶报告 —— PATCH /api/v1/reports/{id}/favorite（#5） */
export async function updateReportFavorite(
  id: number,
  patch: { favorited?: boolean; pinned?: boolean },
  visitorId?: string,
): Promise<ReportListItem> {
  const qs = visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : '';
  const res = await fetch(`${API_BASE}/api/v1/reports/${id}/favorite${qs}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error(`更新收藏状态失败：HTTP ${res.status}`);
  }
  return res.json();
}

/** 批量删除报告 —— POST /api/v1/reports/batch-delete（#7） */
export async function batchDeleteReports(
  ids: number[],
  visitorId?: string,
): Promise<{ deleted: number; skipped: number }> {
  const qs = visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : '';
  const res = await fetch(`${API_BASE}/api/v1/reports/batch-delete${qs}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    throw new Error(`批量删除失败：HTTP ${res.status}`);
  }
  return res.json();
}

/** 报告版本链 —— GET /api/v1/reports/{id}/versions（#12） */
export async function fetchReportVersions(id: number, visitorId?: string): Promise<ReportListItem[]> {
  const qs = visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : '';
  const res = await fetch(`${API_BASE}/api/v1/reports/${id}/versions${qs}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`获取版本列表失败：HTTP ${res.status}`);
  }
  return res.json();
}

/* ---------------- 报告批注（#8） ---------------- */

export async function fetchAnnotations(reportId: number, visitorId?: string): Promise<ReportAnnotation[]> {
  const qs = visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : '';
  const res = await fetch(`${API_BASE}/api/v1/reports/${reportId}/annotations${qs}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`获取批注失败：HTTP ${res.status}`);
  }
  return res.json();
}

export async function createAnnotation(input: {
  reportId: number;
  visitorId?: string;
  anchor?: string;
  anchorLabel?: string;
  quote?: string;
  content: string;
}): Promise<ReportAnnotation> {
  const res = await fetch(`${API_BASE}/api/v1/reports/annotations`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`新增批注失败：HTTP ${res.status}`);
  }
  return res.json();
}

export async function updateAnnotation(
  id: number,
  content: string,
  visitorId?: string,
): Promise<ReportAnnotation> {
  const qs = visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : '';
  const res = await fetch(`${API_BASE}/api/v1/reports/annotations/${id}${qs}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    throw new Error(`修改批注失败：HTTP ${res.status}`);
  }
  return res.json();
}

export async function deleteAnnotation(id: number, visitorId?: string): Promise<void> {
  const qs = visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : '';
  const res = await fetch(`${API_BASE}/api/v1/reports/annotations/${id}${qs}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`删除批注失败：HTTP ${res.status}`);
  }
}

/* ---------------- 随喜供养订单（#1） ---------------- */

/** 创建供养订单 —— POST /api/v1/donations */
export async function createDonation(input: {
  tier: string;
  amountFen?: number;
  visitorId?: string;
}): Promise<DonationOrder> {
  const res = await fetch(`${API_BASE}/api/v1/donations`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`创建订单失败：HTTP ${res.status}${detail ? ` ${detail.slice(0, 120)}` : ''}`);
  }
  return res.json();
}

/** 查询订单状态（前端轮询）—— GET /api/v1/donations/{outTradeNo} */
export async function fetchDonation(outTradeNo: string, visitorId?: string): Promise<DonationOrder> {
  const qs = visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : '';
  const res = await fetch(`${API_BASE}/api/v1/donations/${outTradeNo}${qs}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`查询订单失败：HTTP ${res.status}`);
  }
  return res.json();
}

/* ---------------- 进阶内容付费订单（premium） ---------------- */

/** 付费订单（与后端 PremiumOrderOut 对齐） */
export interface PremiumOrder {
  outTradeNo: string;
  itemId: string;
  itemName: string;
  amountFen: number;
  amountYuan: string;
  channel: string;
  status: string;
  payUrl: string | null;
  qrText: string;
  checkCode: string;
  refType: string;
  refId: string;
  selfClaimed: boolean;
  createdAt: string;
  expireAt: string;
  paidAt: string | null;
  message: string;
}

/** 创建付费订单 —— POST /api/v1/premium/orders */
export async function createPremiumOrder(input: {
  itemId: string;
  visitorId?: string;
  refType?: string;
  refId?: string;
}): Promise<PremiumOrder> {
  const res = await fetch(`${API_BASE}/api/v1/premium/orders`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`创建订单失败：HTTP ${res.status}${detail ? ` ${detail.slice(0, 120)}` : ''}`);
  }
  return res.json();
}

/** 查询付费订单状态（前端轮询）—— GET /api/v1/premium/orders/{outTradeNo} */
export async function fetchPremiumOrder(outTradeNo: string, visitorId?: string): Promise<PremiumOrder> {
  const qs = visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : '';
  const res = await fetch(`${API_BASE}/api/v1/premium/orders/${outTradeNo}${qs}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`查询订单失败：HTTP ${res.status}`);
  }
  return res.json();
}

/* ---------------- 付费商品目录与权益（会员页数据源） ---------------- */

/** 单个商品（与后端 PremiumPlanOut 对齐） */
export interface PremiumPlanOut {
  itemId: string;
  name: string;
  icon: string;
  priceFen: number;
  priceYuan: string;
  tagline: string;
  perks: string[];
  scope: string;
}

/** 商品目录 + 免费权益 + 当前支付渠道（与后端 PremiumPlansOut 对齐） */
export interface PremiumPlansOut {
  plans: PremiumPlanOut[];
  freePerks: string[];
  channel: string;
}

/** 单个商品的解锁状态（与后端 PremiumEntitlementItem 对齐） */
export interface PremiumEntitlementItem {
  itemId: string;
  unlocked: boolean;
  orderNo: string;
  channel: string;
  paidAt: string | null;
  refType: string;
  refId: string;
}

/** 当前身份已解锁权益集合（服务端真源，只认 status=paid） */
export interface PremiumEntitlementsOut {
  visitorId: string;
  userId: number | null;
  unlocked: string[];
  items: PremiumEntitlementItem[];
  channel: string;
}

/** 商品目录 —— GET /api/v1/premium/plans */
export async function fetchPremiumPlans(): Promise<PremiumPlansOut> {
  const res = await fetch(`${API_BASE}/api/v1/premium/plans`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`获取商品目录失败：HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * 已解锁权益 —— GET /api/v1/premium/entitlements
 *
 * 未登录且无 visitorId 时后端会 401/400，调用方需容错（视为「无权益」而非报错）。
 */
export async function fetchPremiumEntitlements(visitorId?: string): Promise<PremiumEntitlementsOut> {
  const qs = visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : '';
  const res = await fetch(`${API_BASE}/api/v1/premium/entitlements${qs}`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`查询权益失败：HTTP ${res.status}`);
  }
  return res.json();
}

/* ============================================================================
 * AI 解读服务（oraclemind-ai-py，默认端口 8021）
 * POST /api/v1/interpret —— 消费排盘结果 JSON，返回 Markdown 解读文本
 *
 * 注：8001 现为 oraclemind-admin 后台后端，与 AI 服务无关（旧注释误写为 8001）。
 * ==========================================================================*/

/**
 * AI 解读服务地址。
 *
 * 修正点（旧实现无条件 fallback 到 'http://localhost:8021'）：
 * NEXT_PUBLIC_* 是**构建时内联**的，生产环境一旦漏配该变量，产物里就会硬编码一个回环地址。
 * 而前端代码跑在**用户浏览器**里，于是线上会去连用户本机的 8021 端口 ——
 * 表现为「AI 解读全部连接被拒」，且报错完全不指向配置缺失，排查成本极高。
 *
 * 现策略：
 *  - 显式配置 NEXT_PUBLIC_AI_API_BASE → 一律采用（生产 / 自托管走这条）；
 *  - 开发环境未配置 → 回落到 http://localhost:8021（本地一键起服务，符合直觉）；
 *  - 生产环境未配置 → 回落到同源相对地址（由网关 / 反代转发），并告警一次提示补配置。
 */
const _AI_BASE_ENV = (process.env.NEXT_PUBLIC_AI_API_BASE ?? '').trim();
const _IS_DEV = process.env.NODE_ENV === 'development';

export const AI_BASE = _AI_BASE_ENV || (_IS_DEV ? 'http://localhost:8021' : '');

if (!_AI_BASE_ENV && !_IS_DEV && typeof window !== 'undefined') {
  // 只在浏览器侧告警一次：SSR 日志里刷这条没有意义
  console.warn(
    '[oraclemind] NEXT_PUBLIC_AI_API_BASE 未配置，AI 解读将请求同源地址。' +
      '请在构建时注入该变量（指向 oraclemind-ai-py，本地默认 http://localhost:8021）。',
  );
}

/** 支持 AI 解读的术数模块（与 oraclemind-ai-py 的 InterpretModule 对齐；liuren/taiyi 为三式补齐新增） */
export type InterpretModule =
  | 'bazi' | 'ziwei' | 'liuyao' | 'meihua' | 'qimen'
  | 'liuren' | 'taiyi'
  | 'numerology' | 'tarot' | 'dream' | 'fengshui' | 'summary'
  | 'angel';

/** 解梦多视角（前端『换个角度再看』按钮）—— 与 oraclemind-ai/src/types.ts DreamPerspective 对齐 */
export type DreamPerspective = 'jung' | 'freud' | 'cognitive' | 'fortune';

/** 梦境解读请求负载（梦境描述必填，近期背景/视角可选） */
export interface DreamRequest {
  dream: string;
  context?: string;
  /** 可选的指定解读视角：荣格 / 弗洛伊德 / 认知 / 东方运势命理 */
  perspective?: DreamPerspective;
}

/** 解读请求元信息（与 oraclemind-ai InterpretMeta 对齐） */
export interface InterpretMeta {
  requestId: string;
  module: InterpretModule;
  promptVersion: string;
  /** 实际供应商：aliyun / zhipu / local-rules / cache */
  provider: string;
  model: string;
  cacheHit: boolean;
  /** 是否降级（本地规则 / 预算熔断） */
  degraded: boolean;
  degradedReason: string | null;
  tokens: { prompt: number; completion: number } | null;
  costYuan: number;
  latencyMs: number;
  truncated: boolean;
  /** 检索增强命中信息（未启用/未命中则为 undefined） */
  retrieval?: { enabled: boolean; count: number; sources: string[]; text: string };
  /** 归一化层修补过的字段清单（综合运势专用）：非空表示 LLM 输出不合规已被纠正 */
  patched?: string[];
}

/** 解读响应（与 oraclemind-ai InterpretResponse 对齐） */
export interface InterpretResponse {
  /** Markdown 解读文本 */
  text: string;
  /** 强制免责声明 */
  disclaimer: string;
  meta: InterpretMeta;
}

/** 检索增强命中的典籍原文（与 oraclemind-ai InterpretMeta.retrieval 对齐） */
export interface RetrieveResult {
  /** 检索增强是否启用 */
  enabled: boolean;
  /** 命中条数 */
  count: number;
  /** 命中来源（典籍名，去重） */
  sources: string[];
  /** 已格式化、带来源标注的典籍原文（前端「命理原文」块直接展示） */
  text: string;
}

/**
 * 请求纯检索（不调 LLM，零成本）—— POST /api/v1/retrieve。
 * 返回检索增强命中的典籍原文，供前端「命理原文」块展示；失败/未命中返回空，前端展示空态（无本地兜底）。
 */
export async function requestRetrieve(
  module: InterpretModule,
  result: unknown,
  signal?: AbortSignal
): Promise<RetrieveResult> {
  const res = await fetch(`${AI_BASE}/api/v1/retrieve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ module, result }),
    signal,
  });
  if (!res.ok) {
    throw new Error(`检索接口响应异常：HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * 请求 AI 解读 —— POST /api/v1/interpret。
 * 失败抛错由调用方静默降级（前端保留内置解读文案），符合离线可用原则。
 */
export async function requestInterpret(
  module: InterpretModule,
  result: unknown,
  focus?: string,
  signal?: AbortSignal
): Promise<InterpretResponse> {
  // 统一请求缓存：同模块+同结果+同聚焦 命中缓存直接返回，不调 AI 解读（省 token）
  const { data } = await cachedRequest<InterpretResponse>(
    `interpret:${module}`,
    { result, focus },
    async () => {
      const res = await fetch(`${AI_BASE}/api/v1/interpret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, result, focus }),
        signal,
      });
      if (!res.ok) {
        throw new Error(`AI 解读接口响应异常：HTTP ${res.status}`);
      }
      return res.json();
    },
    REQ_CACHE_TTL.long,
  );
  return data;
}

/**
 * 请求 AI 梦境解读 —— POST /api/v1/interpret（module=dream）。
 * 输入自然语言梦境描述 + 可选近期背景/情绪；失败抛错由调用方本地兜底。
 */
export async function requestDreamInterpret(
  dream: string,
  context?: string,
  signal?: AbortSignal,
  perspective?: DreamPerspective
): Promise<InterpretResponse> {
  const { data } = await cachedRequest<InterpretResponse>(
    'interpret:dream',
    { dream, context, perspective },
    () => requestInterpret('dream', { dream, context, perspective } satisfies DreamRequest, undefined, signal),
    'long',
  );
  return data;
}

// ==================== 卜卦 · 综合行动建议（结构化，AI 服务 /api/v1/summary） ====================

/** 综合行动建议 · 单栏 */
export interface SummaryAdviceColumn {
  title: string;
  items: string[];
  /** AI 返回的 emoji 图标（如 ⚡📅🚀），前端映射为 SectionIcon */
  icon?: string;
}

/** 综合行动建议 · 交叉验证共识项 */
export interface SummaryConsensus {
  label: string;
  /** 运势强度：该维度当前运势有多好，越高越好（60~95） */
  score: number;
  /**
   * 共识度：参与融合的各术数在该维度上结论的一致程度（0~100）。
   * 与 score 语义不同 —— score=85 且 agreement=50 表示"整体看好但各术数分歧大"。
   * 0 表示未计算（本地规则降级态），前端应隐藏该标签而非显示"0% 共识"。
   */
  agreement?: number;
  /** 分维解读：该维度分数的具体依据（哪几个术数一致指向此结论），由后端 consensus.reason 产出 */
  reason?: string;
}

/** 综合行动建议 · 综合卡片项 */
export interface SummaryCardItem {
  icon: string;
  name: string;
  score: string;
  desc: string;
}

/** 综合行动建议 · 时间分段项 */
export interface SummaryTimelineItem {
  period: string;
  overview: string;
}

/** 术数间分歧与调和方案（交叉验证的核心产出之一） */
export interface SummaryDivergence {
  /** 矛盾描述 */
  desc: string;
  /** 产生分歧的术数名（如 ["bazi", "liuyao"]） */
  modules: string[];
  /** 调和建议 */
  resolution?: string;
}

/** 综合行动建议 · AI 结构化输出 */
export interface SummaryOutput {
  ok: boolean;
  /** 跨术数共振发现（哪几个术数一致、指向什么结论） */
  keyFindings?: string[];
  /** 术数间分歧与调和方案 */
  divergences?: SummaryDivergence[];
  /** 白话整体概述 */
  summary: string;
  /** 三栏行动建议：立即行动 / 短期（1-3月） / 中长期（2027+） */
  advice: SummaryAdviceColumn[];
  /** 近期趋势提示 */
  outlook: string;
  /** 交叉验证共识度（6 个维度） */
  consensus?: SummaryConsensus[];
  /** 综合卡片（4 张） */
  cards?: SummaryCardItem[];
  /** 时间分段概述（今年 / 明年 / 关键期）—— summary agent 产出，report agent 不产但类型需保留以兼容 */
  timeline?: SummaryTimelineItem[];
  reason?: string;
}

/** 综合行动建议 · 接口响应 */
export interface SummaryResponse {
  data: SummaryOutput;
  disclaimer: string;
  meta: InterpretMeta;
}

/** 请求综合行动建议（融合多术数排盘结果，POST /api/v1/summary） */
export async function requestSummary(
  modules: { module: string; name: string; result: unknown }[],
  question?: string,
  signal?: AbortSignal,
  focus?: string | null
): Promise<SummaryResponse> {
  const { data } = await cachedRequest<SummaryResponse>(
    'summary',
    { modules, question, focus },
    async () => {
      const res = await fetch(`${AI_BASE}/api/v1/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules, question, focus: focus ?? null }),
        signal,
      });
      if (!res.ok) {
        throw new Error(`综合行动建议接口响应异常：HTTP ${res.status}`);
      }
      return res.json();
    },
    REQ_CACHE_TTL.long,
  );
  return data;
}

// ==================== 卜卦 · 综合行动建议（SSE 流式，AI 服务 /api/v1/summary/stream） ====================

/** 综合行动建议 · 流式增量回调 */
export interface SummaryStreamHandlers {
  /** 首个事件：是否成功 / 降级信息（可用于在 LLM 计算期间预判最终态） */
  onInit?: (init: { ok: boolean; reason?: string; degraded: boolean; provider?: string; model?: string; cacheHit: boolean }) => void;
  /** 每个 section（共识度/卡片/建议/总结）到达时回调，partial 为累积到当前的 SummaryResponse，可直接喂给 SummaryModule 渐进渲染 */
  onSection?: (partial: SummaryResponse) => void;
  /** 流结束（done 事件） */
  onDone?: (final: SummaryResponse) => void;
}

/** 请求综合行动建议（流式，POST /api/v1/summary/stream）
 *  - 入参语义与 requestSummary 完全一致
 *  - 过程通过 onSection 把累积的部分结果喂给调用方，实现"共识度→卡片→建议→总结"分块点亮
 *  - 返回 Promise<SummaryResponse>（done 事件后 resolve；HTTP / 流错误则 reject）
 */
export async function requestSummaryStream(
  modules: { module: string; name: string; result: unknown }[],
  question?: string,
  opts: {
    focus?: string | null;
    signal?: AbortSignal;
    onInit?: SummaryStreamHandlers['onInit'];
    onSection?: SummaryStreamHandlers['onSection'];
    onDone?: SummaryStreamHandlers['onDone'];
  } = {}
): Promise<SummaryResponse> {
  const { focus, signal, onInit, onSection, onDone } = opts;
  const res = await fetch(`${AI_BASE}/api/v1/summary/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ modules, question, focus: focus ?? null }),
    signal,
  });
  if (!res.ok) {
    let msg = `流式综合解读接口响应异常：HTTP ${res.status}`;
    try {
      const j = await res.json().catch(() => null);
      if (j?.message) msg += `：${j.message}`;
    } catch {}
    throw new Error(msg);
  }

  // 初始占位：meta 永不为 null，避免 SummaryModule 在读 shown.meta 时崩溃
  let data: SummaryOutput = { ok: true, summary: '', advice: [], outlook: '', consensus: [], cards: [], timeline: [], keyFindings: [], divergences: [] };
  let meta: InterpretMeta = {
    requestId: '', module: 'summary', promptVersion: '', provider: '', model: '',
    cacheHit: false, degraded: false, degradedReason: null, tokens: null, costYuan: 0, latencyMs: 0, truncated: false,
  };
  let disclaimer = '';
  let errCode: string | null = null;
  let errMessage: string | null = null;

  const emit = (): SummaryResponse => ({ data, disclaimer, meta });

  await parseSSE(res, (event, d) => {
    switch (event) {
      case 'open':
        return;
      case 'init':
        if (d && typeof d === 'object') {
          data.ok = d.ok !== false;
          if (typeof d.reason === 'string') data.reason = d.reason;
          onInit?.({
            ok: data.ok, reason: d.reason, degraded: !!d.degraded,
            provider: d.provider, model: d.model, cacheHit: !!d.cacheHit,
          });
          if (!data.ok) onSection?.(emit()); // ok:false 无后续 section，直接把失败态推给 UI
        }
        return;
      case 'consensus':
        if (Array.isArray(d)) { data.consensus = d as SummaryOutput['consensus']; onSection?.(emit()); }
        return;
      case 'cards':
        if (Array.isArray(d)) { data.cards = d as SummaryOutput['cards']; onSection?.(emit()); }
        return;
      case 'advice':
        if (Array.isArray(d)) { data.advice = d as SummaryOutput['advice']; onSection?.(emit()); }
        return;
      case 'summary':
        if (d && typeof d === 'object') {
          data.summary = typeof d.summary === 'string' ? d.summary : '';
          data.outlook = typeof d.outlook === 'string' ? d.outlook : '';
          data.timeline = Array.isArray(d.timeline) ? (d.timeline as SummaryOutput['timeline']) : [];
          onSection?.(emit());
        }
        return;
      case 'keyFindings':
        if (Array.isArray(d)) { data.keyFindings = d as SummaryOutput['keyFindings']; onSection?.(emit()); }
        return;
      case 'divergences':
        if (Array.isArray(d)) { data.divergences = d as SummaryOutput['divergences']; onSection?.(emit()); }
        return;
      case 'meta':
        if (d && typeof d === 'object') meta = d as InterpretMeta;
        return;
      case 'done':
        if (d && typeof d === 'object' && typeof d.disclaimer === 'string') disclaimer = d.disclaimer;
        return;
      case 'error':
        if (d) {
          errCode = String(d.code ?? 'STREAM_ERROR');
          errMessage = String(d.message ?? '流式综合解读失败');
        }
        return;
      default:
        return;
    }
  }, signal);

  if (errCode) {
    throw new Error(`流式综合解读错误[${errCode}]：${errMessage}`);
  }
  const final = emit();
  onDone?.(final);
  return final;
}

// ==================== 占星术 · 本命盘 / 运势（oraclemind-ai） ====================

/** 出生信息（AI 服务计算本命盘用） */
export interface AstroBirth {
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:mm（出生地本地墙上时间）
  latitude: number;
  longitude: number;
  houseSystem?: 'equal' | 'whole'; // 等宫制 / 整宫制
  unknownTime?: boolean; // 出生时间未知 → 日间盘降级
  /**
   * 出生地时区相对 UT 的小时偏移（如北京 8、纽约 -5、新德里 5.5）。
   * 必填：占星计算以 UT 为输入，缺失时后端只能按经度兜底推算（中国全境用东八区，
   * 经度法会把乌鲁木齐算成 +6，偏差 2 小时 = 上升偏 30°）。
   */
  utcOffset?: number;
  /** 太阳返照年份（仅 /solar-return 使用），缺省由后端取当前年 */
  year?: number;
  /** 解读盐值：前端「换一版」用随机串绕开同 prompt 缓存，触发重新生成 */
  salt?: string;
}

/** 本命盘星体 */
export interface AstroBody {
  key: string; label: string; glyph: string;
  signKey: string; sign: string; signGlyph: string;
  longitude: number; degreeInSign: string; house: number | null; retrograde: boolean;
  dignity: 'ruler' | 'exalt' | 'detriment' | 'fall' | null; // 入庙/曜升/失势/落陷
}
/** 本命盘宫位 */
export interface AstroHouse {
  num: number; name: string; signKey: string; sign: string; signGlyph: string; cusp: number;
  theme?: string; // 宫位主题含义
}
/** 本命盘小行星 / 虚点（北交/莉莉丝/凯龙） */
export interface AstroExtraPoint {
  key: string; label: string; glyph: string;
  signKey: string; sign: string; signGlyph: string;
  longitude: number; degreeInSign: string; house: number | null;
}
/** 本命盘相位 */
export interface AstroAspect {
  p1Key: string; p1: string; p2Key: string; p2: string;
  typeKey: string; type: string; level: string; orb: number;
}
/** 完整本命盘 */
export interface NatalChart {
  birth: AstroBirth;
  houseSystem: 'equal' | 'whole';
  ascendant: { sign: string; signGlyph: string; degreeInSign: string; longitude: number } | null;
  midheaven: { sign: string; signGlyph: string; degreeInSign: string; longitude: number } | null;
  immc: { sign: string; signGlyph: string; degreeInSign: string; longitude: number } | null;
  descendant: { sign: string; signGlyph: string; degreeInSign: string; longitude: number } | null;
  sunSign: { key: string; sign: string; signGlyph: string };
  moonSign: { key: string; sign: string; signGlyph: string };
  planets: AstroBody[];
  extraPoints: AstroExtraPoint[];
  houses: AstroHouse[];
  aspects: AstroAspect[];
  elements: Record<string, number>;
  summary: string;
  /** 太阳返照盘专用：返照年份 */
  solarReturnYear?: number;
  /** 太阳返照盘专用：太阳精确回归的本地时刻（YYYY-MM-DD HH:mm） */
  solarReturnTime?: string;
}

/** 解读响应的元信息（是否降级、由谁生成、是否命中缓存） */
export interface AstroMeta {
  degraded: boolean;
  degradedReason: string | null;
  provider: string;
  model?: string;
  cacheHit: boolean;
  tokens?: number | null;
  costYuan?: number;
  latencyMs?: number;
  [k: string]: unknown;
}

/** 组合盘（中点法 Composite） */
export interface AstroComposite {
  sun: { sign: string; signGlyph: string; degreeInSign: string; longitude: number } | null;
  moon: { sign: string; signGlyph: string; degreeInSign: string; longitude: number } | null;
  venus: { sign: string; signGlyph: string; degreeInSign: string; longitude: number } | null;
  mars: { sign: string; signGlyph: string; degreeInSign: string; longitude: number } | null;
  ascendant: { sign: string; signGlyph: string; degreeInSign: string; longitude: number } | null;
  midheaven: { sign: string; signGlyph: string; degreeInSign: string; longitude: number } | null;
  aspects: { p1: string; p2: string; type: string; orb: number }[];
}

/** 真实天象交相（流年对本命盘） */
export interface AstroTransit {
  transitKey: string; transit: string;
  natalKey: string; natal: string;
  typeKey: string; type: string; orb: number;
}

/** 本命盘解读响应（结构化） */
export interface AstroReportData {
  overview: string;
  personality: string;
  love: string;
  career: string;
  health: string;
  advice: string[];
}
/** 运势预测响应（结构化） */
export interface AstroForecastData {
  overview: string;
  love: string;
  career: string;
  health: string;
  advice: string[];
  luckyNumbers?: number[];
  luckyColors?: string[];
  luckyDirection?: string;
}
export interface AstroResponse<T> {
  data: T;
  disclaimer: string;
  transits?: AstroTransit[];
  meta: AstroMeta;
}

/** 仅计算本命盘（用于星盘渲染，POST /api/v1/astrology/natal） */
export async function requestNatalChart(birth: AstroBirth, signal?: AbortSignal): Promise<NatalChart> {
  const { data } = await cachedRequest<NatalChart>(
    'astro:natal',
    birth,
    async () => {
      const res = await fetch(`${AI_BASE}/api/v1/astrology/natal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(birth),
        signal,
      });
      if (!res.ok) throw new Error(`本命盘计算异常：HTTP ${res.status}`);
      return res.json();
    },
    REQ_CACHE_TTL.long,
  );
  return data;
}

/** 本命盘 AI 解读（POST /api/v1/astrology/report） */
export async function requestNatalReport(birth: AstroBirth, salt?: string, signal?: AbortSignal): Promise<AstroResponse<AstroReportData>> {
  const { data } = await cachedRequest<AstroResponse<AstroReportData>>(
    'astro:report',
    { birth, salt },
    async () => {
      const res = await fetch(`${AI_BASE}/api/v1/astrology/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(salt ? { ...birth, salt } : birth),
        signal,
      });
      if (!res.ok) throw new Error(`本命盘解读异常：HTTP ${res.status}`);
      return res.json();
    },
    REQ_CACHE_TTL.long,
  );
  return data;
}

/** 每日/每周/每月运势预测（POST /api/v1/astrology/forecast） */
export async function requestAstroForecast(
  birth: AstroBirth,
  period: 'daily' | 'weekly' | 'monthly' | 'yearly',
  signal?: AbortSignal
): Promise<AstroResponse<AstroForecastData>> {
  const { data } = await cachedRequest<AstroResponse<AstroForecastData>>(
    'astro:forecast',
    { birth, period },
    async () => {
      const res = await fetch(`${AI_BASE}/api/v1/astrology/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...birth, period }),
        signal,
      });
      if (!res.ok) throw new Error(`运势预测异常：HTTP ${res.status}`);
      return res.json();
    },
    REQ_CACHE_TTL.long,
  );
  return data;
}

// ==================== 风水堪舆 · AI 四维解读（oraclemind-ai /api/v1/interpret module=fengshui） ====================

/** 风水堪舆 AI 解读请求负载 */
export interface FengshuiInterpretRequest {
  dimension: 'wealth' | 'health' | 'love' | 'career';
  stars: { pos: string; starNum: number; starName: string; auspicious: string }[];
  mingGua?: { num: number; name: string; group: string; dir: string };
  bazhai?: { dir: string; star: string; auspicious: string }[];
  bazi?: { dayMaster: string; wuxing: string; xi: string[]; ji: string[] };
  xingSha?: { id: string; name: string; severity: string }[];
  facing?: string;
  year: number;
  /** 访客出生信息（来自 VisitorProvider，即使未排八字也能提供） */
  birthDate?: { year: number; month: number; day: number; time: string; gender: string };
}

/** 请求风水堪舆 AI 解读 —— POST /api/v1/interpret（module=fengshui） */
export async function requestFengshuiInterpret(
  payload: FengshuiInterpretRequest,
  signal?: AbortSignal
): Promise<InterpretResponse> {
  const { data } = await cachedRequest<InterpretResponse>(
    'interpret:fengshui',
    payload,
    () => requestInterpret('fengshui', payload, undefined, signal),
    'long',
  );
  return data;
}

// ==================== 占星术 · 星座配对 / 合盘（oraclemind-ai） ====================

/** 合盘交叉相位 */
export interface SynastryAspect {
  p1Key: string; p1: string; p2Key: string; p2: string;
  type: string; label: string; orb: number;
}

/** 合盘解读数据（AI 结构化输出 + 计算结果） */
export interface SynastryData {
  compatibility: string;
  love: string;
  communication: string;
  conflict: string;
  advice: string[];
  /** 配对指数 0-100（服务端天文计算） */
  score: number;
  chart1: { sun: string; moon: string; ascendant: string };
  chart2: { sun: string; moon: string; ascendant: string };
  aspects: SynastryAspect[];
  /** 组合盘（中点法） */
  composite?: AstroComposite;
}

/** 星座配对 / 合盘分析（POST /api/v1/astrology/synastry） */
export async function requestSynastry(
  birth1: AstroBirth,
  birth2: AstroBirth,
  signal?: AbortSignal
): Promise<AstroResponse<SynastryData>> {
  const { data } = await cachedRequest<AstroResponse<SynastryData>>(
    'astro:synastry',
    { birth1, birth2 },
    async () => {
      const res = await fetch(`${AI_BASE}/api/v1/astrology/synastry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birth1, birth2 }),
        signal,
      });
      if (!res.ok) throw new Error(`合盘分析异常：HTTP ${res.status}`);
      const raw: any = await res.json();
      // 后端直接返回 SynastryData（无 data 包裹层），归一化为前端期望的 AstroResponse 结构
      return { data: raw as SynastryData, disclaimer: raw.disclaimer ?? '', meta: raw.meta };
    },
    REQ_CACHE_TTL.long,
  );
  return data;
}

/** 当前真实天象交相（流年行星对本命盘，POST /api/v1/astrology/transits） */
export async function requestTransits(
  birth: AstroBirth,
  period: 'daily' | 'weekly' | 'monthly' | 'yearly',
  signal?: AbortSignal
): Promise<{ period: string; refDate: string; transits: AstroTransit[] }> {
  const { data } = await cachedRequest<{ period: string; refDate: string; transits: AstroTransit[] }>(
    'astro:transits',
    { birth, period },
    async () => {
      const res = await fetch(`${AI_BASE}/api/v1/astrology/transits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...birth, period }),
        signal,
      });
      if (!res.ok) throw new Error(`天象计算异常：HTTP ${res.status}`);
      return res.json();
    },
    REQ_CACHE_TTL.long,
  );
  return data;
}

/** 太阳返照盘（POST /api/v1/astrology/solar-return，返回 NatalChart 结构）
 *  @param year 返照年份，缺省由后端取当前年
 */
export async function requestSolarReturn(
  birth: AstroBirth,
  year?: number,
  signal?: AbortSignal
): Promise<NatalChart> {
  const { data } = await cachedRequest<NatalChart>(
    'astro:solar-return',
    { birth, year },
    async () => {
      const res = await fetch(`${AI_BASE}/api/v1/astrology/solar-return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...birth, year: year ?? null }),
        signal,
      });
      if (!res.ok) throw new Error(`太阳返照计算异常：HTTP ${res.status}`);
      return res.json();
    },
    REQ_CACHE_TTL.long,
  );
  return data;
}

/** 太阳返照盘 AI 解读（POST /api/v1/astrology/solar-return/report） */
export async function requestSolarReturnReport(
  birth: AstroBirth,
  year?: number,
  signal?: AbortSignal
): Promise<AstroResponse<AstroReportData>> {
  const { data } = await cachedRequest<AstroResponse<AstroReportData>>(
    'astro:solar-return-report',
    { birth, year },
    async () => {
      const res = await fetch(`${AI_BASE}/api/v1/astrology/solar-return/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...birth, year: year ?? null }),
        signal,
      });
      if (!res.ok) throw new Error(`太阳返照解读异常：HTTP ${res.status}`);
      return res.json();
    },
    REQ_CACHE_TTL.long,
  );
  return data;
}

// ==================== 塔罗 · 每日（今日能量 / 每日三牌） ====================

/** tarot-daily 请求负载：牌面由前端按日期 seed 确定性生成 */
export interface TarotDailyRequest {
  date: string;
  theme: { name: string; isRev: boolean };
  /** position：每日三牌的牌位语义（今日能量 / 今日挑战 / 今日行动） */
  cards: { name: string; isRev: boolean; position?: string }[];
}

/** tarot-daily 结构化解读数据 */
export interface TarotDailyData {
  ok: boolean;
  /** 主题牌关键词（如「希望 · 疗愈 · 信心」） */
  themeKw: string;
  /** AI 综合指引：综合主题牌 + 每日三牌能量主线的一段话 */
  summary: string;
  /** 今日能量列表（k = 维度名，v = 内容） */
  energy: { k: string; v: string }[];
  /** 每日三牌指引（与请求 cards 一一对应） */
  cards: { name: string; posi: string; read: string }[];
  reason?: string;
}

/** tarot-daily 响应（结构化数据，非 Markdown） */
export interface TarotDailyResponse {
  data: TarotDailyData;
  disclaimer: string;
  meta: InterpretMeta;
}

/**
 * 请求今日塔罗解读 —— POST /api/v1/tarot/daily。
 * 返回结构化数据（主题牌关键词 + 能量列表 + 三牌指引），失败抛错由调用方本地兜底。
 */
export async function requestTarotDaily(
  payload: TarotDailyRequest,
  signal?: AbortSignal
): Promise<TarotDailyResponse> {
  // 每日运势：同日期+同牌面 命中缓存（daily TTL，跨日自动失效）
  const { data } = await cachedRequest<TarotDailyResponse>(
    'tarot-daily',
    payload,
    async () => {
      const res = await fetch(`${AI_BASE}/api/v1/tarot/daily`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });
      if (!res.ok) {
        throw new Error(`今日塔罗接口响应异常：HTTP ${res.status}`);
      }
      return res.json();
    },
    REQ_CACHE_TTL.daily,
  );
  return data;
}

// =====================================================================================
// SSE 流式输出（打字机渐进展示）
// =====================================================================================

/**
 * 流式回调选项。
 *  - onDelta：每收到一段 chunk（若干字符）调用，fullTextSoFar 是累计到当前的完整文本
 *  - onMeta：流最后、已收到 meta+disclaimer 时调用（在最终 Promise resolve 之前）
 *  - signal：AbortController.signal，abort() 可中途停止（Promise 会 reject DOMException[AbortError]）
 */
export interface InterpretStreamOptions {
  onDelta?: (chunk: string, fullTextSoFar: string) => void;
  onMeta?: (meta: InterpretMeta, disclaimer: string, fullText: string) => void;
  signal?: AbortSignal;
  /** 可选：透传 requestId（审计/幂等），不传则前端不塞 */
  requestId?: string;
  /** 可选：透传 reportId，不传则不塞 */
  reportId?: string;
  /**
   * 可选：解读聚焦模式，'refs' = 命理原文白话解读，'wuxing' = 五行能量专属解读。
   * 同时并入后端缓存键，因此传一个新值即可绕开缓存拿到重新生成的结果
   * （塔罗「换个角度再解读」用 'reread-N'）。
   */
  focus?: 'refs' | 'wuxing' | (string & {});
}

/**
 * 解析 SSE 响应：从 fetch Response 中读取 ReadableStream，按 "\n\n" 切 event，
 * 解析出 event 名和 JSON data，逐条交给 onEvent 回调。
 */
async function parseSSE(
  response: Response,
  onEvent: (event: string, data: any) => void,
  signal?: AbortSignal
): Promise<void> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let buf = '';

  const onAbort = () => reader.cancel().catch(() => {});
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value || new Uint8Array(), { stream: true });
      // SSE 以空行（\n\n / \r\n\r\n）分隔事件
      let idx: number;
      while ((idx = buf.indexOf('\n\n')) >= 0 || (idx = buf.indexOf('\r\n\r\n')) >= 0) {
        const raw = buf.slice(0, idx);
        const sep = buf.startsWith('\r', idx) ? 4 : 2;
        buf = buf.slice(idx + sep);
        let eventName = 'message';
        const dataLines: string[] = [];
        for (const line of raw.split(/\r?\n/)) {
          if (!line) continue;
          if (line.startsWith(':')) continue; // SSE 注释，跳过
          const colon = line.indexOf(':');
          const key = colon >= 0 ? line.slice(0, colon) : line;
          const val = colon >= 0 ? line.slice(colon + 1).replace(/^ /, '') : '';
          if (key === 'event') eventName = val;
          else if (key === 'data') dataLines.push(val);
        }
        const dataStr = dataLines.join('\n');
        let data: any = undefined;
        if (dataStr) {
          try { data = JSON.parse(dataStr); } catch { data = { raw: dataStr }; }
        }
        onEvent(eventName, data);
      }
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
    reader.cancel().catch(() => {});
  }
}

/**
 * 通用流式解读请求 —— POST /api/v1/interpret/stream
 *  - 复用 requestInterpret 的入参（module / result），语义完全一致
 *  - 返回 Promise<InterpretResponse>（在 done 事件后 resolve；错误事件或 HTTP 错误则 reject）
 *  - 过程中通过 onDelta / onMeta 回调把增量文本喂给调用方（用于打字机渲染）
 */
export async function requestInterpretStream(
  module: InterpretModule,
  result: unknown,
  opts: InterpretStreamOptions = {}
): Promise<InterpretResponse> {
  const { onDelta, onMeta, signal, requestId, reportId, focus } = opts;

  const res = await fetch(`${AI_BASE}/api/v1/interpret/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ module, result, requestId, reportId, focus }),
    signal,
  });

  // 非 2xx：按错误处理（可能是入参校验 400 —— 此时不是 event-stream）
  if (!res.ok) {
    let msg = `流式解读接口响应异常：HTTP ${res.status}`;
    try {
      const j = await res.json().catch(() => null);
      if (j?.message) msg += `：${j.message}`;
    } catch {}
    throw new Error(msg);
  }

  const buildFallbackMeta = (extra: Partial<InterpretMeta> = {}): InterpretMeta => ({
    requestId: requestId ?? 'stream-' + Math.random().toString(36).slice(2, 10),
    module,
    promptVersion: 'stream-fallback',
    provider: 'stream',
    model: 'stream-fallback',
    cacheHit: false,
    degraded: false,
    degradedReason: null,
    tokens: null,
    costYuan: 0,
    latencyMs: 0,
    truncated: false,
    ...extra,
  });

  let text = '';
  let disclaimer = '';
  let meta: InterpretMeta | null = null;
  let errCode: string | null = null;
  let errMessage: string | null = null;
  let finalDoneText: string | null = null;

  await parseSSE(res, (event, data) => {
    switch (event) {
      case 'open':
        return;
      case 'delta':
        if (typeof data?.chunk === 'string') {
          text += data.chunk;
          onDelta?.(data.chunk, text);
        }
        return;
      case 'meta':
        if (data && typeof data === 'object') {
          if (typeof data.disclaimer === 'string') disclaimer = data.disclaimer;
          if (data.meta && typeof data.meta === 'object') meta = buildFallbackMeta(data.meta as Partial<InterpretMeta>);
          onMeta?.(meta ?? buildFallbackMeta(), disclaimer, text);
        }
        return;
      case 'error':
        if (data) {
          errCode = String(data.code ?? 'STREAM_ERROR');
          errMessage = String(data.message ?? '流式解读失败');
        }
        return;
      case 'done':
      case 'message':
      default:
        // 优先使用 done 事件中的格式化文本（方案 B：JSON→Markdown 转换在服务端完成）
        if (data && typeof data === 'object' && typeof data.text === 'string') {
          finalDoneText = data.text;
        }
        return;
    }
  }, signal);

  if (errCode) {
    throw new Error(`流式解读错误[${errCode}]：${errMessage}`);
  }

  const finalMeta: InterpretMeta = meta ?? buildFallbackMeta();
  // 优先使用 done 事件中的格式化文本
  const finalText = finalDoneText ?? text;
  return { text: finalText, disclaimer, meta: finalMeta };
}

/** 梦境解读 · 流式版 */
export async function requestDreamInterpretStream(
  dream: string,
  context: string | undefined,
  opts: InterpretStreamOptions,
  perspective?: DreamPerspective
): Promise<InterpretResponse> {
  return requestInterpretStream('dream', { dream, context, perspective } satisfies DreamRequest, opts);
}

/** 风水堪舆 · 流式版 */
export async function requestFengshuiInterpretStream(
  payload: FengshuiInterpretRequest,
  opts: InterpretStreamOptions = {}
): Promise<InterpretResponse> {
  return requestInterpretStream('fengshui', payload, opts);
}

// ==================== 测字起名 · AI 起名 Agent（/api/v1/agent/ming） ====================

/** 起名 Agent 流式选项 */
/** 首页通用命理助手 · 对话内 CTA（引导去卜卦页排盘） */
export interface HomeAgentCta {
  target: string;
  label: string;
  prefill?: string;
  birthHint?: MingAgentBirthHint;
}

export interface MingAgentStreamOptions {
  onDelta?: (chunk: string, fullTextSoFar: string) => void;
  onMeta?: (meta: { disclaimer: string; degraded: boolean; degradedReason: string | null; cta?: HomeAgentCta | null }) => void;
  signal?: AbortSignal;
  requestId?: string;
}

/** 起名 Agent 出生信息提示（与后端 MingRequest.birthHint 对齐） */
export interface MingAgentBirthHint {
  year?: number;
  month?: number;
  day?: number;
  timeText?: string;
  gender?: string;
}

/**
 * 起名 Agent 流式请求 —— POST /api/v1/agent/ming/stream
 *  - message: 自然语言描述（如"给姓李的男宝起名"）
 *  - birthHint: 可选出生信息对象 {year, month, day, timeText, gender}
 *  - SSE 事件流：open → delta* → meta → done
 */
export async function requestMingAgentStream(
  message: string,
  opts: MingAgentStreamOptions = {},
  birthHint?: MingAgentBirthHint
): Promise<{ text: string; disclaimer: string; degraded: boolean; degradedReason: string | null }> {
  const { onDelta, onMeta, signal, requestId } = opts;
  const res = await fetch(`${AI_BASE}/api/v1/agent/ming/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ message, birthHint, requestId }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`AI 起名服务响应异常：HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let text = '';
  let disclaimer = '';
  let degraded = false;
  let degradedReason: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      try {
        const data = JSON.parse(line.slice(5).trim());
        if (data.chunk) {
          text += data.chunk;
          onDelta?.(data.chunk, text);
        }
        if (data.disclaimer) disclaimer = data.disclaimer;
        if (data.degraded !== undefined) degraded = data.degraded;
        if (data.degradedReason !== undefined) degradedReason = data.degradedReason;
        if (data.event === 'meta' || data.disclaimer) {
          onMeta?.({ disclaimer, degraded, degradedReason });
        }
      } catch { /* skip */ }
    }
  }

  return { text, disclaimer, degraded, degradedReason };
}

/**
 * 首页通用命理助手 · 流式请求 —— POST /api/v1/agent/home/stream
 *  - message: 用户问题（自然语言）
 *  - history: 可选多轮对话历史（ChatHistoryEntry[]）
 *  - birthHint: 可选已知出生信息
 *  - SSE 事件流：open → delta* → meta → done（与起名 Agent 同结构，可复用解析）
 */
export async function requestHomeAgentStream(
  message: string,
  opts: MingAgentStreamOptions = {},
  history?: ChatHistoryEntry[],
  birthHint?: MingAgentBirthHint
): Promise<{ text: string; disclaimer: string; degraded: boolean; degradedReason: string | null }> {
  const { onDelta, onMeta, signal, requestId } = opts;
  const res = await fetch(`${AI_BASE}/api/v1/agent/home/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ message, history, birthHint, requestId }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`命理助手服务响应异常：HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let text = '';
  let disclaimer = '';
  let degraded = false;
  let degradedReason: string | null = null;
  let cta: HomeAgentCta | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      try {
        const data = JSON.parse(line.slice(5).trim());
        if (data.chunk) {
          text += data.chunk;
          onDelta?.(data.chunk, text);
        }
        if (data.disclaimer) disclaimer = data.disclaimer;
        if (data.degraded !== undefined) degraded = data.degraded;
        if (data.degradedReason !== undefined) degradedReason = data.degradedReason;
        if (data.cta) cta = data.cta as HomeAgentCta;
        if (data.event === 'meta' || data.disclaimer) {
          onMeta?.({ disclaimer, degraded, degradedReason, cta });
        }
      } catch { /* skip */ }
    }
  }

  return { text, disclaimer, degraded, degradedReason };
}

/** 多轮对话 · 对话历史条目 */
export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * 多轮对话流式请求 —— POST /api/v1/chat/stream
 *  - dream: 初始梦境描述（作为 system 上下文）
 *  - context: 近期背景（可选）
 *  - history: 之前的对话历史（不含当前 question）
 *  - question: 用户最新问题（或视角切换提示词）
 *  - perspective: 指定视角（可选，点击"换个角度"时传入）
 *  - SSE 事件流：open → delta* → meta → done
 *  - 返回 Promise<{text, disclaimer}>（在 done 后 resolve）
 */
export async function requestDreamChatStream(
  dream: string,
  context: string | undefined,
  history: ChatHistoryEntry[],
  question: string,
  opts: InterpretStreamOptions = {},
  perspective?: DreamPerspective
): Promise<{ text: string; disclaimer: string }> {
  const { onDelta, onMeta, signal } = opts;

  const res = await fetch(`${AI_BASE}/api/v1/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ module: 'dream', dream, context, history, question, perspective }),
    signal,
  });

  if (!res.ok) {
    let msg = `对话接口响应异常：HTTP ${res.status}`;
    try {
      const j = await res.json().catch(() => null);
      if (j?.message) msg += `：${j.message}`;
    } catch {}
    throw new Error(msg);
  }

  let text = '';
  let disclaimer = '';
  let errCode: string | null = null;
  let errMessage: string | null = null;

  await parseSSE(res, (event, data) => {
    switch (event) {
      case 'open':
        return;
      case 'delta':
        if (typeof data?.chunk === 'string') {
          text += data.chunk;
          onDelta?.(data.chunk, text);
        }
        return;
      case 'meta':
        if (data && typeof data === 'object') {
          if (typeof data.disclaimer === 'string') disclaimer = data.disclaimer;
          onMeta?.({
            requestId: 'chat-stream',
            module: 'dream',
            promptVersion: 'chat',
            provider: 'chat',
            model: 'chat',
            cacheHit: false,
            degraded: false,
            degradedReason: null,
            tokens: null,
            costYuan: 0,
            latencyMs: 0,
            truncated: false,
          }, disclaimer, text);
        }
        return;
      case 'error':
        if (data) {
          errCode = String(data.code ?? 'STREAM_ERROR');
          errMessage = String(data.message ?? '对话失败');
        }
        return;
      case 'done':
      default:
        return;
    }
  }, signal);

  if (errCode) {
    throw new Error(`对话错误[${errCode}]：${errMessage}`);
  }

  return { text, disclaimer: disclaimer || '以上内容由 AI 生成，仅供娱乐与传统文化参考。' };
}

/**
 * 塔罗追问（多轮对话流式）—— POST /api/v1/chat/stream（module=tarot）
 *  - tarotCtx: 本次占卜的牌阵与牌面（含牌义），作为追问的上下文基准
 *  - history: 之前的对话历史（不含当前 question）
 *  - question: 用户最新追问
 *  - SSE 事件流：open → delta* → meta → done
 */
export interface TarotChatCtx {
  spreadName: string;
  question: string;
  cards: { pos: string; name: string; isRev: boolean; upright?: string; rev?: string }[];
}

export async function requestTarotChatStream(
  tarotCtx: TarotChatCtx,
  history: ChatHistoryEntry[],
  question: string,
  opts: InterpretStreamOptions = {}
): Promise<{ text: string; disclaimer: string }> {
  const { onDelta, onMeta, signal } = opts;

  const res = await fetch(`${AI_BASE}/api/v1/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ module: 'tarot', tarotCtx, history, question }),
    signal,
  });

  if (!res.ok) {
    let msg = `追问接口响应异常：HTTP ${res.status}`;
    try {
      const j = await res.json().catch(() => null);
      if (j?.message) msg += `：${j.message}`;
    } catch {}
    throw new Error(msg);
  }

  let text = '';
  let disclaimer = '';
  let errCode: string | null = null;
  let errMessage: string | null = null;

  await parseSSE(res, (event, data) => {
    switch (event) {
      case 'open':
        return;
      case 'delta':
        if (typeof data?.chunk === 'string') {
          text += data.chunk;
          onDelta?.(data.chunk, text);
        }
        return;
      case 'meta':
        if (data && typeof data === 'object') {
          if (typeof data.disclaimer === 'string') disclaimer = data.disclaimer;
          onMeta?.({
            requestId: 'tarot-chat-stream',
            module: 'tarot',
            promptVersion: 'chat',
            provider: 'chat',
            model: 'chat',
            cacheHit: false,
            degraded: false,
            degradedReason: null,
            tokens: null,
            costYuan: 0,
            latencyMs: 0,
            truncated: false,
          }, disclaimer, text);
        }
        return;
      case 'error':
        if (data) {
          errCode = String(data.code ?? 'STREAM_ERROR');
          errMessage = String(data.message ?? '追问失败');
        }
        return;
      case 'done':
      default:
        return;
    }
  }, signal);

  if (errCode) {
    throw new Error(`追问错误[${errCode}]：${errMessage}`);
  }

  return { text, disclaimer: disclaimer || '以上内容由 AI 生成，仅供娱乐与传统文化参考。' };
}

/**
 * 通用「轻量追问」流式请求 —— POST /api/v1/chat/stream
 *  - 适用 module：numerology / horoscope / bazi / ziwei / liuyao / meihua / qimen / wuxing / summary
 *  - context：原始解读文本（作为追问的唯一上下文基准）
 *  - history：之前的对话历史（不含当前 question）
 *  - question：用户最新追问（可来自预设胶囊或自由输入）
 *  - SSE 事件流：open → delta* → meta → done
 */
export async function requestGenericChatStream(
  module: string,
  context: string,
  history: ChatHistoryEntry[],
  question: string,
  opts: InterpretStreamOptions = {}
): Promise<{ text: string; disclaimer: string }> {
  const { onDelta, onMeta, signal } = opts;

  const res = await fetch(`${AI_BASE}/api/v1/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ module, context, history, question }),
    signal,
  });

  if (!res.ok) {
    let msg = `追问接口响应异常：HTTP ${res.status}`;
    try {
      const j = await res.json().catch(() => null);
      if (j?.message) msg += `：${j.message}`;
    } catch {}
    throw new Error(msg);
  }

  let text = '';
  let disclaimer = '';
  let errCode: string | null = null;
  let errMessage: string | null = null;

  await parseSSE(res, (event, data) => {
    switch (event) {
      case 'open':
        return;
      case 'delta':
        if (typeof data?.chunk === 'string') {
          text += data.chunk;
          onDelta?.(data.chunk, text);
        }
        return;
      case 'meta':
        if (data && typeof data === 'object') {
          if (typeof data.disclaimer === 'string') disclaimer = data.disclaimer;
          onMeta?.({
            requestId: 'generic-chat-stream',
            module: module as InterpretModule,
            promptVersion: 'chat',
            provider: 'chat',
            model: 'chat',
            cacheHit: false,
            degraded: false,
            degradedReason: null,
            tokens: null,
            costYuan: 0,
            latencyMs: 0,
            truncated: false,
          }, disclaimer, text);
        }
        return;
      case 'error':
        if (data) {
          errCode = String(data.code ?? 'STREAM_ERROR');
          errMessage = String(data.message ?? '追问失败');
        }
        return;
      case 'done':
      default:
        return;
    }
  }, signal);

  if (errCode) {
    throw new Error(`追问错误[${errCode}]：${errMessage}`);
  }

  return { text, disclaimer: disclaimer || '以上内容由 AI 生成，仅供娱乐与传统文化参考。' };
}

// ==================== 一键分享海报（AI 服务 /api/v1/poster） ====================

/** 海报生成响应 */
export interface PosterResult {
  /** AI 生成的分享文案（中文，30-50字） */
  shareText: string;
  /** AI 生成的图片 prompt（英文） */
  imagePrompt: string;
  /** CogView-3-Flash 生成的图片 URL（可能为 null） */
  imageUrl: string | null;
  /** 图片生成错误信息（imageUrl 为 null 时有值） */
  imageError: string | null;
  /** 是否降级（无 LLM 时） */
  fallback: boolean;
}

/**
 * 请求生成分享海报 —— POST /api/v1/poster。
 * 调用 LLM 生成分享文案 + CogView-3-Flash 生成精美图片。
 */
export async function requestPoster(
  keyword: string,
  interpretation: string
): Promise<PosterResult> {
  const { data } = await cachedRequest<PosterResult>(
    'poster',
    { keyword, interpretation },
    async () => {
      const res = await fetch(`${AI_BASE}/api/v1/poster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, interpretation }),
      });
      if (!res.ok) {
        throw new Error(`海报接口响应异常：HTTP ${res.status}`);
      }
      return res.json();
    },
    'long',
  );
  return data;
}

// ==================== 分享存档（oraclemind-backend /api/v1/shares） ====================

/** 分享存档记录（与后端 ShareOut 对齐；后端 GET 无记录时返回 null） */
export interface ShareOut {
  id: number;
  userId: number;
  module: string;
  title: string;
  shareText: string;
  imageUrl: string | null;
  imagePrompt: string | null;
  /** ISO 字符串（后端返回） */
  created_at: string;
  updated_at: string;
}

/** 保存/更新分享入参（与后端 ShareCreate 对齐） */
export interface ShareInput {
  module: string;
  title?: string;
  shareText: string;
  imageUrl?: string | null;
  imagePrompt?: string | null;
}

/** 获取当前登录用户某模块的分享存档（无则返回 null）—— GET /api/v1/shares?module= */
export async function getShare(module: string): Promise<ShareOut | null> {
  const res = await fetch(`${API_BASE}/api/v1/shares?module=${encodeURIComponent(module)}`, {
    credentials: 'include',
    headers: {},
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`获取分享存档失败：HTTP ${res.status}`);
  const data = await res.json();
  return data ?? null;
}

/** 保存/更新分享存档（按 user+module upsert，实现首次落库 / 重新生成覆盖）—— POST /api/v1/shares */
export async function saveShare(payload: ShareInput): Promise<ShareOut> {
  const res = await fetch(`${API_BASE}/api/v1/shares`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`保存分享失败：HTTP ${res.status}`);
  return res.json();
}

/* ============================= 综合报告 Agent · 流式版（LangGraph StateGraph） ============================= */

/** report Agent 流式回调 */
export interface ReportAgentStreamCallbacks {
  /** 节点进入：analyzer / paipan / synthesizer / reviewer / writer */
  onPhase?: (phase: string, detail?: {
    selectedModules?: string[];
    selectedLabels?: string[];
    success?: string[];
    errors?: string[];
    successLabels?: string[];
    reason?: string;
  }) => void;
  /** LLM token 分片（synthesizer/reviewer/writer 思考过程） */
  onDelta?: (chunk: string) => void;
  /** meta 事件（最终 report 就绪） */
  onMeta?: (meta: { report: any; disclaimer: string; degraded: boolean; degradedReason: string | null }) => void;
}

/** report Agent 请求入参（birthInfo 与后端 PaipanRequest 对齐） */
export interface ReportAgentBirthInfo {
  year: number;
  month: number;
  day: number;
  hour?: number | null;
  timeText?: string;
  gender?: string;
}

/**
 * 综合报告 Agent · 流式版 —— POST /api/v1/agent/report/stream
 * 复用 parseSSE，分发 phase / delta / meta / done / error 事件。
 * 后端 LangGraph StateGraph：analyzer→paipan→synthesizer→reviewer→writer
 */
export async function requestReportAgentStream(
  question: string,
  birthInfo: ReportAgentBirthInfo,
  opts: ReportAgentStreamCallbacks & {
    signal?: AbortSignal;
    requestId?: string;
    /** 跨页测算结论（塔罗/星座/数字命理共享池），与排盘同权参与 AI 融合 */
    crossReadings?: { type: string; label: string; summary: string }[];
    /** 换个说法：>0 时要求后端换全新切入点（结论须一致） */
    variant?: number;
  } = {}
): Promise<{ report: any; disclaimer: string; degraded: boolean; degradedReason: string | null }> {
  const { onPhase, onDelta, onMeta, signal, requestId, crossReadings, variant } = opts;

  const res = await fetch(`${AI_BASE}/api/v1/agent/report/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      question,
      birthInfo,
      requestId,
      crossReadings: crossReadings?.length ? crossReadings : undefined,
      variant: variant && variant > 0 ? variant : 0,
    }),
    signal,
  });

  if (!res.ok) {
    let msg = `综合报告接口响应异常：HTTP ${res.status}`;
    try {
      const j = await res.json().catch(() => null);
      if (j?.message) msg += `：${j.message}`;
    } catch {}
    throw new Error(msg);
  }

  let report: any = null;
  let disclaimer = '';
  let degraded = false;
  let degradedReason: string | null = null;
  let errCode: string | null = null;
  let errMsg: string | null = null;

  await parseSSE(res, (event, data) => {
    switch (event) {
      case 'open':
        return;
      case 'phase':
        if (data && typeof data.phase === 'string') onPhase?.(data.phase, data);
        return;
      case 'delta':
        if (typeof data?.chunk === 'string') onDelta?.(data.chunk);
        return;
      case 'meta':
        if (data && typeof data === 'object') {
          if (data.report) report = data.report;
          if (typeof data.disclaimer === 'string') disclaimer = data.disclaimer;
          if (typeof data.degraded === 'boolean') degraded = data.degraded;
          if (data.degradedReason !== undefined) degradedReason = data.degradedReason;
          onMeta?.({ report, disclaimer, degraded, degradedReason });
        }
        return;
      case 'error':
        if (data) {
          errCode = String(data.code ?? 'STREAM_ERROR');
          errMsg = String(data.message ?? '报告生成失败');
        }
        return;
      case 'done':
      default:
        return;
    }
  }, signal);

  if (errCode) throw new Error(`综合报告错误[${errCode}]：${errMsg}`);
  return { report, disclaimer, degraded, degradedReason };
}

// ==================== 用户认证（oraclemind-backend /api/v1/auth） ====================

/** 登录用户信息 */
export interface AuthUser {
  id: number;
  username: string;
  email: string | null;
}

/** 注册 / 登录接口响应。
 * S6 修复（双凭证 XSS）：后端不在响应体返回 token，认证凭证统一经 httpOnly Cookie
 * `om_auth` 下发与携带（fetch credentials:'include 自动携带，JS 不可读）。本接口仅回传用户资料。 */
export interface AuthTokenResponse {
  user: AuthUser;
}

/** 注册：POST /api/v1/auth/register（visitorId 用于登录即认领匿名报告） */
export async function requestRegister(
  username: string,
  password: string,
  email?: string,
  visitorId?: string | null
): Promise<AuthTokenResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, email: email || null, visitorId: visitorId || null }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || `注册失败：HTTP ${res.status}`);
  return data;
}

/** 登录：POST /api/v1/auth/login（visitorId 用于登录即认领匿名报告） */
export async function requestLogin(
  username: string,
  password: string,
  visitorId?: string | null
): Promise<AuthTokenResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, visitorId: visitorId || null }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || `登录失败：HTTP ${res.status}`);
  return data;
}

/** 获取当前用户：GET /api/v1/auth/me（依赖 httpOnly Cookie 自动携带） */
export async function requestMe(): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`获取用户信息失败：HTTP ${res.status}`);
  return res.json();
}

// ============================================================================
// 用户资料接口（出生信息 / 偏好设置）
// ============================================================================

/** 出生信息（与后端 BirthInfo 对齐，camelCase） */
export interface ProfileBirthInfo {
  date: string | null;
  time: string | null;
  gender: string | null;
  lunarYear: number | null;
  lunarMonth: number | null;
  lunarDay: number | null;
  province: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
}

/** 用户资料响应 */
export interface UserProfileResponse {
  userId: number;
  username: string;
  email: string | null;
  birth: ProfileBirthInfo | null;
  timezone: string | null;
  theme: string | null;
  notes: string | null;
  updatedAt: number | null;
}

/** 获取当前用户资料：GET /api/v1/user/profile（依赖 httpOnly Cookie） */
export async function requestUserProfile(): Promise<UserProfileResponse> {
  const res = await fetch(`${API_BASE}/api/v1/user/profile`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const msg = res.status === 401 ? '登录已过期' : `获取用户资料失败：HTTP ${res.status}`;
    throw new Error(msg);
  }
  return res.json();
}

/** 更新当前用户资料：PUT /api/v1/user/profile */
export async function requestUpdateProfile(
  payload: { birth?: ProfileBirthInfo | null; timezone?: string | null; theme?: string | null; notes?: string | null }
): Promise<UserProfileResponse> {
  const res = await fetch(`${API_BASE}/api/v1/user/profile`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`更新用户资料失败：HTTP ${res.status}`);
  return res.json();
}

/** 迁移访客数据：POST /api/v1/user/profile/migrate */
export async function requestMigrateVisitor(
  birth: ProfileBirthInfo
): Promise<UserProfileResponse> {
  const res = await fetch(`${API_BASE}/api/v1/user/profile/migrate`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ birth }),
  });
  if (!res.ok) throw new Error(`迁移访客数据失败：HTTP ${res.status}`);
  return res.json();
}

/** 清除当前用户出生信息：DELETE /api/v1/user/profile/birth（依赖 httpOnly Cookie） */
export async function requestClearProfileBirth(): Promise<UserProfileResponse> {
  const res = await fetch(`${API_BASE}/api/v1/user/profile/birth`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`清除出生信息失败：HTTP ${res.status}`);
  return res.json();
}

/** 登出：POST /api/v1/auth/logout —— 通知后端拉黑当前 token 并清除 httpOnly Cookie */
export async function requestLogout(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    // 即使后端失败（如未登录），前端仍应继续本地清理
    throw new Error(`登出失败：HTTP ${res.status}`);
  }
}

// ============================================================================
// 前端数据上云 KV（缺陷报告 P1-8）
// 后端 user_stash 表：登录态用 httpOnly Cookie 鉴权，匿名态需带 visitorId。
// ============================================================================

function stashQuery(visitorId?: string): string {
  return visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : '';
}

/** 拉取当前身份全部上云数据：GET /api/v1/stash -> { key: jsonString } */
export async function requestStashList(visitorId?: string): Promise<Record<string, string>> {
  const res = await fetch(`${API_BASE}/api/v1/stash${stashQuery(visitorId)}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`拉取上云数据失败：HTTP ${res.status}`);
  return res.json();
}

/** 写入/覆盖一条上云数据：PUT /api/v1/stash */
export async function requestStashPut(
  key: string,
  value: string,
  visitorId?: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/stash${stashQuery(visitorId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ key, value }),
  });
  if (!res.ok) throw new Error(`上云写入失败：HTTP ${res.status}`);
}

/** 删除一条上云数据：DELETE /api/v1/stash/{key} */
export async function requestStashDelete(key: string, visitorId?: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/v1/stash/${encodeURIComponent(key)}${stashQuery(visitorId)}`,
    { method: 'DELETE', credentials: 'include' }
  );
  if (!res.ok) throw new Error(`上云删除失败：HTTP ${res.status}`);
}

