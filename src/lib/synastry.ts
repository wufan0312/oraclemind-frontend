// ===== 合婚 / 合盘（两人出生信息多维合参） =====
// 维度：生肖三合六合 · 星座四元素 · 八字日干五行 · 生命灵数。
// 各维度独立打分，加权合成综合分，并输出维度解读与建议。
// 说明：本模块为传统文化视角的「合参」，仅供娱乐参考，不构成任何现实决策依据。

import { computeLocalBazi } from '@/data/baziDayun';
import { digitalRoot } from '@/data/numerologyData';

export interface BirthProfile {
  name: string;
  /** yyyy-MM-dd */
  date: string;
  /** HH:MM，可选（日柱仅由日期决定，无时刻也能算） */
  time?: string;
  gender?: 'male' | 'female';
}

export interface SynastryDimension {
  key: string;
  label: string;
  score: number; // 0-100
  note: string;
}

export interface SynastryResult {
  dimensions: SynastryDimension[];
  total: number; // 0-100
  grade: string;
  advice: string[];
  zodiacA: string;
  zodiacB: string;
  signA: string | null;
  signB: string | null;
  lifePathA: number;
  lifePathB: number;
  dayGanA: string;
  dayGanB: string;
}

// ---- 基础换算 ----
const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
function shengxiao(year: number): string {
  return ZODIAC[(((year - 4) % 12) + 12) % 12];
}

function getConstellation(date: string): string | null {
  const [, m, d] = date.split('-').map(Number);
  if (!m || !d) return null;
  const edges = [20, 19, 21, 20, 21, 22, 23, 23, 23, 24, 23, 22];
  const names = [
    '摩羯座', '水瓶座', '双鱼座', '白羊座', '金牛座', '双子座',
    '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座',
  ];
  return d >= edges[m - 1] ? names[m] : names[m - 1];
}

const SIGN_ELEMENT: Record<string, string> = {
  白羊座: '火', 金牛座: '土', 双子座: '风', 巨蟹座: '水', 狮子座: '火',
  处女座: '土', 天秤座: '风', 天蝎座: '水', 射手座: '火', 摩羯座: '土',
  水瓶座: '风', 双鱼座: '水',
};

const GAN_WUXING: Record<string, string> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土',
  庚: '金', 辛: '金', 壬: '水', 癸: '水',
};
const WX_SHENG: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const WX_KE: Record<string, string> = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };

const LIUHE: Record<string, string> = {
  鼠: '牛', 牛: '鼠', 虎: '猪', 猪: '虎', 兔: '狗', 狗: '兔',
  龙: '鸡', 鸡: '龙', 蛇: '猴', 猴: '蛇', 马: '羊', 羊: '马',
};
const CHONG: Record<string, string> = {
  鼠: '马', 马: '鼠', 牛: '羊', 羊: '牛', 虎: '猴', 猴: '虎',
  兔: '鸡', 鸡: '兔', 龙: '狗', 狗: '龙', 蛇: '猪', 猪: '蛇',
};
const HAI: Record<string, string> = {
  鼠: '羊', 羊: '鼠', 牛: '马', 马: '牛', 虎: '蛇', 蛇: '虎',
  兔: '龙', 龙: '兔', 猴: '猪', 猪: '猴', 鸡: '狗', 狗: '鸡',
};
const SANHE: Record<string, string[]> = {
  猴: ['鼠', '龙'], 鼠: ['猴', '龙'], 龙: ['猴', '鼠'],
  猪: ['兔', '羊'], 兔: ['猪', '羊'], 羊: ['猪', '兔'],
  虎: ['马', '狗'], 马: ['虎', '狗'], 狗: ['虎', '马'],
  蛇: ['鸡', '牛'], 鸡: ['蛇', '牛'], 牛: ['蛇', '鸡'],
};

// ---- 各维度评分 ----

function zodiacScore(a: string, b: string): { score: number; note: string } {
  if (a === b) return { score: 82, note: `同属${a}，性情相近，易有默契，但也可能缺乏互补。` };
  if (LIUHE[a] === b) return { score: 95, note: `六合：${a}与${b}为六合生肖，传统视为上上婚配，最为契合。` };
  if (SANHE[a]?.includes(b)) return { score: 88, note: `三合：${a}与${b}三合，气场相投，相处顺遂。` };
  if (CHONG[a] === b) return { score: 35, note: `相冲：${a}与${b}六冲，观念易冲撞，需更多体谅与磨合。` };
  if (HAI[a] === b) return { score: 50, note: `相害：${a}与${b}相害，易有隐性摩擦，沟通是关键。` };
  return { score: 70, note: `无特殊刑冲，常规组合，相处看具体缘分。` };
}

function elementPairScore(a: string, b: string): number {
  if (a === b) return 90;
  const friendly: Record<string, string[]> = {
    火: ['风', '土'], 风: ['火', '水'], 水: ['风', '土'],
    土: ['火', '水'], 木: ['水', '火'],
  };
  // 互为友好（无向）
  if (friendly[a]?.includes(b) || friendly[b]?.includes(a)) return 80;
  // 相克：火水 / 土风 / 木金
  const clash = (a === '火' && b === '水') || (a === '水' && b === '火') ||
    (a === '土' && b === '风') || (a === '风' && b === '土');
  return clash ? 58 : 68;
}

function signScore(a: string, b: string): { score: number; note: string } {
  const ea = SIGN_ELEMENT[a];
  const eb = SIGN_ELEMENT[b];
  if (!ea || !eb) return { score: 70, note: '星座信息缺失，按常规计。' };
  const s = elementPairScore(ea, eb);
  const label = (e: string) => ({ 火: '火象', 土: '土象', 风: '风象', 水: '水象' }[e] || e);
  return { score: s, note: `${a}(${label(ea)}) 与 ${b}(${label(eb)})：${s >= 85 ? '同象共振，吸引力强' : s >= 75 ? '元素相生，互补舒适' : s >= 60 ? '元素平和，可磨合' : '元素相克，需互相包容'}。` };
}

function dayGanScore(ga: string, gb: string): { score: number; note: string } {
  const wa = GAN_WUXING[ga];
  const wb = GAN_WUXING[gb];
  if (!wa || !wb) return { score: 70, note: '日主信息缺失，按常规计。' };
  if (wa === wb) return { score: 80, note: `日主同属${wa}，比和，易理解彼此行事风格。` };
  if (WX_SHENG[wa] === wb) return { score: 86, note: `${wa}生${wb}：一方滋养另一方，关系中有付出与承接。` };
  if (WX_SHENG[wb] === wa) return { score: 86, note: `${wb}生${wa}：一方滋养另一方，彼此互补扶持。` };
  if (WX_KE[wa] === wb) return { score: 55, note: `${wa}克${wb}：存在张力，需把握好分寸与尊重。` };
  if (WX_KE[wb] === wa) return { score: 55, note: `${wb}克${wa}：存在张力，磨合中见成长。` };
  return { score: 70, note: '日主五行无明显生克，关系中性。' };
}

function lifePathScore(a: number, b: number): { score: number; note: string } {
  const GOOD_PAIRS: [number, number][] = [
    [1, 5], [1, 7], [2, 4], [2, 6], [2, 8], [3, 6], [3, 9], [4, 8], [5, 7],
  ];
  const isGood = GOOD_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const master = [11, 22, 33].includes(a) || [11, 22, 33].includes(b);
  if (a === b) return { score: 85, note: `生命灵数同为 ${a}，人生课题与节奏高度同频。` };
  if (isGood) return { score: 82, note: `生命灵数 ${a} 与 ${b} 互为增益组合，目标与步调易合拍。` };
  if (master) return { score: 78, note: `含大师数（${a}/${b}），灵性课题深刻，亦需落地磨合。` };
  return { score: 68, note: `生命灵数 ${a} 与 ${b}，节奏不同，差异处正是互补空间。` };
}

function gradeOf(total: number): string {
  if (total >= 85) return '天作之合';
  if (total >= 75) return '良缘佳配';
  if (total >= 62) return '可期之缘';
  if (total >= 48) return '磨合成全';
  return '谨慎相处';
}

/** 计算两人合参结果 */
export function computeSynastry(a: BirthProfile, b: BirthProfile): SynastryResult {
  const ya = Number(a.date.split('-')[0]);
  const yb = Number(b.date.split('-')[0]);
  const zodiacA = shengxiao(ya);
  const zodiacB = shengxiao(yb);
  const signA = getConstellation(a.date);
  const signB = getConstellation(b.date);

  const lpA = digitalRoot(ya + Number(a.date.split('-')[1]) + Number(a.date.split('-')[2]));
  const lpB = digitalRoot(yb + Number(b.date.split('-')[1]) + Number(b.date.split('-')[2]));

  const dayGanA = computeLocalBazi({ date: a.date, time: a.time || '子时', gender: a.gender || 'male' }).dayGan;
  const dayGanB = computeLocalBazi({ date: b.date, time: b.time || '子时', gender: b.gender || 'female' }).dayGan;

  const zx = zodiacScore(zodiacA, zodiacB);
  const sg = signScore(signA || '', signB || '');
  const dg = dayGanScore(dayGanA, dayGanB);
  const lp = lifePathScore(lpA, lpB);

  const dimensions: SynastryDimension[] = [
    { key: 'zodiac', label: '生肖三合六合', score: zx.score, note: zx.note },
    { key: 'sign', label: '星座四元素', score: sg.score, note: sg.note },
    { key: 'daygan', label: '八字日干五行', score: dg.score, note: dg.note },
    { key: 'life', label: '生命灵数', score: lp.score, note: lp.note },
  ];

  // 加权：生肖 30% / 星座 25% / 日干 25% / 灵数 20%
  const total = Math.round(zx.score * 0.3 + sg.score * 0.25 + dg.score * 0.25 + lp.score * 0.2);

  const advice: string[] = [];
  dimensions.forEach((dim) => {
    if (dim.score >= 85) advice.push(`· ${dim.label}：${dim.note.split('：')[0]}极佳，是关系的天然优势。`);
    else if (dim.score <= 55) advice.push(`· ${dim.label}：${dim.note}`);
  });
  if (advice.length === 0) advice.push('· 各维度均较协调，顺其自然地相处即可。');
  advice.push('· 合参仅为传统文化视角的趣味参考，真正的关系靠彼此的理解与经营。');

  return {
    dimensions,
    total,
    grade: gradeOf(total),
    advice,
    zodiacA,
    zodiacB,
    signA,
    signB,
    lifePathA: lpA,
    lifePathB: lpB,
    dayGanA,
    dayGanB,
  };
}
