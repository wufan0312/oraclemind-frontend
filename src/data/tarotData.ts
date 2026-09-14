import { storage } from '../lib/storage';

// ===== 塔罗 · 牌阵与牌库数据 =====
// 牌库：完整 78 张（22 张大阿卡纳 + 56 张小阿卡纳），含正逆位解读与关键词
// 抽牌：确定性种子（mulberry32 + FNV-1a），调用方可附加 nonce 支持「再抽一次」

/** 花色：大阿卡纳 / 权杖（火）/ 圣杯（水）/ 宝剑（风）/ 星币（土） */
export type TarotSuit = 'major' | 'wands' | 'cups' | 'swords' | 'pentacles';

export interface TarotCard {
  /** 展示符号 */
  sym: string;
  /** 正位牌义（一句话） */
  upright: string;
  /** 逆位牌义（一句话） */
  rev: string;
  /** 关键词 */
  kw: string[];
  /** 花色 */
  suit: TarotSuit;
  /** 编号（大阿卡纳 0-21，小阿卡纳 1-14） */
  num: number;
  /**
   * 元素。注意语义分两套：
   *  - 大阿卡纳（suit='major'）：存的是**占星对应**（水星 / 月亮 / 金牛 / 白羊…），
   *    UI 展示时应标注为「占星对应」，不能写成「元素」；
   *  - 小阿卡纳：存四元素（火 / 水 / 风 / 土）。
   */
  element: string;
}

export interface SpreadInfo {
  name: string;
  count: number;
  /** 牌阵图标（emoji），统一随数据存放，避免再跨数组查 */
  icon: string;
  /** 适合场景：新手引导用，回答「什么情况选它」；与 positionDesc（牌位含义）语义不同 */
  scene: string;
  positions: string[];
  desc: string;
  /** 每个牌位的含义说明（与 positions 一一对应） */
  positionDesc: string[];
}

export interface DrawnCard extends TarotCard {
  name: string;
  isRev: boolean;
  pos: string;
  /** 该牌位的含义说明 */
  posDesc: string;
}

// ==================== 牌阵（5 种） ====================

export const spreadData: Record<string, SpreadInfo> = {
  time: {
    name: '时间之流', count: 3, icon: '🔮', scene: '一件事的发展脉络',
    positions: ['过去', '现在', '未来'],
    desc: '过去 → 现在 → 未来',
    positionDesc: [
      '事情的起因与已埋下的伏笔',
      '当前真实处境与你的状态',
      '按现有轨迹发展下去的走向'
    ]
  },
  choice: {
    name: '二选一', count: 5, icon: '⚖️', scene: 'A / B 两个选项对比',
    positions: ['现状', 'A选项优势', 'A选项风险', 'B选项优势', 'B选项风险'],
    desc: 'A选项 vs B选项对比',
    positionDesc: [
      '你此刻的立足点与真正诉求',
      '选 A 能拿到的收益与助力',
      '选 A 要付出的代价与隐患',
      '选 B 能拿到的收益与助力',
      '选 B 要付出的代价与隐患'
    ]
  },
  love: {
    name: '感情关系', count: 5, icon: '💞', scene: '两个人之间的关系',
    positions: ['你', '对方', '关系现状', '阻碍', '结果'],
    desc: '你 · 对方 · 关系 · 阻碍 · 结果',
    positionDesc: [
      '你在这段关系里的真实状态与期待',
      '对方的想法、态度与未说出口的部分',
      '两人之间当下的互动与能量场',
      '卡住这段关系的核心问题',
      '顺此发展的可能结局'
    ]
  },
  celtic: {
    name: '凯尔特十字', count: 10, icon: '🏆', scene: '复杂局面的全面剖析',
    positions: ['现状', '阻碍', '潜意识', '过去', '目标', '未来', '你的态度', '环境', '希望与恐惧', '结果'],
    desc: '深度全面分析',
    positionDesc: [
      '问题的核心与当下处境（1 号位，十字中心）',
      '横亘在眼前的阻碍或助力（2 号位，横跨 1 号位）',
      '你没意识到的深层动机（3 号位，1 号位下方）',
      '刚刚过去、正在消散的影响（4 号位，1 号位左侧）',
      '你意识层面追求的目标（5 号位，1 号位上方）',
      '即将到来的近期发展（6 号位，1 号位右侧）',
      '你对这件事的态度与自我定位（7 号位，竖列底）',
      '外界环境与他人对你的影响（8 号位，竖列自下第二）',
      '你内心的期待与担忧（9 号位，竖列自下第三）',
      '综合以上能量的最终结果（10 号位，竖列顶端）'
    ]
  },
  career: {
    name: '事业决策', count: 5, icon: '💼', scene: '工作、升迁与事业',
    positions: ['现状', '挑战', '建议', '短期发展', '长期发展'],
    desc: '现状 · 挑战 · 建议 · 短期 · 长期',
    positionDesc: [
      '当前事业/工作局面与所处阶段',
      '必须面对的难题或竞争压力',
      '此刻最该采取的动作与策略',
      '未来 3-6 个月的可见走向',
      '一年以上的长期趋势与天花板'
    ]
  }
};

// ==================== 牌库（78 张） ====================

export const tarotDeck: Record<string, TarotCard> = {
  // ---------- 大阿卡纳 22 张 ----------
  '愚者': { sym: '🃏', suit: 'major', num: 0, element: '风', upright: '新的开始、冒险精神，适合大胆尝试', rev: '鲁莽冲动或犹豫不决，需三思后行', kw: ['开始', '冒险', '天真'] },
  '魔术师': { sym: '🪄', suit: 'major', num: 1, element: '水星', upright: '行动力与创造力俱佳，资源齐备可成事', rev: '才华未展或流于口头，谨防夸大其词', kw: ['创造', '资源', '行动'] },
  '女祭司': { sym: '🌙', suit: 'major', num: 2, element: '月亮', upright: '直觉敏锐，静观其变比急于行动更有利', rev: '忽视内心声音，情绪波动影响判断', kw: ['直觉', '潜藏', '静观'] },
  '皇后': { sym: '👑', suit: 'major', num: 3, element: '金星', upright: '丰饶滋养，人际与生活被爱与美环绕', rev: '过度付出或依赖，需守住自我边界', kw: ['丰饶', '滋养', '美'] },
  '皇帝': { sym: '🏛️', suit: 'major', num: 4, element: '白羊', upright: '秩序与掌控力，适合做决策、定规则', rev: '固执专断，听不进建议易失人心', kw: ['秩序', '权威', '结构'] },
  '教皇': { sym: '📿', suit: 'major', num: 5, element: '金牛', upright: '寻求指引、遵循体系，前辈经验可借鉴', rev: '教条束缚或盲目遵从，需建立自己的判断', kw: ['传承', '信念', '指引'] },
  '恋人': { sym: '💞', suit: 'major', num: 6, element: '双子', upright: '关系的和谐与重要选择，跟随真心', rev: '左右为难，关系中存在分歧或诱惑', kw: ['结合', '选择', '价值'] },
  '战车': { sym: '🏇', suit: 'major', num: 7, element: '巨蟹', upright: '意志坚定、勇往直前，胜利在望', rev: '方向失控或半途而废，需重新聚焦', kw: ['意志', '前进', '掌控'] },
  '力量': { sym: '🦁', suit: 'major', num: 8, element: '狮子', upright: '以柔克刚，耐心与勇气化解难题', rev: '自我怀疑或软弱，先安抚内心', kw: ['勇气', '柔和', '耐心'] },
  '隐士': { sym: '🏮', suit: 'major', num: 9, element: '处女', upright: '独处内省，答案在安静中找到', rev: '过度孤立，小心与外界脱节', kw: ['内省', '独处', '智慧'] },
  '命运之轮': { sym: '🎡', suit: 'major', num: 10, element: '木星', upright: '时来运转，顺势而为必有转机', rev: '抗拒变化，旧循环需要被打破', kw: ['转机', '循环', '时机'] },
  '正义': { sym: '⚖️', suit: 'major', num: 11, element: '天秤', upright: '公正与因果，努力会得到对等回报', rev: '失衡或偏见，检查是否问心无愧', kw: ['公正', '因果', '权衡'] },
  '倒吊人': { sym: '🙃', suit: 'major', num: 12, element: '海王星', upright: '换个视角，暂时的沉淀是智慧', rev: '无谓牺牲或拖延，别自我感动', kw: ['换位', '等待', '牺牲'] },
  '死神': { sym: '💀', suit: 'major', num: 13, element: '天蝎', upright: '结束与蜕变，放下旧我迎来新生', rev: '抗拒改变，执念让局面僵持', kw: ['结束', '蜕变', '重生'] },
  '节制': { sym: '🏺', suit: 'major', num: 14, element: '射手', upright: '平衡与调和，耐心酝酿最佳方案', rev: '节奏失衡，过犹不及需收一收', kw: ['平衡', '调和', '节奏'] },
  '恶魔': { sym: '😈', suit: 'major', num: 15, element: '摩羯', upright: '直面欲望与束缚，识别执念所在', rev: '挣脱枷锁，勇气正在回归', kw: ['欲望', '束缚', '觉察'] },
  '高塔': { sym: '🗼', suit: 'major', num: 16, element: '火星', upright: '突变与重构，崩塌处正是重建起点', rev: '危机预警，尽早止损可减轻损失', kw: ['突变', '瓦解', '重建'] },
  '星星': { sym: '⭐', suit: 'major', num: 17, element: '水瓶', upright: '希望与疗愈，梦想值得被相信', rev: '暂时失望，别让一时乌云遮住光', kw: ['希望', '疗愈', '信心'] },
  '月亮': { sym: '🌕', suit: 'major', num: 18, element: '双鱼', upright: '潜意识涌动，迷雾中慢行慎断', rev: '真相浮出水面，困惑将解', kw: ['迷雾', '潜意识', '不安'] },
  '太阳': { sym: '☀️', suit: 'major', num: 19, element: '太阳', upright: '成功与喜悦，全力以赴自有光芒', rev: '短暂低迷，但光明已在转角', kw: ['成功', '喜悦', '明朗'] },
  '审判': { sym: '📯', suit: 'major', num: 20, element: '冥王星', upright: '觉醒与召唤，过往努力迎来结果', rev: '自我审判过度，学会宽恕自己', kw: ['觉醒', '召唤', '清算'] },
  '世界': { sym: '🌍', suit: 'major', num: 21, element: '土星', upright: '圆满达成，一个阶段画上句号', rev: '差临门一脚，补齐短板即可完成', kw: ['圆满', '完成', '整合'] },

  // ---------- 权杖（火 · 行动与热情）14 张 ----------
  '权杖首牌': { sym: '🔥', suit: 'wands', num: 1, element: '火', upright: '灵感与干劲点燃，此刻起跑最有利', rev: '热情不足或起步受阻，先找回动机', kw: ['灵感', '启动', '热情'] },
  '权杖二': { sym: '🗺️', suit: 'wands', num: 2, element: '火', upright: '规划与抉择，手握资源待布局', rev: '犹豫不决或视野受限，别只盯眼前', kw: ['规划', '抉择', '格局'] },
  '权杖三': { sym: '⛵', suit: 'wands', num: 3, element: '火', upright: '扩张与等待，前期投入将见回报', rev: '进展延迟或方向偏差，需复盘调整', kw: ['扩张', '远见', '等待'] },
  '权杖四': { sym: '🎊', suit: 'wands', num: 4, element: '火', upright: '稳定与庆祝，阶段成果值得分享', rev: '根基未稳就急于庆祝，先补齐短板', kw: ['庆祝', '稳定', '归属'] },
  '权杖五': { sym: '⚔️', suit: 'wands', num: 5, element: '火', upright: '竞争与磨合，良性冲突能激发成长', rev: '内耗与无谓争执，先对齐目标', kw: ['竞争', '冲突', '磨合'] },
  '权杖六': { sym: '🏆', suit: 'wands', num: 6, element: '火', upright: '胜利与认可，成果正被看见', rev: '荣耀迟到，但方向是对的', kw: ['胜利', '认可', '荣耀'] },
  '权杖七': { sym: '🛡️', suit: 'wands', num: 7, element: '火', upright: '坚守阵地，顶住压力即可守住成果', rev: '腹背受敌或信心动摇，需分清主次', kw: ['坚守', '防御', '压力'] },
  '权杖八': { sym: '🏹', suit: 'wands', num: 8, element: '火', upright: '进展飞快，消息与机会接踵而至', rev: '节奏混乱或信息滞后，先理顺优先级', kw: ['迅速', '消息', '推进'] },
  '权杖九': { sym: '🩹', suit: 'wands', num: 9, element: '火', upright: '带伤坚守，最后一段路最考验韧性', rev: '过度戒备或疲惫透支，该求助就求助', kw: ['韧性', '戒备', '收尾'] },
  '权杖十': { sym: '📦', suit: 'wands', num: 10, element: '火', upright: '责任压身，扛得动但需学会分派', rev: '负担过重或大包大揽，做减法才能走远', kw: ['负担', '责任', '超载'] },
  '权杖侍从': { sym: '✉️', suit: 'wands', num: 11, element: '火', upright: '热情的新消息与新尝试，保持好奇', rev: '三分钟热度或坏消息，先核实再行动', kw: ['好消息', '好奇', '试炼'] },
  '权杖骑士': { sym: '🐎', suit: 'wands', num: 12, element: '火', upright: '果敢出击，行动力是此刻最大筹码', rev: '急躁冒进或半途转向，先稳住节奏', kw: ['果敢', '冲劲', '出发'] },
  '权杖王后': { sym: '🌻', suit: 'wands', num: 13, element: '火', upright: '自信而有感染力，以热情带动他人', rev: '情绪化或过度要强，允许自己示弱', kw: ['自信', '感染力', '主见'] },
  '权杖国王': { sym: '🌞', suit: 'wands', num: 14, element: '火', upright: '领导力与决断，适合拍板定方向', rev: '独断专行或虚张声势，多听一线声音', kw: ['领导', '决断', '愿景'] },

  // ---------- 圣杯（水 · 情感与关系）14 张 ----------
  '圣杯首牌': { sym: '💧', suit: 'cups', num: 1, element: '水', upright: '情感流动，新的关系或感动正在开启', rev: '情感封闭或错付，先照顾好自己', kw: ['心动', '开启', '流动'] },
  '圣杯二': { sym: '🥂', suit: 'cups', num: 2, element: '水', upright: '双向奔赴，合作与感情达成默契', rev: '关系失衡或沟通错位，说开才好', kw: ['结合', '默契', '互信'] },
  '圣杯三': { sym: '🎉', suit: 'cups', num: 3, element: '水', upright: '欢聚与互助，朋友是此刻的贵人', rev: '圈子消耗或三角关系，注意边界', kw: ['欢聚', '友谊', '庆祝'] },
  '圣杯四': { sym: '🪑', suit: 'cups', num: 4, element: '水', upright: '倦怠与迟疑，眼前机会被你忽略了', rev: '重新振作，愿意接住新的可能', kw: ['倦怠', '迟疑', '错过'] },
  '圣杯五': { sym: '😢', suit: 'cups', num: 5, element: '水', upright: '失落与遗憾，但身后还有两杯未倒', rev: '开始释怀，愿意回头看看拥有的', kw: ['失落', '遗憾', '疗伤'] },
  '圣杯六': { sym: '🧸', suit: 'cups', num: 6, element: '水', upright: '怀旧与温情，旧人旧事带来安稳', rev: '困在过去或拒绝长大，该往前走了', kw: ['回忆', '温情', '纯真'] },
  '圣杯七': { sym: '🌈', suit: 'cups', num: 7, element: '水', upright: '选择太多、幻想太美，需落地取舍', rev: '看清现实，从白日梦里回到计划', kw: ['幻想', '选择', '迷惑'] },
  '圣杯八': { sym: '🏃', suit: 'cups', num: 8, element: '水', upright: '放下旧途，追寻内心真正想要的', rev: '留恋过往，向前走才能遇见新机', kw: ['离开', '追寻', '放下'] },
  '圣杯九': { sym: '🍷', suit: 'cups', num: 9, element: '水', upright: '心愿得偿，此刻值得好好享受', rev: '满足于表面或空虚感，别只晒不品', kw: ['满足', '愿望', '享受'] },
  '圣杯十': { sym: '🏡', suit: 'cups', num: 10, element: '水', upright: '圆满与归属，家人与所爱皆在身边', rev: '表面和气内里失和，需重建连接', kw: ['圆满', '家庭', '归属'] },
  '圣杯侍从': { sym: '💌', suit: 'cups', num: 11, element: '水', upright: '敏感细腻的讯息，创意或表白将至', rev: '情绪化或幼稚表达，先想清楚再说', kw: ['讯息', '细腻', '创意'] },
  '圣杯骑士': { sym: '🌊', suit: 'cups', num: 12, element: '水', upright: '浪漫邀约与理想主义，跟随心动', rev: '不切实际或情绪勒索，看清对方行动', kw: ['浪漫', '邀约', '理想'] },
  '圣杯王后': { sym: '🪞', suit: 'cups', num: 13, element: '水', upright: '共情与包容，直觉是你最好的顾问', rev: '过度共情被情绪裹挟，先设好边界', kw: ['共情', '直觉', '包容'] },
  '圣杯国王': { sym: '🐟', suit: 'cups', num: 14, element: '水', upright: '成熟稳重的情感表达，能给予也能承接', rev: '压抑情绪或操控他人，坦诚才是解药', kw: ['成熟', '包容', '掌控'] },

  // ---------- 宝剑（风 · 思维与沟通）14 张 ----------
  '宝剑首牌': { sym: '⚡', suit: 'swords', num: 1, element: '风', upright: '思路清晰，一针见血的决断时刻', rev: '判断失误或言辞伤人，先厘清事实', kw: ['清明', '突破', '决断'] },
  '宝剑二': { sym: '🙈', suit: 'swords', num: 2, element: '风', upright: '僵持与回避，需要拆掉蒙眼布做选择', rev: '信息补齐，终于愿意面对真相', kw: ['僵持', '回避', '抉择'] },
  '宝剑三': { sym: '💔', suit: 'swords', num: 3, element: '风', upright: '心碎与坦诚之痛，允许自己难过', rev: '伤口开始愈合，慢慢放下刺痛', kw: ['心碎', '真相', '疗愈'] },
  '宝剑四': { sym: '🛏️', suit: 'swords', num: 4, element: '风', upright: '休养生息，暂停是为了恢复判断力', rev: '休整结束或被迫回归，别再拖了', kw: ['休息', '恢复', '暂停'] },
  '宝剑五': { sym: '🏳️', suit: 'swords', num: 5, element: '风', upright: '赢了道理输了关系，需评估代价', rev: '愿意和解，放下胜负重新开始', kw: ['失利', '争执', '代价'] },
  '宝剑六': { sym: '🚣', suit: 'swords', num: 6, element: '风', upright: '过渡与远离，离开风浪走向平静', rev: '困在原地或旧事重提，难以真正翻篇', kw: ['过渡', '远离', '平稳'] },
  '宝剑七': { sym: '🕵️', suit: 'swords', num: 7, element: '风', upright: '策略与隐瞒，有人没说实话', rev: '坦白或骗局败露，诚实成本更低', kw: ['策略', '隐瞒', '警觉'] },
  '宝剑八': { sym: '🪢', suit: 'swords', num: 8, element: '风', upright: '自我设限，困住你的多半是自己', rev: '松绑与觉醒，看清束缚本不存在', kw: ['受限', '困住', '自设'] },
  '宝剑九': { sym: '🌘', suit: 'swords', num: 9, element: '风', upright: '焦虑与失眠，恐惧被放大了', rev: '走出噩梦，愿意说出来就会好些', kw: ['焦虑', '担忧', '失眠'] },
  '宝剑十': { sym: '🗡️', suit: 'swords', num: 10, element: '风', upright: '谷底之后必回升，痛过即是成长', rev: '转机初现，旧伤正在愈合', kw: ['谷底', '终结', '回升'] },
  '宝剑侍从': { sym: '🔎', suit: 'swords', num: 11, element: '风', upright: '好奇求证，好问与消息灵通的阶段', rev: '道听途说或说话带刺，先核实再开口', kw: ['求证', '好奇', '警觉'] },
  '宝剑骑士': { sym: '💨', suit: 'swords', num: 12, element: '风', upright: '雷厉风行，快速推进但注意分寸', rev: '莽撞冒进或言辞过激，先踩一脚刹车', kw: ['迅捷', '锐利', '直言'] },
  '宝剑王后': { sym: '🦉', suit: 'swords', num: 13, element: '风', upright: '理性洞察，能看穿话术与真相', rev: '刻薄或过度防备，留一点柔软给人', kw: ['理性', '洞察', '界限'] },
  '宝剑国王': { sym: '🦅', suit: 'swords', num: 14, element: '风', upright: '公正裁断，用逻辑与规则解决问题', rev: '冷酷专断或滥用权威，别只讲道理', kw: ['公正', '权威', '逻辑'] },

  // ---------- 星币（土 · 物质与现实）14 张 ----------
  '星币首牌': { sym: '🪙', suit: 'pentacles', num: 1, element: '土', upright: '财富与机会的种子，务实起步可成', rev: '机会落空或投入不足，先算清账', kw: ['机会', '务实', '种子'] },
  '星币二': { sym: '🤹', suit: 'pentacles', num: 2, element: '土', upright: '多线并行，灵活周转是当下的本事', rev: '顾此失彼或现金流吃紧，需做取舍', kw: ['平衡', '周转', '灵活'] },
  '星币三': { sym: '🔨', suit: 'pentacles', num: 3, element: '土', upright: '协作与专业，成果靠团队与手艺累积', rev: '配合失序或敷衍了事，标准要对齐', kw: ['协作', '专业', '打磨'] },
  '星币四': { sym: '🔒', suit: 'pentacles', num: 4, element: '土', upright: '保守与守住，稳健比扩张更重要', rev: '过度吝啬或松手过度，重新校准边界', kw: ['保守', '守住', '控制'] },
  '星币五': { sym: '❄️', suit: 'pentacles', num: 5, element: '土', upright: '资源困窘，但援助其实就在身边', rev: '走出低谷，开始重建安全感', kw: ['困窘', '匮乏', '求助'] },
  '星币六': { sym: '🤲', suit: 'pentacles', num: 6, element: '土', upright: '给予与接受，资源流动带来善缘', rev: '施受失衡或附条件的帮助，看清动机', kw: ['给予', '平衡', '资源'] },
  '星币七': { sym: '🌱', suit: 'pentacles', num: 7, element: '土', upright: '耐心等待回报，评估投入是否值得', rev: '急于收割或投入打水漂，及时止损', kw: ['等待', '评估', '耐心'] },
  '星币八': { sym: '🛠️', suit: 'pentacles', num: 8, element: '土', upright: '勤学苦练，专注打磨就有进步', rev: '敷衍重复或缺乏精进，别只做量', kw: ['勤勉', '精进', '专注'] },
  '星币九': { sym: '🍇', suit: 'pentacles', num: 9, element: '土', upright: '自立与丰收，靠自己攒下的底气', rev: '过度依赖或虚荣消费，根基要稳', kw: ['自立', '丰收', '底气'] },
  '星币十': { sym: '🏰', suit: 'pentacles', num: 10, element: '土', upright: '家业与长期积累，财富与传承落地', rev: '家庭财务纠纷或长远规划缺失', kw: ['积累', '家业', '传承'] },
  '星币侍从': { sym: '📚', suit: 'pentacles', num: 11, element: '土', upright: '踏实学习，新技能会带来实际回报', rev: '眼高手低或拖延，先把基础打牢', kw: ['学习', '踏实', '机会'] },
  '星币骑士': { sym: '🐢', suit: 'pentacles', num: 12, element: '土', upright: '稳扎稳打，慢就是快，坚持就有结果', rev: '固执拖沓或陷入例行公事，需要变一变', kw: ['稳健', '坚持', '可靠'] },
  '星币王后': { sym: '🌾', suit: 'pentacles', num: 13, element: '土', upright: '务实滋养，把钱和精力花在刀刃上', rev: '过度操劳或物质焦虑，先照顾自己', kw: ['务实', '滋养', '经营'] },
  '星币国王': { sym: '💰', suit: 'pentacles', num: 14, element: '土', upright: '财务稳健与资源调度，适合做长期布局', rev: '过度逐利或固守成规，别被钱绑住', kw: ['富足', '经营', '稳健'] }
};

/** 花色中文名 */
export const SUIT_LABEL: Record<TarotSuit, string> = {
  major: '大阿卡纳',
  wands: '权杖（火）',
  cups: '圣杯（水）',
  swords: '宝剑（风）',
  pentacles: '星币（土）'
};

/** 牌库张数（78） */
export const DECK_SIZE = Object.keys(tarotDeck).length;

/** 取牌义：正/逆位一句话 */
export function cardMeaning(name: string, isRev: boolean): string {
  const c = tarotDeck[name];
  if (!c) return '';
  return isRev ? c.rev : c.upright;
}

// ==================== 每日塔罗（按日期确定性抽牌） ====================

/** 每日三牌的牌位语义（取代原先只存"正位/逆位"的 posi） */
export const DAILY_POSITIONS = ['今日能量', '今日挑战', '今日行动'] as const;

/** 今日塔罗牌面（前端按日期 seed 生成：同一天固定、跨天自动变化） */
export interface DailyTarotDeal {
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 今日主题牌 */
  theme: { name: string; sym: string; isRev: boolean };
  /** 每日三牌 */
  cards: { name: string; sym: string; isRev: boolean; posi: string; position: string }[];
}

/** FNV-1a 字符串 hash → 32 位无符号整数（日期种子） */
function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG（确定性：同一种子输出序列一致） */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 逆位概率 */
const REV_RATE = 0.32;

/**
 * 按日期确定性生成今日塔罗牌面（主题牌 1 张 + 每日三牌 3 张，不重复，正逆位同源随机）。
 * 三张牌带牌位语义（今日能量 / 今日挑战 / 今日行动），会一并提交给 AI 生成解读。
 *
 * @param allowRev 是否允许逆位。此前逆位概率写死在这函数里，「允许逆位」开关只作用于主抽牌，
 *   关掉开关后每日三牌照样出逆位，与页面上的口径不一致。
 *   注意：无论开关与否都要消耗同一次 rand() —— 否则关掉逆位会改变随机序列、连牌名都换掉，
 *   「同一天同一副牌」的确定性就不成立了。
 */
export function generateDailyTarot(dateStr: string, allowRev = true): DailyTarotDeal {
  const rand = mulberry32(hashSeed('om-daily:' + dateStr));
  /** 先照常掷一次骰子（保住随机序列），再按开关决定是否兑现成逆位 */
  const rev = (): boolean => rand() < REV_RATE && allowRev;
  const names = Object.keys(tarotDeck);
  // 今日主题牌
  const ti = Math.floor(rand() * names.length);
  const themeName = names[ti];
  // 每日三牌（从剩余牌中不重复抽 3 张）
  const pool = names.slice();
  pool.splice(ti, 1);
  const cards: DailyTarotDeal['cards'] = [];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(rand() * pool.length);
    const name = pool.splice(idx, 1)[0];
    const isRev = rev();
    cards.push({
      name,
      sym: tarotDeck[name].sym,
      isRev,
      posi: isRev ? '逆位' : '正位',
      position: DAILY_POSITIONS[i],
    });
  }
  const themeIsRev = rev();
  return {
    date: dateStr,
    theme: { name: themeName, sym: tarotDeck[themeName].sym, isRev: themeIsRev },
    cards,
  };
}

/**
 * 综合指引文本：按正逆位占比生成（纯文本，历史存档与 HTML 展示共用同一口径）。
 * 单独抽出来是因为失败降级时要把同样的内容存进历史 —— 两份文案不能各写一遍。
 */
export function tarotSummaryLine(cards: DrawnCard[]): string {
  const revCount = cards.filter((c) => c.isRev).length;
  const total = cards.length;
  if (revCount === 0) {
    return '全部正位，能量通畅。近期宜顺势推进，重要决定可以果断一些。';
  }
  if (revCount <= Math.ceil(total / 3)) {
    return '多数正位、少数逆位：大方向乐观，但留意逆位牌对应的卡点，先解决它再加速。';
  }
  if (revCount <= Math.ceil((total * 2) / 3)) {
    return '正逆平衡：目前处在拉扯期，不必急于定论，给彼此（或给自己）一点缓冲时间。';
  }
  return '逆位偏多：能量受阻，当前不宜硬推。先停下来理清阻碍是什么，再调整策略。';
}

/** 综合指引（HTML 版，用于结果区渲染） */
export function buildTarotSummary(cards: DrawnCard[]): string {
  return (
    '<p style="margin-top:10px; padding-top:10px; border-top:1px dashed rgba(124,92,255,0.25);">' +
    '<strong>📌 综合指引：</strong>' +
    tarotSummaryLine(cards) +
    '</p>'
  );
}

/**
 * 本地兜底解读全文（AI 不可用时使用）。
 * 与结果区 error 态展示口径一致，同时作为失败时的历史存档内容 —— 否则降级结果刷新即失。
 */
export function localFallbackText(cards: DrawnCard[]): string {
  const lines = cards.map(
    (c) => `**${c.pos} — ${c.isRev ? '逆位' : '正位'}${c.name}**：${c.isRev ? c.rev : c.upright}`
  );
  lines.push('**📌 综合指引**：' + tarotSummaryLine(cards));
  return lines.join('\n\n');
}

/**
 * 抽牌：从牌库不重复抽取 n 张，逆位概率 0.32。
 * 确定性：种子由调用方拼装，格式建议 `${日期}:${牌阵key}:${问题}#${nonce}`。
 *  - nonce 为 0（或不带 #）：同输入必得同一副牌，AI 解读缓存可命中；
 *  - nonce 递增：实现「再抽一次」，换一副新牌。
 *
 * @param majorOnly 只从 22 张大阿卡纳里抽。大阿卡纳代表「命运级议题」，只想看大方向时用。
 *   种子里带模式标记，因此同一 seed 下两种模式牌面不同，切换模式不会抽到同一副牌。
 */
export function drawCardsFromDeck(spread: SpreadInfo, seedStr: string, majorOnly = false): DrawnCard[] {
  const rand = mulberry32(hashSeed('om-draw:' + seedStr + (majorOnly ? ':major' : '')));
  const names = Object.keys(tarotDeck);
  const pool = majorOnly ? names.filter((n) => tarotDeck[n].suit === 'major') : names.slice();
  const picked: string[] = [];
  for (let i = 0; i < spread.count; i++) {
    const idx = Math.floor(rand() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked.map((k, i) => {
    const d = tarotDeck[k];
    return {
      name: k,
      sym: d.sym,
      isRev: rand() < REV_RATE,
      upright: d.upright,
      rev: d.rev,
      kw: d.kw,
      suit: d.suit,
      num: d.num,
      element: d.element,
      pos: spread.positions[i] || '第' + (i + 1) + '张',
      posDesc: spread.positionDesc[i] || '',
    };
  });
}

// ==================== 自定义牌阵（用户自建，存 localStorage） ====================

/** 自定义牌阵持久化结构（含 id，作为 spreadKey 前缀 custom:） */
export interface CustomSpread {
  id: string;
  name: string;
  count: number;
  icon: string;
  scene: string;
  desc: string;
  positions: string[];
  positionDesc: string[];
  createdAt: number;
}

const CUSTOM_SPREAD_KEY = 'om_tarot_custom_spreads';

/**
 * 分享链接 / 历史恢复时，本机没有对应自定义牌阵，用 URL 里携带的牌阵信息兜底，
 * 保证打开链接后「牌阵说明」「结论卡」仍能正常渲染，而不是整页崩溃。
 */
export const ephemeralSpreads: Record<string, SpreadInfo> = {};

function lsGet(key: string): string | null {
  return storage.getItem(key);
}
function lsSet(key: string, val: string): void {
  storage.setItem(key, val);
}

/** 读取本机自定义牌阵列表 */
export function loadCustomSpreads(): CustomSpread[] {
  const raw = lsGet(CUSTOM_SPREAD_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? (list as CustomSpread[]) : [];
  } catch {
    return [];
  }
}

function saveCustomSpreads(list: CustomSpread[]): void {
  lsSet(CUSTOM_SPREAD_KEY, JSON.stringify(list));
}

function customToInfo(c: CustomSpread): SpreadInfo {
  return {
    name: c.name,
    count: c.count,
    icon: c.icon,
    scene: c.scene,
    positions: c.positions,
    desc: c.desc,
    positionDesc: c.positionDesc,
  };
}

/** 取牌阵：内置优先，其次本机自定义，最后分享兜底（ephemeral） */
export function getSpread(key: string): SpreadInfo | undefined {
  if (spreadData[key]) return spreadData[key];
  if (key.startsWith('custom:')) {
    const found = loadCustomSpreads().find((c) => c.id === key);
    if (found) return customToInfo(found);
    if (ephemeralSpreads[key]) return ephemeralSpreads[key];
  }
  return undefined;
}

/** 内置 + 自定义牌阵的 key 列表（决定展示顺序） */
export function getSpreadList(): string[] {
  return [...Object.keys(spreadData), ...loadCustomSpreads().map((c) => c.id)];
}

/** 内置 + 自定义牌阵完整列表（渲染牌阵网格用） */
export function getAllSpreads(): { key: string; info: SpreadInfo; custom: boolean }[] {
  const builtin = Object.keys(spreadData).map((k) => ({ key: k, info: spreadData[k], custom: false }));
  const custom = loadCustomSpreads().map((c) => ({ key: c.id, info: customToInfo(c), custom: true }));
  return [...builtin, ...custom];
}

/**
 * 仅内置牌阵（不读 localStorage 自定义）—— 供组件首屏初始 state 使用。
 * 因为 localStorage 在 SSR / 客户端首渲染阶段不可控（服务端无、客户端有），
 * 若初始 state 直接调 getAllSpreads()，会导致服务端 5 套、客户端 6 套 → hydration mismatch。
 * 首屏先渲染内置，挂载后再由 useEffect 调 getAllSpreads() 补上自定义牌阵。
 */
export function getBuiltinSpreads(): { key: string; info: SpreadInfo; custom: boolean }[] {
  return Object.keys(spreadData).map((k) => ({ key: k, info: spreadData[k], custom: false }));
}

/** 保存自定义牌阵（新增或覆盖），返回其 key */
export function saveCustomSpread(info: SpreadInfo, id?: string): string {
  const list = loadCustomSpreads();
  const newId = id || 'custom:' + Date.now().toString(36);
  const entry: CustomSpread = {
    id: newId,
    name: info.name,
    count: info.count,
    icon: info.icon,
    scene: info.scene,
    desc: info.desc,
    positions: info.positions,
    positionDesc: info.positionDesc,
    createdAt: Date.now(),
  };
  const idx = list.findIndex((c) => c.id === newId);
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  saveCustomSpreads(list);
  return newId;
}

/** 删除自定义牌阵 */
export function deleteCustomSpread(id: string): void {
  saveCustomSpreads(loadCustomSpreads().filter((c) => c.id !== id));
}

// ==================== 指示牌（significator） ====================

/** 16 张宫廷牌（侍从/骑士/王后/国王 × 四花色），作指示牌候选 */
export const COURT_CARDS: string[] = Object.keys(tarotDeck).filter(
  (n) => tarotDeck[n].suit !== 'major' && tarotDeck[n].num >= 11 && tarotDeck[n].num <= 14
);

/**
 * 按性别 + 元素推荐一张指示牌（经典规则）：
 * 男性能量 → 国王；女性能量 → 王后；元素决定花色（火/水/风/土）。
 */
export function recommendSignificator(gender: 'male' | 'female', element: TarotSuit): string {
  const suit: TarotSuit =
    element === 'wands' || element === 'cups' || element === 'swords' || element === 'pentacles'
      ? element
      : 'wands';
  const rank = gender === 'male' ? 14 : 13; // 国王 / 王后
  const name = COURT_CARDS.find((n) => tarotDeck[n].suit === suit && tarotDeck[n].num === rank);
  if (name) return name;
  const fallback = COURT_CARDS.find((n) => tarotDeck[n].suit === suit);
  return fallback || COURT_CARDS[0];
}
