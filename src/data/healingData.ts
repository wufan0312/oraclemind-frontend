import { storage, registerLegacy } from '../lib/storage';
import { setCloudItem } from '../lib/cloudStore';

// ============================================================================
// 玄镜 OracleMind · 疗愈·心斋数据模块
// 从原型 js/app.js（healing 部分）提取：每日一悟 / 小玄对话 / 心镜 /
// 修行等级(道行) / 每日任务 / 心经共读 / 供养心斋
// ============================================================================

// ===== 每日一悟 =====
export const HEALING_QUOTES: { text: string; source: string }[] = [
  { text: '知是行之始，行是知之成。', source: '王阳明 · 传习录' },
  { text: '此心光明，亦复何言。', source: '王阳明 · 临终遗言' },
  { text: '致虚极，守静笃；万物并作，吾以观复。', source: '老子 · 道德经' },
  { text: '夫唯不争，故天下莫能与之争。', source: '老子 · 道德经' },
  { text: '人法地，地法天，天法道，道法自然。', source: '老子 · 道德经' },
  { text: '心无挂碍，无挂碍故，无有恐怖。', source: '般若波罗蜜多心经' },
  { text: '照见五蕴皆空，度一切苦厄。', source: '般若波罗蜜多心经' },
  { text: '呼吸之间，即是当下。', source: '冥想 · 观息' }
];

// ===== 小玄对话（散客模式，与原型 guest 一致） =====
export const XUAN_GREETING =
  '👋 旅人好呀～我是小玄。这里叫「心斋」，是一个可以什么都不做的角落。先坐下来，深呼吸——到了这里，就没有什么需要赶的了。';

export const XUAN_SUGGESTIONS: { q: string; a: string }[] = [
  {
    q: '这里是什么地方？',
    a: '心斋出自《庄子·人间世》——「回曰：吾无以进矣，敢问心斋。仲尼曰：若一志，无听之以耳而听之以心。」它是一种让心空下来、静下来的功夫。在这里，你可以呼吸、发呆、读一句经、或和小玄聊天。没有KPI，没有打卡，只有当下。'
  },
  {
    q: '我什么都不懂，可以来吗？',
    a: '当然可以！心斋不是考试，不需要你懂什么。王阳明说「人人皆可为尧舜」——意思是你本自具足，不需要外求什么。你能来到这里，本身就是一种回归。来，先深呼吸三次，小玄陪你。'
  },
  {
    q: '怎么让自己静下来？',
    a: '最简单的办法：跟着呼吸走。吸气时知道在吸气，呼气时知道在呼气。念头跑了？没关系，拉回来就好，不必自责——这就是「安那般那」数息法。从一数到十，走神了就重来。王阳明说「此心不动，随机而动」，静不是死水一潭，是动中的定。'
  },
  {
    q: '什么是致良知？',
    a: '王阳明说，每个人心里都有个「良知」——它天然知道什么对、什么错。烦恼往往不是因为不知道，而是知道了却做不到。致良知，就是先安静下来，听听心里那个最直接的声音，然后去做最小的一步。不用想太多，心知道答案。'
  },
  {
    q: '我最近压力很大',
    a: '小玄听到了。压力大时，身体会紧绷、呼吸会变浅。先做一件事：把肩膀放下来，深深吸一口气，再慢慢吐出来。心经说「心无挂碍」——不是不挂念，是不被挂念困住。你的压力，小玄帮你分担一点。'
  },
  {
    q: '我想试试卜卦',
    a: '好呀！卜卦像是给心照一面镜子，看看当下的能量在说什么。小玄在卜卦页等你，可以一起去看看。点击导航栏的「卜卦」就可以啦～'
  },
  {
    q: '修行等级是什么？',
    a: '心斋把修行做成了一场温和的游戏：做功课积道行，道行够了就升境界——初入心斋、静心、观照、明心、见性、致良知、道法自然，最后悟道。不需要和别人比，只是陪自己慢慢走。页面顶部的修行面板，就是你的进度。'
  }
];

/** 小玄回复逻辑（散客模式 · 关键词匹配，与原型 xuanRespond 一致） */
export function xuanRespond(question: string): string {
  const dialog = XUAN_SUGGESTIONS;

  // 先尝试精确匹配建议问题
  for (let i = 0; i < dialog.length; i++) {
    if (question === dialog[i].q) return dialog[i].a;
  }

  // 关键词模糊匹配
  const lowerQ = question.toLowerCase();
  const keywords: Record<string, () => string> = {
    '焦虑|压力|烦|累|崩溃': () =>
      '小玄听到了。压力大时先做一件事：把肩膀放下来，深深吸气，慢慢吐出来。心经说「心无挂碍」——不是不挂念，是不被挂念困住。你的压力，小玄帮你分担一点。',
    '静|冥想|呼吸|放松': () =>
      '最简单的办法：跟着呼吸走。吸气时知道在吸气，呼气时知道在呼气。走神了？拉回来就好，不必自责。这就是「安那般那」数息法。从一数到十，走神了就重来。小玄陪你。',
    '阳明|良知|心学': () =>
      '王阳明说，每个人心里都有个「良知」——它天然知道什么对、什么错。烦恼往往不是因为不知道，而是知道了却做不到。致良知，就是先安静下来，听听心里那个最直接的声音，然后去做最小的一步。不用想太多，心知道答案。',
    '心经|般若|空|五蕴': () =>
      '心经最经典三句：①「照见五蕴皆空，度一切苦厄」——看见情绪的本质，疗就开始了；②「色不异空，空不异色」——不必执着，也不必否定；③「心无挂碍，无有恐怖」——心中没有牵挂障碍，就没有恐惧。你可以往下翻，心经共读区有每一句的白话心解，点开还有道行哦。',
    '等级|道行|修行|境界|升级': () =>
      '心斋有一套「修行等级」：从初入心斋 → 静心 → 观照 → 明心 → 见性 → 致良知 → 心无挂碍 → 道法自然，最后抵达「悟道」。做功课会积道行：入斋、聊天、共读心经、静坐、记录悟道都有道行。你现在就可以从「今日修行」开始，把每天的小功课做完，境界自然就上去了。',
    '悟道|顿悟|开悟|领悟|悟': () =>
      '悟不是玄妙的顿悟，是日常里一个小小的「啊，原来如此」。今天换一句每日一悟时，如果心里有念头浮上来，把它写进「记录悟道」——那会是你修行路上第一颗珍珠。',
    '道|老子|自然|无为': () =>
      '老子说「人法地，地法天，天法道，道法自然」——最高的秩序是不勉强。庄子教人「坐忘」：放下形骸与聪明，与大道同游。静坐时把「努力放松」也放下，不追求状态，不评判好坏，虚静自会到来。',
    '卜卦|排盘|八字|算命': () =>
      '卜卦像是给心照一面镜子，看看当下的能量在说什么。你可以先去卜卦页试试，生成专属的觉察档案后再来找小玄，小玄会帮你把结果和心法结合起来看。点击导航栏的「卜卦」就可以啦～',
    '梦|解梦': () =>
      '梦境是潜意识的语言。你可以去「周公解梦」页输入你的梦境，看看传统解梦和心理学双视角怎么说。做完再来找小玄聊聊，小玄陪你一起想。',
    '塔罗|牌|抽牌': () =>
      '塔罗是当下的镜子，不预测未来，而是帮你看见此刻的能量。去塔罗页选一个牌阵抽牌试试，做完再来和小玄聊。',
    '星座|星盘|巨蟹|双鱼': () =>
      '星座是看出生时天上行星的位置。你的太阳星座代表核心自我，月亮代表内在情感，上升代表外在气质。可以去星座页选你的星座看看，做完再来和小玄聊。',
    '数字|灵数|生日': () =>
      '生命灵数把出生日期所有数字逐位相加到个位，代表你的核心天赋。你可以去数字密码页试试，算完再来和小玄聊聊。',
    '风水|方位|布局': () =>
      '环境会影响心情，但心安处即是归处。与其调整布局，不如先照顾好自己——心斋的呼吸与静心练习，随时随地都能让你安顿下来。',
    '你好|hi|hello|嗨': () =>
      '旅人你好呀～欢迎来到心斋。今天想聊什么？不急，慢慢来，小玄一直在。',
    '谢谢|感谢|thx': () =>
      '不客气～小玄很开心能帮到你。阳明先生说「此心光明」，你心里的光，小玄只是帮你拨了拨灰。随时来找小玄，这里永远给你留着位置。',
    '再见|走了|bye|晚安': () =>
      '旅人慢走～下次累了，随时来这里歇歇。心斋的门永远为你开着，小玄一直在。'
  };

  for (const pattern in keywords) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(lowerQ)) return keywords[pattern]();
  }

  // 默认回复
  return (
    '小玄在认真听你说呢。你说的「' + question +
    '」，小玄记下了。有时候，被听见本身就是一种疗愈。你可以先试试深呼吸三次，或者翻翻下面的心法和心经——也许会有一句话刚好对上此刻的你。'
  );
}

// ===== 心镜卡片（登录用户 · 原型数据） =====
export interface MirrorCard {
  icon: string;
  title: string;
  source: string;
  data: string;
  yangming: string;
  action: string;
}

export const MIRROR_CARDS: MirrorCard[] = [
  {
    icon: '☯️',
    title: '八字心镜',
    source: '日主戊土 · 火土偏旺',
    data: '你的五行火土偏旺，为人踏实稳重，但也容易固执己见。2026年火势更旺，宜静不宜动，适合深耕专业领域。',
    yangming: '心即理 — 你的固执，是真心还是惯性？下次遇到分歧，先问良知：这件事的本质是什么？',
    action: '今天试着对一个相反意见说「你说得也有道理」，不必同意，只是听见。'
  },
  {
    icon: '🔮',
    title: '塔罗心镜',
    source: '正位星星 · 希望',
    data: '时间之流三牌显示：你正从不满（逆位圣杯八）走向重建自信（正位权杖六），未来有新的机会（正位星星）。',
    yangming: '知行合一 — 希望不是等来的，是做出来的。星星牌的能量，需要你迈出一步来激活。',
    action: '本周做一件「小小的新尝试」，不必惊天动地，换个路线回家也算。'
  },
  {
    icon: '⭐',
    title: '星座心镜',
    source: '太阳巨蟹 · 月亮双鱼',
    data: '水象能量极强，感受力是你的天赋。但也容易情绪内耗——外在稳重，内在波涛。',
    yangming: '致良知 — 你的敏感是天赋，不是负担。感受来时不必分析，只需观照。',
    action: '情绪涌来时，默念「我看见了」，然后回到呼吸。三分钟足够。多接触水元素平衡能量。'
  },
  {
    icon: '🔢',
    title: '数字心镜',
    source: '生命灵数7 · 智慧探索者',
    data: '你是天生的探索者，善于思考，但容易想太多做太少。九宫格缺3（创造）、6（责任）、8（丰盛）。',
    yangming: '知是行之始，行是知之成 — 想清楚和做到位是一件事，不是两件事。',
    action: '今天把一件「想了很久但没做」的事，做最小的一步。哪怕只是打开那个文档。'
  }
];

// ===== 修行等级 · 悟道（游戏化） =====
export interface RealmLevel {
  name: string;
  icon: string;
  min: number;
  verse: string;
}

export const REALM_LEVELS: RealmLevel[] = [
  { name: '初入心斋', icon: '🌱', min: 0, verse: '万事开头难，坐下来即是开始' },
  { name: '静心', icon: '💧', min: 100, verse: '心安则身安，息在当下' },
  { name: '观照', icon: '🪞', min: 250, verse: '看见，是疗愈的开始' },
  { name: '明心', icon: '🌟', min: 450, verse: '心即理，本自具足' },
  { name: '见性', icon: '💡', min: 700, verse: '知是行之始，行是知之成' },
  { name: '致良知', icon: '🔥', min: 1000, verse: '知行合一，此心光明' },
  { name: '心无挂碍', icon: '🕊️', min: 1400, verse: '无挂碍故，无有恐怖' },
  { name: '道法自然', icon: '🌀', min: 1900, verse: '致虚极，守静笃，道法自然' },
  { name: '悟道', icon: '☯️', min: 2500, verse: '此心光明，亦复何言' }
];

// ===== 每日修行任务 =====
export interface Quest {
  id: string;
  icon: string;
  label: string;
  desc: string;
  xp: number;
  target?: number;
}

export const DAILY_QUESTS: Quest[] = [
  { id: 'login', icon: '🏮', label: '今日入斋', desc: '来到心斋，即是修行', xp: 10 },
  { id: 'chat', icon: '💬', label: '与小玄说说话', desc: '聊满 3 句心里话', xp: 10, target: 3 },
  { id: 'sutra', icon: '📿', label: '共读一句心经', desc: '点开任一句白话心解', xp: 10 },
  { id: 'breath', icon: '🌬️', label: '静坐一分钟', desc: '跟着圆圈呼吸 60 秒', xp: 15 },
  { id: 'wudao', icon: '✨', label: '记录一次悟道', desc: '写下此刻的领悟', xp: 20 },
  { id: 'meditate', icon: '🧘', label: '静坐冥想', desc: '完成一段引导冥想', xp: 20 },
  { id: 'mood', icon: '🌈', label: '记录此刻心情', desc: '写下来，被自己看见', xp: 10 }
];

// ===== 诵读今日心经 =====
export interface SutraLine {
  text: string;
  body: string;
}

export const SUTRA_LINES: SutraLine[] = [
  {
    text: '观自在菩萨，行深般若波罗蜜多时，照见五蕴皆空，度一切苦厄。',
    body: '菩萨进入甚深禅定时，如实照见身心与情绪（五蕴）都是因缘聚合、本无自性，于是度脱了一切痛苦烦恼——看见，是疗愈的开始。'
  },
  {
    text: '色不异空，空不异色；色即是空，空即是色。',
    body: '「色」指一切所见所感，「空」指其本性无常。两者不二：不必执着于事物，也不必否定它们——如实观照，如云来去。'
  },
  {
    text: '心无挂碍，无挂碍故，无有恐怖，远离颠倒梦想，究竟涅槃。',
    body: '心中没有牵挂与障碍，就没有恐惧；远离颠倒的妄想，便抵达真正的安宁——这就是疗愈的终点：心无挂碍。'
  }
];

// 今日诵读的心经片段（精选四句）
export const TODAY_SUTRA = {
  text: '观自在菩萨，行深般若波罗蜜多时，\n照见五蕴皆空，度一切苦厄。\n舍利子，色不异空，空不异色；\n色即是空，空即是色。',
  source: '——《般若波罗蜜多心经》'
};

// 完整心经（含白话注释，供展开查看）
export const FULL_SUTRA: SutraLine[] = [
  {
    text: '观自在菩萨，行深般若波罗蜜多时，照见五蕴皆空，度一切苦厄。',
    body: '菩萨进入甚深禅定时，如实照见身心与情绪（五蕴）都是因缘聚合、本无自性，于是度脱了一切痛苦烦恼——看见，是疗愈的开始。'
  },
  {
    text: '舍利子，色不异空，空不异色；色即是空，空即是色。',
    body: '「色」指一切所见所感，「空」指其本性无常。两者不二：不必执着于事物，也不必否定它们——如实观照，如云来去。'
  },
  {
    text: '受想行识，亦复如是。',
    body: '感受、想象、意志、意识这四蕴，也同样如此——其性皆空，不必执着。'
  },
  {
    text: '舍利子，是诸法空相，不生不灭，不垢不净，不增不减。',
    body: '一切法的本质是空相，没有生起也没有消灭，没有污垢也没有清净，没有增加也没有减少——这就是不二中道。'
  },
  {
    text: '是故空中无色，无受想行识，无眼耳鼻舌身意，无色声香味触法。',
    body: '因此在空性之中，没有物质现象，没有感受想象意志意识，没有眼耳鼻舌身意六根，也没有色声香味触法六尘。'
  },
  {
    text: '无眼界，乃至无意识界。',
    body: '没有眼界，乃至没有意识界——十八界皆空，这是对空性的深入观照。'
  },
  {
    text: '无无明，亦无无明尽；乃至无老死，亦无老死尽。',
    body: '没有无明，也没有无明的穷尽；乃至没有老死，也没有老死的穷尽——十二因缘皆空。'
  },
  {
    text: '无苦集灭道，无智亦无得。',
    body: '没有苦、集、灭、道四圣谛，没有智慧也没有所得——这是般若波罗蜜多的究竟。'
  },
  {
    text: '以无所得故，菩提萨埵，依般若波罗蜜多故，心无挂碍。',
    body: '因为没有所得，菩萨依般若波罗蜜多修行，心中没有任何牵挂障碍。'
  },
  {
    text: '无挂碍故，无有恐怖，远离颠倒梦想，究竟涅槃。',
    body: '因为没有挂碍，就没有恐惧；远离颠倒的妄想，便抵达真正的安宁——这就是涅槃。'
  },
  {
    text: '三世诸佛，依般若波罗蜜多故，得阿耨多罗三藐三菩提。',
    body: '过去、现在、未来的一切诸佛，都是依般若波罗蜜多，证得无上正等正觉。'
  },
  {
    text: '故知般若波罗蜜多，是大神咒，是大明咒，是无上咒，是无等等咒。',
    body: '所以般若波罗蜜多是大神咒、大明咒、无上咒、无等等咒——它能除一切苦，真实不虚。'
  },
  {
    text: '能除一切苦，真实不虚。',
    body: '它能除一切苦，真实不虚——这就是心经的核心：照见五蕴皆空，度一切苦厄。'
  },
  {
    text: '故说般若波罗蜜多咒，即说咒曰：\n揭谛揭谛，波罗揭谛，波罗僧揭谛，\n菩提萨婆诃。',
    body: '所以说般若波罗蜜多咒：揭谛揭谛，波罗揭谛，波罗僧揭谛，菩提萨婆诃。（意为：去吧，去吧，到彼岸去吧，大家一起到彼岸去吧，成就菩提！）'
  }
];

// ===== 经典文库（经典·读经页 · 可点选品读的经典合集）=====
// 合规口径：经典作为「照见与体悟」的文本，注释统一落在觉察/当下/放下，不渲染神通吉凶。
export type ScriptureTradition = '佛' | '道' | '儒' | '诗词';

// 情境/情绪维度：经典文库不再只按"书"排，而是按"你今晚怎么了"排
export type ScriptureSituation =
  | '焦虑' | '失眠' | '失恋' | '事业' | '自我怀疑'
  | '迷茫' | '孤独' | '执念' | '想要平静';

export const SCRIPTURE_SITUATIONS: { key: ScriptureSituation; label: string; emoji: string }[] = [
  { key: '焦虑', label: '焦虑', emoji: '🌪️' },
  { key: '失眠', label: '失眠', emoji: '🌙' },
  { key: '失恋', label: '失恋', emoji: '💔' },
  { key: '事业', label: '事业卡住', emoji: '🧭' },
  { key: '自我怀疑', label: '自我怀疑', emoji: '🪞' },
  { key: '迷茫', label: '迷茫', emoji: '🌫️' },
  { key: '孤独', label: '孤独', emoji: '🌑' },
  { key: '执念', label: '放不下', emoji: '🔗' },
  { key: '想要平静', label: '想平静', emoji: '🍃' },
];

export interface ScripturePassage {
  text: string;
  body: string;
}

export interface ScriptureItem {
  id: string;
  title: string;
  tradition: ScriptureTradition;
  source: string;
  intro: string;
  /** 该经典能照见的情绪/困境维度，用于"你今晚怎么了"筛选 */
  situations: ScriptureSituation[];
  passage: ScripturePassage[];
}

export const SCRIPTURE_LIBRARY: ScriptureItem[] = [
  {
    id: 'daode',
    title: '道德经',
    tradition: '道',
    source: '老子',
    intro: '道家根本经典。老子以「道」为万物本源，教人在喧嚣里回到虚静，不强求而自在。',
    situations: ['焦虑', '执念', '想要平静', '自我怀疑'],
    passage: [
      { text: '致虚极，守静笃。万物并作，吾以观复。', body: '把心放到最空、最静的状态，看世间万物生发又归复。静不是不动，是看清来去的定力。' },
      { text: '上善若水。水善利万物而不争，处众人之所恶，故几于道。', body: '最好的状态像水：滋养万物却不争抢，甘处低位。不争，反得自在——这是柔软的力量。' },
      { text: '人法地，地法天，天法道，道法自然。', body: '人效法大地，大地效法天，天效法道，道只效法它本来的样子。最高的秩序，是不勉强。' },
    ],
  },
  {
    id: 'jingang',
    title: '金刚经',
    tradition: '佛',
    source: '鸠摩罗什译',
    intro: '般若经典之王。全经讲「应无所住而生其心」，教人放下对一切相的执着。',
    situations: ['执念', '焦虑', '迷茫'],
    passage: [
      { text: '凡所有相，皆是虚妄。若见诸相非相，即见如来。', body: '你看见的一切形相都在变化、并不恒常。能看穿「相」背后的空性，便触及了真实。' },
      { text: '一切有为法，如梦幻泡影，如露亦如电，应作如是观。', body: '所有因缘聚合的事，都像梦、像泡影、像露水闪电般短暂。这样去看，便不会被困在得失里。' },
    ],
  },
  {
    id: 'lunyu',
    title: '论语',
    tradition: '儒',
    source: '孔子及弟子',
    intro: '儒家言行录。孔子不说玄虚，只讲如何在日用之间把人做好、把心安顿。',
    situations: ['事业', '迷茫', '自我怀疑', '想要平静'],
    passage: [
      { text: '学而时习之，不亦说乎？', body: '学了，又在日常里常常温习、实践，那份踏实与欢喜是装不出来的。' },
      { text: '吾日三省吾身：为人谋而不忠乎？与朋友交而不信乎？传不习乎？', body: '每天回头问自己三件事：尽心了吗？守信了吗？所学的践行了吗？反省，是成长的起点。' },
      { text: '知之为知之，不知为不知，是知也。', body: '知道就是知道，不知道就承认不知道——这份诚实本身已是智慧。' },
    ],
  },
  {
    id: 'tanjing',
    title: '六祖坛经',
    tradition: '佛',
    source: '惠能',
    intro: '中国禅宗根本经典，主张「即心即佛」，顿悟不假外求。',
    situations: ['自我怀疑', '焦虑', '想要平静'],
    passage: [
      { text: '菩提本无树，明镜亦非台。本来无一物，何处惹尘埃。', body: '心本清净，又何须时时擦拭？烦恼多是自己拂上的尘。放下「我在修行」的念头，清净就现前了。' },
      { text: '佛法在世间，不离世间觉。离世觅菩提，恰如求兔角。', body: '觉悟不在庙里，就在柴米油盐的当下。离开生活去找开悟，就像找兔子头上的角——本就无此物。' },
    ],
  },
  {
    id: 'zhuangzi',
    title: '庄子',
    tradition: '道',
    source: '庄周',
    intro: '道家的逍遥之书。庄子用寓言教人松开执念，与变化同游，活得舒展。',
    situations: ['失恋', '执念', '想要平静', '孤独'],
    passage: [
      { text: '且夫水之积也不厚，则其负大舟也无力。', body: '水积得不够深，就托不起大船。厚积，方能载动人生的风浪。' },
      { text: '泉涸，鱼相与处于陆，相呴以湿，相濡以沫，不如相忘于江湖。', body: '困顿时彼此吐沫相救固然动人，但不如各自回到江河、自在从容。有时放手，才是更深的成全。' },
    ],
  },
  {
    id: 'shijing',
    title: '诗经',
    tradition: '诗词',
    source: '先秦歌谣',
    intro: '中国最早的诗歌总集。三千年前的情与景，读来仍心头一热。',
    situations: ['失恋', '孤独', '迷茫'],
    passage: [
      { text: '关关雎鸠，在河之洲。窈窕淑女，君子好逑。', body: '水鸟和鸣，引动少年心头最初的喜欢。美好的情感，本就如自然一样坦荡。' },
      { text: '蒹葭苍苍，白露为霜。所谓伊人，在水一方。', body: '芦苇茫茫，伊人在水那一边。求而不得的距离里，藏着最温柔的怅惘。' },
    ],
  },
  {
    id: 'dingfengbo',
    title: '定风波 · 苏轼',
    tradition: '诗词',
    source: '苏轼',
    intro: '苏轼被贬黄州途中遇雨所作。一场突如其来的雨，被他走成了人生的注脚。',
    situations: ['焦虑', '失恋', '迷茫', '事业'],
    passage: [
      { text: '莫听穿林打叶声，何妨吟啸且徐行。', body: '别管那穿林打叶的雨声，不妨一边吟唱一边慢慢走。外界的风雨，挡不住内心的从容。' },
      { text: '回首向来萧瑟处，归去，也无风雨也无晴。', body: '回头看那阵风雨，走过去了才发现：既没有雨，也没有晴。起落皆是过眼，心平了天就晴了。' },
    ],
  },
  {
    id: 'yinjiu',
    title: '饮酒 · 陶渊明',
    tradition: '诗词',
    source: '陶渊明',
    intro: '陶渊明归隐后的闲适之作。在鸡犬相闻的村居里，他安顿下了一颗不躁的心。',
    situations: ['焦虑', '想要平静', '孤独'],
    passage: [
      { text: '结庐在人境，而无车马喧。问君何能尔？心远地自偏。', body: '住在人群里，却听不到车马喧嚣。秘诀无他——心若疏远了纷扰，地方自然就安静了。' },
      { text: '采菊东篱下，悠然见南山。', body: '在东篱下采菊，一抬头，南山就在那里。不刻意寻找，美好自会撞个满怀。' },
    ],
  },
];

// ===== 供养心斋 =====
export interface Offering {
  id: string;
  icon: string;
  name: string;
  desc: string;
  price: string;
  tag: string;
  featured?: boolean;
  toast: string;
  /** 对齐后端 donations TIERS：心意 / 诚意 / 大愿 / 自定义 */
  tier: string;
}

export const OFFERINGS: Offering[] = [
  { id: 'tea', icon: '🍵', name: '一盏茶', desc: '为心斋添一壶热茶', price: '¥6.6', tag: '随喜', tier: '心意', toast: '🍵 谢谢你的茶！一盏茶暖一室同修' },
  { id: 'incense', icon: '🪔', name: '一炷香', desc: '为同修燃一盏清净香', price: '¥19.9', tag: '随喜', tier: '诚意', toast: '🪔 谢谢你的香！一炷香清净一方心田' },
  { id: 'lamp', icon: '🏮', name: '一盏灯', desc: '为迷途的人点亮心灯', price: '¥66', tag: '最受欢迎', featured: true, tier: '大愿', toast: '🏮 谢谢你的灯！一盏灯照亮一段归途' },
  { id: 'free', icon: '💛', name: '随缘', desc: '金额随心，一片心意', price: '任意金额', tag: '随喜', tier: '自定义', toast: '💛 随喜即是最好的供养' }
];

// ===== 情绪打卡 =====
export interface MoodEntry {
  date: string;   // YYYY-MM-DD
  score: number;  // 1(低落) ~ 5(舒展)
  mood: string;   // 标签
  emoji: string;
  note?: string;
}

export const MOOD_OPTIONS: { emoji: string; label: string; score: number }[] = [
  { emoji: '😔', label: '低落', score: 1 },
  { emoji: '😰', label: '焦虑', score: 2 },
  { emoji: '😐', label: '一般', score: 3 },
  { emoji: '🙂', label: '安稳', score: 4 },
  { emoji: '🌿', label: '舒展', score: 5 },
];

// ===== 修行存档（localStorage） =====
export interface HealingSave {
  date: string;
  xp: number;
  quests: Record<string, boolean>;
  chatCount: number;
  sutraOpened: boolean[];
  sutraRead: boolean;
  /** 诵读足迹：已诵读日期（YYYY-MM-DD）列表，用于连续/累计天数统计 */
  sutraDates?: string[];
  /** 静坐足迹：已完成静坐/冥想日期（YYYY-MM-DD）列表，用于修行日历热力图 */
  meditationDates?: string[];
  wudao: { text: string; src: string; time: string; likes?: number }[];
  moods: MoodEntry[];
}

export const SAVE_KEY = 'om_healing';
// P2-1/A 收口：旧键惰性迁移，用户已存修行存档零丢失
registerLegacy('xuan_healing_v1', SAVE_KEY);

export function todayStr(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function defaultSave(): HealingSave {
  return { date: todayStr(), xp: 0, quests: {}, chatCount: 0, sutraOpened: [], sutraRead: false, sutraDates: [], meditationDates: [], wudao: [], moods: [] };
}

export function loadSave(): HealingSave {
  const s = defaultSave();
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      s.xp = p.xp || 0;
      s.wudao = p.wudao || [];
      s.moods = p.moods || [];
      s.quests = p.quests || {};
      s.chatCount = p.chatCount || 0;
      s.sutraOpened = p.sutraOpened || [];
      s.sutraRead = p.sutraRead || false;
      s.sutraDates = p.sutraDates || [];
      s.meditationDates = p.meditationDates || [];
      if (p.date !== todayStr()) {
        s.quests = {};
        s.chatCount = 0;
        s.sutraOpened = [];
        s.sutraRead = false;
      }
    }
  } catch (e) {
    /* ignore */
  }
  return s;
}

export function persistSave(s: HealingSave): void {
  try {
    s.date = todayStr();
    // 本地优先 + 异步上云（om_healing 已在 CLOUD_KEYS 登记；syncCloud 启动时负责云端→本地恢复）
    setCloudItem(SAVE_KEY, JSON.stringify(s));
  } catch (e) {
    /* ignore */
  }
}

// ===== 每日一偈（经典·读经页首屏）=====
// 候选池：汇中心经 / 经典文库精华句 / 每日一悟，作为「取一句今日智慧」的来源。
// 合规口径：仅作照见与体悟，不渲染吉凶神通、不作求签算命。
export interface VerseItem {
  text: string;
  source: string;
}

export const DAILY_VERSE_POOL: VerseItem[] = [
  ...HEALING_QUOTES.map(q => ({ text: q.text, source: q.source })),
  ...SUTRA_LINES.map(s => ({ text: s.text, source: '般若波罗蜜多心经' })),
  ...FULL_SUTRA.map(s => ({ text: s.text.replace(/\n/g, ' '), source: '般若波罗蜜多心经' })),
  ...SCRIPTURE_LIBRARY.flatMap(s =>
    s.passage.map(p => ({ text: p.text, source: `${s.title} · ${s.source}` }))
  ),
];

// 按日期字符串生成稳定种子，保证「今天」的偈语全局一致（换一句则用随机）
export function getDailyVerse(dateStr: string): VerseItem {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
  return DAILY_VERSE_POOL[h % DAILY_VERSE_POOL.length];
}
