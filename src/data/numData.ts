// ===== 数字命理数据 =====
// 从原型 js/app.js 提取（NUM_DATA / YEAR_MEANING / NUM_COLORS / 计算工具）

export interface NumData {
  name: string;
  element: string;
  color: string;
  keywords: string;
  talent: string;
  lesson: string;
  career: string;
  mate: string;
  posi: string;
  nega: string;
  desc: string;
}

/** 1-9 数字命理数据 */
export const NUM_DATA: Record<number, NumData> = {
  1: { name: '开创者', element: '火', color: '红 · 金', keywords: '独立 · 领导 · 创造 · 自信', talent: '开创与决断', lesson: '学会合作与倾听', career: '创业者 · 管理者 · 设计师', mate: '4、6 号人最合拍', posi: '自信果敢、行动力强', nega: '固执独断、欠缺耐心', desc: '1 是万物的起点。你天生带着开创的能量，敢于从 0 到 1，是天生的开拓者。人生课题在于：在坚定自我与接纳他人之间找到平衡，学会把「我」变成「我们」。' },
  2: { name: '调和者', element: '水', color: '蓝 · 银', keywords: '合作 · 平衡 · 细腻 · 直觉', talent: '协调与共情', lesson: '避免过度依赖他人', career: '外交 · 咨询 · 护理 · 艺术', mate: '4、8 号人最合拍', posi: '温柔包容、洞察人心', nega: '优柔寡断、易被影响', desc: '2 是关系的桥梁。你天生敏感细腻，擅长感受氛围、调和矛盾，是团队里天然的润滑剂。人生课题在于：把自己的感受也放在同等重要的位置，学会说不。' },
  3: { name: '表达者', element: '木', color: '黄 · 橙', keywords: '表达 · 创意 · 社交 · 乐观', talent: '表达与创造', lesson: '专注深耕、不浅尝辄止', career: '写作 · 演艺 · 营销 · 设计', mate: '1、5 号人最合拍', posi: '才华外放、感染力强', nega: '浮夸散漫、三分钟热度', desc: '3 是语言的魔法师。你天生善于表达、灵感源源不断，走到哪里都是气氛中心。人生课题在于：把喷涌的创意沉淀成作品，学会在一件事上扎下根。' },
  4: { name: '建造者', element: '土', color: '绿 · 棕', keywords: '稳定 · 执行 · 秩序 · 可靠', talent: '规划与执行', lesson: '学会灵活应变', career: '工程 · 财务 · 行政 · 法律', mate: '2、7 号人最合拍', posi: '踏实可靠、步步为营', nega: '僵化固执、抗拒变化', desc: '4 是大地的建造者。你天生可靠、注重秩序，能把想法一步步落地成现实，是所有人最信任的伙伴。人生课题在于：在规则与变化之间留出弹性，接受世界的不可控。' },
  5: { name: '探索者', element: '火', color: '红 · 紫', keywords: '自由 · 冒险 · 应变 · 好奇', talent: '适应与突破', lesson: '学会坚持与承担', career: '旅行 · 销售 · 媒体 · 公关', mate: '3、9 号人最合拍', posi: '灵活机智、拥抱变化', nega: '逃避责任、难以安定', desc: '5 是风中的旅人。你天生向往自由、对新事物永远好奇，危机在你眼里都是转机。人生课题在于：在自由和承诺之间找到平衡，让冒险有归处。' },
  6: { name: '守护者', element: '金', color: '粉 · 白', keywords: '责任 · 关爱 · 完美 · 疗愈', talent: '照顾与疗愈', lesson: '接受不完美、适度放手', career: '教育 · 医护 · 家装 · 心理', mate: '1、9 号人最合拍', posi: '温暖负责、为爱付出', nega: '过度操心、自我牺牲', desc: '6 是家的守护星。你天生有强烈的责任感与爱的能力，总想为在乎的人撑起一片天。人生课题在于：爱别人的同时也爱自己，学会接受世间本无完美。' },
  7: { name: '智慧探索者', element: '水', color: '靛 · 紫', keywords: '思考 · 洞察 · 灵性 · 独立', talent: '分析与洞察', lesson: '学会信任直觉', career: '研究 · 科技 · 哲学 · 玄学', mate: '2、5 号人最合拍', posi: '深邃冷静、看透本质', nega: '孤僻多疑、封闭自我', desc: '7 是夜空的观星者。你天生具备深刻的洞察力和分析能力，是天生的研究者和思考者。人生课题在于：学会信任直觉，在理性与灵性之间找到平衡。' },
  8: { name: '掌舵者', element: '土', color: '黑 · 金', keywords: '权力 · 财富 · 掌控 · 格局', talent: '统筹与创造财富', lesson: '平衡物质与精神', career: '金融 · 管理 · 法律 · 创业', mate: '2、6 号人最合拍', posi: '有魄力、格局宏大', nega: '控制欲强、易被欲望牵引', desc: '8 是王座的掌权者。你天生对资源和权力敏感，有把事业做大做强的格局与手腕。人生课题在于：让财富与权力为更大的善意服务，别被数字定义。' },
  9: { name: '圆满者', element: '火', color: '白 · 红', keywords: '大爱 · 智慧 · 放下 · 慈悲', talent: '感召与成就他人', lesson: '学会放手的艺术', career: '公益 · 艺术 · 导师 · 慈善', mate: '3、6 号人最合拍', posi: '胸怀宽广、悲天悯人', nega: '过度理想化、容易心累', desc: '9 是旅程的终点站。你天生带着大爱与智慧，看得懂全局，也愿意成就别人。人生课题在于：学会放下不属于自己的责任，让慈悲不变成负担。' }
};

/** 流年含义 */
export const YEAR_MEANING: Record<number, string> = {
  1: '🌱 新开始年：开启新篇章，适合制定计划、启动新项目',
  2: '🌊 等待年：节奏放慢，合作与沉淀，不宜冒进',
  3: '🎭 表达年：社交活跃、创意表达，是被看见的一年',
  4: '🏗️ 建设年：打基础、稳扎稳打，努力开始有回报',
  5: '🌀 变动年：变化与机会流动，灵活应变、敢于尝试',
  6: '❤️ 责任年：家庭感情与责任成为重心，付出与平衡',
  7: '🔭 内省年：向内探索、学习修行，适合独处思考',
  8: '👑 收获年：事业财运迎来回报，掌控与成就之年',
  9: '🎆 完结年：收尾与放下，为下一个十年做准备'
};

/** 数字色彩 */
export const NUM_COLORS: Record<number, string> = {
  1: '红 · 金', 2: '蓝 · 银', 3: '黄 · 橙', 4: '绿 · 棕', 5: '红 · 紫',
  6: '粉 · 白', 7: '靛 · 紫', 8: '黑 · 金', 9: '白 · 红'
};

/** 数字根计算（原型 digitalRoot） */
export function digitalRoot(n: number): number {
  while (n > 9) {
    let s = 0;
    while (n > 0) { s += n % 10; n = Math.floor(n / 10); }
    n = s;
  }
  return n;
}

/** 九宫格数字计数（原型 numGridCounts） */
export function numGridCounts(y: number, m: number, d: number): Record<number, number> {
  const s = String(y) + String(m) + String(d);
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
  for (const ch of s) { if (ch >= '1' && ch <= '9') counts[+ch]++; }
  return counts;
}
