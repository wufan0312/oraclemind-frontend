// ===== 风水 · 九宫飞星数据 =====
// 从原型 js/app.js 提取（starData）

export interface StarData {
  name: string;
  luck: 'good' | 'bad';
  tag: string;
  element: string;
  domain: string;
  pos: string;
  advice: string;
}

/** 九宫飞星星曜数据（2026 年九星飞布） */
export const starData: Record<string, StarData> = {
  '一白': { name: '一白贪狼星', luck: 'good', tag: '吉 · 桃花人缘', element: '水', domain: '桃花 · 人缘 · 官运 · 求名', pos: '正东', advice: '2026 年飞临正东。催旺：正东方宜放鱼缸、水养植物、黑蓝色饰品，保持水气流通，忌炉灶火源。想提升人缘、感情运的朋友可重点布置此方位。' },
  '二黑': { name: '二黑巨门星', luck: 'bad', tag: '凶 · 病符星', element: '土', domain: '疾病 · 伤痛 · 是非', pos: '东南', advice: '2026 年飞临东南。化解：东南方保持整洁安静，忌红/黄色物品与过多绿植，宜放铜器、金属葫芦泄土气。若家人肠胃、消化系统反复不适，可检查此方位。' },
  '三碧': { name: '三碧禄存星', luck: 'bad', tag: '凶 · 蚩尤星', element: '木', domain: '口舌是非 · 官非 · 小人', pos: '正南', advice: '2026 年飞临正南。化解：正南方忌放大绿植，宜放红色饰品或以灯光照亮（火泄木气）。近期家中口角频繁、职场遇小人，可检查此方位。' },
  '四绿': { name: '四绿文曲星', luck: 'good', tag: '吉 · 文昌星', element: '木', domain: '学业 · 考试 · 功名 · 文职', pos: '东北', advice: '2026 年飞临东北，是当年的文昌位！家有考生重点布置：书桌朝向东北、放文昌塔或四支毛笔、添一盆绿植。利考试升学、写作、求学历。' },
  '五黄': { name: '五黄廉贞星', luck: 'bad', tag: '大凶 · 正关煞', element: '土', domain: '灾祸 · 血光 · 破财', pos: '西南', advice: '2026 年飞临西南，全年最凶之星。化解：西南方宜静不宜动，忌动土、装修、鱼缸、红黄物品，宜放铜铃、金属葫芦、五帝钱泄煞。此方位尽量少逗留。' },
  '六白': { name: '六白武曲星', luck: 'good', tag: '吉 · 偏财贵人', element: '金', domain: '贵人 · 偏财 · 事业晋升', pos: '西北', advice: '2026 年飞临西北。催旺：西北方放金属摆件、黄水晶、白水晶并保持明亮，利偏财投资与贵人提携。做生意的朋友可在此方位放置貔貅招财。' },
  '七赤': { name: '七赤破军星', luck: 'bad', tag: '凶 · 破财星', element: '金', domain: '破财 · 盗贼 · 口舌', pos: '正西', advice: '2026 年飞临正西。化解：正西方忌放尖锐金属、刀具摆件，宜放一杯水（金生水泄其气）。近期注意防盗、合同纠纷与冲动消费。' },
  '八白': { name: '八白左辅星', luck: 'good', tag: '大吉 · 正财星', element: '土', domain: '正财 · 置业 · 贵人 · 吉庆', pos: '正北', advice: '2026 年飞临正北，是全年财位！催旺：正北方保持明亮整洁，放聚宝盆、水晶洞、招财猫等招财物，经常在此活动；忌堆放杂物、放置垃圾桶。' },
  '九紫': { name: '九紫右弼星', luck: 'good', tag: '吉 · 喜庆星', element: '火', domain: '姻缘 · 喜庆 · 升迁 · 人丁', pos: '中宫', advice: '2026 年飞临中宫。催旺：家中中央区域保持明亮，放红色饰品、开一盏长明灯或放绿植。利婚恋喜事、事业升迁，单身者可在此方位放一束鲜花。' }
};

/** 九宫格布局：9 个宫位（顺序与原型 fengshui.html 完全一致：上排西北/正北/东北，中排正西/中宫/正东，下排西南/正南/东南） */
export interface BaguaCell {
  key: string;
  symbol: string;
  highlight?: boolean;
}

export const baguaGrid: BaguaCell[] = [
  { key: '六白', symbol: '✈️' },
  { key: '八白', symbol: '⭐', highlight: true },
  { key: '四绿', symbol: '🌀' },
  { key: '七赤', symbol: '💰' },
  { key: '九紫', symbol: '🎯' },
  { key: '一白', symbol: '📚' },
  { key: '五黄', symbol: '🌿' },
  { key: '三碧', symbol: '🔥' },
  { key: '二黑', symbol: '💎' }
];
