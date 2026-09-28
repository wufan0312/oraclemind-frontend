// ============================================================================
// 玄镜 OracleMind · 疗愈心斋 · 冥想内容库 + 助眠声景元数据
// 引导文案用于 Web Speech (speechSynthesis) 朗读；ambient 用于 Web Audio 背景声。
// ============================================================================

import type { AmbientType } from '@/lib/ambientAudio';

export interface MeditationStep {
  text: string;
  sec: number;
}

export interface MeditationSession {
  id: string;
  title: string;
  category: string;     // 呼吸 / 身体扫描 / 慈心 / 专注 / 睡眠
  duration: number;     // 秒
  summary: string;
  steps: MeditationStep[];
  ambient: AmbientType; // 引导期间的背景声
}

// 分步文案中译，时长之和 = duration
export const MEDITATION_SESSIONS: MeditationSession[] = [
  {
    id: 'breath-space',
    title: '三分钟呼吸空间',
    category: '呼吸',
    duration: 180,
    summary: '把注意力轻轻带回呼吸，给情绪一个喘息的空隙。',
    ambient: 'none',
    steps: [
      { text: '欢迎来到这段小小的呼吸空间。请找个舒服的姿势坐下，让脊背自然舒展，轻轻闭上眼睛，或让目光柔和地落在前方。', sec: 20 },
      { text: '把注意力带到呼吸上。不用去改变它，只是感受空气进入鼻腔，胸腔缓缓起伏。', sec: 30 },
      { text: '跟着我：吸气……一、二、三、四。屏住……一、二。慢慢呼气……把今天攒了一天的紧绷，轻轻放掉。', sec: 30 },
      { text: '如果念头飘走了，没关系，那很正常。温柔地，把它带回到呼吸。再来一次深长的吸气。', sec: 30 },
      { text: '现在，把一只手放在心口，感受它的温度与跳动。你在这里，此刻，已经足够好。', sec: 25 },
      { text: '最后三次深呼吸，让肩膀、下巴、眉心一处一处松下来。', sec: 20 },
      { text: '准备好了，就慢慢睁开眼睛。把这份安静，轻轻带回接下来的生活里。', sec: 25 },
    ],
  },
  {
    id: 'body-scan',
    title: '身体扫描 · 安睡引导',
    category: '身体扫描',
    duration: 300,
    summary: '从脚趾到头顶，逐一关照身体的每一处，让紧绷在觉察中融化。',
    ambient: 'bowl',
    steps: [
      { text: '躺下来，或者靠得舒服一些。让被褥托住你，就像大地托住山川。今晚，你什么都不必做。', sec: 30 },
      { text: '把注意带到右脚趾，感受它们是否还攥着白天的用力。试着，对它说一声：可以松开了。', sec: 35 },
      { text: '让放松像温水一样，漫过脚踝、小腿、膝盖……每一寸肌肉都沉向床面。', sec: 35 },
      { text: '来到腹部，随着呼吸轻轻起伏。这里，是你安放情绪的地方，此刻它很安全。', sec: 35 },
      { text: '放松双肩，它们扛了一整天。让锁骨打开，像退潮后摊开的沙滩。', sec: 35 },
      { text: '关照面部：松开咬紧的牙关，舒展眉心，让眼皮沉沉地覆盖下来。', sec: 35 },
      { text: '现在，整个人都沉静了。把今天交出去，交给黑夜，交给睡眠。晚安。', sec: 55 },
    ],
  },
  {
    id: 'loving-kindness',
    title: '慈心冥想',
    category: '慈心',
    duration: 240,
    summary: '把善意先给自已，再流向重要的人，最后流向整个世界。',
    ambient: 'pink',
    steps: [
      { text: '把手放在心口，感受掌心的温暖。今天，我们先对自己，温柔一点。', sec: 30 },
      { text: '在心里默念：愿我平安，愿我健康，愿我自在。不用急着相信，只是轻轻念着。', sec: 40 },
      { text: '想起一个你爱的人，把同样的祝愿送给他：愿你平安，愿你被温柔以待。', sec: 40 },
      { text: '再想起一个曾让你为难的人。也把祝愿送过去——放下，是先放过自己。', sec: 40 },
      { text: '最后，把这股暖意扩向所有人：愿众生，都少一点苦，多一点安稳。', sec: 40 },
      { text: '把这份慈心收回来，放在心里。你刚刚，对自己和 world 都做了一件温柔的事。', sec: 30 },
    ],
  },
  {
    id: 'five-senses',
    title: '五感回到当下',
    category: '专注',
    duration: 150,
    summary: '当思绪乱飞，用五感把自己轻轻锚定在此时此地。',
    ambient: 'white',
    steps: [
      { text: '无论你此刻在想什么，先停一下。我们做一次小小的「着陆」。', sec: 20 },
      { text: '看：环顾四周，默默说出你看到的五样东西。它们的颜色、形状，是怎样的？', sec: 30 },
      { text: '听：闭上眼，捕捉三种声音。远的、近的、你平时忽略的。', sec: 30 },
      { text: '触：感受身体与椅子的接触，衣服的质地，指尖的温度。', sec: 30 },
      { text: '闻与尝：深吸一口气，有没有什么气味？舌尖是什么味道？', sec: 25 },
      { text: '好，你已经回到了此刻。焦虑常常活在未来，而你的身体，只在此地。', sec: 15 },
    ],
  },
  {
    id: 'release-anxiety',
    title: '释放焦虑',
    category: '呼吸',
    duration: 210,
    summary: '给翻涌的念头一个容器，让它在呼吸里慢慢沉淀。',
    ambient: 'brown',
    steps: [
      { text: '焦虑来的时候，身体会先知道。先做一个动作：把肩膀放下来，深深吸一口气。', sec: 30 },
      { text: '把此刻最担心的那件事，在心里轻轻命名。不必解决它，只是看见它。', sec: 35 },
      { text: '像对着一池浑水：你越搅动，它越浊。所以，先不动。吸气，呼气，让它自己沉淀。', sec: 40 },
      { text: '对自己说：这件事我现在处理不了，但今晚，我允许自己先放下。', sec: 35 },
      { text: '想象焦虑是一缕烟，随呼气从胸口飘出，散在空气里，越来越淡。', sec: 35 },
      { text: '剩下的，交给时间。此刻你是安全的。呼吸还在，你就在。', sec: 35 },
    ],
  },
  {
    id: 'gratitude-sleep',
    title: '睡前感恩',
    category: '睡眠',
    duration: 180,
    summary: '在入睡前，存下今天三件值得感谢的小事，带着暖意入睡。',
    ambient: 'ocean',
    steps: [
      { text: '夜深了。把手机放远一点，让这一天真正结束。今晚，我们只做一件事：感谢。', sec: 25 },
      { text: '想起今天一件小事——一杯热茶、一句问候、一段好天气，在心里说声谢谢。', sec: 35 },
      { text: '再想起一个你感激的人。不必告诉 TA，只需在心里，把这份谢意停留几秒。', sec: 35 },
      { text: '也谢谢今天努力的自己。哪怕只是准时吃了饭，也值得被自己看见。', sec: 35 },
      { text: '把这三份感恩，像三颗小星星，放进今晚的梦里。', sec: 25 },
      { text: '现在，放下一切。愿你在感恩里，安稳入睡。', sec: 25 },
    ],
  },
];

export interface AmbientMeta {
  type: AmbientType;
  label: string;
  emoji: string;
}

// 助眠声景选项（none 在 UI 另作「静默」处理）
export const AMBIENT_OPTIONS: AmbientMeta[] = [
  { type: 'white', label: '白噪音', emoji: '🌫️' },
  { type: 'pink', label: '粉噪音', emoji: '🌸' },
  { type: 'brown', label: '棕噪音', emoji: '🌧️' },
  { type: 'rain', label: '雨声', emoji: '☔' },
  { type: 'ocean', label: '海浪', emoji: '🌊' },
  { type: 'bowl', label: '颂钵', emoji: '🔔' },
];

export const SLEEP_TIMER_OPTIONS = [
  { label: '15 分钟', sec: 15 * 60 },
  { label: '30 分钟', sec: 30 * 60 },
  { label: '45 分钟', sec: 45 * 60 },
  { label: '60 分钟', sec: 60 * 60 },
  { label: '不定时', sec: 0 },
];

// ===== 静坐计时预设（自定练习用，非引导）=====
export const MEDITATION_TIMER_OPTIONS = [
  { label: '5 分钟', sec: 5 * 60 },
  { label: '10 分钟', sec: 10 * 60 },
  { label: '15 分钟', sec: 15 * 60 },
  { label: '20 分钟', sec: 20 * 60 },
  { label: '不定时', sec: 0 },
];

// ===== 正念小练习（速览卡 · 纯文字行动指引，与引导音频互补）=====
export interface MindfulPractice {
  id: string;
  title: string;
  emoji: string;
  minutes: number;
  desc: string;
  steps: string[];
}

export const MINDFUL_PRACTICES: MindfulPractice[] = [
  {
    id: 'breath-478',
    title: '4-7-8 呼吸',
    emoji: '🌬️',
    minutes: 2,
    desc: '用节奏呼吸，三两下就让紧绷松下来。',
    steps: ['吸气 4 秒', '屏息 7 秒', '缓慢呼气 8 秒', '重复 4 轮'],
  },
  {
    id: 'body-scan-mini',
    title: '三分钟身体扫描',
    emoji: '🧎',
    minutes: 3,
    desc: '从脚趾到头顶，把紧绷一处一处松开。',
    steps: ['坐下，轻轻闭眼', '注意力从脚慢慢移到头顶', '每到一个部位，轻轻说「松」', '不评判，只是关照'],
  },
  {
    id: 'five-senses',
    title: '五感着陆',
    emoji: '👀',
    minutes: 3,
    desc: '思绪乱飞时，用五感把自己锚回此刻。',
    steps: ['看 5 样东西', '听 3 种声音', '触 2 种质感', '闻 1 种气味'],
  },
  {
    id: 'loving-mini',
    title: '慈心三句话',
    emoji: '💗',
    minutes: 2,
    desc: '把善意先给自己，再流向他人。',
    steps: ['把手放胸口', '默念：愿我平安', '愿我爱的人平安', '愿众生少一点苦'],
  },
  {
    id: 'walk',
    title: '步行冥想',
    emoji: '🚶',
    minutes: 5,
    desc: '把走路变成练习，感受脚掌起落。',
    steps: ['放慢脚步', '感受脚掌触地、离地', '呼吸与步伐合拍', '念头飘走，拉回脚步'],
  },
  {
    id: 'eat',
    title: '正念饮食',
    emoji: '🍃',
    minutes: 5,
    desc: '第一口，慢慢尝，重新认识食物。',
    steps: ['夹起食物，先看', '放进嘴里，别急', '感受味道与质地', '咽下，留意满足'],
  },
];

