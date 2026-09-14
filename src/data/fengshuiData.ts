// ============================================================================
// 玄镜 OracleMind · 风水数据与算法模块
// 九宫飞星(玄空) + 八宅明镜(命卦) + 形煞自查 + 择日引擎 + 开运好物
// ============================================================================

import { Solar } from 'lunar-typescript';
import { storage, registerLegacy } from '@/lib/storage';
// P2-1：旧键（oraclemind_bazi_result）惰性迁移到新键
registerLegacy('oraclemind_bazi_result', 'om_fengshui_bazi_result');

// ============================ 生肖计算 ============================

/**
 * 根据公历日期精确计算生肖（基于农历年，正确处理立春/春节前的日期）。
 * 使用 lunar-typescript 与后端 lunar-python 同源历法。
 */
export function getShengxiao(year: number, month: number, day: number): string {
  try {
    const solar = Solar.fromYmd(year, month, day);
    const lunar = solar.getLunar();
    return lunar.getYearShengXiao();
  } catch {
    // 降级：纯公历年份公式（粗略，未考虑立春）
    const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
    return ZODIAC[(year - 4) % 12] || '未知';
  }
}

// ============================ 九宫飞星 ============================

/** 九星属性表 */
export interface StarInfo {
  num: number;
  name: string;       // 星名(如「一白贪狼」)
  short: string;      // 简称(如「一白」)
  wuxing: string;     // 五行
  color: string;      // 主色(十六进制)
  auspicious: '吉' | '凶' | '平';
  title: string;      // 别名(如「桃花星」「文昌星」)
  meaning: string;    // 含义
  cure: string;       // 催旺/化解建议
  detail: string;     // 详细解读
}

export const STARS: Record<number, StarInfo> = {
  1: {
    num: 1, name: '一白贪狼星', short: '一白', wuxing: '水', color: '#7c5cff',
    auspicious: '吉', title: '桃花·官星',
    meaning: '主桃花、人缘、官运、智慧',
    cure: '宜在北方放置水类物品或金属饰品催旺，利事业人际与感情',
    detail: '一白贪狼星属水，为魁名之星、主桃花与人缘。飞临之方利考试、求职、社交；若见水则旺桃花官贵。流年一白所临之宫宜保持整洁明亮，可摆金属风铃或流水摆件助旺。',
  },
  2: {
    num: 2, name: '二黑巨门星', short: '二黑', wuxing: '土', color: '#ff6b6b',
    auspicious: '凶', title: '病符星',
    meaning: '主疾病、健康问题、消极',
    cure: '宜静不宜动，忌堆杂物；可挂五帝铜钱或铜葫芦化解土煞',
    detail: '二黑巨门星属土，为病符之星。飞临之方忌动土、装修，忌见红色物品催旺火生土煞。可挂六字铜铃、安放铜制葫芦泄土气。若为卧室或厨房所在，尤需注意健康。',
  },
  3: {
    num: 3, name: '三碧禄存星', short: '三碧', wuxing: '木', color: '#8b9a4a',
    auspicious: '凶', title: '是非星·蚩尤星',
    meaning: '主是非口舌、官非、争执',
    cure: '宜用红色物品或火属性物件克制木煞；忌放绿色植物',
    detail: '三碧禄存星属木，为是非之星。飞临之方易招口舌争端、官非诉讼。化解宜用火克木——可摆放红色地毯、红色装饰品，或置明灯。切忌在此方养植物或放木制家具，以免助长木气。',
  },
  4: {
    num: 4, name: '四绿文曲星', short: '四绿', wuxing: '木', color: '#4ade80',
    auspicious: '吉', title: '文昌星',
    meaning: '主学业、考试、文采、名誉',
    cure: '宜设书房书桌；摆放四支富贵竹或文昌塔催旺',
    detail: '四绿文曲星属木，为文昌之星。飞临之宫大利读书、考试、写作、升职。可在该方设书桌、书架，摆四支富贵竹（取「四绿」之数），或置文昌塔、毛笔架。忌见红色克木。',
  },
  5: {
    num: 5, name: '五黄廉贞星', short: '五黄', wuxing: '土', color: '#a0a0b8',
    auspicious: '凶', title: '正关煞·灾星',
    meaning: '主灾祸、意外、凶险',
    cure: '宜绝对安静；挂五帝铜钱或安铜麒麟化煞；忌动土装修',
    detail: '五黄廉贞星属土，为九星中最凶之星，又称「正关煞」。飞临之方切忌动土、钻孔、装修、搬动家具。宜保持静止、暗淡。化解须用金泄土——挂五帝铜钱、安放铜麒麟或铜葫芦。若五黄叠临二黑，尤需谨慎。',
  },
  6: {
    num: 6, name: '六白武曲星', short: '六白', wuxing: '金', color: '#a78bfa',
    auspicious: '吉', title: '武贵星·官星',
    meaning: '主贵人、武贵、权力、权威',
    cure: '宜放金属摆件或黄色水晶；利武职及管理岗',
    detail: '六白武曲星属金，为武贵之星。飞临之方利升职、遇贵人、掌权。可在该方放金属摆件、铜马、黄水晶球助旺。亦利动中求贵——出差、运动可在此方出门。忌见红色克金。',
  },
  7: {
    num: 7, name: '七赤破军星', short: '七赤', wuxing: '金', color: '#5ce1e6',
    auspicious: '平', title: '破军星·偏财',
    meaning: '主偏财、口舌、破败、肃杀',
    cure: '吉则催旺偏财宜放金属物；凶则忌动，宜用水泄金',
    detail: '七赤破军星属金，主肃杀与破败，亦主偏财。飞临之方若得令则利偏门财运、投资投机；若失令则主口舌、盗贼、破财。催旺可放金属饰品，化解宜用水泄金——置鱼缸或流水摆件。',
  },
  8: {
    num: 8, name: '八白左辅星', short: '八白', wuxing: '土', color: '#d4a853',
    auspicious: '吉', title: '当旺财星',
    meaning: '主正财、置业、田产、富足',
    cure: '大利财运；宜放聚宝盆、黄水晶、貔貅催旺财气',
    detail: '八白左辅星属土，为当运财星（八运2004-2023当旺）。飞临之方为流年财位，大利求财、投资、置业。可放聚宝盆、黄水晶球、貔貅、金蟾催旺。该方宜明亮、整洁，忌阴暗潮湿。',
  },
  9: {
    num: 9, name: '九紫右弼星', short: '九紫', wuxing: '火', color: '#ff6b9d',
    auspicious: '吉', title: '喜庆星·桃花',
    meaning: '主喜庆、姻缘、生育、姻缘桃花',
    cure: '宜放红色或紫色喜庆物品；利婚嫁添丁',
    detail: '九紫右弼星属火，为喜庆之星。飞临之方利婚嫁、添丁、庆贺、姻缘。可摆红色花束、紫色水晶、喜庆装饰催旺。该方宜亮不宜暗，见红色或暖色调物品尤佳。但若飞临凶位叠煞则反主火灾、血光。',
  },
};

/** 九宫方位排列(洛书宫位 → 方位名称 → 方位索引) */
// 洛书排列(3x3, 从上到下、左到右):
// 东南4 | 正南9 | 西南2
// 正东3 | 中宫5 | 正西7
// 东北8 | 正北1 | 西北6
export const PALACE_GRID: { pos: string; luoNum: number }[] = [
  { pos: '东南', luoNum: 4 }, { pos: '正南', luoNum: 9 }, { pos: '西南', luoNum: 2 },
  { pos: '正东', luoNum: 3 }, { pos: '中宫', luoNum: 5 }, { pos: '正西', luoNum: 7 },
  { pos: '东北', luoNum: 8 }, { pos: '正北', luoNum: 1 }, { pos: '西北', luoNum: 6 },
];

/** 飞星路径索引：中宫为起点(0)，沿洛书轨迹飞布 */
// 路径: 中宫→西北→正西→东北→正南→正北→西南→正东→东南
const FLY_PATH: Record<string, number> = {
  '中宫': 0, '西北': 1, '正西': 2, '东北': 3,
  '正南': 4, '正北': 5, '西南': 6, '正东': 7, '东南': 8,
};

/**
 * 计算流年中宫入星号(1~9)
 * 玄空飞星年命公式：以2000年为九紫入中(9)锚点，逐年递减
 */
export function getCentralStar(year: number): number {
  const star = (((9 - (year - 2000)) % 9) + 9) % 9;
  return star === 0 ? 9 : star;
}

/**
 * 计算某年某方位的飞星号(1~9)
 * @param year 年份
 * @param pos 方位(东南/正南/西南/正东/中宫/正西/东北/正北/西北)
 */
export function getFlyingStar(year: number, pos: string): number {
  const central = getCentralStar(year);
  const offset = FLY_PATH[pos] ?? 0;
  const star = (((central - 1 + offset) % 9) + 9) % 9 + 1;
  return star;
}

/**
 * 获取某年完整的九宫飞星布局
 * @returns 9个宫位，按 PALACE_GRID 顺序排列，每格含飞星号+星信息
 */
export function getAnnualStarLayout(year: number): {
  pos: string; luoNum: number; starNum: number; star: StarInfo;
}[] {
  return PALACE_GRID.map((cell) => {
    const starNum = getFlyingStar(year, cell.pos);
    return { ...cell, starNum, star: STARS[starNum] };
  });
}

// ============================ 八宅明镜 ============================

/** 卦号 → 卦名/方位/五行 */
export interface GuaInfo {
  num: number;
  name: string;     // 卦名(坎/坤/震/巽/乾/兑/艮/离)
  dir: string;      // 方位
  wuxing: string;
  group: '东四命' | '西四命';
  trigram: string;  // 卦符
  desc: string;
}

export const GUAS: Record<number, GuaInfo> = {
  1: { num: 1, name: '坎', dir: '正北', wuxing: '水', group: '东四命', trigram: '☵', desc: '坎为水，主智慧、隐伏、中男' },
  2: { num: 2, name: '坤', dir: '西南', wuxing: '土', group: '西四命', trigram: '☷', desc: '坤为地，主包容、柔顺、母亲' },
  3: { num: 3, name: '震', dir: '正东', wuxing: '木', group: '东四命', trigram: '☳', desc: '震为雷，主行动、奋发、长男' },
  4: { num: 4, name: '巽', dir: '东南', wuxing: '木', group: '东四命', trigram: '☴', desc: '巽为风，主灵活、顺入、长女' },
  6: { num: 6, name: '乾', dir: '西北', wuxing: '金', group: '西四命', trigram: '☰', desc: '乾为天，主刚健、权威、父亲' },
  7: { num: 7, name: '兑', dir: '正西', wuxing: '金', group: '西四命', trigram: '☱', desc: '兑为泽，主喜悦、言语、少女' },
  8: { num: 8, name: '艮', dir: '东北', wuxing: '土', group: '西四命', trigram: '☶', desc: '艮为山，主稳重、静止、少男' },
  9: { num: 9, name: '离', dir: '正南', wuxing: '火', group: '东四命', trigram: '☲', desc: '离为火，主光明、美丽、中女' },
};

/** 八方方位(对应卦号) */
export const EIGHT_DIRS: { dir: string; guaNum: number }[] = [
  { dir: '正北', guaNum: 1 }, { dir: '东北', guaNum: 8 },
  { dir: '正东', guaNum: 3 }, { dir: '东南', guaNum: 4 },
  { dir: '正南', guaNum: 9 }, { dir: '西南', guaNum: 2 },
  { dir: '正西', guaNum: 7 }, { dir: '西北', guaNum: 6 },
];

/** 三爻(底→中→顶) 二进制表示 */
const TRIGRAM_BITS: Record<number, [number, number, number]> = {
  1: [0, 1, 0], // 坎
  2: [0, 0, 0], // 坤
  3: [1, 0, 0], // 震
  4: [0, 1, 1], // 巽
  6: [1, 1, 1], // 乾
  7: [1, 1, 0], // 兑
  8: [0, 0, 1], // 艮
  9: [1, 0, 1], // 离
};

/** 大游年星名 */
export type DayouYearStar =
  | '伏位' | '生气' | '天医' | '延年'   // 四吉
  | '绝命' | '五鬼' | '祸害' | '六煞';   // 四凶

/** 大游年星属性 */
export const STAR_ATTRS: Record<DayouYearStar, {
  auspicious: '吉' | '凶';
  level: '大吉' | '中吉' | '小吉' | '大凶' | '中凶' | '小凶';
  color: string;
  meaning: string;
  advice: string;
}> = {
  '伏位': { auspicious: '吉', level: '小吉', color: '#a0a0b8', meaning: '主平稳安定、伏藏蓄力', advice: '该方宜安床、静坐，利休养蓄势' },
  '生气': { auspicious: '吉', level: '大吉', color: '#4ade80', meaning: '主生机勃勃、贵人运、财运', advice: '该方宜开门、设财位，大利进取求财' },
  '天医': { auspicious: '吉', level: '中吉', color: '#5ce1e6', meaning: '主健康疗愈、贵人助', advice: '该方宜设卧室、安床，利健康康复' },
  '延年': { auspicious: '吉', level: '大吉', color: '#d4a853', meaning: '主感情和谐、人缘旺、长寿', advice: '该方宜设主卧或会客，利姻缘人际' },
  '绝命': { auspicious: '凶', level: '大凶', color: '#ff6b6b', meaning: '主破财、伤丁、绝嗣', advice: '该方忌做主卧、开门；宜用金属性物品化解' },
  '五鬼': { auspicious: '凶', level: '大凶', color: '#ff6b6b', meaning: '主官非、口舌、火灾、破财', advice: '该方忌安炉灶、动土；宜安铜器泄煞' },
  '祸害': { auspicious: '凶', level: '小凶', color: '#d4a853', meaning: '主是非、口舌、诸事不顺', advice: '该方宜静不宜动；可置金属物化解' },
  '六煞': { auspicious: '凶', level: '中凶', color: '#ff8c69', meaning: '主桃花劫、抑郁、人际关系差', advice: '该方忌做卧室；宜用水属性物品泄化' },
};

/**
 * 计算命卦号(1~9，不含5)
 * 男命: (11 - year%9) % 9, 0→9, 5→2(寄坤)
 * 女命: 与男命互补, (10 - 男命raw) % 9, 0→9, 5→8(寄艮)
 */
export function getMingGua(year: number, gender: '男' | '女'): number {
  const maleRaw = ((11 - (year % 9)) % 9 + 9) % 9 || 9;
  if (gender === '男') {
    return maleRaw === 5 ? 2 : maleRaw;
  }
  const femaleRaw = ((10 - maleRaw) % 9 + 9) % 9 || 9;
  return femaleRaw === 5 ? 8 : femaleRaw;
}

/** 获取命卦详细信息 */
export function getMingGuaInfo(year: number, gender: '男' | '女'): GuaInfo {
  const num = getMingGua(year, gender);
  return GUAS[num];
}

/**
 * 大游年：计算命卦与方位卦的关系星
 * 基于三爻变换：比较命卦与方位卦的爻变，确定四吉四凶
 */
export function getDayouYearStar(mingGuaNum: number, dirGuaNum: number): DayouYearStar {
  const m = TRIGRAM_BITS[mingGuaNum];
  const d = TRIGRAM_BITS[dirGuaNum];
  if (!m || !d) return '伏位';
  // 计算爻变: [底, 中, 顶]
  const bc = m[0] !== d[0] ? 1 : 0;
  const mc = m[1] !== d[1] ? 1 : 0;
  const tc = m[2] !== d[2] ? 1 : 0;
  // 变爻组合 → 大游年星
  // 000=伏位 001=生气 010=绝命 011=五鬼 100=祸害 101=六煞 110=天医 111=延年
  const key = `${bc}${mc}${tc}`;
  const map: Record<string, DayouYearStar> = {
    '000': '伏位', '001': '生气', '010': '绝命', '011': '五鬼',
    '100': '祸害', '101': '六煞', '110': '天医', '111': '延年',
  };
  return map[key] || '伏位';
}

/**
 * 计算命卦的八方位吉凶布局
 * @returns 8个方位，每个含方位名、方位卦、大游年星、吉凶信息
 */
export function getBazhaiLayout(mingGuaNum: number): {
  dir: string; guaNum: number; gua: GuaInfo;
  star: DayouYearStar; attr: typeof STAR_ATTRS[DayouYearStar];
}[] {
  return EIGHT_DIRS.map((d) => {
    const star = getDayouYearStar(mingGuaNum, d.guaNum);
    return {
      dir: d.dir,
      guaNum: d.guaNum,
      gua: GUAS[d.guaNum],
      star,
      attr: STAR_ATTRS[star],
    };
  });
}

// ============================ 形煞自查 ============================

/** 形煞类型 */
export interface XingSha {
  id: string;
  name: string;
  icon: string;
  severity: '轻' | '中' | '重';
  color: string;
  checklist: string[];      // 检测清单(用户自查)
  effect: string;           // 影响说明
  cures: {                  // 3档化解方案
    level: '基础' | '进阶' | '专业';
    method: string;
    items: string[];        // 开运好物
  }[];
}

export const XING_SHA_LIST: XingSha[] = [
  {
    id: 'luanchong', name: '路冲煞', icon: '🛣️', severity: '重', color: '#ff6b6b',
    checklist: ['住宅正对直路/走廊/巷道', '门窗外有直路冲来', '走廊尽头正对入户门'],
    effect: '主血光、意外、破财、家人不睦',
    cures: [
      { level: '基础', method: '玄关遮挡', items: ['屏风', '玄关柜'] },
      { level: '进阶', method: '铜器化煞', items: ['五帝铜钱', '铜麒麟'] },
      { level: '专业', method: '泰山石+八卦镜', items: ['泰山石敢当', '凸面八卦镜'] },
    ],
  },
  {
    id: 'tianzhan', name: '天斩煞', icon: '⛰️', severity: '重', color: '#ff6b6b',
    checklist: ['窗外两栋高楼间有狭窄缝隙正对', '缝隙如刀劈般直对住宅'],
    effect: '主血光、手术、呼吸系统疾病',
    cures: [
      { level: '基础', method: '厚窗帘遮挡', items: ['遮光厚窗帘'] },
      { level: '进阶', method: '铜器化煞', items: ['铜葫芦', '五帝铜钱'] },
      { level: '专业', method: '凸面八卦镜反射', items: ['凸面八卦镜', '铜麒麟'] },
    ],
  },
  {
    id: 'fanhui', name: '反弓煞', icon: '🏹', severity: '中', color: '#d4a853',
    checklist: ['住宅位于道路/河流弯道外侧', '弯道弧线如弓箭对准住宅'],
    effect: '主破财、感情破裂、人际关系差',
    cures: [
      { level: '基础', method: '绿植缓冲', items: ['大型绿植', '篱笆'] },
      { level: '进阶', method: '泰山石+五帝钱', items: ['泰山石敢当', '五帝铜钱'] },
      { level: '专业', method: '八卦镜+风水轮', items: ['凸面八卦镜', '铜风水轮'] },
    ],
  },
  {
    id: 'jianjiao', name: '尖角煞', icon: '🔺', severity: '中', color: '#d4a853',
    checklist: ['窗外有建筑尖角/屋檐正对', '对面楼体锐角直指住宅'],
    effect: '主口舌是非、失眠头痛、健康问题',
    cures: [
      { level: '基础', method: '窗帘遮挡+凸面镜', items: ['遮光窗帘', '小凸面镜'] },
      { level: '进阶', method: '铜葫芦化煞', items: ['铜葫芦', '五帝铜钱'] },
      { level: '专业', method: '泰山石+八卦镜', items: ['泰山石敢当', '凸面八卦镜'] },
    ],
  },
  {
    id: 'liangya', name: '梁压煞', icon: '📏', severity: '中', color: '#d4a853',
    checklist: ['床头/沙发/书桌正上方有横梁', '横梁压顶导致坐卧不安'],
    effect: '主头痛、事业压力、精神紧张',
    cures: [
      { level: '基础', method: '移位避开', items: ['床头/桌位移开横梁下方'] },
      { level: '进阶', method: '吊顶遮梁', items: ['吊顶装修', '装饰横梁包边'] },
      { level: '专业', method: '葫芦+五帝钱挂梁', items: ['铜葫芦', '五帝铜钱'] },
    ],
  },
  {
    id: 'dujian', name: '穿心煞', icon: '🗡️', severity: '重', color: '#ff6b6b',
    checklist: ['电梯/楼梯正对入户门', '门一开即见电梯或下行楼梯'],
    effect: '主破财、气场不稳、家运衰退',
    cures: [
      { level: '基础', method: '玄关遮挡', items: ['屏风', '玄关柜', '门帘'] },
      { level: '进阶', method: '五帝钱+绿植', items: ['五帝铜钱', '大型绿植'] },
      { level: '专业', method: '泰山石+八卦镜', items: ['泰山石敢当', '凸面八卦镜'] },
    ],
  },
  {
    id: 'guangsha', name: '光煞', icon: '💡', severity: '轻', color: '#a0a0b8',
    checklist: ['窗外有强光/霓虹灯/玻璃幕墙反射直射', '室内光线过强刺眼无法调节'],
    effect: '主失眠、烦躁、精神不宁',
    cures: [
      { level: '基础', method: '遮光窗帘', items: ['遮光厚窗帘', '磨砂窗贴'] },
      { level: '进阶', method: '绿植+水化解', items: ['大型绿植', '鱼缸'] },
      { level: '专业', method: '磨砂玻璃更换', items: ['磨砂玻璃窗', '百叶窗'] },
    ],
  },
  {
    id: 'shengsha', name: '声煞', icon: '🔊', severity: '轻', color: '#a0a0b8',
    checklist: ['窗外临马路/工地/广场噪音持续', '室内有水管/电器持续嗡鸣'],
    effect: '主烦躁、失眠、判断力下降',
    cures: [
      { level: '基础', method: '隔音降噪', items: ['隔音窗', '隔音门帘', '耳塞'] },
      { level: '进阶', method: '水化解+绿植', items: ['鱼缸', '大型绿植', '白噪音机'] },
      { level: '专业', method: '专业隔音工程', items: ['隔音墙', '双层中空玻璃'] },
    ],
  },
  {
    id: 'weisha', name: '孤峰煞', icon: '🏙️', severity: '中', color: '#d4a853',
    checklist: ['住宅为周边最高建筑、四周无靠', '独高楼立于矮房群中'],
    effect: '主孤立无援、事业人际受阻',
    cures: [
      { level: '基础', method: '靠山布置', items: ['山水画挂背后', '厚实靠背椅'] },
      { level: '进阶', method: '水晶+绿植聚气', items: ['黄水晶球', '大型绿植'] },
      { level: '专业', method: '风水球+泰山石', items: ['铜风水球', '泰山石敢当'] },
    ],
  },
  {
    id: 'dengxia', name: '灯柱煞', icon: '🔌', severity: '轻', color: '#a0a0b8',
    checklist: ['窗外电灯柱/信号塔/变压器正对', '大型电线杆正对门窗'],
    effect: '主脾气暴躁、暗病缠身',
    cures: [
      { level: '基础', method: '窗帘遮挡', items: ['遮光窗帘', '磨砂窗贴'] },
      { level: '进阶', method: '凸面镜反射', items: ['小凸面镜', '五帝铜钱'] },
      { level: '专业', method: '八卦镜+铜葫芦', items: ['凸面八卦镜', '铜葫芦'] },
    ],
  },
];

// ============================ 择日引擎 ============================

/** 天干 */
export const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
/** 地支 */
export const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** 建除十二神 */
export const JIAN_CHU = ['建', '除', '满', '平', '定', '执', '破', '危', '成', '收', '开', '闭'];

/** 建除值 → 吉凶宜忌 */
export const JIAN_CHU_YIJI: Record<string, { yi: string[]; ji: string[]; auspicious: '吉' | '凶' | '平' }> = {
  '建': { yi: ['谒贵', '上任', '出行'], ji: ['动土', '开仓', '嫁娶'], auspicious: '平' },
  '除': { yi: ['治病', '祭祀', '解除'], ji: ['嫁娶', '求财'], auspicious: '吉' },
  '满': { yi: ['祭祀', '祈福', '进人口'], ji: ['安葬', '动土'], auspicious: '吉' },
  '平': { yi: ['修造', '动土', '平整'], ji: ['祭祀', '祈福'], auspicious: '平' },
  '定': { yi: ['嫁娶', '冠笄', '交易'], ji: ['诉讼', '出行'], auspicious: '吉' },
  '执': { yi: ['捕捉', '打猎', '祭祀'], ji: ['开市', '搬家'], auspicious: '平' },
  '破': { yi: ['求医疗病', '破屋坏垣'], ji: ['嫁娶', '开市', '搬家'], auspicious: '凶' },
  '危': { yi: ['祭祀', '祈福', '安床'], ji: ['登山', '乘船'], auspicious: '平' },
  '成': { yi: ['嫁娶', '开市', '签约', '搬家', '入学'], ji: ['诉讼', '出行'], auspicious: '吉' },
  '收': { yi: ['纳财', '开仓', '捕捉'], ji: ['出行', '安葬'], auspicious: '吉' },
  '开': { yi: ['搬家', '开市', '祭祀', '求财', '上任'], ji: ['安葬', '破土'], auspicious: '吉' },
  '闭': { yi: ['筑堤', '塞穴', '安坟'], ji: ['开市', '嫁娶', '求财'], auspicious: '凶' },
};

/** 择日分类标签 */
export const DATE_CATEGORIES = [
  { k: 'move', icon: '🏠', name: '搬家入宅' },
  { k: 'business', icon: '💼', name: '开业签约' },
  { k: 'renovate', icon: '🔨', name: '装修动土' },
  { k: 'marry', icon: '💍', name: '嫁娶订婚' },
  { k: 'travel', icon: '✈️', name: '出行上任' },
  { k: 'finance', icon: '💰', name: '求财纳财' },
];

/** 分类 → 关键词映射(用于匹配建除宜忌) */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  move: ['搬家', '入宅', '安床'],
  business: ['开市', '签约', '交易', '上任'],
  renovate: ['修造', '动土', '平整', '筑堤'],
  marry: ['嫁娶', '冠笄'],
  travel: ['出行', '上任', '谒贵'],
  finance: ['求财', '纳财', '开仓'],
};

/**
 * 计算某日的干支(简易算法)
 * 以2000年1月7日=甲子日为锚点(儒略日)
 */
export function getDayGanZhi(year: number, month: number, day: number): { gan: string; zhi: string } {
  // 简易算法：以 2000-01-07 为甲子日，按天数递推
  const anchor = new Date(2000, 0, 7);
  const target = new Date(year, month - 1, day);
  const diff = Math.round((target.getTime() - anchor.getTime()) / 86400000);
  const ganIdx = ((diff % 10) + 10) % 10;
  const zhiIdx = ((diff % 12) + 12) % 12;
  return { gan: TIAN_GAN[ganIdx], zhi: DI_ZHI[zhiIdx] };
}

/**
 * 计算建除十二神值
 * 建除从月支起建，按日支顺序推算
 */
export function getJianChu(year: number, month: number, day: number): string {
  const { zhi } = getDayGanZhi(year, month, day);
  // 月支(农历月，此处用公历月简化映射)
  const monthZhiIdx = ((month + 1) % 12); // 简化：寅月=正月=2月左右
  const dayZhiIdx = DI_ZHI.indexOf(zhi);
  const offset = ((dayZhiIdx - monthZhiIdx) % 12 + 12) % 12;
  return JIAN_CHU[offset];
}

/** 日辰宜忌查询 */
export function getDailyYiJi(year: number, month: number, day: number): {
  gan: string; zhi: string; jianchu: string; yi: string[]; ji: string[]; auspicious: '吉' | '凶' | '平';
} {
  const { gan, zhi } = getDayGanZhi(year, month, day);
  const jc = getJianChu(year, month, day);
  const yiji = JIAN_CHU_YIJI[jc] || JIAN_CHU_YIJI['建'];
  return { gan, zhi, jianchu: jc, yi: yiji.yi, ji: yiji.ji, auspicious: yiji.auspicious };
}

/**
 * 按分类筛选吉日(从起始日起扫描N天)
 * 返回匹配该分类「宜」关键词的吉日列表
 */
export function findLuckyDates(
  startDate: Date, days: number, categoryKey: string
): { date: Date; gan: string; zhi: string; jianchu: string; yi: string[]; ji: string[]; auspicious: '吉' | '凶' | '平'; matched: string[] }[] {
  const keywords = CATEGORY_KEYWORDS[categoryKey] || [];
  const results: { date: Date; gan: string; zhi: string; jianchu: string; yi: string[]; ji: string[]; auspicious: '吉' | '凶' | '平'; matched: string[] }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const daily = getDailyYiJi(y, m, day);
    const matched = daily.yi.filter((y) => keywords.some((kw) => y.includes(kw)));
    if (matched.length > 0 && daily.auspicious !== '凶') {
      results.push({ date: d, ...daily, matched });
    }
    if (results.length >= 10) break;
  }
  return results;
}

/** 时辰吉凶(简化版：基于日干旺衰) */
export const SHICHEN = [
  { idx: 0, name: '子时', time: '23-01', zhi: '子' },
  { idx: 1, name: '丑时', time: '01-03', zhi: '丑' },
  { idx: 2, name: '寅时', time: '03-05', zhi: '寅' },
  { idx: 3, name: '卯时', time: '05-07', zhi: '卯' },
  { idx: 4, name: '辰时', time: '07-09', zhi: '辰' },
  { idx: 5, name: '巳时', time: '09-11', zhi: '巳' },
  { idx: 6, name: '午时', time: '11-13', zhi: '午' },
  { idx: 7, name: '未时', time: '13-15', zhi: '未' },
  { idx: 8, name: '申时', time: '15-17', zhi: '申' },
  { idx: 9, name: '酉时', time: '17-19', zhi: '酉' },
  { idx: 10, name: '戌时', time: '19-21', zhi: '戌' },
  { idx: 11, name: '亥时', time: '21-23', zhi: '亥' },
];

/**
 * 计算某日各时辰吉凶(基于日干生克)
 * 日干与时辰地支的生克关系定吉凶
 */
export function getShichenJiXiong(year: number, month: number, day: number): {
  name: string; time: string; zhi: string; score: number; level: '吉' | '中' | '平' | '凶'; color: string;
}[] {
  const { gan } = getDayGanZhi(year, month, day);
  const ganIdx = TIAN_GAN.indexOf(gan);
  const ganWuxing = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'][ganIdx];
  const zhiWuxingMap: Record<string, string> = {
    '子': '水', '丑': '土', '寅': '木', '卯': '木', '辰': '土', '巳': '火',
    '午': '火', '未': '土', '申': '金', '酉': '金', '戌': '土', '亥': '水',
  };
  return SHICHEN.map((sc) => {
    const zwx = zhiWuxingMap[sc.zhi];
    let score = 60;
    if (zwx === ganWuxing) score = 88;                       // 比和
    else if (isSheng(ganWuxing, zwx)) score = 82;            // 日干生时支(泄)
    else if (isSheng(zwx, ganWuxing)) score = 78;            // 时支生日干(生)
    else if (isKe(ganWuxing, zwx)) score = 55;               // 日干克时支
    else if (isKe(zwx, ganWuxing)) score = 45;               // 时支克日干
    const level = score >= 80 ? '吉' : score >= 65 ? '中' : score >= 50 ? '平' : '凶';
    const color = level === '吉' ? '#4ade80' : level === '中' ? '#d4a853' : level === '平' ? '#a0a0b8' : '#ff6b6b';
    return { name: sc.name, time: sc.time, zhi: sc.zhi, score, level, color };
  });
}

// 五行生克工具
const WX = ['金', '木', '水', '火', '土'];
// 相生: 金→水→木→火→土→金
function isSheng(a: string, b: string): boolean {
  const ai = WX.indexOf(a), bi = WX.indexOf(b);
  return (ai + 1) % 5 === bi;
}
// 相克: 金→木→土→水→火→金
function isKe(a: string, b: string): boolean {
  const ai = WX.indexOf(a), bi = WX.indexOf(b);
  return (ai + 2) % 5 === bi;
}

// ============================ 开运好物 ============================

export interface LuckyItem {
  icon: string;
  name: string;
  place: string;
  effect: string;
  wuxing: string;
}

/** 星曜 → 开运好物推荐 */
export const STAR_LUCKY_ITEMS: Record<number, LuckyItem[]> = {
  1: [ // 一白桃花官星
    { icon: '🔮', name: '紫水晶', place: '正北方', effect: '催旺桃花人缘', wuxing: '水' },
    { icon: '🔔', name: '铜风铃', place: '一白方', effect: '金生水助旺', wuxing: '金' },
  ],
  2: [ // 二黑病符
    { icon: '🪙', name: '五帝铜钱', place: '二黑方', effect: '金泄土煞', wuxing: '金' },
    { icon: '🫙', name: '铜葫芦', place: '病符方', effect: '化病化煞', wuxing: '金' },
  ],
  3: [ // 三碧是非
    { icon: '🔴', name: '红色地毯', place: '三碧方', effect: '火克木化是非', wuxing: '火' },
    { icon: '🏮', name: '红灯笼', place: '是非方', effect: '火克木镇煞', wuxing: '火' },
  ],
  4: [ // 四绿文昌
    { icon: '🎋', name: '富贵竹×4', place: '四绿方', effect: '催旺文昌学业', wuxing: '木' },
    { icon: '🏯', name: '文昌塔', place: '书桌东南方', effect: '利考试升职', wuxing: '木' },
  ],
  5: [ // 五黄煞
    { icon: '🪙', name: '五帝铜钱', place: '五黄方', effect: '金泄土大煞', wuxing: '金' },
    { icon: '🦁', name: '铜麒麟', place: '中宫五黄方', effect: '镇宅化灾煞', wuxing: '金' },
  ],
  6: [ // 六白武贵
    { icon: '💎', name: '黄水晶球', place: '六白方', effect: '催旺贵人武贵', wuxing: '土' },
    { icon: '🐴', name: '铜马', place: '西北方', effect: '利升职遇贵', wuxing: '金' },
  ],
  7: [ // 七赤破军
    { icon: '🐠', name: '鱼缸', place: '七赤方', effect: '水泄金化口舌', wuxing: '水' },
    { icon: '💧', name: '流水摆件', place: '破军方', effect: '水泄金生偏财', wuxing: '水' },
  ],
  8: [ // 八白财星
    { icon: '🏺', name: '聚宝盆', place: '八白财位', effect: '大利正财聚财', wuxing: '土' },
    { icon: '💎', name: '黄水晶球', place: '东北财位', effect: '旺财招偏财', wuxing: '土' },
    { icon: '🦔', name: '貔貅', place: '财位', effect: '招财守财', wuxing: '土' },
  ],
  9: [ // 九紫喜庆
    { icon: '🌹', name: '红色花束', place: '九紫方', effect: '催旺姻缘喜庆', wuxing: '火' },
    { icon: '💜', name: '紫水晶', place: '喜庆方', effect: '利婚嫁添丁', wuxing: '火' },
  ],
};

/** 形煞化解 → 开运好物 */
export const SHA_CURE_ITEMS: Record<string, LuckyItem[]> = {
  'luanchong': [{ icon: '🪨', name: '泰山石敢当', place: '入户门侧', effect: '挡路冲煞', wuxing: '土' }, { icon: '🪙', name: '五帝铜钱', place: '门框', effect: '化煞聚气', wuxing: '金' }],
  'tianzhan': [{ icon: '🪞', name: '凸面八卦镜', place: '窗户外侧', effect: '反射天斩煞', wuxing: '金' }, { icon: '🫙', name: '铜葫芦', place: '窗台', effect: '化煞收气', wuxing: '金' }],
  'fanhui': [{ icon: '🪨', name: '泰山石敢当', place: '反弓方位', effect: '挡反弓煞', wuxing: '土' }, { icon: '🪿', name: '铜麒麟', place: '门口', effect: '镇煞招贵', wuxing: '金' }],
  'jianjiao': [{ icon: '🫙', name: '铜葫芦', place: '窗台', effect: '收尖角煞', wuxing: '金' }, { icon: '🪞', name: '凸面镜', place: '窗外', effect: '反射尖角', wuxing: '金' }],
  'liangya': [{ icon: '🫙', name: '铜葫芦', place: '横梁下', effect: '化梁压煞', wuxing: '金' }, { icon: '🪙', name: '五帝铜钱', place: '横梁两端', effect: '泄土煞', wuxing: '金' }],
  'dujian': [{ icon: '🪞', name: '屏风', place: '入户门内', effect: '遮挡穿心煞', wuxing: '木' }, { icon: '🪙', name: '五帝铜钱', place: '门框', effect: '化煞聚气', wuxing: '金' }],
  'guangsha': [{ icon: '🪟', name: '遮光窗帘', place: '窗户', effect: '挡光煞', wuxing: '土' }, { icon: '🌵', name: '大型绿植', place: '窗台', effect: '缓冲化光', wuxing: '木' }],
  'shengsha': [{ icon: '🪟', name: '隔音窗', place: '窗户', effect: '降噪化声煞', wuxing: '金' }, { icon: '🐠', name: '鱼缸', place: '窗边', effect: '水化声煞', wuxing: '水' }],
  'weisha': [{ icon: '🖼️', name: '山水画', place: '座椅背后', effect: '做靠山补孤峰', wuxing: '土' }, { icon: '💎', name: '黄水晶球', place: '财位', effect: '聚气补气', wuxing: '土' }],
  'dengxia': [{ icon: '🪞', name: '凸面镜', place: '窗外', effect: '反射灯柱煞', wuxing: '金' }, { icon: '🪙', name: '五帝铜钱', place: '窗框', effect: '化煞', wuxing: '金' }],
};

/** 综合开运好物(家居通用) */
export const HOME_GOODS: LuckyItem[] = [
  { icon: '🪙', name: '五帝铜钱', place: '挂入户门左侧', effect: '挡煞聚气', wuxing: '金' },
  { icon: '💎', name: '黄水晶球', place: '东北财位', effect: '旺财招偏财', wuxing: '土' },
  { icon: '🌿', name: '富贵竹×4', place: '东南文昌', effect: '利学业事业', wuxing: '木' },
  { icon: '🔔', name: '铜风铃', place: '五黄方', effect: '化五黄煞', wuxing: '金' },
  { icon: '🫙', name: '铜葫芦', place: '病符方/窗台', effect: '化病化煞', wuxing: '金' },
  { icon: '🦔', name: '貔貅摆件', place: '财位', effect: '招财守财', wuxing: '土' },
];

// ============================ AI 堪舆四维 ============================

export type FengshuiDimension = 'wealth' | 'health' | 'love' | 'career';

export const DIMENSIONS: { key: FengshuiDimension; icon: string; name: string; desc: string }[] = [
  { key: 'wealth', icon: '💰', name: '财运', desc: '财位布局·催财化煞·偏正财方向' },
  { key: 'health', icon: '🌿', name: '健康', desc: '病符方位·卧室安床·健康化解' },
  { key: 'love', icon: '❤️', name: '感情', desc: '桃花位·喜庆方·姻缘催旺' },
  { key: 'career', icon: '🏆', name: '事业', desc: '官星位·贵人方·文昌催旺' },
];

/** 方位 → 五行 */
export const DIR_WUXING: Record<string, string> = {
  '正北': '水', '东北': '土', '正东': '木', '东南': '木',
  '正南': '火', '西南': '土', '正西': '金', '西北': '金', '中宫': '土',
};

/** 四维 → 关注星号 */
export const DIMENSION_STARS: Record<FengshuiDimension, number[]> = {
  wealth: [8, 6, 7],    // 八白财星 / 六白武贵 / 七赤偏财
  health: [2, 5, 1],    // 二黑病符 / 五黄煞 / 一白(也管官/身体)
  love: [9, 1],         // 九紫喜庆 / 一白桃花
  career: [6, 4, 1],    // 六白武贵 / 四绿文昌 / 一白官星
};

// ============================ 八字跨页接口 ============================

/** 从 localStorage 读取八字喜用神(由卜卦页排盘后存入) */
export interface BaziFengshuiLink {
  dayMaster: string;
  dayMasterWuxing: string;
  yongshen: { xi: string[]; ji: string[] };
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthTime: string;
  gender: string;
  shengxiao: string;
}

/** 读取 localStorage 中的八字数据 */
export function loadBaziLink(): BaziFengshuiLink | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = storage.getItem('om_fengshui_bazi_result');
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.dayMaster) return null;
    return {
      dayMaster: data.dayMaster,
      dayMasterWuxing: data.dayMasterWuxing || '',
      yongshen: data.yongshen || { xi: [], ji: [] },
      birthYear: data.birthYear || data.params?.year || 1990,
      birthMonth: data.birthMonth || data.params?.month || 1,
      birthDay: data.birthDay || data.params?.day || 1,
      birthTime: data.birthTime || data.params?.timeText || '不详',
      gender: data.gender || data.params?.gender || '男',
      shengxiao: data.shengxiao || '',
    };
  } catch {
    return null;
  }
}

/** 保存八字数据到 localStorage(供风水页读取) */
export function saveBaziLink(result: Record<string, unknown>, params: { year: number; month?: number; day?: number; timeText?: string; gender?: string }): void {
  if (typeof window === 'undefined') return;
  try {
    storage.setItem('om_fengshui_bazi_result', JSON.stringify({
      dayMaster: result.dayMaster,
      dayMasterWuxing: result.dayMasterWuxing,
      yongshen: result.yongshen,
      shengxiao: result.shengxiao,
      birthYear: params.year,
      birthMonth: params.month || 1,
      birthDay: params.day || 1,
      birthTime: params.timeText || '不详',
      gender: params.gender || '男',
    }));
  } catch { /* ignore */ }
}
