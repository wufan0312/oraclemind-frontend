/**
 * 12 星座完整数据
 * - 百科信息：性格/优点/缺点/守护星/幸运色/幸运数字/宝石/方位/最佳配对/同元素星座
 * - 速选运势：关键词/一句话运势/四维星级/幸运元素（静态降级数据，AI 可用时走 AI）
 */

export interface ZodiacSign {
  key: string;
  name: string;
  englishName: string;
  glyph: string;          // 星座符号
  dateRange: string;      // 日期范围
  element: '火' | '土' | '风' | '水';
  quality: '基本' | '固定' | '变动';
  ruler: string;          // 守护星
  symbol: string;         // 守护星符号
  personality: string;    // 性格概述
  strengths: string[];    // 优点
  weaknesses: string[];   // 缺点
  bestMatch: string[];    // 最佳配对星座
  luckyColor: string;     // 幸运色
  luckyColorHex: string;  // 幸运色 hex
  luckyNumbers: number[]; // 幸运数字
  luckyGem: string;       // 幸运宝石
  luckyDirection: string; // 幸运方位
  keyword: string;        // 核心关键词
}

export interface QuickHoroscope {
  keyword: string;
  summary: string;         // 一句话运势
  love: number;            // 爱情星级 1-5
  career: number;          // 事业星级
  wealth: number;          // 财运星级
  health: number;          // 健康星级
  loveDesc: string;        // 爱情简短说明
  careerDesc: string;      // 事业简短说明
  wealthDesc: string;      // 财运简短说明
  healthDesc: string;      // 健康简短说明
  luckyNumber: number;
  luckyColor: string;
  luckyDirection: string;
}

export const ZODIAC_SIGNS: ZodiacSign[] = [
  {
    key: 'aries', name: '白羊座', englishName: 'Aries', glyph: '♈',
    dateRange: '3月21日 - 4月19日',
    element: '火', quality: '基本', ruler: '火星', symbol: '♂',
    personality: '热情冲动、勇敢直率、行动力强，是天生的开拓者和领导者。如同初春的火焰，充满生命力和冒险精神。',
    strengths: ['勇敢果断', '行动力强', '乐观热情', '领导力', '直率真诚'],
    weaknesses: ['冲动急躁', '缺乏耐心', '自我中心', '容易与人冲突'],
    bestMatch: ['狮子座', '射手座', '双子座', '水瓶座'],
    luckyColor: '红色', luckyColorHex: '#E24B4A',
    luckyNumbers: [1, 9, 17],
    luckyGem: '红宝石',
    luckyDirection: '东方',
    keyword: '行动 · 勇气 · 开创',
  },
  {
    key: 'taurus', name: '金牛座', englishName: 'Taurus', glyph: '♉',
    dateRange: '4月20日 - 5月20日',
    element: '土', quality: '固定', ruler: '金星', symbol: '♀',
    personality: '踏实稳重、务实可靠、热爱美食与美好事物，追求感官享受和物质安全感。如同肥沃的大地，沉稳而持久。',
    strengths: ['踏实可靠', '耐心持久', '审美品味', '理财能力', '忠诚专一'],
    weaknesses: ['固执保守', '占有欲强', '贪图安逸', '变通能力差'],
    bestMatch: ['处女座', '摩羯座', '巨蟹座', '双鱼座'],
    luckyColor: '金色', luckyColorHex: '#BA7517',
    luckyNumbers: [2, 6, 18],
    luckyGem: '祖母绿',
    luckyDirection: '东北',
    keyword: '稳定 · 享受 · 坚持',
  },
  {
    key: 'gemini', name: '双子座', englishName: 'Gemini', glyph: '♊',
    dateRange: '5月21日 - 6月20日',
    element: '风', quality: '变动', ruler: '水星', symbol: '☿',
    personality: '聪明灵活、好奇善变、善于沟通表达，信息时代的弄潮儿。如同灵动的风，永远在追寻新鲜感和知识。',
    strengths: ['思维敏捷', '沟通力强', '适应力佳', '博学多才', '幽默风趣'],
    weaknesses: ['善变不定', '缺乏专注', '肤浅浮躁', '说多做少'],
    bestMatch: ['天秤座', '水瓶座', '白羊座', '狮子座'],
    luckyColor: '黄色', luckyColorHex: '#BA7517',
    luckyNumbers: [3, 5, 14],
    luckyGem: '玛瑙',
    luckyDirection: '东南',
    keyword: '沟通 · 灵活 · 好奇',
  },
  {
    key: 'cancer', name: '巨蟹座', englishName: 'Cancer', glyph: '♋',
    dateRange: '6月21日 - 7月22日',
    element: '水', quality: '基本', ruler: '月亮', symbol: '☽',
    personality: '温柔敏感、顾家重情、记忆力强，是天然的守护者和照顾者。如同潮汐，情感深邃而有节律。',
    strengths: ['温柔体贴', '记忆力强', '富有同情心', '顾家忠诚', '直觉敏锐'],
    weaknesses: ['情绪化', '多愁善感', '退缩逃避', '过度依赖'],
    bestMatch: ['双鱼座', '天蝎座', '金牛座', '处女座'],
    luckyColor: '银白色', luckyColorHex: '#888780',
    luckyNumbers: [2, 7, 9],
    luckyGem: '月光石',
    luckyDirection: '正北',
    keyword: '情感 · 家庭 · 守护',
  },
  {
    key: 'leo', name: '狮子座', englishName: 'Leo', glyph: '♌',
    dateRange: '7月23日 - 8月22日',
    element: '火', quality: '固定', ruler: '太阳', symbol: '☉',
    personality: '自信耀眼、慷慨大方、天生具有王者气质，是人群中最闪亮的存在。如同盛夏的烈日，温暖而充满力量。',
    strengths: ['自信大方', '领导才能', '慷慨热情', '创造力强', '忠诚尊严'],
    weaknesses: ['骄傲自负', '爱面子', '专横霸道', '铺张浪费'],
    bestMatch: ['白羊座', '射手座', '双子座', '天秤座'],
    luckyColor: '橙色', luckyColorHex: '#D85A30',
    luckyNumbers: [1, 8, 19],
    luckyGem: '太阳石',
    luckyDirection: '正东',
    keyword: '自信 · 光芒 · 领导',
  },
  {
    key: 'virgo', name: '处女座', englishName: 'Virgo', glyph: '♍',
    dateRange: '8月23日 - 9月22日',
    element: '土', quality: '变动', ruler: '水星', symbol: '☿',
    personality: '细致严谨、追求完美、善于分析和整理，是天生的服务者和工匠。如同精耕细作的田野，精确而有条理。',
    strengths: ['细致认真', '分析力强', '务实可靠', '服务精神', '追求完美'],
    weaknesses: ['挑剔苛刻', '焦虑紧张', '过度纠结', '吹毛求疵'],
    bestMatch: ['金牛座', '摩羯座', '巨蟹座', '天蝎座'],
    luckyColor: '藏青色', luckyColorHex: '#185FA5',
    luckyNumbers: [5, 14, 23],
    luckyGem: '蓝宝石',
    luckyDirection: '正南',
    keyword: '完美 · 分析 · 服务',
  },
  {
    key: 'libra', name: '天秤座', englishName: 'Libra', glyph: '♎',
    dateRange: '9月23日 - 10月22日',
    element: '风', quality: '基本', ruler: '金星', symbol: '♀',
    personality: '优雅和谐、追求平衡、善于交际，天生的外交官和审美家。如同秋日的金风，温和而公正。',
    strengths: ['公平公正', '审美力强', '善于交际', '优雅得体', '合作精神'],
    weaknesses: ['优柔寡断', '回避冲突', '依赖他人', '表面功夫'],
    bestMatch: ['双子座', '水瓶座', '白羊座', '狮子座'],
    luckyColor: '粉色', luckyColorHex: '#D4537E',
    luckyNumbers: [6, 9, 15],
    luckyGem: '蛋白石',
    luckyDirection: '西南',
    keyword: '平衡 · 和谐 · 优雅',
  },
  {
    key: 'scorpio', name: '天蝎座', englishName: 'Scorpio', glyph: '♏',
    dateRange: '10月23日 - 11月21日',
    element: '水', quality: '固定', ruler: '冥王星', symbol: '♇',
    personality: '深邃神秘、意志力极强、洞察力敏锐，是灵魂的炼金师。如同深不见底的海洋，表面平静而内里翻涌。',
    strengths: ['意志坚定', '洞察力强', '忠诚专一', '执行力强', '直觉敏锐'],
    weaknesses: ['多疑嫉妒', '报复心强', '极端偏执', '控制欲强'],
    bestMatch: ['巨蟹座', '双鱼座', '处女座', '摩羯座'],
    luckyColor: '深红色', luckyColorHex: '#993C1D',
    luckyNumbers: [4, 13, 21],
    luckyGem: '黑曜石',
    luckyDirection: '正北',
    keyword: '深邃 · 执着 · 重生',
  },
  {
    key: 'sagittarius', name: '射手座', englishName: 'Sagittarius', glyph: '♐',
    dateRange: '11月22日 - 12月21日',
    element: '火', quality: '变动', ruler: '木星', symbol: '♃',
    personality: '乐观豁达、热爱自由、追求真理与远方，天生的旅行家和哲学家。如同离弦之箭，永远射向更远的远方。',
    strengths: ['乐观开朗', '热爱自由', '哲学思维', '诚实直率', '冒险精神'],
    weaknesses: ['粗心大意', '不负责任', '说话太直', '难以安定'],
    bestMatch: ['白羊座', '狮子座', '天秤座', '水瓶座'],
    luckyColor: '紫色', luckyColorHex: '#534AB7',
    luckyNumbers: [3, 7, 21],
    luckyGem: '紫水晶',
    luckyDirection: '正南',
    keyword: '自由 · 探索 · 乐观',
  },
  {
    key: 'capricorn', name: '摩羯座', englishName: 'Capricorn', glyph: '♑',
    dateRange: '12月22日 - 1月19日',
    element: '土', quality: '基本', ruler: '土星', symbol: '♄',
    personality: '坚毅自律、野心勃勃、脚踏实地追求成就，是天生的建设者和管理者。如同冬日的高山，冷峻而坚不可摧。',
    strengths: ['自律坚韧', '责任心强', '务实上进', '组织力强', '耐力持久'],
    weaknesses: ['悲观严肃', '固执保守', '工作狂', '情感压抑'],
    bestMatch: ['处女座', '金牛座', '天蝎座', '双鱼座'],
    luckyColor: '黑色', luckyColorHex: '#2C2C2A',
    luckyNumbers: [8, 10, 26],
    luckyGem: '石榴石',
    luckyDirection: '正东',
    keyword: '坚韧 · 责任 · 成就',
  },
  {
    key: 'aquarius', name: '水瓶座', englishName: 'Aquarius', glyph: '♒',
    dateRange: '1月20日 - 2月18日',
    element: '风', quality: '固定', ruler: '天王星', symbol: '♅',
    personality: '独立创新、前卫特立、关心人类福祉，是未来的先知和改革者。如同冬日清冽的寒风，冷而清醒。',
    strengths: ['创新思维', '独立自主', '人道主义', '理性客观', '博爱精神'],
    weaknesses: ['疏离冷漠', '叛逆固执', '不近人情', '想法天马行空'],
    bestMatch: ['双子座', '天秤座', '白羊座', '射手座'],
    luckyColor: '蓝绿色', luckyColorHex: '#1D9E75',
    luckyNumbers: [4, 11, 22],
    luckyGem: '海蓝宝石',
    luckyDirection: '东北',
    keyword: '创新 · 独立 · 博爱',
  },
  {
    key: 'pisces', name: '双鱼座', englishName: 'Pisces', glyph: '♓',
    dateRange: '2月19日 - 3月20日',
    element: '水', quality: '变动', ruler: '海王星', symbol: '♆',
    personality: '浪漫多情、富有同情心、直觉力极强，是天生的艺术家和梦想家。如同无边的海洋，包容而神秘。',
    strengths: ['富有同情心', '艺术天赋', '直觉敏锐', '善良无私', '想象力丰富'],
    weaknesses: ['优柔寡断', '逃避现实', '过度感性', '容易上瘾'],
    bestMatch: ['巨蟹座', '天蝎座', '金牛座', '摩羯座'],
    luckyColor: '海蓝色', luckyColorHex: '#378ADD',
    luckyNumbers: [7, 12, 29],
    luckyGem: '海蓝宝石',
    luckyDirection: '东南',
    keyword: '梦幻 · 慈悲 · 直觉',
  },
];

/**
 * 根据出生月日获取太阳星座
 */
export function getSunSign(month: number, day: number): ZodiacSign {
  const ranges: [number, number, number, number, number][] = [
    // [startMonth, startDay, endMonth, endDay, signIndex]
    [3, 21, 4, 19, 0],  // 白羊
    [4, 20, 5, 20, 1],  // 金牛
    [5, 21, 6, 20, 2],  // 双子
    [6, 21, 7, 22, 3],  // 巨蟹
    [7, 23, 8, 22, 4],  // 狮子
    [8, 23, 9, 22, 5],  // 处女
    [9, 23, 10, 22, 6], // 天秤
    [10, 23, 11, 21, 7],// 天蝎
    [11, 22, 12, 21, 8],// 射手
    [12, 22, 1, 19, 9], // 摩羯
    [1, 20, 2, 18, 10], // 水瓶
    [2, 19, 3, 20, 11], // 双鱼
  ];

  for (const [sm, sd, em, ed, idx] of ranges) {
    if (sm <= em) {
      if ((month === sm && day >= sd) || (month === em && day <= ed)) {
        return ZODIAC_SIGNS[idx];
      }
    } else {
      // 跨年（摩羯 12→1）
      if ((month === sm && day >= sd) || (month === em && day <= ed)) {
        return ZODIAC_SIGNS[idx];
      }
    }
  }
  return ZODIAC_SIGNS[0]; // fallback
}

/**
 * 速选今日运势静态降级数据（AI 不可用时使用）
 * 基于星座特性的通用运势模板，每日轮转
 */
export const QUICK_HOROSCOPES: Record<string, QuickHoroscope> = {
  aries: {
    keyword: '冲劲十足',
    summary: '今天是行动的好日子，适合开启新计划，但注意与人沟通时放慢节奏。',
    love: 4, career: 5, wealth: 3, health: 4,
    loveDesc: '主动表达情感，单身者有邂逅机会。',
    careerDesc: '适合启动新项目，效率高。',
    wealthDesc: '冲动消费需克制，守住预算。',
    healthDesc: '精力旺盛，注意休息别透支。',
    luckyNumber: 9, luckyColor: '红色', luckyDirection: '东方',
  },
  taurus: {
    keyword: '稳中有进',
    summary: '财运回暖，适合处理理财事务，感情上多一些表达会让关系更近。',
    love: 3, career: 4, wealth: 5, health: 3,
    loveDesc: '多些言语表达，关系会更亲近。',
    careerDesc: '踏实推进，收获来自坚持。',
    wealthDesc: '理财运佳，适合规划投资。',
    healthDesc: '注意颈椎与咽喉，别久坐。',
    luckyNumber: 6, luckyColor: '金色', luckyDirection: '东北',
  },
  gemini: {
    keyword: '灵感迸发',
    summary: '社交运极佳，新的合作机会浮现，注意言多必失，专注一件事更有收获。',
    love: 5, career: 4, wealth: 3, health: 4,
    loveDesc: '社交场合魅力足，桃花旺盛。',
    careerDesc: '沟通合作机会多，抓住重点。',
    wealthDesc: '收入不稳，避免分散投资。',
    healthDesc: '思维活跃，保证睡眠质量。',
    luckyNumber: 5, luckyColor: '黄色', luckyDirection: '东南',
  },
  cancer: {
    keyword: '情感升温',
    summary: '家庭关系和谐，适合与家人共处，工作中注意不要把情绪带入决策。',
    love: 5, career: 3, wealth: 4, health: 3,
    loveDesc: '家庭温馨，感情稳定升温。',
    careerDesc: '别让情绪影响判断，稳住节奏。',
    wealthDesc: '家庭相关支出有回报。',
    healthDesc: '注意情绪管理，胃肠敏感。',
    luckyNumber: 2, luckyColor: '银白色', luckyDirection: '正北',
  },
  leo: {
    keyword: '光芒四射',
    summary: '今日是展示自我的好时机，贵人人缘佳，注意不要过度自信忽略细节。',
    love: 4, career: 5, wealth: 4, health: 5,
    loveDesc: '自信耀眼，吸引关注与好感。',
    careerDesc: '贵人助力强，适合展示才华。',
    wealthDesc: '正财稳定，有额外进账机会。',
    healthDesc: '精力充沛，注意别过度消耗。',
    luckyNumber: 1, luckyColor: '橙色', luckyDirection: '正东',
  },
  virgo: {
    keyword: '细节制胜',
    summary: '工作中的细致处理会带来回报，健康方面注意肠胃保养，感情宜主动。',
    love: 3, career: 5, wealth: 4, health: 3,
    loveDesc: '别太挑剔，主动一些更顺利。',
    careerDesc: '细节处理出色，获认可。',
    wealthDesc: '精打细算有回报，适合理财。',
    healthDesc: '注意肠胃保养，饮食规律。',
    luckyNumber: 5, luckyColor: '藏青色', luckyDirection: '正南',
  },
  libra: {
    keyword: '和谐顺遂',
    summary: '人际关系顺畅，适合调解矛盾或谈判，购物运不错但注意控制预算。',
    love: 5, career: 4, wealth: 3, health: 4,
    loveDesc: '魅力散发，感情和谐甜蜜。',
    careerDesc: '协调能力强，谈判有利。',
    wealthDesc: '购物欲强，注意控制预算。',
    healthDesc: '身心平衡，注意腰部保养。',
    luckyNumber: 6, luckyColor: '粉色', luckyDirection: '西南',
  },
  scorpio: {
    keyword: '洞察先机',
    summary: '直觉力敏锐的一天，适合做重要决策和投资判断，注意控制情绪波动。',
    love: 4, career: 5, wealth: 5, health: 3,
    loveDesc: '感情深邃，吸引力强。',
    careerDesc: '洞察力敏锐，决策精准。',
    wealthDesc: '投资判断准，有意外收获。',
    healthDesc: '情绪波动大，注意释压。',
    luckyNumber: 4, luckyColor: '深红色', luckyDirection: '正北',
  },
  sagittarius: {
    keyword: '自由飞扬',
    summary: '适合安排旅行或学习计划，社交活动有趣事发生，注意承诺前想清楚。',
    love: 4, career: 3, wealth: 4, health: 5,
    loveDesc: '开朗吸引人，异地桃花佳。',
    careerDesc: '适合学习拓展，别急于求成。',
    wealthDesc: '旅途或学习有意外进账。',
    healthDesc: '活力充沛，户外运动有益。',
    luckyNumber: 3, luckyColor: '紫色', luckyDirection: '正南',
  },
  capricorn: {
    keyword: '稳扎稳打',
    summary: '事业上有贵人助力，适合推进长期计划，感情上多一些温度和柔软。',
    love: 3, career: 5, wealth: 4, health: 4,
    loveDesc: '别太严肃，多一些柔软和温度。',
    careerDesc: '贵人助力，长期计划有进展。',
    wealthDesc: '稳健理财，长期投资有利。',
    healthDesc: '注意骨骼关节，别过度劳累。',
    luckyNumber: 8, luckyColor: '黑色', luckyDirection: '正东',
  },
  aquarius: {
    keyword: '创意涌动',
    summary: '灵感丰富的日子，适合头脑风暴和创新项目，感情上多一些亲近感。',
    love: 3, career: 4, wealth: 3, health: 5,
    loveDesc: '独特魅力吸引志同道合的人。',
    careerDesc: '创意灵感多，适合创新项目。',
    wealthDesc: '收入不稳，别跟风投资。',
    healthDesc: '身心状态佳，注意腿部循环。',
    luckyNumber: 4, luckyColor: '蓝绿色', luckyDirection: '东北',
  },
  pisces: {
    keyword: '直觉超群',
    summary: '艺术和灵性方面的体验很好，感情甜蜜，工作中注意分清现实与幻想。',
    love: 5, career: 3, wealth: 4, health: 4,
    loveDesc: '感情甜蜜浪漫，直觉敏锐。',
    careerDesc: '别沉溺幻想，专注现实任务。',
    wealthDesc: '偏财运佳，有意外小收获。',
    healthDesc: '注意水分代谢，别过度感性。',
    luckyNumber: 7, luckyColor: '海蓝色', luckyDirection: '东南',
  },
};

/**
 * 元素分组（同元素星座天然和谐）
 */
export const ELEMENT_GROUPS: Record<string, string[]> = {
  '火': ['白羊座', '狮子座', '射手座'],
  '土': ['金牛座', '处女座', '摩羯座'],
  '风': ['双子座', '天秤座', '水瓶座'],
  '水': ['巨蟹座', '天蝎座', '双鱼座'],
};

/**
 * 配对兼容度速查表（百分比，对称）
 */
export const COMPATIBILITY_MATRIX: Record<string, Record<string, number>> = {
  '白羊座': { '金牛座': 55, '双子座': 85, '巨蟹座': 45, '狮子座': 95, '处女座': 50, '天秤座': 70, '天蝎座': 48, '射手座': 93, '摩羯座': 52, '水瓶座': 87, '双鱼座': 58, '白羊座': 75 },
  '金牛座': { '白羊座': 55, '双子座': 50, '巨蟹座': 85, '狮子座': 55, '处女座': 95, '天秤座': 60, '天蝎座': 62, '射手座': 48, '摩羯座': 93, '水瓶座': 42, '双鱼座': 87, '金牛座': 78 },
  '双子座': { '白羊座': 85, '金牛座': 50, '巨蟹座': 52, '狮子座': 87, '处女座': 48, '天秤座': 95, '天蝎座': 45, '射手座': 68, '摩羯座': 45, '水瓶座': 93, '双鱼座': 50, '双子座': 78 },
  '巨蟹座': { '白羊座': 45, '金牛座': 85, '双子座': 52, '狮子座': 48, '处女座': 87, '天秤座': 50, '天蝎座': 93, '射手座': 45, '摩羯座': 55, '水瓶座': 42, '双鱼座': 95, '巨蟹座': 78 },
  '狮子座': { '白羊座': 95, '金牛座': 55, '双子座': 87, '巨蟹座': 48, '处女座': 52, '天秤座': 87, '天蝎座': 45, '射手座': 93, '摩羯座': 48, '水瓶座': 68, '双鱼座': 50, '狮子座': 78 },
  '处女座': { '白羊座': 50, '金牛座': 95, '双子座': 48, '巨蟹座': 87, '狮子座': 52, '天秤座': 55, '天蝎座': 87, '射手座': 45, '摩羯座': 93, '水瓶座': 42, '双鱼座': 58, '处女座': 78 },
  '天秤座': { '白羊座': 70, '金牛座': 60, '双子座': 95, '巨蟹座': 50, '狮子座': 87, '处女座': 55, '天蝎座': 52, '射手座': 85, '摩羯座': 50, '水瓶座': 93, '双鱼座': 55, '天秤座': 78 },
  '天蝎座': { '白羊座': 48, '金牛座': 62, '双子座': 45, '巨蟹座': 93, '狮子座': 45, '处女座': 87, '天秤座': 52, '射手座': 45, '摩羯座': 87, '水瓶座': 42, '双鱼座': 93, '天蝎座': 80 },
  '射手座': { '白羊座': 93, '金牛座': 48, '双子座': 68, '巨蟹座': 45, '狮子座': 93, '处女座': 45, '天秤座': 85, '天蝎座': 45, '摩羯座': 48, '水瓶座': 87, '双鱼座': 50, '射手座': 78 },
  '摩羯座': { '白羊座': 52, '金牛座': 93, '双子座': 45, '巨蟹座': 55, '狮子座': 48, '处女座': 93, '天秤座': 50, '天蝎座': 87, '射手座': 48, '水瓶座': 45, '双鱼座': 87, '摩羯座': 78 },
  '水瓶座': { '白羊座': 87, '金牛座': 42, '双子座': 93, '巨蟹座': 42, '狮子座': 68, '处女座': 42, '天秤座': 93, '天蝎座': 42, '射手座': 87, '摩羯座': 45, '双鱼座': 48, '水瓶座': 80 },
  '双鱼座': { '白羊座': 58, '金牛座': 87, '双子座': 50, '巨蟹座': 95, '狮子座': 50, '处女座': 58, '天秤座': 55, '天蝎座': 93, '射手座': 50, '摩羯座': 87, '水瓶座': 48, '双鱼座': 82 },
};

/**
 * 获取两个星座的配对百分比
 */
export function getCompatibility(sign1: string, sign2: string): number {
  return COMPATIBILITY_MATRIX[sign1]?.[sign2] ?? 60;
}
