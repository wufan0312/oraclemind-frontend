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
  '一白': { name: '一白贪狼星', luck: 'good', tag: '吉 · 桃花人缘', element: '水', domain: '桃花 · 人缘 · 官运 · 求名', pos: '正东', advice: '2026 年飞临正东，五行属水，传统上关联人缘、沟通与名望。此方位宜保持水气流通、整洁明亮。' },
  '二黑': { name: '二黑巨门星', luck: 'bad', tag: '二黑 · 土星', element: '土', domain: '健康 · 安宁 · 人际', pos: '东南', advice: '2026 年飞临东南，五行属土。此方位宜保持整洁安静。' },
  '三碧': { name: '三碧禄存星', luck: 'bad', tag: '三碧 · 木星', element: '木', domain: '沟通 · 人际 · 文书', pos: '正南', advice: '2026 年飞临正南，五行属木。此方位宜保持通透有序。' },
  '四绿': { name: '四绿文曲星', luck: 'good', tag: '吉 · 文昌星', element: '木', domain: '学业 · 考试 · 功名 · 文职', pos: '东北', advice: '2026 年飞临东北，为传统文昌位，利静心学习与写作。' },
  '五黄': { name: '五黄廉贞星', luck: 'bad', tag: '五黄 · 土星', element: '土', domain: '稳妥 · 安宁 · 守成', pos: '西南', advice: '2026 年飞临西南，五行属土。此方位宜保持安静、减少大型变动。' },
  '六白': { name: '六白武曲星', luck: 'good', tag: '吉 · 偏财贵人', element: '金', domain: '贵人 · 偏财 · 事业晋升', pos: '西北', advice: '2026 年飞临西北，五行属金，传统关联事业与人际。' },
  '七赤': { name: '七赤破军星', luck: 'bad', tag: '七赤 · 金星', element: '金', domain: '人际 · 沟通 · 财务', pos: '正西', advice: '2026 年飞临正西，五行属金。' },
  '八白': { name: '八白左辅星', luck: 'good', tag: '大吉 · 正财星', element: '土', domain: '正财 · 置业 · 贵人 · 吉庆', pos: '正北', advice: '2026 年飞临正北，五行属土，传统关联财富与安定。此方位宜整洁。' },
  '九紫': { name: '九紫右弼星', luck: 'good', tag: '吉 · 喜庆星', element: '火', domain: '姻缘 · 喜庆 · 升迁 · 人丁', pos: '中宫', advice: '2026 年飞临中宫，五行属火，传统关联人际喜事。' }
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
