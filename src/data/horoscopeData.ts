/**
 * 星座页数据模块 —— 从原型 js/app.js ZODIAC_DATA / PLANET_DATA 提取
 */

export interface ZodiacTri {
  sign: string;
  keywords: string;
}

export interface ZodiacMatch {
  best: string;
  friend: string;
  hard: string;
}

export interface ZodiacData {
  key: string;
  name: string;
  symbol: string;
  date: string;
  element: string;
  ruler: string;
  keywords: string;
  domain: string;
  moon: ZodiacTri;
  rising: ZodiacTri;
  today: string;
  week: string;
  month: string;
  lucky: { color: string; num: string; person: string; good: string };
  match: ZodiacMatch;
  ai: { title: string; p1: string; p2: string; p3: string };
}

/** 12 星座完整数据（默认选中：巨蟹座，与原型一致） */
export const ZODIAC_DATA: Record<string, ZodiacData> = {
  aries: { key: 'aries', name: '白羊座', symbol: '♈', date: '3.21-4.19', element: '火', ruler: '火星', keywords: '勇敢 · 直接 · 行动派', domain: '自我突破',
    moon: { sign: '狮子座', keywords: '热烈 · 自信 · 表现欲' }, rising: { sign: '射手座', keywords: '乐观 · 自由 · 直率' },
    today: '火星能量充沛，适合推进搁置已久的计划。开口前先想三秒，避免冲动伤人。',
    week: '职场贵人运走高，周中可能接到重要任务。注意控制急躁，好结果需要耐心打磨。',
    month: '木星加持节奏加快，月中前后可能出现跳槽或项目主导机会，大胆争取别犹豫。',
    lucky: { color: '烈焰红', num: '9', person: '狮子座', good: '运动 · 开创 · 表白' },
    match: { best: '狮子座 · 射手座', friend: '双子座 · 水瓶座', hard: '巨蟹座 · 摩羯座' },
    ai: { title: '太阳白羊 + 月亮狮子 + 上升射手', p1: '火象三连的配置，行动力与自信拉满，是典型的「先冲再说」型人格。', p2: '上升射手让你在人群中显得乐观洒脱，但月亮狮子渴望被看见——你其实很需要掌声。', p3: '2026年下半年火星进入你的合作宫，事业与感情都要学会「借力」，单打独斗的日子该结束了。' } },
  taurus: { key: 'taurus', name: '金牛座', symbol: '♉', date: '4.20-5.20', element: '土', ruler: '金星', keywords: '稳健 · 务实 · 重享受', domain: '稳定积累',
    moon: { sign: '处女座', keywords: '细腻 · 挑剔 · 服务心' }, rising: { sign: '天秤座', keywords: '温和 · 得体 · 社交' },
    today: '适合处理财务与整理事务，金星加持审美在线。别抗拒变化，小步调整更轻松。',
    week: '财运稳步回升，投资理财宜求稳。周末适合犒赏自己，一顿美食治愈一周疲惫。',
    month: '土星守护事业宫，晋升机会显现。坚持长期主义，月底能看到积累的回报。',
    lucky: { color: '翡翠绿', num: '6', person: '处女座', good: '理财 · 收纳 · 美食' },
    match: { best: '处女座 · 摩羯座', friend: '巨蟹座 · 双鱼座', hard: '狮子座 · 水瓶座' },
    ai: { title: '太阳金牛 + 月亮处女 + 上升天秤', p1: '土象基底加月亮处女，追求秩序与质感，慢热但极靠谱。', p2: '上升天秤给了你柔和的社交外壳，让人第一眼觉得亲切好相处。', p3: '2026下半年木星点亮财务宫，偏财运值得期待，但别为短期利益放弃长期原则。' } },
  gemini: { key: 'gemini', name: '双子座', symbol: '♊', date: '5.21-6.20', element: '风', ruler: '水星', keywords: '机智 · 好奇 · 善变', domain: '表达与连接',
    moon: { sign: '水瓶座', keywords: '理性 · 疏离 · 独立' }, rising: { sign: '处女座', keywords: '严谨 · 细致 · 分析' },
    today: '水星活跃，沟通效率超高，适合谈判与学习。信息过载时记得给自己留白。',
    week: '社交应酬增多，人脉带来新机会。注意专注力分散，重要事项列清单逐项完成。',
    month: '创意与表达力被激发，副业或自媒体有起色。月中需防口舌，谨言慎行。',
    lucky: { color: '柠檬黄', num: '5', person: '水瓶座', good: '社交 · 学习 · 表达' },
    match: { best: '天秤座 · 水瓶座', friend: '白羊座 · 狮子座', hard: '处女座 · 双鱼座' },
    ai: { title: '太阳双子 + 月亮水瓶 + 上升处女', p1: '风象双子的典型，思维快、好奇心强，是人群里的「信息枢纽」。', p2: '月亮水瓶让你内心其实疏离，热闹背后常想独处；上升处女帮你把灵感落地成方案。', p3: '2026下半年土星过境沟通宫，深耕一个领域比广撒网更有利。' } },
  cancer: { key: 'cancer', name: '巨蟹座', symbol: '♋', date: '6.21-7.22', element: '水', ruler: '月亮', keywords: '情感丰富 · 顾家 · 直觉', domain: '家庭与归属',
    moon: { sign: '双鱼座', keywords: '敏感 · 共情 · 梦幻' }, rising: { sign: '天秤座', keywords: '优雅 · 得体 · 社交' },
    today: '月亮进入天蝎，情感波动较大。适合独处反思，不宜做重大决定。',
    week: '水星与金星形成三分相，沟通能力增强，是表白或修复关系的好时机。',
    month: '木星守护，整体运势上升。事业有突破机会，注意抓住8月中旬的贵人运。',
    lucky: { color: '银白', num: '2', person: '双鱼座', good: '独处 · 写日记 · 陪伴家人' },
    match: { best: '天蝎座 · 双鱼座', friend: '金牛座 · 处女座', hard: '白羊座 · 摩羯座' },
    ai: { title: '太阳巨蟹 + 月亮双鱼 + 上升天秤', p1: '典型的「水象三重奏」——情感深度极高，共情能力超强，但容易内耗。', p2: '上升天秤给了你一层「社交滤镜」，外人看你优雅从容，其实内心波涛汹涌。', p3: '2026年下半年，土星离开你的事业宫，压力减轻，可以开始为自己而活。' } },
  leo: { key: 'leo', name: '狮子座', symbol: '♌', date: '7.23-8.22', element: '火', ruler: '太阳', keywords: '自信 · 慷慨 · 领导力', domain: '创造与认可',
    moon: { sign: '白羊座', keywords: '直率 · 冲动 · 行动' }, rising: { sign: '天蝎座', keywords: '神秘 · 深沉 · 洞察' },
    today: '太阳能量全开，适合站在台前表现。留意他人感受，别让光芒刺到身边人。',
    week: '事业迎来高光时刻，提案易获认可。感情上主动表达，对方等你开口很久了。',
    month: '金星进入自我宫，魅力值飙升。月底留意合作邀约，贵人就在朋友圈里。',
    lucky: { color: '金橙', num: '1', person: '白羊座', good: '展示 · 领导 · 约会' },
    match: { best: '白羊座 · 射手座', friend: '双子座 · 天秤座', hard: '金牛座 · 天蝎座' },
    ai: { title: '太阳狮子 + 月亮白羊 + 上升天蝎', p1: '太阳守护的王者配置，天然自带舞台，走到哪里都是焦点。', p2: '月亮白羊让你行动比思考快，上升天蝎则给锋芒加了层神秘滤镜。', p3: '2026下半年天王星激活社交宫，大胆跳出舒适圈会有意外收获。' } },
  virgo: { key: 'virgo', name: '处女座', symbol: '♍', date: '8.23-9.22', element: '土', ruler: '水星', keywords: '细致 · 完美主义 · 服务', domain: '精进与服务',
    moon: { sign: '摩羯座', keywords: '自律 · 克制 · 务实' }, rising: { sign: '双鱼座', keywords: '温柔 · 梦幻 · 包容' },
    today: '适合复盘与精进，把细节打磨到位。对人对己都温柔一点，完美主义别压垮自己。',
    week: '工作效率高，能啃下硬骨头。健康运需关注，规律作息比咖啡因更提神。',
    month: '土星加持事业稳健，年中考核有惊喜。感情上别太理性，适当感性更迷人。',
    lucky: { color: '燕麦色', num: '5', person: '摩羯座', good: '复盘 · 整理 · 养生' },
    match: { best: '金牛座 · 摩羯座', friend: '巨蟹座 · 天蝎座', hard: '双子座 · 射手座' },
    ai: { title: '太阳处女 + 月亮摩羯 + 上升双鱼', p1: '土象的严谨加月亮摩羯的自律，你是最可靠的执行者。', p2: '上升双鱼柔化了你的棱角，让挑剔显得温柔。', p3: '2026下半年木星点亮事业宫，专业价值会被看见——别再默默付出，记得主动展示。' } },
  libra: { key: 'libra', name: '天秤座', symbol: '♎', date: '9.23-10.22', element: '风', ruler: '金星', keywords: '优雅 · 平衡 · 社交', domain: '关系与平衡',
    moon: { sign: '双子座', keywords: '好奇 · 善变 · 表达' }, rising: { sign: '狮子座', keywords: '自信 · 耀眼 · 大方' },
    today: '金星加持人际和谐，适合谈合作与约会。别为迎合他人委屈自己，平衡是双向的。',
    week: '团队协作顺畅，你的调和能力是关键。注意决策拖延，小事别纠结太久。',
    month: '关系宫位能量强，单身者桃花运旺。月中适合推进签约、合作类事项。',
    lucky: { color: '淡粉', num: '6', person: '狮子座', good: '社交 · 合作 · 美学' },
    match: { best: '双子座 · 水瓶座', friend: '狮子座 · 射手座', hard: '巨蟹座 · 摩羯座' },
    ai: { title: '太阳天秤 + 月亮双子 + 上升狮子', p1: '风象的优雅调和者，天生懂分寸，是朋友圈的「润滑剂」。', p2: '月亮双子让你思维活跃，上升狮子则透出贵气与主场感。', p3: '2026下半年火星过境伴侣宫，关系议题集中爆发——直面它，反而让感情升温。' } },
  scorpio: { key: 'scorpio', name: '天蝎座', symbol: '♏', date: '10.23-11.21', element: '水', ruler: '冥王星', keywords: '深沉 · 专注 · 洞察', domain: '深度与蜕变',
    moon: { sign: '巨蟹座', keywords: '依恋 · 敏感 · 守护' }, rising: { sign: '摩羯座', keywords: '沉稳 · 克制 · 目标' },
    today: '直觉异常敏锐，适合处理复杂问题。情绪暗流涌动时，先给自己一个安全出口。',
    week: '深度思考带来破局灵感，适合研究型工作。关系里适当示弱，反而赢得信任。',
    month: '冥王星加持，人生进入蜕变期。旧模式被打破，月底会迎来重要转折。',
    lucky: { color: '深紫红', num: '8', person: '巨蟹座', good: '研究 · 断舍离 · 深度对话' },
    match: { best: '巨蟹座 · 双鱼座', friend: '处女座 · 摩羯座', hard: '狮子座 · 水瓶座' },
    ai: { title: '太阳天蝎 + 月亮巨蟹 + 上升摩羯', p1: '水象的极致深度，看人看事一针见血，藏不住秘密也藏得住心事。', p2: '月亮巨蟹让你在信任的人面前卸下盔甲，上升摩羯则是外冷内热的现实面。', p3: '2026下半年天王星过境自我宫，学会放下控制欲是重要课题。' } },
  sagittarius: { key: 'sagittarius', name: '射手座', symbol: '♐', date: '11.22-12.21', element: '火', ruler: '木星', keywords: '乐观 · 自由 · 冒险', domain: '远方与意义',
    moon: { sign: '白羊座', keywords: '热忱 · 直接 · 冲劲' }, rising: { sign: '双子座', keywords: '灵巧 · 活泼 · 沟通' },
    today: '木星能量注入，适合探索新事物。远方或学习计划可以开始，别让犹豫困住脚步。',
    week: '出差或出游运强，旅途中或有意外收获。财务上注意冲动消费，记账更稳妥。',
    month: '事业视野打开，跨界机会出现。感情上坦诚相待，你的真诚是最强吸引力。',
    lucky: { color: '宝蓝', num: '3', person: '双子座', good: '旅行 · 学习 · 冒险' },
    match: { best: '白羊座 · 狮子座', friend: '天秤座 · 水瓶座', hard: '处女座 · 双鱼座' },
    ai: { title: '太阳射手 + 月亮白羊 + 上升双子', p1: '木星守护的乐天派，天生向往远方，烦恼很少过夜。', p2: '月亮白羊让热情说走就走，上升双子让你在人群中游刃有余。', p3: '2026下半年土星过境家庭宫，漂泊的心需要安放，「家」会成为新课题。' } },
  capricorn: { key: 'capricorn', name: '摩羯座', symbol: '♑', date: '12.22-1.19', element: '土', ruler: '土星', keywords: '坚韧 · 自律 · 野心', domain: '事业与秩序',
    moon: { sign: '天蝎座', keywords: '深沉 · 执着 · 掌控' }, rising: { sign: '天秤座', keywords: '得体 · 分寸 · 平衡' },
    today: '适合推进长期项目，专注力是今天的王牌。别把所有压力扛在肩上，学会分担。',
    week: '事业运稳步上行，领导会看到你的价值。注意身体信号，别用熬夜换进度。',
    month: '土星回馈耕耘期，年终考核有望大丰收。感情上慢热但有进展，主动约一次吧。',
    lucky: { color: '墨黑', num: '8', person: '天蝎座', good: '规划 · 攻坚 · 复盘' },
    match: { best: '金牛座 · 处女座', friend: '天蝎座 · 双鱼座', hard: '白羊座 · 天秤座' },
    ai: { title: '太阳摩羯 + 月亮天蝎 + 上升天秤', p1: '土星的坚韧加月亮天蝎的深沉，你是暗夜里的攀登者，从不轻言放弃。', p2: '上升天秤给野心披上得体外衣，进退有度。', p3: '2026下半年木星点亮偏财宫，多年的积累开始变现——记得允许自己享受成果。' } },
  aquarius: { key: 'aquarius', name: '水瓶座', symbol: '♒', date: '1.20-2.18', element: '风', ruler: '天王星', keywords: '独立 · 创新 · 博爱', domain: '创新与独立',
    moon: { sign: '狮子座', keywords: '骄傲 · 热烈 · 表达' }, rising: { sign: '天蝎座', keywords: '神秘 · 冷静 · 洞察' },
    today: '创意灵感迸发，适合头脑风暴。独立精神旺盛，但团队协作时记得收起锋芒。',
    week: '新奇想法带来关注，别怕标新立异。友情运佳，老友可能带来事业新线索。',
    month: '天王星激活事业宫，转型或跨界机会出现。保持开放，惊喜往往来自计划之外。',
    lucky: { color: '电光蓝', num: '4', person: '狮子座', good: '创新 · 社交 · 公益活动' },
    match: { best: '双子座 · 天秤座', friend: '白羊座 · 射手座', hard: '金牛座 · 天蝎座' },
    ai: { title: '太阳水瓶 + 月亮狮子 + 上升天蝎', p1: '风象的独立思考者，永远超前半步，讨厌被定义。', p2: '月亮狮子让你渴望表达与认可，上升天蝎给理想主义加了深沉底色。', p3: '2026下半年土星过境自我宫，把理想主义落地成具体计划，是本年最重要的功课。' } },
  pisces: { key: 'pisces', name: '双鱼座', symbol: '♓', date: '2.19-3.20', element: '水', ruler: '海王星', keywords: '共情 · 梦幻 · 艺术', domain: '共情与灵性',
    moon: { sign: '天秤座', keywords: '温和 · 平衡 · 美化' }, rising: { sign: '巨蟹座', keywords: '温柔 · 敏感 · 顾家' },
    today: '直觉与灵感在线，适合艺术创作与疗愈。边界感要守住，别把别人的情绪全接过来。',
    week: '贵人运浮现，迷茫时不妨向信任的人求助。睡眠质量影响状态，早点休息。',
    month: '海王星加持想象力，创意项目开花结果。感情上遇到同频的人，慢慢来比较快。',
    lucky: { color: '海蓝', num: '7', person: '巨蟹座', good: '创作 · 冥想 · 助人' },
    match: { best: '巨蟹座 · 天蝎座', friend: '金牛座 · 摩羯座', hard: '双子座 · 射手座' },
    ai: { title: '太阳双鱼 + 月亮天秤 + 上升巨蟹', p1: '海王星守护的梦幻体质，共情力是天赋也是负担。', p2: '月亮天秤让你习惯美化一切，上升巨蟹给人邻家般的温暖。', p3: '2026下半年火星过境财帛宫，别让浪漫主义影响现实决策，理性记账更重要。' } }
};

/** 星盘行星（SVG 位置 + 颜色 + 符号 + 解读模板） */
export interface PlanetData {
  key: string;
  sym: string;
  name: string;
  base: string;
  signText?: string;
  fixText?: string;
  x: number;
  y: number;
  color: string;
}

export const PLANET_DATA: Record<string, PlanetData> = {
  sun:     { key: 'sun', sym: '☉', name: '太阳', base: '核心自我 · 生命力 · 人生目标', x: 250, y: 120, color: '#ff6b6b' },
  moon:    { key: 'moon', sym: '☽', name: '月亮', base: '情绪 · 潜意识 · 安全感', x: 100, y: 200, color: '#5ce1e6' },
  mercury: { key: 'mercury', sym: '☿', name: '水星', base: '思维 · 沟通 · 学习表达', signText: '水星落命盘第三宫，', fixText: '沟通、学习与信息整合正在成为你的破局点。', x: 200, y: 280, color: '#d4a853' },
  venus:   { key: 'venus', sym: '♀', name: '金星', base: '爱情 · 审美 · 价值观', signText: '金星落命盘第七宫，', fixText: '关系与审美领域近期能量活跃，值得主动经营。', x: 300, y: 220, color: '#a78bfa' },
  mars:    { key: 'mars', sym: '♂', name: '火星', base: '行动力 · 欲望 · 勇气', signText: '火星落命盘第十宫，', fixText: '事业上的冲劲被激活，适合主动出击。', x: 150, y: 80, color: '#4ade80' },
  jupiter: { key: 'jupiter', sym: '♃', name: '木星', base: '幸运 · 扩张 · 贵人', signText: '木星落命盘第十一宫，', fixText: '贵人运与社交圈扩张是本年的主线。', x: 280, y: 50, color: '#ff6b9d' }
};

/** 星座小知识（静态 5 条，text 支持 HTML） */
export const ZODIAC_FACTS: { icon: string; text: string }[] = [
  { icon: '🌍', text: '黄道十二宫是太阳一年绕行的轨迹，恰好每月经过一个星座，「你是什么星座」问的其实是太阳位置' },
  { icon: '🔥', text: '十二星座分四象：<strong style="color:var(--text-primary)">火</strong>白羊狮子射手 · <strong style="color:var(--text-primary)">土</strong>金牛处女摩羯 · <strong style="color:var(--text-primary)">风</strong>双子天秤水瓶 · <strong style="color:var(--text-primary)">水</strong>巨蟹天蝎双鱼' },
  { icon: '🌟', text: '每个星座都有守护星：白羊—火星、金牛—金星、双子—水星、巨蟹—月亮、狮子—太阳、处女—水星、天秤—金星、天蝎—冥王星、射手—木星、摩羯—土星、水瓶—天王星、双鱼—海王星' },
  { icon: '🌙', text: '「上升星座」是出生那一刻东方地平线升起的星座，决定你的外在气质与第一印象' },
  { icon: '🎭', text: '为什么同星座的人性格差很多？因为完整星盘 = 太阳 + 月亮 + 上升 + 水金火木土… 十颗行星的复杂组合' }
];
