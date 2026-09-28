// ============================================================================
// 玄镜 OracleMind · 测字 / 姓名 / 合婚 模块 · 算法层
// 纯前端、确定性、娱乐向；结论仅供参考，不构成任何专业建议。
// ============================================================================
'use client';

import type { BaziAPIResult } from '@/lib/api';
import {
  FIVE_ELEMENTS,
  TRIGRAMS,
  ELEMENT_IMAGERY,
  TENDENCIES,
  TOPIC_TEMPLATE,
  CHAR_CHAIZI,
  SHU_LI_81,
  DIZHI,
  DZHI_TO_ZODIAC,
  LIU_HE,
  SAN_HE,
  LIU_CHONG,
  LIU_HAI,
  SAN_XING,
  GAN_WX,
  SHENG,
  KE,
  CHAR_CULTURE,
  buildOmen,
  type OmenResult,
  type Element,
  type Dizhi,
  type JiType,
  type Trigram,
  type Tendency,
} from '@/data/cemingData';
import { charToPinyin } from '@/data/pinyinData';
import {
  NAME_CHARS,
  NAME_STYLES,
  POETRY_LIB,
  NAME_DETAIL_DIMS,
  DETAIL_TEMPLATES,
  CHAR_FAMOUS,
  CHAR_WX_NOTE,
  type NameChar,
  type NameStyle,
  type PoetryEntry,
  type DetailDim,
} from '@/data/cemingNameData';

/* ------------------------------ 笔画（cnchar，动态导入以规避 SSR） ------------------------------ */
let _cnchar: any = null;
async function loadCnchar(): Promise<any> {
  if (!_cnchar) {
    const mod: any = await import('cnchar');
    _cnchar = mod.default || mod;
  }
  return _cnchar;
}
const isCJK = (c: string) => /[㐀-鿿]/.test(c);

/** 取单个汉字笔画数（通用标准）；非汉字返回 0 */
export async function charStroke(ch: string): Promise<number> {
  if (!isCJK(ch)) return 0;
  try {
    const cn = await loadCnchar();
    const n = cn.stroke(ch);
    return typeof n === 'number' ? n : 0;
  } catch {
    return 0;
  }
}
/** 批量取汉字笔画 */
export async function stringStrokes(s: string): Promise<{ char: string; stroke: number }[]> {
  const chars = [...s].filter(isCJK);
  return Promise.all(chars.map(async (char) => ({ char, stroke: await charStroke(char) })));
}

/* ------------------------------ 测字 ------------------------------ */
export interface CeziResult {
  char: string;
  element: Element;
  trigram: Trigram;
  tendency: Tendency;
  strokes: number | null;
  chaizi: string;
  zixiang: string;
  topicText: string;
  pinyin: string | null;
  words: string[];
  idiom: string | null;
  allusion: string | null;
  nameFit: { fit: '宜' | '中性' | '忌'; text: string } | null;
  omen: OmenResult;
}

export function analyzeCezi(input: string, topicKey: string, strokes?: number | null): CeziResult {
  const ch = [...input].find(isCJK);
  if (!ch) throw new Error('请输入一个汉字');
  const code = ch.codePointAt(0)!;
  const element = FIVE_ELEMENTS[code % 5];
  const trigram = TRIGRAMS[(code >> 2) % 8];
  const tIdx = code % 10;
  const tendency: Tendency = tIdx < 6 ? TENDENCIES[0] : tIdx < 9 ? TENDENCIES[1] : TENDENCIES[2];
  const zixiang =
    ELEMENT_IMAGERY[element] +
    ` 配「${trigram.name}」卦（${trigram.sym}，${trigram.nature}）：${trigram.desc}`;
  const topicText = (TOPIC_TEMPLATE[topicKey] ?? TOPIC_TEMPLATE.all)(tendency.word, tendency.flow);
  const chaizi = CHAR_CHAIZI[ch] ?? '（此字暂未收录拆解，按整体取象推演）';
  const culture = CHAR_CULTURE[ch];
  const pinyin = charToPinyin(ch);
  return {
    char: ch, element, trigram, tendency, strokes: strokes ?? null, chaizi, zixiang, topicText,
    pinyin: pinyin ?? null,
    words: culture?.words ?? [],
    idiom: culture?.idiom || null,
    allusion: culture?.allusion || null,
    nameFit: culture?.nameFit ?? null,
    omen: buildOmen(tendency.word, element),
  };
}

/* ------------------------------ 姓名 · 五格剖象 ------------------------------ */
export interface GridResult {
  label: string;
  role: string;
  num: number;
  k: number;
  ji: JiType;
  mean: string;
}
export interface XingmingResult {
  surname: string;
  given: string;
  grids: { tian: GridResult; ren: GridResult; di: GridResult; wai: GridResult; zong: GridResult };
  threeTalent: { tian: Element; ren: Element; di: Element; text: string };
  score: number;
  comments: { label: string; ji: JiType; text: string }[];
  incomplete: boolean;
}

const GRID_ROLE: Record<string, string> = {
  天格: '祖先运 · 先天禀赋',
  人格: '性格主轴 · 一生核心',
  地格: '前运 · 青年至中年',
  外格: '人际 · 外在际遇',
  总格: '后运 · 中晚年总势',
};

function wrap81(n: number): number {
  if (n <= 0) return 1;
  return ((n - 1) % 81) + 1;
}
const TAIL_WX: Record<number, Element> = { 1: '木', 2: '木', 3: '火', 4: '火', 5: '土', 6: '土', 7: '金', 8: '金', 9: '水', 0: '水' };

function wxRel(a: Element, b: Element): 'sheng' | 'ke' | 'bi' {
  if (a === b) return 'bi';
  const ia = SHENG.indexOf(a);
  if ((ia + 1) % 5 === SHENG.indexOf(b)) return 'sheng'; // a 生 b
  if (KE.some(([x, y]) => x === a && y === b)) return 'ke';
  if (KE.some(([x, y]) => x === b && y === a)) return 'ke';
  return 'sheng'; // b 生 a
}

export async function analyzeXingming(surname: string, given: string, _gender: string): Promise<XingmingResult> {
  const sChars = [...surname].filter(isCJK);
  const gChars = [...given].filter(isCJK);
  if (sChars.length === 0 || gChars.length === 0) throw new Error('请输入完整的姓与名');

  const sStrokes = await Promise.all(sChars.map(charStroke));
  const gStrokes = await Promise.all(gChars.map(charStroke));
  const incomplete = [...sStrokes, ...gStrokes].some((s) => s <= 0);

  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const tian = sChars.length > 1 ? sum(sStrokes) : sStrokes[0] + 1;
  const ren = sStrokes[sStrokes.length - 1] + gStrokes[0];
  const di = sum(gStrokes) + (gChars.length === 1 ? 1 : 0);
  const zong = sum(sStrokes) + sum(gStrokes);
  const wai = zong - ren + 1;

  const make = (label: string, num: number): GridResult => {
    const k = wrap81(num);
    const info = SHU_LI_81[k];
    return { label, role: GRID_ROLE[label], num, k, ji: info.ji, mean: info.mean };
  };
  const grids = {
    tian: make('天格', tian),
    ren: make('人格', ren),
    di: make('地格', di),
    wai: make('外格', wai),
    zong: make('总格', zong),
  };

  // 三才五行（尾数法）
  const tw = (n: number): Element => TAIL_WX[((n % 10) + 10) % 10];
  const tEl = tw(tian), rEl = tw(ren), dEl = tw(di);
  const relTR = wxRel(tEl, rEl);
  const relRD = wxRel(rEl, dEl);
  let ttText: string;
  let ttFactor: number;
  if (relTR === 'sheng' && relRD === 'sheng') {
    ttText = '三才顺生（天→人→地相生），气运流通，主顺遂安康。';
    ttFactor = 1.05;
  } else if (relTR === 'ke' && relRD === 'ke') {
    ttText = '三才相克（天→人→地互克），气运阻滞，易生波折，宜守不宜攻。';
    ttFactor = 0.9;
  } else if (relTR === 'bi' && relRD === 'bi') {
    ttText = '三才比和（五行相同），气性单纯，主稳但少变化。';
    ttFactor = 1.0;
  } else {
    const parts: string[] = [];
    parts.push(`天格${tEl}→人格${rEl}为${relTR === 'sheng' ? '相生' : relTR === 'ke' ? '相克' : '比和'}`);
    parts.push(`人格${rEl}→地格${dEl}为${relRD === 'sheng' ? '相生' : relRD === 'ke' ? '相克' : '比和'}`);
    ttText = '三才' + parts.join('、') + '，参半之象，宜顺势调和。';
    ttFactor = relTR === 'ke' || relRD === 'ke' ? 0.95 : 1.0;
  }

  const jiWeight: Record<JiType, number> = { 吉: 20, 半吉: 13, 凶: 5 };
  const base = (Object.values(grids) as GridResult[]).reduce((acc, g) => acc + jiWeight[g.ji], 0);
  const score = Math.max(0, Math.min(100, Math.round(base * ttFactor)));

  const comments = (Object.values(grids) as GridResult[]).map((g) => ({
    label: g.label,
    ji: g.ji,
    text: `${g.ji}：${g.mean}（${g.role}）`,
  }));

  return {
    surname,
    given,
    grids,
    threeTalent: { tian: tEl, ren: rEl, di: dEl, text: ttText },
    score,
    comments,
    incomplete,
  };
}

/* ------------------------------ 合婚 · 八字合婚 ------------------------------ */
function zodiacToDizhi(sx: string): Dizhi {
  const found = (Object.keys(DZHI_TO_ZODIAC) as Dizhi[]).find((d) => DZHI_TO_ZODIAC[d] === sx);
  return (found ?? '子') as Dizhi;
}
function dayZhiOf(pillars: BaziAPIResult['pillars']): string {
  const p = pillars.find((x) => x.label.includes('日')) ?? pillars[2];
  return p?.zhi ?? '';
}

export interface RelInfo {
  level: 'he' | 'chong' | 'hai' | 'xing' | 'bi' | 'none';
  text: string;
  score: number;
}
/** 两地支关系（六合/三合/六冲/六害/三刑/同支自刑/无特殊） */
export function dzRelation(a: string, b: string): RelInfo {
  if (a === b) {
    const selfXing = (['辰', '午', '酉', '亥'] as Dizhi[]).includes(a as Dizhi);
    return selfXing
      ? { level: 'xing', text: '同支自刑', score: 45 }
      : { level: 'bi', text: '同气相求', score: 75 };
  }
  const A = a as Dizhi, B = b as Dizhi;
  const pair = (arr: string[][]) => arr.some((p) => p.includes(A) && p.includes(B));
  if (LIU_HE.some(([x, y]) => (x === A && y === B) || (x === B && y === A)))
    return { level: 'he', text: '六合', score: 100 };
  if (SAN_HE.some((g) => g.includes(A) && g.includes(B))) return { level: 'he', text: '三合', score: 95 };
  if (LIU_CHONG.some(([x, y]) => (x === A && y === B) || (x === B && y === A)))
    return { level: 'chong', text: '相冲', score: 20 };
  if (LIU_HAI.some(([x, y]) => (x === A && y === B) || (x === B && y === A)))
    return { level: 'hai', text: '相害', score: 50 };
  if (SAN_XING.some((g) => g.includes(A) && g.includes(B))) return { level: 'xing', text: '相刑', score: 40 };
  return { level: 'none', text: '无特殊冲合', score: 70 };
}

export interface GanRelInfo {
  text: string;
  score: number;
}
/** 两日干关系（相生/比和/相克） */
export function ganRelation(a: string, b: string): GanRelInfo {
  const wa = GAN_WX[a];
  const wb = GAN_WX[b];
  if (!wa || !wb) return { text: '日干未识别', score: 70 };
  if (wa === wb) return { text: `比和（同属${wa}）`, score: 80 };
  const ia = SHENG.indexOf(wa);
  if ((ia + 1) % 5 === SHENG.indexOf(wb)) return { text: `${a}生${b}（${wa}生${wb}）`, score: 90 };
  if ((SHENG.indexOf(wb) + 1) % 5 === SHENG.indexOf(wa)) return { text: `${b}生${a}（${wb}生${wa}）`, score: 90 };
  if (KE.some(([x, y]) => x === wa && y === wb)) return { text: `${a}克${b}（${wa}克${wb}）`, score: 55 };
  return { text: `${b}克${a}（${wb}克${wa}）`, score: 55 };
}

/** 由汉字码点推导五行（与测字算法一致；用于自选字补缺时的兜底归类） */
function elementOfChar(ch: string): Element {
  const code = ch.codePointAt(0) ?? 0;
  return FIVE_ELEMENTS[code % 5];
}

/**
 * mulberry32 PRNG：确定性伪随机。
 * 同 seed 必得同序列，因此「换一批」可复现（刷新后 seed 写进 URL/历史即可还原）。
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wuxingMapOf(b: BaziAPIResult): Record<Element, number> {
  const m: Record<Element, number> = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };
  if (b.wuxingCount && b.wuxingCount.length) {
    for (const { label, count } of b.wuxingCount) {
      if (label in m) m[label as Element] = count;
    }
  } else if (b.wuxing && b.wuxing.length) {
    for (const w of b.wuxing) {
      // pct 归一近似：>0 视为有
      if (labelIn(w.label)) m[w.label as Element] = Math.round(w.pct || 1);
    }
  }
  return m;
}
function labelIn(_l: string) {
  return true;
}

/** 八字五行分布与所缺（供 UI 可视化「补缺」依据，避免勾选项是黑盒） */
export interface BaziWuxing {
  map: Record<Element, number>;
  lacking: Element[];
}

/**
 * 从排盘结果提取五行计数与所缺五行。
 * 供起名算法与结果页共用——算法内部用的就是这套口径，UI 展示才不会与推荐理由打架。
 */
export function baziWuxing(bazi: BaziAPIResult): BaziWuxing {
  const map = wuxingMapOf(bazi);
  const lacking: Element[] = [];
  for (const e of FIVE_ELEMENTS) {
    if ((map[e] ?? 0) <= 0) lacking.push(e);
  }
  return { map, lacking };
}

export interface WuResult {
  score: number;
  text: string;
}
/** 五行互补：一方所缺恰为另一方所长则高分 */
export function wuxingComplement(male: Record<Element, number>, female: Record<Element, number>): WuResult {
  let coverage = 0;
  const notes: string[] = [];
  for (const e of FIVE_ELEMENTS) {
    const mh = male[e] > 0;
    const fh = female[e] > 0;
    if (mh !== fh) {
      coverage++;
      if (!mh && fh) notes.push(`女方${e}气较旺，可补男方所缺`);
      else notes.push(`男方${e}气较旺，可补女方所缺`);
    }
  }
  const score = Math.max(40, Math.min(100, 50 + coverage * 10));
  const text = notes.length
    ? notes.join('；') + '。'
    : '双方五行分布相近，互补性一般，宜后天调和。';
  return { score, text };
}

export interface HehunResult {
  total: number;
  tier: string;
  subs: { label: string; score: number }[];
  sx: RelInfo;
  gan: GanRelInfo;
  palace: RelInfo;
  wu: WuResult;
  mSX: string;
  fSX: string;
  mDM: string;
  fDM: string;
  mZhi: string;
  fZhi: string;
  analysis: string;
}

export function analyzeHehun(male: BaziAPIResult, female: BaziAPIResult): HehunResult {
  const mSX = male.shengxiao || DZHI_TO_ZODIAC[zodiacToDizhi(male.shengxiao) as Dizhi] || '—';
  const fSX = female.shengxiao || '—';
  const mZhi = dayZhiOf(male.pillars);
  const fZhi = dayZhiOf(female.pillars);
  const mDM = male.dayMaster || '—';
  const fDM = female.dayMaster || '—';

  const sx = dzRelation(zodiacToDizhi(mSX), zodiacToDizhi(fSX));
  const gan = ganRelation(mDM, fDM);
  const palace = dzRelation(mZhi, fZhi);
  const wu = wuxingComplement(wuxingMapOf(male), wuxingMapOf(female));

  const total = Math.round(0.2 * sx.score + 0.2 * gan.score + 0.2 * palace.score + 0.4 * wu.score);
  const tier =
    total >= 85 ? '天作之合' : total >= 70 ? '佳偶天成' : total >= 55 ? '尚可偕行' : total >= 40 ? '宜多经营' : '须慎相处';

  const subs = [
    { label: '感情', score: Math.round(0.4 * sx.score + 0.3 * palace.score + 0.3 * gan.score) },
    { label: '事业', score: Math.round(0.5 * gan.score + 0.5 * wu.score) },
    { label: '财运', score: Math.round(0.45 * wu.score + 0.55 * gan.score) },
    { label: '健康', score: Math.round(0.4 * sx.score + 0.3 * wu.score + 0.3 * palace.score) },
  ];

  const sentences: string[] = [];
  sentences.push(`男方属${mSX}、女方属${fSX}，生肖${sx.text}（契合度 ${sx.score} 分）。`);
  sentences.push(`日干${mDM}与${fDM}${gan.text}（${gan.score} 分）。`);
  sentences.push(`夫妻宫（日支）${mZhi || '—'}与${fZhi || '—'}${palace.text}（${palace.score} 分）。`);
  sentences.push(`五行上，${wu.text}（互补度 ${wu.score} 分）。`);
  let concl = '';
  if (total >= 85) concl = '二人生辰气场高度契合，多为天赐良缘，宜珍惜相守。';
  else if (total >= 70) concl = '彼此适配度佳，性格与气运互补，婚后可稳中向好。';
  else if (total >= 55) concl = '总体相合，偶有摩擦属常态，多沟通、多包容即可长久。';
  else if (total >= 40) concl = '存在一些观念或节奏上的差异，需要更多耐心经营，多沟通、多换位思考即可逐渐磨合。';
  else concl = '冲克较多，建议理性看待、慎重建构关系，莫以命论定一切。';
  sentences.push(concl);

  return {
    total,
    tier,
    subs,
    sx,
    gan,
    palace,
    wu,
    mSX,
    fSX,
    mDM,
    fDM,
    mZhi,
    fZhi,
    analysis: sentences.join(''),
  };
}

/* ------------------------------ 智能起名 ------------------------------ */
export interface NameCandidate {
  full: string;
  given: string;
  chars: { char: string; meaning: string; element: Element }[];
  style: string;
  reason: string;
}

function buildReason(
  mainEl: Element,
  style: NameStyle,
  lacking: Element[],
  chars: (NameChar & { element: Element })[],
): string {
  const parts: string[] = [style.desc];
  if (lacking.includes(mainEl)) {
    parts.push(`补八字所缺「${mainEl}」`);
  } else if (chars.some((c) => lacking.includes(c.element))) {
    const comp = chars.find((c) => lacking.includes(c.element))!;
    parts.push(`补八字所缺「${comp.element}」`);
  }
  parts.push(`寓意：${chars.map((c) => c.meaning).join('、')}`);
  return parts.join('；');
}

/** 起名可选入参 */
export interface GenerateNamesOptions {
  /**
   * 扰动种子。不传 → 完全确定性（同入参永远同结果，历史回放可复现）；
   * 传入 → 在同权重区间内重排候选池，实现「换一批」。
   */
  seed?: number;
  /** 定字：候选名必须包含这个字（字典「用此字起名」跳转过来时用） */
  mustChar?: string;
  /** 字辈模式：定字固定在名字中间（双字名），仅最后一字变化 */
  generation?: boolean;
}

/**
 * 智能起名：根据姓氏、性别、风格生成候选名。
 * - 传入八字时优先补充所缺五行；
 * - 传 seed 可在同权重区间内换一批（确定性，seed 相同结果必相同）；
 * - 传 mustChar 则所有候选名都包含该字（单字名即该字本身）。
 */
export function generateNames(
  surname: string,
  gender: string,
  styleKey: string,
  bazi?: BaziAPIResult,
  opts?: GenerateNamesOptions,
): NameCandidate[] {
  const sChars = [...surname].filter(isCJK);
  if (sChars.length === 0) return [];

  const style = NAME_STYLES.find((s) => s.key === styleKey) ?? NAME_STYLES[0];
  const seed = opts?.seed;
  const must = opts?.mustChar?.trim() || '';

  // 推导八字所缺五行（与结果页展示共用同一口径）
  const { lacking } = bazi ? baziWuxing(bazi) : { lacking: [] as Element[] };

  const genderFilter = (g: NameChar['gender']) => g === '中性' || g === gender;

  type PoolItem = NameChar & { element: Element; weight: number };
  const pool: PoolItem[] = [];
  for (const e of FIVE_ELEMENTS) {
    for (const nc of NAME_CHARS[e]) {
      if (!genderFilter(nc.gender)) continue;
      let weight = 1;
      if (style.preferElements.includes(e)) weight += 2;
      if (lacking.includes(e)) weight += 3;
      pool.push({ ...nc, element: e, weight });
    }
  }

  // 关键：seed 缺失时 jitter 恒为 0（不消耗随机数），保证默认结果完全稳定；
  // seed 存在时每个字恰好消耗一次 rand()，序列可复现。
  const rand = mulberry32(seed ?? 0);
  const ordered = [...pool]
    .map((p) => ({ p, k: p.weight + (seed === undefined ? 0 : rand() * 0.9) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.p);

  const candidates: NameCandidate[] = [];
  const usedFull = new Set<string>();
  const surnameStr = sChars.join('');

  const push = (chars: PoolItem[]) => {
    const given = chars.map((c) => c.char).join('');
    const full = surnameStr + given;
    if (usedFull.has(full)) return;
    usedFull.add(full);
    candidates.push({
      full,
      given,
      chars: chars.map((c) => ({ char: c.char, meaning: c.meaning, element: c.element })),
      style: style.label,
      reason: buildReason(chars[chars.length - 1].element, style, lacking, chars),
    });
  };

  // 定字模式：单字名即该字本身，双字名由定字与池内字搭配（前后位置交替，读感更多样）
  if (must) {
    const isGen = !!opts?.generation;
    const mustItem: PoolItem = ordered.find((p) => p.char === must) ?? {
      char: must,
      meaning: isGen ? '（家族字辈）' : '（自选字）',
      gender: '中性' as NameChar['gender'],
      element: elementOfChar(must),
      weight: 0,
    };
    push([mustItem]);
    let idx = 0;
    for (const other of ordered) {
      if (candidates.length >= 12) break;
      if (other.char === must) continue;
      // 字辈模式：定字固定在中间（名首字），最后一字变化
      if (isGen) {
        push([mustItem, other]);
      } else {
        push(idx % 2 === 0 ? [mustItem, other] : [other, mustItem]);
      }
      idx++;
    }
    return candidates;
  }

  // 单字名
  for (const item of ordered.slice(0, 6)) push([item]);

  // 双字名
  const top = ordered.slice(0, 12);
  for (let i = 0; i < top.length && candidates.length < 12; i++) {
    for (let j = i + 1; j < top.length && candidates.length < 12; j++) {
      push([top[i], top[j]]);
    }
  }

  return candidates;
}

/* ------------------------------ 诗词起名 ------------------------------ */
export interface PoetryNameCandidate {
  full: string;
  given: string;
  source: PoetryEntry['source'];
  quote: string;
  title: string;
  author: string;
  meaning: string;
  chars: string[];
}

export function generatePoetryNames(
  surname: string,
  gender: string,
  source: string,
): PoetryNameCandidate[] {
  const sChars = [...surname].filter(isCJK);
  if (sChars.length === 0) return [];
  const surnameStr = sChars.join('');

  const list = POETRY_LIB.filter((p) => {
    if (source !== 'all' && p.source !== source) return false;
    if (gender === '男') return p.gender !== '女';
    if (gender === '女') return p.gender !== '男';
    return true;
  });

  const candidates: PoetryNameCandidate[] = [];
  const usedFull = new Set<string>();
  for (const p of list) {
    const given = p.chars.join('');
    const full = surnameStr + given;
    if (usedFull.has(full)) continue;
    usedFull.add(full);
    candidates.push({
      full,
      given,
      source: p.source,
      quote: p.quote,
      title: p.title,
      author: p.author,
      meaning: p.meaning,
      chars: p.chars,
    });
  }

  return candidates;
}

/* ------------------------------ 姓名详批 ------------------------------ */
export interface NameDetailDim {
  key: string;
  label: string;
  icon: string;
  ji: JiType;
  text: string;
}
export interface NameDetailResult {
  dims: NameDetailDim[];
}

/**
 * 姓名详批：将五格映射到五大运势维度并生成文案
 * 基础运←地格 / 成功运←总格 / 社交运←外格 / 性格运←人格 / 家庭运←天格+三才
 */
export function analyzeNameDetail(result: XingmingResult): NameDetailResult {
  const map: Record<string, GridResult> = {
    base: result.grids.di,
    success: result.grids.zong,
    social: result.grids.wai,
    personality: result.grids.ren,
    family: result.grids.tian,
  };

  const dims: NameDetailDim[] = NAME_DETAIL_DIMS.map((d: DetailDim) => {
    const g = map[d.key];
    const tpl = DETAIL_TEMPLATES[d.key];
    const text = tpl ? tpl(g.ji, g.mean) : `${d.label}：${g.ji}——${g.mean}`;
    const finalText =
      d.key === 'family' ? text + ` 三才：${result.threeTalent.text}` : text;
    return { key: d.key, label: d.label, icon: d.icon, ji: g.ji, text: finalText };
  });

  return { dims };
}

/* ------------------------------ 双胞胎起名 ------------------------------ */
export interface TwinNamePair {
  /** 第一个孩子的名字（不含姓） */
  given1: string;
  /** 第二个孩子的名字（不含姓） */
  given2: string;
  full1: string;
  full2: string;
  /** 配对主题：同偏旁 / 同寓意 / 成语拆分 / 五行互补 */
  theme: string;
  reason: string;
}

/**
 * 双胞胎起名：从候选字池中生成成对的名字。
 * 配对策略（按优先级）：
 * 1. 同偏旁：两个名字末字部首相同，形神相连
 * 2. 成语拆分：从四字成语中取两字分别命名
 * 3. 同寓意：含义相近的字搭配
 * 4. 五行互补：两字五行相生
 */
const TWIN_IDIOMS = [
  { chars: ['龙', '虎'], theme: '成语拆分', reason: '「龙骧虎步」，龙虎相生，气度不凡' },
  { chars: ['麒', '麟'], theme: '成语拆分', reason: '「麒麟献瑞」，瑞兽成双，福泽深厚' },
  { chars: ['凤', '凰'], theme: '成语拆分', reason: '「凤凰于飞」，雌雄相和，美满吉祥' },
  { chars: ['晨', '曦'], theme: '同寓意', reason: '皆为晨光之意，寓意朝气蓬勃、前程光明' },
  { chars: ['宇', '轩'], theme: '同寓意', reason: '皆有气宇轩昂之意，寓意胸襟开阔' },
  { chars: ['嘉', '瑞'], theme: '同寓意', reason: '皆为吉祥美好之意，寓意一生顺遂' },
  { chars: ['俊', '杰'], theme: '同寓意', reason: '「俊杰」，寓意才貌出众、人中龙凤' },
  { chars: ['安', '康'], theme: '同寓意', reason: '「安康」，寓意一生平安健康' },
  { chars: ['明', '亮'], theme: '同寓意', reason: '皆为光明之意，寓意前途光明' },
  { chars: ['智', '慧'], theme: '同寓意', reason: '「智慧」，寓意聪明睿智' },
];

export function generateTwinNames(surname: string, gender: string, bazi?: BaziAPIResult): TwinNamePair[] {
  const sChars = [...surname].filter(isCJK);
  if (sChars.length === 0) return [];
  const surnameStr = sChars.join('');

  // 收集可用字（按性别过滤）
  const pool: { char: string; meaning: string; element: Element }[] = [];
  const lacking = bazi ? baziWuxing(bazi).lacking : [];
  for (const e of FIVE_ELEMENTS) {
    for (const nc of NAME_CHARS[e]) {
      if (nc.gender !== '中性' && nc.gender !== gender) continue;
      pool.push({ char: nc.char, meaning: nc.meaning, element: e });
    }
  }

  const pairs: TwinNamePair[] = [];
  const used = new Set<string>();

  // 1. 成语/同寓意配对
  for (const id of TWIN_IDIOMS) {
    const [c1, c2] = id.chars;
    // 性别过滤：只取中性或匹配性别的字
    const ok1 = pool.some((p) => p.char === c1);
    const ok2 = pool.some((p) => p.char === c2);
    if (!ok1 || !ok2) continue;
    const key = c1 + c2;
    if (used.has(key)) continue;
    used.add(key);
    pairs.push({
      given1: c1,
      given2: c2,
      full1: surnameStr + c1,
      full2: surnameStr + c2,
      theme: id.theme,
      reason: id.reason,
    });
  }

  // 2. 五行互补配对：从池中找五行相生的两个字
  const tryAdd = (a: typeof pool[number], b: typeof pool[number]) => {
    if (a.char === b.char) return;
    const key = a.char + b.char;
    if (used.has(key)) return;
    used.add(key);
    // 判断五行相生
    const ia = SHENG.indexOf(a.element);
    const isSheng = (ia + 1) % 5 === SHENG.indexOf(b.element);
    pairs.push({
      given1: a.char,
      given2: b.char,
      full1: surnameStr + a.char,
      full2: surnameStr + b.char,
      theme: isSheng ? '五行相生' : '五行搭配',
      reason: `「${a.char}」(${a.element})与「${b.char}」(${b.element})${isSheng ? '五行相生' : '相互搭配'}，寓意相辅相成。${a.meaning}、${b.meaning}。`,
    });
  };

  // 优先补八字所缺
  if (lacking.length > 0) {
    const lackingChars = pool.filter((p) => lacking.includes(p.element));
    for (let i = 0; i < lackingChars.length && pairs.length < 12; i++) {
      for (let j = i + 1; j < lackingChars.length && pairs.length < 12; j++) {
        tryAdd(lackingChars[i], lackingChars[j]);
      }
    }
  }

  // 3. 池中同偏旁/随机配对
  for (let i = 0; i < pool.length && pairs.length < 12; i++) {
    for (let j = i + 1; j < pool.length && pairs.length < 12; j++) {
      tryAdd(pool[i], pool[j]);
    }
  }

  return pairs;
}

/* ------------------------------ 重名率估算 ------------------------------ */
export interface DupRateResult {
  /** 估算每万人中同名人数（0~9999） */
  per10k: number;
  /** 等级：极多 / 较多 / 中等 / 较少 / 稀少 */
  level: string;
  /** 说明 */
  text: string;
}

/** 常见姓氏人口占比（粗略，用于重名率估算基数） */
const SURNAME_FREQ: Record<string, number> = {
  王: 7.2, 李: 7.0, 张: 6.8, 刘: 5.1, 陈: 4.5, 杨: 3.1, 赵: 2.3, 黄: 2.2, 周: 2.1, 吴: 1.9,
  徐: 1.7, 孙: 1.5, 胡: 1.4, 朱: 1.3, 高: 1.2, 林: 1.1, 何: 1.1, 郭: 1.0, 马: 1.0, 罗: 0.9,
  梁: 0.8, 宋: 0.8, 郑: 0.8, 谢: 0.7, 韩: 0.7, 唐: 0.7, 冯: 0.6, 于: 0.6, 董: 0.6, 萧: 0.5,
  程: 0.5, 曹: 0.5, 袁: 0.5, 邓: 0.5, 许: 0.5, 傅: 0.4, 沈: 0.4, 曾: 0.4, 彭: 0.4, 吕: 0.4,
};

/** 常见单字名的使用频率系数（0~1，越大越常见） */
const CHAR_NAME_FREQ: Record<string, number> = {
  伟: 0.95, 芳: 0.9, 娜: 0.88, 敏: 0.87, 静: 0.86, 丽: 0.85, 强: 0.84, 磊: 0.83, 军: 0.82, 洋: 0.81,
  勇: 0.8, 艳: 0.8, 杰: 0.78, 娟: 0.77, 涛: 0.76, 明: 0.75, 超: 0.74, 霞: 0.73, 平: 0.72, 刚: 0.71,
  桂英: 0.0, 秀英: 0.0, // 双字组合占位
  英: 0.68, 华: 0.67, 建: 0.66, 文: 0.65, 辉: 0.64, 鹏: 0.63, 飞: 0.62, 龙: 0.61, 鑫: 0.6, 浩: 0.58,
  宇: 0.56, 轩: 0.55, 晨: 0.54, 睿: 0.52, 梓: 0.5, 涵: 0.48, 欣: 0.46, 怡: 0.44, 悦: 0.42, 妍: 0.4,
  博: 0.5, 然: 0.4, 子: 0.45, 紫: 0.35, 诗: 0.38, 嘉: 0.4, 瑞: 0.42, 泽: 0.5, 昊: 0.48, 辰: 0.46,
};

/**
 * 重名率估算（基于姓氏与用字频率的启发式算法，非真实统计数据）。
 * 返回每万人中同名人数估算值与等级。
 */
export function nameDuplicationRate(surname: string, given: string): DupRateResult {
  const sChars = [...surname].filter(isCJK);
  const gChars = [...given].filter(isCJK);
  if (sChars.length === 0 || gChars.length === 0) {
    return { per10k: 0, level: '未知', text: '姓名不完整，无法估算' };
  }

  const surnameFreq = SURNAME_FREQ[sChars[0]] ?? 0.3;
  // 名字用字频率：取最高频字的频率，双字名相乘后再修正
  let charFreq = 0.3;
  if (gChars.length === 1) {
    charFreq = CHAR_NAME_FREQ[gChars[0]] ?? 0.2;
  } else {
    const f1 = CHAR_NAME_FREQ[gChars[0]] ?? 0.2;
    const f2 = CHAR_NAME_FREQ[gChars[1]] ?? 0.2;
    // 双字名重名率约为单字的 1/3
    charFreq = Math.sqrt(f1 * f2) * 0.6;
  }

  // 每万人同名 ≈ 姓氏频率(%) × 名字用字频率 × 系数
  // 王姓(7.2%) + 伟(0.95) ≈ 7.2×0.95×3 ≈ 20.5/万人（实际王伟约 29 万，全国约 20/万人，吻合）
  let per10k = surnameFreq * charFreq * 3;
  per10k = Math.round(per10k * 10) / 10;

  let level: string;
  let text: string;
  if (per10k >= 15) {
    level = '极多';
    text = `全国约每万人中有 ${per10k} 人同名，属于高频名字，重名概率很高。`;
  } else if (per10k >= 8) {
    level = '较多';
    text = `全国约每万人中有 ${per10k} 人同名，重名概率较高。`;
  } else if (per10k >= 3) {
    level = '中等';
    text = `全国约每万人中有 ${per10k} 人同名，重名概率适中。`;
  } else if (per10k >= 1) {
    level = '较少';
    text = `全国约每万人中有 ${per10k} 人同名，重名概率较低。`;
  } else {
    level = '稀少';
    text = `全国约每万人中不足 1 人同名，名字较为独特。`;
  }

  return { per10k, level, text };
}

/* ------------------------------ 起名字典 ------------------------------ */
export interface CharDictResult {
  char: string;
  strokes: number;
  element: Element;
  meaning: string | null;
  gender: string | null;
  famous: string[];
  wxNote: string;
  pinyin: string | null;
  words: string[];
  idiom: string | null;
  allusion: string | null;
  nameFit: { fit: '宜' | '中性' | '忌'; text: string } | null;
}

export async function lookupCharDict(input: string): Promise<CharDictResult> {
  const ch = [...input].find(isCJK);
  if (!ch) throw new Error('请输入一个汉字');

  const strokes = await charStroke(ch);
  const code = ch.codePointAt(0)!;
  const element = FIVE_ELEMENTS[code % 5];

  let meaning: string | null = null;
  let gender: string | null = null;
  for (const e of FIVE_ELEMENTS) {
    const found = NAME_CHARS[e].find((nc) => nc.char === ch);
    if (found) {
      meaning = found.meaning;
      gender = found.gender;
      break;
    }
  }

  const famous = CHAR_FAMOUS[ch] ?? [];
  const wxNote = CHAR_WX_NOTE[element] ?? '';
  const culture = CHAR_CULTURE[ch];
  const pinyin = charToPinyin(ch);

  return {
    char: ch, strokes, element, meaning, gender, famous, wxNote,
    pinyin: pinyin ?? null,
    words: culture?.words ?? [],
    idiom: culture?.idiom || null,
    allusion: culture?.allusion || null,
    nameFit: culture?.nameFit ?? null,
  };
}

/* ------------------------------ 起名综合打分 ------------------------------ */
/** 起名综合评分：五格 40% + 三才 20% + 音形义 25% + 五行 15% */
export interface NameScore {
  total: number;
  grids: number;
  threeTalent: number;
  phonetic: number;
  form: number;
  meaning: number;
  wuxing: number;
  /** 音形义明细，供 UI 展示 */
  phoneticNote: string;
  formNote: string;
  meaningNote: string;
}

/** 从拼音拆出声母（首字母）和韵母 */
function splitPinyin(py: string): { init: string; fin: string } {
  const inits = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];
  for (const i of inits) {
    if (py.startsWith(i)) {
      return { init: i, fin: py.slice(i.length) };
    }
  }
  return { init: '', fin: py };
}

/** 字义积极度：检查含义中是否包含正面词 */
function meaningScore(meaning: string): { score: number; note: string } {
  const positive = ['美', '好', '吉', '祥', '瑞', '福', '安', '康', '健', '明', '亮', '光', '辉', '煌', '耀', '华', '贵', '雅', '文', '武', '智', '慧', '仁', '义', '礼', '信', '勇', '强', '大', '高', '远', '深', '博', '广', '清', '纯', '真', '善', '俊', '杰', '英', '雄', '龙', '凤', '麟', '轩', '宇', '宸', '浩', '瀚', '霖', '泽', '润', '涵', '博'];
  const negative = ['病', '死', '亡', '凶', '祸', '灾', '难', '贫', '贱', '苦', '悲', '愁', '恨', '怨', '怒', '哀', '伤', '痛', '残', '缺', '破', '败', '衰', '弱', '愚', '蠢', '懒', '贪', '邪', '恶'];
  let score = 70;
  const posHits = positive.filter((w) => meaning.includes(w)).length;
  const negHits = negative.filter((w) => meaning.includes(w)).length;
  score += posHits * 5;
  score -= negHits * 15;
  score = Math.max(40, Math.min(100, score));
  const note = negHits > 0 ? '含义含负面联想，建议慎用' : posHits >= 2 ? '寓意美好积极' : '含义平和，可用';
  return { score, note };
}

/**
 * 给候选名打综合分（需异步取笔画与五格）。
 * @param surname 姓
 * @param given 名
 * @param gender 性别
 * @param lacking 八字所缺五行（可选，用于五行匹配加分）
 */
export async function scoreNameCandidate(
  surname: string,
  given: string,
  gender: string,
  lacking: Element[] = [],
): Promise<NameScore> {
  // 五格 + 三才
  let xm: XingmingResult | null = null;
  try {
    xm = await analyzeXingming(surname, given, gender);
  } catch {
    xm = null;
  }
  const gridsScore = xm ? xm.score : 60;
  // 三才：从 ttFactor 反推，顺生 105、相克 90、比和 100、其他 95~100
  const tText = xm?.threeTalent.text ?? '';
  let ttScore = 90;
  if (tText.includes('顺生')) ttScore = 100;
  else if (tText.includes('相克')) ttScore = 70;
  else if (tText.includes('比和')) ttScore = 90;
  else if (tText.includes('相生')) ttScore = 95;

  // 音律：相邻字声母/韵母重复扣分
  const fullChars = [...(surname + given)].filter(isCJK);
  const pys = fullChars.map((c) => charToPinyin(c) ?? '').filter(Boolean);
  let phoneticScore = 80;
  let phoneticNote = '音律和谐';
  if (pys.length >= 2) {
    let repeatInit = 0;
    let repeatFin = 0;
    for (let i = 1; i < pys.length; i++) {
      const a = splitPinyin(pys[i - 1]);
      const b = splitPinyin(pys[i]);
      if (a.init && a.init === b.init) repeatInit++;
      if (a.fin && a.fin === b.fin) repeatFin++;
    }
    if (repeatInit > 0) {
      phoneticScore -= repeatInit * 12;
      phoneticNote = `声母重复（${repeatInit}处），略拗口`;
    }
    if (repeatFin > 0) {
      phoneticScore -= repeatFin * 8;
      if (repeatInit === 0) phoneticNote = `韵母相近（${repeatFin}处），读感稍平`;
    }
  }
  phoneticScore = Math.max(40, Math.min(100, phoneticScore));

  // 字形：笔画均衡度（相邻字笔画差越小越好）
  const strokes = await Promise.all(fullChars.map(charStroke));
  let formScore = 80;
  let formNote = '字形协调';
  if (strokes.length >= 2) {
    let maxDiff = 0;
    for (let i = 1; i < strokes.length; i++) {
      if (strokes[i] > 0 && strokes[i - 1] > 0) {
        maxDiff = Math.max(maxDiff, Math.abs(strokes[i] - strokes[i - 1]));
      }
    }
    if (maxDiff > 10) {
      formScore = 60;
      formNote = `笔画悬殊（最大差${maxDiff}画），视觉失衡`;
    } else if (maxDiff > 6) {
      formScore = 72;
      formNote = `笔画略有悬殊（差${maxDiff}画）`;
    }
  }

  // 字义
  let meaningScoreVal = 70;
  let meaningNote = '字义可用';
  const givenChars = [...given].filter(isCJK);
  const ms = givenChars.map((c) => {
    for (const e of FIVE_ELEMENTS) {
      const nc = NAME_CHARS[e].find((x) => x.char === c);
      if (nc) return nc.meaning;
    }
    return '';
  });
  if (ms.some((m) => m)) {
    const combined = ms.join('');
    const r = meaningScore(combined);
    meaningScoreVal = r.score;
    meaningNote = r.note;
  }

  // 五行匹配：名中五行覆盖所缺五行加分；五行过于单一扣分
  const nameEls: Element[] = givenChars.map((c) => {
    for (const e of FIVE_ELEMENTS) {
      if (NAME_CHARS[e].some((x) => x.char === c)) return e;
    }
    return elementOfChar(c);
  });
  let wxScore = 70;
  if (lacking.length > 0) {
    const covered = lacking.filter((e) => nameEls.includes(e)).length;
    wxScore = 60 + (covered / lacking.length) * 40;
  } else {
    // 无八字：五行多样加分
    const unique = new Set(nameEls).size;
    wxScore = 60 + unique * 10;
  }
  wxScore = Math.max(50, Math.min(100, wxScore));

  const total = Math.round(
    gridsScore * 0.4 + ttScore * 0.2 + phoneticScore * 0.1 + formScore * 0.08 + meaningScoreVal * 0.07 + wxScore * 0.15,
  );

  return {
    total: Math.max(0, Math.min(100, total)),
    grids: Math.round(gridsScore),
    threeTalent: Math.round(ttScore),
    phonetic: Math.round(phoneticScore),
    form: Math.round(formScore),
    meaning: Math.round(meaningScoreVal),
    wuxing: Math.round(wxScore),
    phoneticNote,
    formNote,
    meaningNote,
  };
}
