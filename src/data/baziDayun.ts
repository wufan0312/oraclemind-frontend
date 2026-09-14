/**
 * 八字排盘 —— 本地动态计算（离线兜底，替代写死的演示数据）
 *
 * 算法与 oraclemind-backend services/paipan/bazi.py 对齐（同源 lunar 历法）：
 * - 四柱：lunar-typescript `EightChar` 真实干支（年/月/日/时柱）
 * - 大运：`EightChar.getYun(gender)` 真实起运（阳男阴女顺排、阴男阳女逆排）
 * - 当前大运高亮「★ 当前」、下一大运「⭐ 黄金期」
 * - 流年：1984 甲子 60 甲子循环公式，今年起未来 5 年
 */

import { Solar, Lunar } from 'lunar-typescript';
import type { BaziDayun, BaziPillar, BaziShishen, BaziWuxing } from '@/lib/api';

/** 十天干 */
const GAN = '甲乙丙丁戊己庚辛壬癸';
/** 十二地支 */
const ZHI = '子丑寅卯辰巳午未申酉戌亥';

/** 天干五行 */
const GAN_WUXING: Record<string, string> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};

/** 地支五行 */
const ZHI_WUXING: Record<string, string> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};

/** 地支藏干表（主气→中气→余气，权重见 CANG_WEIGHT） */
const ZHI_CANG_GAN: Record<string, string[]> = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
  辰: ['戊', '乙', '癸'], 巳: ['丙', '戊', '庚'], 午: ['丁', '己'],
  未: ['己', '丁', '乙'], 申: ['庚', '壬', '戊'], 酉: ['辛'],
  戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
};
/** 藏干权重：主气 1.0 / 中气 0.5 / 余气 0.3 */
const CANG_WEIGHT = [1.0, 0.5, 0.3];

/** 五行展示顺序与图标（与原型 WUXING 常量一致：木水火土金） */
const WX_ORDER = ['木', '水', '土', '火', '金'] as const;
const WX_ICON: Record<string, string> = { 木: '🌳', 水: '💧', 土: '🌍', 火: '🔥', 金: '⚙️' };

/** 十神配色（与原型 SHI_SHEN 一致；undefined 走默认） */
const SHI_SHEN_COLOR: Record<string, string | undefined> = {
  比肩: undefined, 劫财: 'var(--accent-gold)',
  食神: 'var(--accent-green)', 伤官: '#ff6b6b',
  偏财: 'var(--accent-gold)', 正财: 'var(--accent-green)',
  七杀: '#ff6b6b', 正官: 'var(--primary-light)',
  偏印: 'var(--accent-pink)', 正印: 'var(--primary-light)',
};

/** 五行相生 */
const SHENG: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
/** 五行相克 */
const KE: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

/** 十神表（相对日主） */
const SHI_SHEN_MAP: Record<string, string> = {
  '同同': '比肩', '同异': '劫财',
  '生我同': '偏印', '生我异': '正印',
  '我生同': '食神', '我生异': '伤官',
  '克我同': '七杀', '克我异': '正官',
  '我克同': '偏财', '我克异': '正财',
};

/** 五行 → 元素样式类（与原型 pillar-element 一致） */
const ELEMENT_CLS: Record<string, string> = {
  木: 'el-wood', 火: 'el-fire', 土: 'el-earth', 金: 'el-metal', 水: 'el-water',
};

/** 两干之间相对日主的十神（otherGan 相对 dayGan）—— 与后端 _gan_relation 一致 */
export function ganRelation(dayGan: string, otherGan: string): string {
  if (otherGan === dayGan) return '比肩';
  const dw = GAN_WUXING[dayGan];
  const ow = GAN_WUXING[otherGan];
  const yinDay = GAN.indexOf(dayGan) % 2 === 0; // 甲丙戊庚壬 阳
  const yinOther = GAN.indexOf(otherGan) % 2 === 0;
  const sameYin = yinDay === yinOther;
  if (dw === ow) return sameYin ? '比肩' : '劫财';
  let rel: string;
  if (SHENG[dw] === ow) rel = '我生';
  else if (SHENG[ow] === dw) rel = '生我';
  else if (KE[dw] === ow) rel = '我克';
  else rel = '克我';
  return SHI_SHEN_MAP[rel + (sameYin ? '同' : '异')];
}

/** 公历年份 → 年干支（1984 甲子起 60 循环；验证：2026→丙午 / 2027→丁未 / 1995→乙亥） */
export function yearGanZhi(year: number): string {
  const offset = (((year - 4) % 60) + 60) % 60;
  return GAN[offset % 10] + ZHI[offset % 12];
}

/** 时辰文本（如「辰时 (07:00-09:00)」或「辰时」）→ 小时（取时段中点；不详用 12） */
export function timeTextToHour(timeText: string): number {
  const m: Record<string, number> = {
    子时: 0, 丑时: 2, 寅时: 4, 卯时: 6, 辰时: 8, 巳时: 10,
    午时: 12, 未时: 14, 申时: 16, 酉时: 18, 戌时: 20, 亥时: 22,
  };
  for (const k of Object.keys(m)) {
    if (timeText.startsWith(k)) return m[k];
  }
  return 12;
}

export interface LocalDayunInput {
  /** 出生日期 yyyy-MM-dd */
  date: string;
  /** 时辰完整文本（含时段）或时辰名 */
  time: string;
  gender: string;
}

export interface LocalBaziResult {
  /** 日主天干 */
  dayGan: string;
  /** 四柱（干支真实计算） */
  pillars: BaziPillar[];
  /** 大运 + 流年（流年条目 age 以「年」结尾、pink 标记） */
  dayun: BaziDayun[];
  /** 十神分布（四柱除日干外按十神聚合计数；离线兜底替代写死 SHI_SHEN） */
  shiShen: BaziShishen[];
  /** 五行能量百分比（加权含藏干；离线兜底替代写死 WUXING） */
  wuxing: BaziWuxing[];
  /** 五行个数（四柱8字本气计；label+count） */
  wuxingCount: { label: string; count: number }[];
  /** 缺失五行（个数为 0） */
  lacking: string[];
  /** 用神喜忌（扶抑 + 补缺简化推断） */
  yongshen: { xi: string[]; ji: string[] };
  /** 格局判定文案 */
  analysis: string;
  /** 起运信息（专业排盘口径：起运公历时间 + 出生后时长 + 起运虚岁） */
  qiyun: { date: string; after: string; age: number };
}

/** 四柱宫位（年/月/日/时） */
const PILLAR_LABELS = [
  { label: '年柱 · 祖业', who: '祖业' },
  { label: '月柱 · 父母', who: '父母' },
  { label: '日柱 · 自身', who: '自身' },
  { label: '时柱 · 子女', who: '子女' },
];

/**
 * 本地完整排盘：四柱 + 大运 + 流年（离线兜底，与后端 lunar-python 算法一致）
 */
export function computeLocalBazi(input: LocalDayunInput): LocalBaziResult {
  const [y = 1995, m = 6, d = 15] = input.date.split('-').map(Number);
  const solar = Solar.fromYmdHms(y, m, d, timeTextToHour(input.time), 0, 0);
  const lunar = solar.getLunar();
  const ec = lunar.getEightChar();
  const dayGan = ec.getDayGan();

  // 四柱
  const gzList = [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getTime()];
  const pillars: BaziPillar[] = gzList.map((gz, i) => {
    const isDay = i === 2;
    const gan = gz[0];
    const zhi = gz[1];
    const el = GAN_WUXING[gan] + ZHI_WUXING[zhi];
    return {
      label: PILLAR_LABELS[i].label,
      gan,
      zhi,
      el,
      elCls: ELEMENT_CLS[GAN_WUXING[gan]],
      note: isDay ? '★ 日主' : `坐${ZHI_WUXING[zhi]} · ${ganRelation(dayGan, gan)}`,
      gold: isDay,
    };
  });

  // 大运：阳男阴女顺排、阴男阳女逆排（gender=1 男，0 女 —— 与后端一致）
  const yun = ec.getYun(input.gender === '男' ? 1 : 0);
  // 起运信息（专业排盘口径：起运公历时间 + 出生后时长 + 起运虚岁）
  const yunStart = yun.getStartSolar();
  const qiyun = {
    date: `${yunStart.getYear()}-${String(yunStart.getMonth()).padStart(2, '0')}-${String(yunStart.getDay()).padStart(2, '0')}`,
    after: `${yun.getStartYear()}年${yun.getStartMonth()}个月${yun.getStartDay()}天`,
    age: 0,
  };
  const dayun: (BaziDayun & { startDt?: Date })[] = [];
  for (const dy of yun.getDaYun()) {
    const gz = dy.getGanZhi();
    if (!gz) continue;
    const age = dy.getStartAge();
    if (!qiyun.age) qiyun.age = age;
    // 该步大运精确起运时刻：起运年 + 起运纪念日（首步起运的月/日）
    const startDt = new Date(dy.getStartYear(), yunStart.getMonth() - 1, yunStart.getDay());
    dayun.push({ age: `${age}-${age + 9}岁`, gan: gz, note: `${ganRelation(dayGan, gz[0])}运`, startDt });
  }

  // 当前大运高亮：按「起运纪念日」精确判定（与后端/专业排盘一致）。
  // 虚岁近似法在起运日（多为年中）前后的年份里会把当前大运标错一步。
  const today = new Date();
  let curIdx = -1;
  dayun.forEach((d, i) => {
    if (d.startDt && d.startDt <= today) curIdx = i;
  });
  dayun.forEach((d) => delete d.startDt);
  if (curIdx >= 0) {
    dayun[curIdx].gold = true;
    dayun[curIdx].note = '★ 当前';
    if (curIdx + 1 < dayun.length) {
      dayun[curIdx + 1].primary = true;
      dayun[curIdx + 1].note = '⭐ 黄金期';
      dayun[curIdx + 1].highlight = true;
    }
  }

  // 流年：以立春为界取当前农历年，未来 5 年（pink 标记）。
  // 立春前（公历 2 月 4 日前后）仍属上一农历年，流年干支应取上一农历年而非公历今年。
  let baseYear = today.getFullYear();
  const liChun = Lunar.fromDate(today).getJieQiTable()['立春'];
  if (liChun) {
    const lc = new Date(liChun.getYear(), liChun.getMonth() - 1, liChun.getDay());
    if (today < lc) baseYear -= 1;
  }
  for (let i = 0; i < 5; i++) {
    const yr = baseYear + i;
    const gz = yearGanZhi(yr);
    dayun.push({ age: `${yr}年`, gan: gz, note: `${ganRelation(dayGan, gz[0])}年`, pink: true });
  }

  // 五行统计、十神、用神、格局（离线兜底，随出生信息真实计算，替代写死常量）
  const wx = computeWuxingStats(pillars);
  const shiShen = computeShiShen(pillars, dayGan);
  const yongshen = inferYongshen(dayGan, wx.score, wx.total, wx.lacking, wx.strong);
  const analysis = buildBaziAnalysis(dayGan, pillars[1]?.zhi || '', wx, yongshen);

  return { dayGan, pillars, dayun, shiShen, wuxing: wx.wuxing, wuxingCount: wx.wuxingCount, lacking: wx.lacking, yongshen, analysis, qiyun };
}

/* ============================================================================
 * 五行 / 十神 / 用神 / 格局 本地统计算法（离线兜底，随四柱真实计算）
 * ========================================================================== */

/** 四柱 → 五行加权分数 + 个数 + 缺失 / 偏旺 */
function computeWuxingStats(pillars: BaziPillar[]) {
  const score: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const count: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  pillars.forEach((p) => {
    const gWx = GAN_WUXING[p.gan];
    score[gWx] += 1;
    count[gWx] += 1;
    count[ZHI_WUXING[p.zhi]] += 1; // 地支按本气五行计入个数（总数=8）
    const cang = ZHI_CANG_GAN[p.zhi] || [];
    cang.forEach((g, i) => {
      score[GAN_WUXING[g]] += CANG_WEIGHT[i] || 0.3;
    });
  });
  const total = Object.values(score).reduce((a, b) => a + b, 0) || 1;
  const wuxing: BaziWuxing[] = WX_ORDER.map((label) => ({
    label,
    pct: Math.round((score[label] / total) * 100),
    icon: WX_ICON[label],
  }));
  const wuxingCount = WX_ORDER.map((label) => ({ label, count: count[label] }));
  const lacking = WX_ORDER.filter((l) => count[l] === 0);
  const strong = WX_ORDER.filter((l) => score[l] / total >= 0.3);
  return { score, count, total, wuxing, wuxingCount, lacking, strong };
}

/** 四柱 → 十神分布（除日干外：干 + 地支主气藏干，按十神聚合计数，取前 5） */
function computeShiShen(pillars: BaziPillar[], dayGan: string): BaziShishen[] {
  const counts: Record<string, number> = {};
  const reps: Record<string, string> = {};
  pillars.forEach((p, i) => {
    if (i === 2) return; // 跳过日干自身
    const gName = ganRelation(dayGan, p.gan);
    counts[gName] = (counts[gName] || 0) + 1;
    reps[gName] = `${p.gan}${GAN_WUXING[p.gan]}`;
    const main = (ZHI_CANG_GAN[p.zhi] || [])[0];
    if (main) {
      const zName = ganRelation(dayGan, main);
      counts[zName] = (counts[zName] || 0) + 1;
      reps[zName] = reps[zName] || `${main}${GAN_WUXING[main]}`;
    }
  });
  const ORDER = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'];
  return ORDER.filter((n) => counts[n] > 0)
    .slice(0, 5)
    .map((name) => ({
      name,
      val: counts[name],
      wuxing: reps[name] || dayGan + GAN_WUXING[dayGan],
      color: SHI_SHEN_COLOR[name],
    }));
}

/** 日主扶抑 + 补缺 → 用神喜忌（简化版，本地兜底；非完整调候体系） */
function inferYongshen(
  dayGan: string,
  score: Record<string, number>,
  total: number,
  lacking: string[],
  strong: string[]
): { xi: string[]; ji: string[] } {
  const dw = GAN_WUXING[dayGan];
  const dayRatio = score[dw] / total;
  const isStrong = dayRatio >= 0.3 || strong.includes(dw);
  const shengMe = Object.keys(SHENG).find((k) => SHENG[k] === dw) as string; // 生我
  const iSheng = SHENG[dw]; // 我生
  const keMe = Object.keys(KE).find((k) => KE[k] === dw) as string; // 克我
  const iKe = KE[dw]; // 我克
  let xi: string[];
  let ji: string[];
  if (isStrong) {
    xi = [iSheng, iKe, keMe].filter(Boolean);
    ji = [shengMe, dw].filter(Boolean);
  } else {
    xi = [shengMe, dw].filter(Boolean);
    ji = [iSheng, iKe, keMe].filter(Boolean);
  }
  xi = xi.concat(lacking).filter((v, i, arr) => arr.indexOf(v) === i); // 补缺优先纳入喜用（去重）
  return { xi, ji };
}

/** 生成格局判定文案（日主 + 月令 + 旺衰 + 用神 + 缺失，纯文本） */
function buildBaziAnalysis(
  dayGan: string,
  monthZhi: string,
  wx: { strong: string[]; lacking: string[] },
  yongshen: { xi: string[] }
): string {
  const dw = GAN_WUXING[dayGan];
  const monthWx = ZHI_WUXING[monthZhi];
  const isStrong = wx.strong.includes(dw);
  const lackTxt = wx.lacking.length ? `，补缺${wx.lacking.join('、')}` : '';
  return `日主${dayGan}${dw}，生于${monthZhi}月${monthWx}当令，日主${isStrong ? '偏旺' : '偏弱'}。取${yongshen.xi.slice(0, 3).join('、')}为用神${lackTxt}。属${isStrong ? '中上' : '中和'}格局。`;
}

/* ============================================================================
 * 格局原文（子平月令取格法）
 * 规则：月令藏干中透出天干者优先取格（本气→中气→余气），无透干则取本气；
 *       月令为日主禄位→建禄格；月令为劫财（阳刃/月刃）→羊刃格。
 * ========================================================================== */

/** 格局原文输出 */
export interface GejuYuanwen {
  /** 格局名（如 正官格 / 建禄格 / 羊刃格） */
  name: string;
  /** 取格依据（一句话说明月令与藏干） */
  basis: string;
  /** 传统命书风格原文（取格 + 性情 + 喜忌） */
  text: string;
}

/** 日主禄位（临官） */
const LU_WEI: Record<string, string> = {
  甲: '寅', 乙: '卯', 丙: '巳', 戊: '巳', 丁: '午', 己: '午',
  庚: '申', 辛: '酉', 壬: '亥', 癸: '子',
};

/** 八格原文（十神名 → 命书风格文本） */
const GEJU_TEXT: Record<string, string> = {
  正官格: '官星者，身之贵气，正气之官。月令正官，为人端正守礼，重名誉，有责任担当。喜财星生官、印绶护官，行财印之地主贵；忌伤官见官、官杀混杂，岁运犯之，恐是非缠身。',
  七杀格: '杀者，攻身之凶器，得制则化权。月令七杀，其性刚烈，魄力过人，敢于任事。喜食神制杀、印绶化杀，杀刃相济，多主武贵掌权；忌身弱杀重无制，及财党杀生灾。',
  正财格: '财为养命之源，正财出于正途。月令正财，勤俭务实，财帛丰盈而取之有道。喜身强财旺、食伤生财，身财两停，富而可久；忌比劫分夺、身弱财旺，反成富屋贫人。',
  偏财格: '偏财者，众人之财，流通之财。月令偏财，慷慨疏财，善经营机变，多主远方及意外之财。喜身旺任财、食伤生财，财源滚滚；忌比劫争夺，财来财去，须聚守有道。',
  正印格: '印者，生我之母，庇身之神。月令正印，慈祥敦厚，聪敏好学，多得庇荫提携。喜官杀生印、印绶护身，功名有靠；忌财星坏印，贪财坏印，恐损名失利。',
  偏印格: '偏印者，同气之生而不同心。月令偏印，思虑深敏，多才多艺，然性情近孤，喜精专之学。喜身弱倚印、偏财制枭；忌枭神夺食，谋多成少，寿元有损。',
  食神格: '食神者，我生之秀气，泄身之精华。月令食神，温良恭俭，衣禄丰厚，有口福善滋养。喜身旺食健、食神生财，福泽绵长；忌偏印夺食，枭神当道，才华受抑。',
  伤官格: '伤官者，我生之骄气，克官之利刃。月令伤官，聪明外露，才华横溢，然易恃才傲物。喜伤官配印、伤官生财，才华得用，名利可期；忌再见正官，伤官见官，其祸百端。',
};

/** 建禄格 / 羊刃格原文 */
const JIANLU_TEXT =
  '禄者，日主临官之地。建禄格身强自立，不倚祖业，白手兴家之命。喜财官食伤泄其旺气，忌印比重叠，身旺无依。行运财官得地，中晚年自有发越。';
const YANGREN_TEXT =
  '刃者，劫财之旺极，日主之锋芒。羊刃格性刚果敢，胆识过人，宜武职、军旅、开创之途。喜七杀制刃，杀刃相济，掌威权；忌刃旺无制、岁运再逢劫夺，恐伤身破财。';

/** 月令取格：返回格局名 + 依据 + 命书风格原文 */
export function buildGejuYuanwen(
  dayGan: string,
  monthZhi: string,
  /** 四柱天干（用于判断月令藏干是否透出，含月干） */
  gans: string[]
): GejuYuanwen | null {
  if (!dayGan || !monthZhi) return null;
  const hides = ZHI_CANG_GAN[monthZhi] || [];
  if (!hides.length) return null;
  const dw = GAN_WUXING[dayGan];

  // 建禄：月令为日主临官禄位（本气与日主同五行同阴阳，即比肩）
  const mainSS = ganRelation(dayGan, hides[0]);
  if (mainSS === '比肩') {
    return {
      name: '建禄格',
      basis: `日主${dayGan}${dw}生于${monthZhi}月，月令为日主临官禄位，藏干${hides.join('、')}皆比劫之气，故取建禄格。`,
      text: JIANLU_TEXT,
    };
  }
  // 羊刃：月令本气为劫财（阳日主为阳刃，阴日主称月刃，从众仍以羊刃格论）
  if (mainSS === '劫财') {
    const isYang = GAN.indexOf(dayGan) % 2 === 0;
    return {
      name: '羊刃格',
      basis: `日主${dayGan}${dw}生于${monthZhi}月，月令本气${hides[0]}${GAN_WUXING[hides[0]]}为${isYang ? '阳刃' : '月刃'}，劫财秉令，故取羊刃格。`,
      text: YANGREN_TEXT,
    };
  }

  // 八格：月令藏干透出天干者优先（本气→中气→余气），无透干取本气
  let pick = hides[0];
  let via = '月令本气';
  for (const h of hides) {
    const pos = gans.filter((g) => g && g !== dayGan).indexOf(h);
    if (pos >= 0) {
      pick = h;
      const where = pos === 0 ? '年干' : pos === 1 ? '月干' : '时干';
      via = `藏干${h}透出${where}`;
      break;
    }
  }
  const ss = ganRelation(dayGan, pick);
  const name = `${ss}格`;
  const text = GEJU_TEXT[name];
  if (!text) return null;
  return {
    name,
    basis: `日主${dayGan}${dw}生于${monthZhi}月，${via}${pick}${GAN_WUXING[pick]}为日主${ss}，故取${name}。`,
    text,
  };
}

/** 兼容导出：仅大运流年（供脚本/调试） */
export function computeLocalDayun(input: LocalDayunInput): BaziDayun[] {
  return computeLocalBazi(input).dayun;
}

/* ============================================================================
 * 大运流年解说
 * 基于真实排盘结果（四柱 + 大运 + 流年）生成可读的中文解说文本，
 * 前端通用：后端在线（data.dayun）与离线（computeLocalBazi）均适用。
 * ========================================================================== */

/** 十神寓意（解说文案库） */
const SHI_SHEN_MEANING: Record<string, string> = {
  比肩: '主自我与同辈竞争，合作与独立并进',
  劫财: '主人际往来增多，宜防冲动与破财',
  食神: '主才华彰显，口福、创作与表达俱佳',
  伤官: '主表达欲与创意迸发，宜收敛锋芒',
  正财: '主财运稳进，务实经营多有收获',
  偏财: '主偏财机遇，投资与社交易见财',
  正官: '主事业运上扬，责任与晋升并存',
  七杀: '主压力与机遇并存，魄力定成败',
  正印: '主贵人庇佑，学业文书多顺利',
  偏印: '主思维活跃，宜进修钻研新领域',
};

/** 干支五行对日主的生克关系描述 */
function elementRelation(dayWx: string, otherWx: string): string {
  if (!dayWx || !otherWx) return '运势平稳';
  if (dayWx === otherWx) return '同类比助，气势增强';
  if (SHENG[dayWx] === otherWx) return '为日主所生，属耗泄之象';
  if (SHENG[otherWx] === dayWx) return '生扶日主，多得助力';
  if (KE[dayWx] === otherWx) return '为日主所克，可驾驭掌控';
  return '克制日主，压力中见机遇';
}

export interface DayunAnalysisItem {
  /** 标签：当前大运 / 黄金期 / 今年流年 */
  tag: string;
  title: string;
  text: string;
  /** 语气：good=利好 / warn=谨慎 / info=中性 */
  tone: 'good' | 'warn' | 'info';
}

/**
 * 生成大运流年解说（当前大运 / 下一黄金期 / 今年流年 三段）。
 * dayGan：日主天干（取自日柱）；dayun：排盘结果的大运+流年列表。
 */
export function buildDayunAnalysis(dayGan: string, dayun: BaziDayun[]): DayunAnalysisItem[] {
  const out: DayunAnalysisItem[] = [];
  if (!dayGan || !dayun.length) return out;
  const dw = GAN_WUXING[dayGan];

  // 当前大运（★ 当前）
  const cur = dayun.find((d) => d.gold);
  if (cur) {
    const gShi = ganRelation(dayGan, cur.gan[0]);
    const zRel = elementRelation(dw, ZHI_WUXING[cur.gan[1]]);
    out.push({
      tag: '当前大运',
      title: `${cur.age} · ${cur.gan}`,
      text: `天干${cur.gan[0]}五行属${GAN_WUXING[cur.gan[0]]}，为日主之${gShi}，${SHI_SHEN_MEANING[gShi] || '运势平稳'}；地支${cur.gan[1]}属${ZHI_WUXING[cur.gan[1]]}，${zRel}。此阶段宜顺应时势稳中求进，发挥所长、补足所短。`,
      tone: 'info',
    });
  }

  // 下一大运（⭐ 黄金期）
  const next = dayun.find((d) => d.primary);
  if (next) {
    const gShi = ganRelation(dayGan, next.gan[0]);
    const zRel = elementRelation(dw, ZHI_WUXING[next.gan[1]]);
    out.push({
      tag: '黄金期',
      title: `下一大运 · ${next.gan}`,
      text: `转入「${next.gan}」大运，天干为日主之${gShi}，${SHI_SHEN_MEANING[gShi] || '运势向好'}；地支${next.gan[1]}属${ZHI_WUXING[next.gan[1]]}，${zRel}。十年黄金期宜提前布局，积累资源与人脉，把握事业与财运的上行窗口。`,
      tone: 'good',
    });
  }

  // 今年流年（pink 第一条）
  const year = dayun.find((d) => d.pink);
  if (year) {
    const gShi = ganRelation(dayGan, year.gan[0]);
    const zRel = elementRelation(dw, ZHI_WUXING[year.gan[1]]);
    const warn = gShi === '七杀' || gShi === '劫财' || gShi === '伤官';
    out.push({
      tag: '今年流年',
      title: `${year.age} · ${year.gan}`,
      text: `流年天干为日主之${gShi}，${SHI_SHEN_MEANING[gShi] || '运势平稳'}；地支${year.gan[1]}属${ZHI_WUXING[year.gan[1]]}，${zRel}。${
        warn ? '此年宜低调谨慎，稳字当头，避免冒进与口舌之争。' : '整体顺遂，可主动把握机遇，积极进取。'
      }`,
      tone: warn ? 'warn' : 'good',
    });
  }

  return out;
}
