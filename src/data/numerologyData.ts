// ============================================================================
// 玄镜 OracleMind · 数字密码数据模块
// 提取自原型 js/app.js 的 NUM_DATA / YEAR_MEANING / NUM_COLORS
// ============================================================================

import { hanziToPinyin } from './pinyinData';

/** 单个数字的完整解读 */
export interface NumDetail {
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

/** 1~9 每个数字的完整解读 */
export const NUM_DATA: Record<number, NumDetail> = {
  1: { name: '开创者', element: '火', color: '红 · 金', keywords: '独立 · 领导 · 创造 · 自信', talent: '开创与决断', lesson: '学会合作与倾听', career: '创业者 · 管理者 · 设计师', mate: '4、6 号人最合拍', posi: '自信果敢、行动力强', nega: '固执独断、欠缺耐心', desc: '1 是万物的起点。你天生带着开创的能量，敢于从 0 到 1，是天生的开拓者。人生课题在于：在坚定自我与接纳他人之间找到平衡，学会把「我」变成「我们」。' },
  2: { name: '调和者', element: '水', color: '蓝 · 银', keywords: '合作 · 平衡 · 细腻 · 直觉', talent: '协调与共情', lesson: '避免过度依赖他人', career: '外交 · 咨询 · 护理 · 艺术', mate: '4、8 号人最合拍', posi: '温柔包容、洞察人心', nega: '优柔寡断、易被影响', desc: '2 是关系的桥梁。你天生敏感细腻，擅长感受氛围、调和矛盾，是团队里天然的润滑剂。人生课题在于：把自己的感受也放在同等重要的位置，学会说不。' },
  3: { name: '表达者', element: '木', color: '黄 · 橙', keywords: '表达 · 创意 · 社交 · 乐观', talent: '表达与创造', lesson: '专注深耕、不浅尝辄止', career: '写作 · 演艺 · 营销 · 设计', mate: '1、5 号人最合拍', posi: '才华外放、感染力强', nega: '浮夸散漫、三分钟热度', desc: '3 是语言的魔法师。你天生善于表达、灵感源源不断，走到哪里都是气氛中心。人生课题在于：把喷涌的创意沉淀成作品，学会在一件事上扎下根。' },
  4: { name: '建造者', element: '土', color: '绿 · 棕', keywords: '稳定 · 执行 · 秩序 · 可靠', talent: '规划与执行', lesson: '学会灵活应变', career: '工程 · 财务 · 行政 · 法律', mate: '2、7 号人最合拍', posi: '踏实可靠、步步为营', nega: '僵化固执、抗拒变化', desc: '4 是大地的建造者。你天生可靠、注重秩序，能把想法一步步落地成现实，是所有人最信任的伙伴。人生课题在于：在规则与变化之间留出弹性，接受世界的不可控。' },
  5: { name: '探索者', element: '火', color: '红 · 紫', keywords: '自由 · 冒险 · 应变 · 好奇', talent: '适应与突破', lesson: '学会坚持与承担', career: '旅行 · 销售 · 媒体 · 公关', mate: '3、9 号人最合拍', posi: '灵活机智、拥抱变化', nega: '逃避责任、难以安定', desc: '5 是风中的旅人。你天生向往自由、对新事物永远好奇，危机在你眼里都是转机。人生课题在于：在自由和承诺之间找到平衡，让冒险有归处。' },
  6: { name: '守护者', element: '金', color: '粉 · 白', keywords: '责任 · 关爱 · 完美 · 疗愈', talent: '照顾与疗愈', lesson: '接受不完美、适度放手', career: '教育 · 医护 · 家装 · 心理', mate: '1、9 号人最合拍', posi: '温暖负责、为爱付出', nega: '过度操心、自我牺牲', desc: '6 是家的守护星。你天生有强烈的责任感与爱的能力，总想为在乎的人撑起一片天。人生课题在于：爱别人的同时也爱自己，学会接受世间本无完美。' },
  7: { name: '智慧探索者', element: '水', color: '靛 · 紫', keywords: '思考 · 洞察 · 灵性 · 独立', talent: '分析与洞察', lesson: '学会信任直觉', career: '研究 · 科技 · 哲学 · 玄学', mate: '2、5 号人最合拍', posi: '深邃冷静、看透本质', nega: '孤僻多疑、封闭自我', desc: '7 是夜空的观星者。你天生具备深刻的洞察力和分析能力，是天生的研究者和思考者。人生课题在于：学会信任直觉，在理性与灵性之间找到平衡。' },
  8: { name: '掌舵者', element: '土', color: '黑 · 金', keywords: '权力 · 财富 · 掌控 · 格局', talent: '统筹与创造财富', lesson: '平衡物质与精神', career: '金融 · 管理 · 法律 · 创业', mate: '2、6 号人最合拍', posi: '有魄力、格局宏大', nega: '控制欲强、易被欲望牵引', desc: '8 是王座的掌权者。你天生对资源和权力敏感，有把事业做大做强的格局与手腕。人生课题在于：让财富与权力为更大的善意服务，别被数字定义。' },
  9: { name: '圆满者', element: '火', color: '白 · 红', keywords: '大爱 · 智慧 · 放下 · 慈悲', talent: '感召与成就他人', lesson: '学会放手的艺术', career: '公益 · 艺术 · 导师 · 慈善', mate: '3、6 号人最合拍', posi: '胸怀宽广、悲天悯人', nega: '过度理想化、容易心累', desc: '9 是旅程的终点站。你天生带着大爱与智慧，看得懂全局，也愿意成就别人。人生课题在于：学会放下不属于自己的责任，让慈悲不变成负担。' },
  // ===== 大师数（能量翻倍，不化简）=====
  11: { name: '启蒙者', element: '光', color: '银 · 紫', keywords: '直觉 · 灵性 · 启发 · 洞见', talent: '灵感与灵性觉察', lesson: '安顿敏感的神经、化焦虑为洞见', career: '疗愈 · 艺术 · 灵性引导 · 咨询', mate: '2、9 号人最合拍', posi: '直觉敏锐、灵光乍现', nega: '神经紧绷、想太多而内耗', desc: '11 是放大版的 2，也是连接天地的「灵性天线」。你天生带着远超常人的直觉与洞察，常常一句话就点醒别人。人生课题在于：别被过强的感应烧坏自己——学会落地、休息、把灵感变成可执行的表达，而非困在焦虑里。' },
  22: { name: '建造者', element: '土', color: '金 · 靛', keywords: '格局 · 落地 · 统筹 · 远见', talent: '把愿景建成现实', lesson: '在宏大与实操间找到节奏', career: '建筑 · 创业 · 公益组织 · 战略', mate: '4、8 号人最合拍', posi: '格局宏大、能扛大事', nega: '压力过载、想得大却动不了', desc: '22 是放大版的 4，被称为「大师建造者」。你不仅能想，更能把别人的梦想、甚至整个社群的福祉，一砖一瓦落地成真。人生课题在于：别被「非做大不可」压垮——允许自己从小处起步，稳健比规模更重要。' },
  33: { name: '疗愈师', element: '爱', color: '白 · 粉', keywords: '慈悲 · 疗愈 · 奉献 · 引领', talent: '抚慰与光照他人', lesson: '在付出与自爱间守住边界', career: '心理 · 教育 · 医护 · 公益', mate: '6、9 号人最合拍', posi: '温暖有力量、治愈人心', nega: '过度牺牲、背负他人命运', desc: '33 是放大版的 6，被称为「大师疗愈师」。你天生带着深厚的慈悲，像一盏灯，走到哪里都能照亮、安抚身边的人。人生课题在于：疗愈别人之前先疗愈自己——你不必背负所有人的命运，温柔也要有边界。' }
};

/** 流年数字 → 年度主题 */
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

/** 流年数字 → 年度完整解读（多维度） */
export interface YearGuide {
  brief: string;      // 一句话定位
  overview: string;   // 整体氛围
  career: string;     // 事业财运
  love: string;       // 感情人际
  health: string;     // 健康生活
  actions: string[];  // 行动建议
  cautions: string[]; // 注意事项
}

export const YEAR_GUIDE: Record<number, YearGuide> = {
  1: {
    brief: '种子破土之年：一切归零重启，种什么因，得什么果',
    overview: '数字 1 是十年周期的起点，自带「开创」的能量。今年你会有强烈的「想要重新开始」的冲动——换工作、搬家、启动新项目、调整生活节奏。宇宙在给你一块空白画布，重要的是先想清楚要画什么，而不是急着下笔。主动、果断、敢开头，是这一年的制胜心法。',
    career: '事业上适合启动新计划、跳槽或转岗，主动争取比被动等待更有利。年初定下的目标会贯穿一整年，聚焦 1-2 个核心方向，把开头做扎实，远比撒网式的尝试更有后劲。任何「从零开始」的事，今年做都容易有结果。',
    love: '感情上容易遇见「新的可能」：单身者桃花以新面孔为主，主动参加社交会带来机会；有伴者适合把关系重新「经营一遍」——一起去没去过的地方、聊没聊过的话题，让新鲜感回归日常。',
    health: '身体能量处于上升期，很适合建立新的运动习惯。唯一要注意的是：开启新生活时容易用力过猛，先稳住睡眠和饮食节奏，别让「冲劲」透支「续航」。',
    actions: [
      '年初写下一份「年度清单」：1 个主目标 + 3 个小目标',
      '主动争取一次机会：换岗、竞标、表白、报名课程',
      '清理空间：办公桌、衣柜、手机相册，为新能量腾位置',
      '建立一个小习惯（早睡 / 喝水 / 记账），坚持 21 天'
    ],
    cautions: [
      '别同时开启太多新项目，虎头蛇尾会消耗自信',
      '冲动决策（裸辞、大额消费）前先冷静 48 小时',
      '别急着否定过去——「新」不等于「推翻」'
    ]
  },
  2: {
    brief: '慢水静流之年：不争不抢，合作与沉淀是关键词',
    overview: '数字 2 是「关系与平衡」的数字，今年的关键词是「等」和「合」。节奏明显放慢，很多事情急不来，强推反而会反弹。这是适合倾听、观察、结盟的一年——把地基悄悄打牢，把人际悄悄织密，为后面的爆发期蓄力。',
    career: '事业上不宜单打独斗，找搭档、谈合作、借力资源比个人冲锋有效。谈判、对接、斡旋类的工作会特别顺手；年中很可能出现「被介绍机会」的情况，认真对待每一次牵线搭桥，贵人往往以中间人的形式出现。',
    love: '感情是今年的主旋律。单身者容易在熟人圈、合作场景里发展关系，慢热但更稳；有伴者要把「倾听」放在「讲道理」前面——关系的裂缝多半来自忽视，而不是争吵。',
    health: '情绪敏感度上升，容易受他人影响、想太多。适合温和的运动（瑜伽、散步、游泳）来稳心神；注意肠胃和睡眠，压力大时别用食物和熬夜来逃避。',
    actions: [
      '主动约一次重要的人（客户 / 前辈 / 心仪对象）喝咖啡',
      '每天留 10 分钟「只倾听不评判」的对话时间',
      '把搁置的某个合作或申请重新提上日程',
      '练习表达需求，把「随便」换成具体选项'
    ],
    cautions: [
      '别在情绪低落时做重大决定',
      '别为了和谐一味退让，委屈会累积成怨气',
      '别把「慢」理解成「停滞」，蛰伏也是成长'
    ]
  },
  3: {
    brief: '聚光灯下之年：被看见、被听见，表达即生产力',
    overview: '数字 3 是「表达与创造」的数字，今年你会明显感觉「舞台」变大了——机会向你涌来，关键是敢不敢开口、敢不敢露脸。你的输出能力（说话、写作、创作、表演）会被放大，表达得越真诚，收获越大。',
    career: '事业上适合做「需要被看见」的事：汇报、路演、自媒体、提案、讲课。创意灵感源源不断，但要把点子落到作品上，别停留在「想法很多」。上半年积累曝光和作品，下半年更容易接到好机会。',
    love: '单身者魅力值飙升，社交场合容易成为焦点，桃花多但质量参差，先看清再投入；有伴者适合一起「创作点什么」——旅行 vlog、做顿饭、养只宠物，共同体验比礼物更能增进感情。',
    health: '精力旺盛但容易耗散，嗓子、皮肤、上火是常见信号。注意别熬夜赶工，创意型工作尤其需要规律作息兜底；运动选能「出汗排压」的类型，比如舞蹈、跑步、搏击。',
    actions: [
      '每周输出一次：发一条动态、写一段复盘、录一个视频',
      '把「我想做」改成「我报名了」，先上车再补票',
      '参加一次线下活动，认识 3 个新朋友并保持联系',
      '给一个重要的人写一封真诚的信（或长消息）'
    ],
    cautions: [
      '别口无遮拦，表达力强的年份也最容易「说错话」',
      '别只说不做，承诺之前先掂量兑现能力',
      '别被掌声绑架，活成别人期待的样子'
    ]
  },
  4: {
    brief: '夯实地基之年：一砖一瓦，慢即是快',
    overview: '数字 4 是「秩序与建造」的数字，今年的主题是「踏踏实实」。前几年的浮华与动荡开始沉淀，你会更愿意把注意力收回到手头的事上：存钱、考证、健身、装修、搭团队。过程不性感，但每一步都算数。',
    career: '事业进入「深耕期」，适合打磨技能、完善流程、稳固岗位。跳槽不如优化现状划算；把负责的项目做出「标杆案例」，比频繁换赛道更值钱。年中左右可能迎来一次升职或加薪机会，靠的是积累而非运气。',
    love: '感情趋于务实，适合谈婚论嫁、见家长、规划共同生活等「落地」事项。单身者容易被靠谱、踏实的人吸引，别嫌平淡，稳定本身就是稀缺品；有伴者可以把「承诺」落到实处，比如共同存钱计划。',
    health: '身体像机器，需要规律保养：体检、体态、作息。久坐和肩颈问题是重点；建议把运动排进日程表（固定时间），靠意志力不如靠习惯。',
    actions: [
      '建立月度复盘机制：预算、目标、健康三项必查',
      '把一项核心技能打磨到「可展示」的程度',
      '记账 1 个月，砍掉不必要的支出',
      '给家人或伴侣一份「稳定承诺」并兑现'
    ],
    cautions: [
      '别把自己困在舒适区，规律不等于僵化',
      '别只埋头干活忘了抬头看路，方向错了努力白费',
      '别过度节俭，该投资自己的钱要舍得花'
    ]
  },
  5: {
    brief: '风起云涌之年：变化即机会，灵活是护身符',
    overview: '数字 5 是「自由与变化」的数字，今年最大的确定就是「不确定」。计划赶不上变化，但变化里藏着机会：出差、跳槽、搬家、尝试新领域，都可能在今年发生。保持轻盈和开放，别和变化较劲，顺着风走。',
    career: '事业上「变动」是常态，可能面临架构调整、业务转型或岗位轮换。别慌——变动往往伴随新机遇，勇于接住「没人愿意接的活」，最容易弯道超车。适合开拓副业、接触新行业，多线尝试、快速试错。',
    love: '感情容易出现「变数」：异地、聚少离多、关系模式调整。单身者桃花来得快去得也快，享受过程但别轻易承诺；有伴者需要给彼此空间，用信任代替查岗，用惊喜代替套路。',
    health: '身体状态波动大，时好时坏。出行多、作息乱，注意交通安全和饮食卫生；情绪容易躁动，适合用「动态放松」（骑行、攀岩、快走）来释放多余的能量。',
    actions: [
      '拥抱一次「计划外」的邀请：出差、聚会、新项目',
      '更新简历或作品集——不一定要跳槽，但要保持市场感',
      '每季度做一次「断舍离」，轻装上阵',
      '培养一个可迁移技能（英语 / AI 工具 / 剪辑）'
    ],
    cautions: [
      '别裸辞、别裸奔式冒险，自由要有安全垫',
      '别频繁换目标，变化多不等于方向多',
      '别忽视契约与承诺，变动年份更要守信用'
    ]
  },
  6: {
    brief: '爱与责任之年：家的圆心，付出与被需要',
    overview: '数字 6 是「家庭与责任」的数字，今年你的重心会明显向「人」倾斜：家人、伴侣、孩子、挚友。你会更强烈地感觉到「被需要」，也在付出中确认自己的价值。这是修补关系、安家立业的好年份，但记得别把自己燃尽。',
    career: '事业上适合承担「带人」的角色：带团队、带新人、主导跨部门协作。你的可靠会成为口碑，但也要学会分配任务，别什么都往自己身上揽；如果考虑创业或合伙，今年是谈「信任基础」的好时机。',
    love: '感情进入「经营期」，适合见家长、订婚、备孕、共同购房等家庭化进程。有伴者今年的关键词是「平衡」——平衡小家与原生家庭、平衡付出与索取；单身者容易遇到「顾家型」对象，或通过家人介绍结缘。',
    health: '操心多、付出多，能量容易透支。肩颈、心脏、情绪性胃病是重点；记住：照顾好自己，才是对家人最长久的负责。学会把「我没事」换成「我需要休息」。',
    actions: [
      '组织一次家庭聚会，主动修复一段疏远的关系',
      '把「自我关怀」列入日程：每周半天只为自己',
      '在事业上尝试一次「带队」或「帮扶」角色',
      '为重要的人准备一份「用心」的礼物（手作优于购买）'
    ],
    cautions: [
      '别把别人的课题揽成自己的负担',
      '别用「为你好」绑架家人，爱要讲方式',
      '别忽视自己内心的需求，付出型人格也要被看见'
    ]
  },
  7: {
    brief: '向内探索之年：独处充电，答案在安静里',
    overview: '数字 7 是「智慧与灵性」的数字，今年的主题是「向内转」。社交应酬减少是自然规律，不必焦虑——你正在把注意力从外部世界收回来，去整理认知、学习新知、连接内心。独处不是孤独，是蓄能。',
    career: '事业上适合「深耕专业」：研究、分析、写作、学习考证都特别顺。少说话、多钻研，用专业度建立护城河；今年不适合激进扩张，更适合把现有业务想明白、做透。年中可能出现的贵人，多半以「导师」而非「资源」的形式出现。',
    love: '感情需要「精神共鸣」：聊得来比玩得来重要。单身者今年桃花不多，但容易出现高质量的深度关系，别急着确定，先深聊；有伴者需要独处空间，明确表达「我想静静」不是冷暴力。',
    health: '思绪过多容易失眠、偏头痛，精神消耗大于体力消耗。适合冥想、阅读、规律作息；减少无效信息摄入（短视频、八卦），给大脑「断食」的时间。',
    actions: [
      '报一门课 / 读 12 本书，把输入变成体系',
      '每天留 20 分钟「无手机时间」给自己',
      '写日记或复盘，把思考沉淀成文字',
      '主动约一位「比你高维」的人深聊一次'
    ],
    cautions: [
      '别过度内耗，分析太多会错过行动时机',
      '别把自己封闭起来，独处不等于离群索居',
      '别迷信「想通了再动」，边做边想也是智慧'
    ]
  },
  8: {
    brief: '硕果累累之年：掌控与成就，让成果兑现',
    overview: '数字 8 是「权力与财富」的数字，今年是十年周期里的「兑现期」——前几年播的种、攒的本事，开始结出看得见的果实：升职、加薪、订单、口碑、复利。你的能量场变强，敢于争取，也配得上更好。',
    career: '事业上是「收割季」，适合谈薪、竞聘、主导大项目、敲定大单。你的权威感被认可，适合从「做事」转向「布局」；但权力越大责任越大，注意合规与口碑，别因急功近利翻车。',
    love: '感情上容易「以条件论关系」，吸引力法则显灵——你越优秀，越容易吸引匹配的人。单身者有机会遇到实力相当的伴侣；有伴者事业忙碌，注意别让「谈钱」伤感情，给陪伴留出预算。',
    health: '压力与成就并存，血压、睡眠、肝脏（熬夜应酬）是重点。越是丰收年，越要守住健康底盘；建议把体检安排上，运动以力量训练为宜，给身体也「充个值」。',
    actions: [
      '主动谈一次钱：涨薪、报价、结算，别不好意思',
      '复盘过去几年的积累，提炼成可复用的资产',
      '做一次资产配置，让钱开始「工作」',
      '拓展一个「高势能」圈子，和更强的人站在一起'
    ],
    cautions: [
      '别被欲望带着走，守住底线比赚多少重要',
      '别独吞成果，懂得分利才能聚人',
      '别把「忙碌」当「成就感」，警惕过劳'
    ]
  },
  9: {
    brief: '收尾放下之年：清空行囊，为下一个十年让路',
    overview: '数字 9 是「圆满与终结」的数字，今年是十年大周期的「终点站」：旧的关系、旧的工作、旧的模式，该结束的自然会结束。别硬撑、别挽留——清空是为了腾出手接住更好的开始。有失去感是正常的，回头看，你其实已经走了很远。',
    career: '事业上适合「收尾」而非「开新」：完结旧项目、交接旧岗位、退出不合适的关系与赛道。今年不适合重投入新方向，更适合评估与止损；真正属于你的下一程，要到明年（新周期）才会清晰浮现。',
    love: '感情进入「清算期」，该和解的和解，该放手的放手。单身者容易遇见「旧人回归」或「未完成的情感课题」，处理好它，别让执念拖进下一轮；有伴者适合一起做减法，把关系里多余的东西清掉。',
    health: '身体进入「排毒期」：过去的透支、情绪积压会在今年浮现，需要彻底修复。适合断舍离、戒瘾、治疗旧疾；情绪上允许自己「完成一次告别」，哭出来比憋着好。',
    actions: [
      '列一份「告别清单」：该还的人情、该收的尾、该说清的话',
      '完成一次大扫除（房间 / 关系 / 生活习惯）',
      '写一封给过去自己的信，然后封存或烧掉',
      '做一次深度体检，把旧疾彻底处理好'
    ],
    cautions: [
      '别在低谷期做「挽回式」重大决定',
      '别把结束当失败，周期更替是自然规律',
      '别急着立刻开新计划，先让能量归零'
    ]
  }
};

/** 数字 → 幸运色 */
export const NUM_COLORS: Record<number, string> = {
  1: '红 · 金', 2: '蓝 · 银', 3: '黄 · 橙', 4: '绿 · 棕', 5: '红 · 紫',
  6: '粉 · 白', 7: '靛 · 紫', 8: '黑 · 金', 9: '白 · 红',
  11: '银 · 紫', 22: '金 · 靛', 33: '白 · 粉'
};

/** 数字 → 幸运色（HEX，用于色卡/补色可视化；[主色, 辅色]） */
export const NUM_HEX: Record<number, string[]> = {
  1: ['#E63946', '#FFD166'], // 红 · 金
  2: ['#4895EF', '#C0C0C0'], // 蓝 · 银
  3: ['#FFB703', '#FB8500'], // 黄 · 橙
  4: ['#2A9D8F', '#8D6E63'], // 绿 · 棕
  5: ['#9B5DE5', '#E63946'], // 红 · 紫
  6: ['#FF8FAB', '#FFFFFF'], // 粉 · 白
  7: ['#6A4C93', '#B5179E'], // 靛 · 紫
  8: ['#212529', '#D4AF37'], // 黑 · 金
  9: ['#FFFFFF', '#E63946'], // 白 · 红
  11: ['#C0C0C0', '#9B5DE5'], // 银 · 紫
  22: ['#D4AF37', '#6A4C93'], // 金 · 靛
  33: ['#FFFFFF', '#FF8FAB'], // 白 · 粉
};

/**
 * 流月（Personal Month）精要义 —— key 为流月数 1-9。
 * 公式：digitalRoot(出生月 + 出生日 + 当前年 + 当前月)，与流年同源。
 */
export interface MonthGuide {
  /** 一句话月度定位（与 YEAR_MEANING 标题呼应） */
  brief: string;
  /** 本月聚焦点 */
  focus: string;
  /** 本月行动建议 */
  actions: string[];
  /** 事业财运 */
  career: string;
  /** 感情人际 */
  love: string;
  /** 注意避开 */
  cautions: string[];
}
export const MONTH_GUIDE: Record<number, MonthGuide> = {
  1: {
    brief: '开局月：给一个月定调',
    focus: '适合启动新计划、开个好头，把想做的事先迈出第一步， momentum 比完美重要。',
    actions: ['月初列 3 件本月想完成的事', '主动争取一次机会', '清理桌面与数字空间'],
    career: '新项目、新岗位的种子月，主动请缨容易拿到机会；财务上适合做本月预算，把每笔钱花在起跑线上。',
    love: '单身者宜主动破冰，第一印象分外重要；有伴者适合一起立个本月共同目标。',
    cautions: ['别三分钟热度，开局贵在坚持', '避免和前辈硬碰硬'],
  },
  2: {
    brief: '沉淀月：慢下来才稳',
    focus: '本月宜合作、协商、打磨细节，不强推；关系会悄悄变好，贵人常以中间人形式出现。',
    actions: ['约一位重要的人深聊', '把搁置的合作重新提起', '把「随便」换成具体需求'],
    career: '适合谈合作、拉资源，单打独斗效率低；财务宜稳健观望，不做高风险决定。',
    love: '沟通的黄金期，旧误会适合本月化解；多用陪伴代替说教，关系升温靠细节。',
    cautions: ['别在细节里反复内耗', '避免委曲求全式的妥协'],
  },
  3: {
    brief: '表达月：被看见的一个月',
    focus: '社交与创意活跃，敢开口、敢展示，曝光会带来机会，表达越真诚收获越大。',
    actions: ['每周输出一次（动态 / 复盘）', '报名或参加一次线下活动', '给重要的人写句真诚的话'],
    career: '曝光直接兑换机会：汇报、提案、面试都容易加分；有副业念头的可以试水内容变现。',
    love: '社交活跃桃花多，但要做筛选；有伴者多制造仪式感，一句话的浪漫胜过贵重礼物。',
    cautions: ['别撒太多网收不回来', '慎防言多必失'],
  },
  4: {
    brief: '落地月：一砖一瓦',
    focus: '适合打基础、建习惯、完善流程，过程不性感但都在累计，稳即是快。',
    actions: ['建立月度复盘（预算 / 健康 / 目标）', '打磨一项核心技能到可展示', '记账或存一笔小钱'],
    career: '打地基月：建流程、补短板、考证学习；短期看不到爆发，回报会在下个季度兑现。',
    love: '关系走务实路线，一起规划现实问题（居住、开销、计划）比浪漫桥段更贴心。',
    cautions: ['别钻牛角尖，过度保守会错过窗口', '注意久坐带来的颈椎腰椎问题'],
  },
  5: {
    brief: '变动月：顺势而为',
    focus: '计划易变，但变化里藏着机会；保持灵活、别和变动较劲，顺着风走。',
    actions: ['接住一个「计划外」的邀请', '更新简历 / 作品集保持手感', '做一次断舍离轻装上阵'],
    career: '变动中有机遇：出差、轮岗、转型都可以接住；理财上避免追涨杀跌，波动期以守为攻。',
    love: '新鲜感是关键词，一起尝试没做过的事；异地 / 异国关系需要多主动一步。',
    cautions: ['别冲动辞职或大额消费', '避免同时开太多条线'],
  },
  6: {
    brief: '关系月：人比事重要',
    focus: '重心向家人 / 伴侣 / 挚友倾斜，是修补关系、安家立业的好月份，但别把自己燃尽。',
    actions: ['组织一次家庭聚会', '每周留半天只为自己', '为重要的人准备用心礼物'],
    career: '团队协作顺，适合处理人事、服务、家庭相关事务；本月种下的口碑日后会返还。',
    love: '家庭与伴侣是绝对重心：适合见家长、安家、修复旧关系；付出也会有被看见的暖。',
    cautions: ['别当老好人接下所有事', '避免忽略自己的感受'],
  },
  7: {
    brief: '内省月：充电而非社交',
    focus: '减少应酬、向内整理，学习考证、独处蓄能的效率最高。',
    actions: ['报一门课或读几本书', '每天 20 分钟无手机时间', '写日记把思考沉淀成文字'],
    career: '宜深耕专业：研究、写作、考证效率高；不适合大动作跳槽，先攒够筹码再说。',
    love: '需要空间感的一个月，高质量独处之后，关系反而更松弛更好。',
    cautions: ['别把自己关太久', '避免过度思虑影响睡眠'],
  },
  8: {
    brief: '兑现月：让成果落袋',
    focus: '努力开始有回报，适合谈薪、主导大项目、做资产配置，但也别被欲望带偏。',
    actions: ['主动谈一次钱 / 报价', '复盘积累成可复用资产', '做一次体检守住健康底盘'],
    career: '收成月：谈薪、报价、主导项目都有底气；适合检视资产配置，把被动收入搭起来。',
    love: '现实话题浮现（房、钱、规划），坦诚聊清楚反而加分；实力是本月最好的情话。',
    cautions: ['别被欲望带偏过度消费', '警惕用健康换钱的倾向'],
  },
  9: {
    brief: '收尾月：清空才轻松',
    focus: '适合完结旧事、断舍离，别急着开新项目，先让能量归零，给下一程让路。',
    actions: ['列一份告别清单', '完成一次大扫除', '处理一件拖延已久的旧事'],
    career: '收尾清账：完结旧项目、整理复盘文档，为新周期腾位置；不宜重仓开新局。',
    love: '情感大扫除月：该断则断、该和好就和好，拖着最耗能量。',
    cautions: ['别急着开启新项目', '避免恋战沉没成本'],
  },
};

/**
 * 流日（Personal Day）精要义 —— key 为流日数 1-9。
 * 公式：digitalRoot(出生月 + 出生日 + 当前年 + 当前月 + 当前日)，与流年同源。
 */
export interface DayGuide {
  brief: string;
  focus: string;
  /** 今日一句提示 */
  tip: string;
  /** 今日宜 */
  dos: string[];
  /** 今日忌 */
  donts: string[];
}
export const DAY_GUIDE: Record<number, DayGuide> = {
  1: {
    brief: '开创日',
    focus: '今天适合主动开头、做决定、发起一件事。',
    tip: '别犹豫，先动起来，开始比完美重要。',
    dos: ['拍板一件拖了很久的事', '主动发起一次对话或邀约'],
    donts: ['犹豫不决反复横跳', '被动等待别人安排'],
  },
  2: {
    brief: '调和日',
    focus: '今天宜合作、倾听、缓和关系。',
    tip: '少争对错，多换位思考，默契在细节里。',
    dos: ['倾听伴侣或同事的真实诉求', '推进一件需要协调的事'],
    donts: ['争论输赢', '强行推销自己的方案'],
  },
  3: {
    brief: '表达日',
    focus: '今天适合沟通、展示、创意输出。',
    tip: '有想法就说出来，真诚的表达最加分。',
    dos: ['把想法写下来或说出去', '在会议 / 社交里发一次言'],
    donts: ['背后议论他人', '把话憋在心里生闷气'],
  },
  4: {
    brief: '务实日',
    focus: '今天适合执行、整理、把事做扎实。',
    tip: '列清单按优先级推进，别贪多求全。',
    dos: ['列清单按优先级执行', '整理文件 / 环境 / 账目'],
    donts: ['贪多求全什么都想要', '为了省事跳过流程'],
  },
  5: {
    brief: '变通日',
    focus: '今天宜灵活应对、拥抱变化。',
    tip: '计划有变别恼，顺势调整反而更顺。',
    dos: ['接住一个计划外的变化', '换一条路试试看'],
    donts: ['死守原计划不放手', '冲动做重大决定'],
  },
  6: {
    brief: '暖心日',
    focus: '今天宜照顾人、经营关系、做点温暖的事。',
    tip: '也别忘了照顾自己，付出要有边界。',
    dos: ['为家人 / 朋友做件小事', '好好吃顿饭，早点回家'],
    donts: ['无限度付出', '翻旧账'],
  },
  7: {
    brief: '静思日',
    focus: '今天适合独处、学习、深度思考。',
    tip: '减少无效信息，给大脑留白。',
    dos: ['留 20 分钟完全独处', '读点有难度的内容'],
    donts: ['刷短视频停不下来', '参加无效应酬'],
  },
  8: {
    brief: '进益日',
    focus: '今天宜推进目标、谈条件、做决策。',
    tip: '该争取就争取，底气来自准备。',
    dos: ['推进关键指标 / 去谈条件', '拍板一个重要决策'],
    donts: ['回避该谈的价码', '情绪化消费'],
  },
  9: {
    brief: '圆满日',
    focus: '今天适合收尾、和解、放下。',
    tip: '结束也是新的开始，别纠结已逝的。',
    dos: ['了结一件未完成的事', '道歉 / 和解 / 释怀'],
    donts: ['开启全新的重要事项', '纠结已经翻篇的旧事'],
  },
};

/**
 * 数字根：逐位相加直到个位数。
 * keepMaster=true 时保留 11 / 22 / 33 大师数不化简（毕达哥拉斯体系能量最高的一类）。
 * 例：38 → 3+8=11（保留）；29 → 11（保留）；普通数 1988-12-09 → 2009 → 2+9=11（保留）。
 */
export function digitalRoot(n: number, keepMaster = false): number {
  while (n > 9) {
    if (keepMaster && (n === 11 || n === 22 || n === 33)) return n;
    let s = 0;
    while (n > 0) { s += n % 10; n = Math.floor(n / 10); }
    n = s;
  }
  if (keepMaster && (n === 11 || n === 22 || n === 33)) return n;
  return n;
}

/**
 * 生命灵数（Life Path Number）：毕达哥拉斯数字根，逐位相加到个位数。
 * 全站（数字命理页 / 报告页命主 / 合盘）统一走这一口径（keepMaster=true，保留 11/22/33 大师数），
 * 避免「同一人三处灵数不一致」。
 */
export function lifePathNumber(y: number, m: number, d: number): number {
  return digitalRoot(y + m + d, true);
}

/** 统计年/月/日所有数字在 1~9 中出现的次数 */
export function numGridCounts(y: number, m: number, d: number): Record<number, number> {
  const s = String(y) + String(m) + String(d);
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
  for (const ch of s) { if (ch >= '1' && ch <= '9') counts[+ch]++; }
  return counts;
}

// ============================================================================
// 毕达哥拉斯核心数字（P1-4）
// ----------------------------------------------------------------------------
// 字母 → 数字按 A=1…I=9 循环取值；元音取 A/E/I/O/U（Y 归辅音，与西方主流体系一致）。
// ============================================================================

/** 字母 → 数值（A=1 B=2 … I=9，J=1 循环） */
export const LETTER_VALUE: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((c, i) => { m[c] = (i % 9) + 1; });
  return m;
})();

/** 元音集合（内驱数只统计元音） */
export const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/** 拼音串 → 三类姓名数字 */
export function nameNumbers(pinyin: string): { expression: number; soulUrge: number; personality: number } | null {
  const letters = pinyin.toLowerCase().split('').filter((c) => /[a-z]/.test(c));
  if (!letters.length) return null;
  const sum = (pred: (c: string) => boolean) =>
    letters.filter(pred).reduce((a, c) => a + (LETTER_VALUE[c.toUpperCase()] ?? 0), 0);
  return {
    expression: digitalRoot(sum(() => true), true),
    soulUrge: digitalRoot(sum((c) => VOWELS.has(c)), true),
    personality: digitalRoot(sum((c) => !VOWELS.has(c)), true),
  };
}

/** 挑战数（4 个）：出生月 / 日 / 年各自化到个位后的两两差值，反映需克服的障碍层级 */
export interface ChallengeNumbers {
  /** 第一挑战：月 − 日，早年（0-35 岁）主课题 */
  c1: number;
  /** 第二挑战：日 − 年，中年课题 */
  c2: number;
  /** 第三挑战：第一 − 第二，贯穿一生的底层课题 */
  c3: number;
  /** 第四挑战：月 − 年，面对世界的外部挑战 */
  c4: number;
}

function single(n: number): number { return digitalRoot(n); }

export function computeChallenge(y: number, m: number, d: number): ChallengeNumbers {
  const mo = single(m);
  const da = single(d);
  const ye = single(y);
  const c1 = Math.abs(mo - da);
  const c2 = Math.abs(da - ye);
  const c4 = Math.abs(mo - ye);
  return { c1, c2, c3: Math.abs(c1 - c2), c4 };
}

/** 挑战数 0~8 的解读（0 表示该项差值归零，能量流动无阻塞但也缺张力） */
export const CHALLENGE_DATA: Record<number, { name: string; desc: string }> = {
  0: { name: '无碍', desc: '这一层几乎没有阻力，能量自然流动。风险是缺少张力带来的推力——容易安于现状、动力不足，需要自己给自己设目标。' },
  1: { name: '自我 vs 他人', desc: '在「坚持自己」与「在意他人眼光」之间摇摆。要么过度迎合失去自我，要么过度自我显得独断。课题是：先站稳自己，再从容合作。' },
  2: { name: '亲密 vs 依赖', desc: '害怕亲密又害怕孤单，容易在关系里过度付出或过度退缩。课题是：学会平等地依赖与被依赖，把关系当成选择而不是需要。' },
  3: { name: '表达 vs 自我怀疑', desc: '想说却不敢说，或一说就停不下来。创造力被自我审查卡住。课题是：允许自己「先表达、再完美」，把作品做完比做好更重要。' },
  4: { name: '秩序 vs 束缚', desc: '要么缺乏耐心、做事虎头蛇尾，要么被规则和计划捆死、害怕失控。课题是：建立节奏而非枷锁，允许计划被打乱后重建。' },
  5: { name: '自由 vs 承诺', desc: '渴望自由又渴望归属，临近承诺就想逃，逃开后又空虚。课题是：把「自由」重新定义为「选择自己想要的责任」，而不是无负担。' },
  6: { name: '完美 vs 接纳', desc: '对己对人的标准过高，容易失望、挑剔、替别人背责任。课题是：把标准从「完美」下调到「够好」，允许自己和他人带着瑕疵前行。' },
  7: { name: '信任 vs 怀疑', desc: '要么过度多疑、把人都推开，要么轻信后被伤害。课题是：把怀疑用在验证上而不是预设上——给证据，再下判断。' },
  8: { name: '掌控 vs 焦虑', desc: '对金钱、权力、地位有深层焦虑，容易用力过猛或干脆逃避。课题是：把「掌控感」从外部成就搬回内在节奏，先稳住自己的节奏再谈规模。' },
};

/** 核心数字元信息（展示顺序与一句话释义） */
export const CORE_META: { key: 'expression' | 'soulUrge' | 'personality' | 'maturity'; label: string; icon: string; hint: string }[] = [
  { key: 'expression', label: '表现数', icon: '🎭', hint: '全名所有字母之和 —— 你天生带来的才能与潜能，是「出厂配置」' },
  { key: 'soulUrge', label: '内驱数', icon: '💗', hint: '全名元音之和 —— 你内心真正渴望什么，只有亲近的人才看得到' },
  { key: 'personality', label: '人格数', icon: '🎭', hint: '全名辅音之和 —— 你给外界的 first impression，是「社交面具」' },
  { key: 'maturity', label: '成熟数', icon: '🌳', hint: '生命灵数 + 表现数 —— 中年后真正走向的人生方向' },
];

/** 核心数字快照（可序列化，进云存档） */
export interface NumCore {
  /** 拼音转写（用于复现与展示，空名时为 ''） */
  pinyin: string;
  /** 未识别字符（多音字/生僻字），前端提示用 */
  unmatched: string[];
  expression: number | null;
  soulUrge: number | null;
  personality: number | null;
  maturity: number | null;
  challenge: ChallengeNumbers;
}

/**
 * 计算核心数字。
 * name 为空或无法转拼音时，只返回挑战数（依赖姓名三项为 null）。
 */
export function computeCore(
  y: number, m: number, d: number,
  lifePath: number,
  name: string
): NumCore {
  const challenge = computeChallenge(y, m, d);
  if (!name || !name.trim()) {
    return { pinyin: '', unmatched: [], expression: null, soulUrge: null, personality: null, maturity: null, challenge };
  }
  const py = hanziToPinyin(name.trim());
  const nums = nameNumbers(py.text);
  if (!nums) {
    return { pinyin: py.text, unmatched: py.unmatched, expression: null, soulUrge: null, personality: null, maturity: null, challenge };
  }
  return {
    pinyin: py.text,
    unmatched: py.unmatched,
    expression: nums.expression,
    soulUrge: nums.soulUrge,
    personality: nums.personality,
    maturity: digitalRoot(lifePath + nums.expression, true),
    challenge,
  };
}

// ============================================================================
// 灵码（核心数字组合码）
// ----------------------------------------------------------------------------
// 把「生命灵数 + 生日数 + 姓名四码」按固定顺序缩写成一条代码串，
// 用于一眼看清整张命盘的数字结构，并给出组合层面的整体解读。
// 顺序：LP 生命灵数 → BD 生日数 → EX 表现数 → SU 内驱数 → PE 人格数 → MA 成熟数
// ============================================================================

/** 灵码单段 */
export interface LingPart {
  /** 缩写（LP / BD / EX / SU / PE / MA） */
  abbr: string;
  label: string;
  icon: string;
  /** null = 未解锁（缺姓名或姓名无法转拼音） */
  value: number | null;
  hint: string;
}

export interface LingCode {
  parts: LingPart[];
  /** 代码串，未解锁位用 ? 占位，如 "3 · 9 · 6 · 1 · 5 · 2" */
  codeText: string;
  /** 未解锁段数（0 = 完整） */
  lockedCount: number;
  /** 挑战数四段，如 "1-2-1-4" */
  challengeText: string;
  /** 组合层面的整体解读 */
  readings: { icon: string; text: string }[];
}

/** 大师数（11/22/33）不化简，能量翻倍 */
const MASTER_NUMS = new Set([11, 22, 33]);

/** 统计用的根数（大师数按其根数归组：11→2、22→4、33→6） */
function rootOf(n: number): number {
  return n > 9 ? digitalRoot(n) : n;
}

const LING_GROUPS: { key: string; label: string; nums: number[]; desc: string }[] = [
  { key: 'pioneer', label: '开创组（1·5·7）', nums: [1, 5, 7], desc: '独立、求变、思辨 —— 你习惯自己开路，不喜欢被安排，行动力来自内在冲动。' },
  { key: 'builder', label: '务实组（2·4·8）', nums: [2, 4, 8], desc: '稳定、执行、格局 —— 你擅长搭结构、把事做成，安全感来自可控与可见成果。' },
  { key: 'creator', label: '表达组（3·6·9）', nums: [3, 6, 9], desc: '创造、关怀、慈悲 —— 你靠表达与共情影响他人，情绪和创意是主要燃料。' },
];

/**
 * 生成灵码与整体解读。
 * 无姓名时，姓名四码为 null，解读只基于日期能算出的部分。
 */
export function computeLingCode(core: NumCore | undefined, lifePath: number, birthdayNum: number): LingCode {
  const parts: LingPart[] = [
    { abbr: 'LP', label: '生命灵数', icon: '☉', value: lifePath, hint: '核心天赋与人生课题，整条灵码的主轴' },
    { abbr: 'BD', label: '生日数', icon: '🎯', value: birthdayNum, hint: '出生日的数字根，你的随身天赋、别人最先感受到的能力' },
    { abbr: 'EX', label: '表现数', icon: '🎭', value: core?.expression ?? null, hint: '全名拼音之和 —— 天生才能与潜能，是「出厂配置」' },
    { abbr: 'SU', label: '内驱数', icon: '💗', value: core?.soulUrge ?? null, hint: '全名元音之和 —— 内心真正渴望什么，只有亲近的人才看得到' },
    { abbr: 'PE', label: '人格数', icon: '😶', value: core?.personality ?? null, hint: '全名辅音之和 —— 你给外界的第一印象，是「社交面具」' },
    { abbr: 'MA', label: '成熟数', icon: '🌳', value: core?.maturity ?? null, hint: '生命灵数 + 表现数 —— 中年后真正走向的人生方向' },
  ];

  const lockedCount = parts.filter((p) => p.value == null).length;
  const codeText = parts.map((p) => (p.value == null ? '?' : String(p.value))).join(' · ');
  const ch = core?.challenge;
  const challengeText = ch ? `${ch.c1}-${ch.c2}-${ch.c3}-${ch.c4}` : '—';

  const readings: { icon: string; text: string }[] = [];
  const known = parts.filter((p): p is LingPart & { value: number } => p.value != null);

  // 1) 大师数：能量翻倍，优先提示
  const masters = known.filter((p) => MASTER_NUMS.has(p.value));
  if (masters.length) {
    readings.push({
      icon: '👑',
      text: `灵码里出现大师数 ${masters.map((p) => `${p.value}（${p.label}）`).join('、')} —— 这一位不化简、能量翻倍，天赋与要求都高于普通数字，做得好是引领，滥用则是自我消耗。`,
    });
  }

  // 2) 主导能量组：按根数落在三组的分布
  const tally = LING_GROUPS.map((g) => ({
    g,
    n: known.filter((p) => g.nums.includes(rootOf(p.value))).length,
  })).sort((a, b) => b.n - a.n);
  if (known.length && tally[0].n > 0) {
    if (tally[0].n === tally[1].n && tally[0].n > 0) {
      readings.push({ icon: '⚖️', text: `${tally[0].g.label} 与 ${tally[1].g.label} 在你的灵码中各占 ${tally[0].n} 位 —— 两种能量势均力敌，你既能${tally[0].g.key === 'pioneer' ? '开创' : tally[0].g.key === 'builder' ? '落地' : '感染'}，也能${tally[1].g.key === 'pioneer' ? '开创' : tally[1].g.key === 'builder' ? '落地' : '感染'}，代价是容易在两种模式间反复横跳。` });
    } else {
      readings.push({ icon: '🧭', text: `主导能量：${tally[0].g.label}（灵码中 ${tally[0].n} 位落在此组）。${tally[0].g.desc}` });
    }
  }

  // 3) 内外一致性：内驱数 vs 人格数
  const su = core?.soulUrge ?? null;
  const pe = core?.personality ?? null;
  if (su != null && pe != null) {
    if (su === pe) {
      readings.push({ icon: '🪞', text: `内驱数 ${su} 与人格数 ${pe} 相同 —— 你心里想的和外面呈现的一致，表里如一，别人很少误读你，代价是几乎没有「社交缓冲」，情绪藏不住。` });
    } else {
      readings.push({ icon: '🎭', text: `内驱数 ${su}（${NUM_DATA[su]?.name ?? ''}）× 人格数 ${pe}（${NUM_DATA[pe]?.name ?? ''}）—— 内心要的是 ${NUM_DATA[su]?.talent ?? '—'}，外在呈现的却是 ${NUM_DATA[pe]?.talent ?? '—'}，亲近的人才能看到反差。落差不是伪装，但你需要在信任的人面前主动说出来。` });
    }
  }

  // 4) 天赋与方向：生命灵数 vs 表现数
  const ex = core?.expression ?? null;
  if (ex != null) {
    if (ex === lifePath) {
      readings.push({ icon: '🎯', text: `生命灵数 ${lifePath} 与表现数 ${ex} 同位 —— 你天生会的，正好是这一生要做的。方向感强，但也容易因为「太顺」而在中年缺少重新选择的经验。` });
    } else {
      readings.push({ icon: '🧩', text: `生命灵数 ${lifePath}（${NUM_DATA[lifePath]?.name ?? ''}）走的是 ${NUM_DATA[lifePath]?.talent ?? '—'}，表现数 ${ex}（${NUM_DATA[ex]?.name ?? ''}）给你的工具是 ${NUM_DATA[ex]?.talent ?? '—'} —— 天赋和课题不同源，需要主动把工具用在对的方向上。` });
    }
  }

  // 5) 重复数字：能量叠加
  const freq = new Map<number, string[]>();
  known.forEach((p) => freq.set(p.value, [...(freq.get(p.value) ?? []), p.label]));
  const repeated = [...freq.entries()]
    .filter(([, labels]) => labels.length >= 2)
    .sort((a, b) => b[1].length - a[1].length);
  if (repeated.length) {
    const [num, labels] = repeated[0];
    readings.push({ icon: '🔁', text: `数字 ${num} 在你的灵码里出现 ${labels.length} 次（${labels.join('、')}）—— 这一股能量被反复加码，是你的绝对强项，也是压力最大时最先过载的地方。` });
  }

  // 6) 底层课题：第三挑战贯穿一生
  if (ch) {
    const c3 = CHALLENGE_DATA[ch.c3];
    if (c3) readings.push({ icon: '🧗', text: `底层课题（第三挑战 ${ch.c3} · ${c3.name}）：${c3.desc}` });
  }

  return { parts, codeText, lockedCount, challengeText, readings };
}

// ============================================================================
// 数字配对 / 合盘（P2-1）
// ----------------------------------------------------------------------------
// 契合度不是玄学黑箱，而是三个可解释维度的加权：
//   1) 灵数同组（40 分）—— 毕达哥拉斯经典分组：1·5·7 开创组 / 2·4·8 务实组 / 3·6·9 表达组
//   2) 挑战数互补（30 分）—— 第三挑战（底层课题）相同或互补更容易互相理解
//   3) 九宫格补位（30 分）—— 一方缺的数字另一方有，即为天然互补
// ============================================================================

/** 毕达哥拉斯经典分组：同组内天然合拍 */
const AFFINITY_GROUPS: number[][] = [
  [1, 5, 7], // 开创组：独立、思辨、行动
  [2, 4, 8], // 务实组：稳定、执行、格局
  [3, 6, 9], // 表达组：创造、关怀、慈悲
];

/** 取灵数所属组别（大师数按其根数归组：11→2、22→4、33→6） */
function groupOf(n: number): number {
  const root = n > 9 ? digitalRoot(n) : n;
  return AFFINITY_GROUPS.findIndex((g) => g.includes(root));
}

export interface SynastryResult {
  /** 总契合度 0-100 */
  score: number;
  /** 一句话总评 */
  headline: string;
  /** 三维度拆解 */
  dims: { key: string; label: string; score: number; max: number; desc: string }[];
  /** 优势 */
  strengths: string[];
  /** 需注意 */
  frictions: string[];
}

/** 挑战数关系：相同 = 共同课题；互补（和为 9 或差 4-5）= 互相补位 */
function challengeCompat(a: number, b: number): { score: number; desc: string } {
  if (a === b) return { score: 26, desc: `两人第三挑战同为 ${a}（${CHALLENGE_DATA[a].name}）—— 面对的是同一道课题，容易互相理解，但也容易一起卡住。` };
  const diff = Math.abs(a - b);
  if (diff <= 2) return { score: 20, desc: `挑战数 ${a} 与 ${b} 接近，课题性质相似，能共情对方但不至于完全同质。` };
  if (diff >= 5) return { score: 30, desc: `挑战数 ${a} 与 ${b} 跨度大 —— 你们卡住的地方刚好是对方擅长的地方，互补性最强。` };
  return { score: 24, desc: `挑战数 ${a} 与 ${b} 有差异，相处中需要多解释自己的「卡点」，但也能借此看见另一种解法。` };
}

/** 九宫格补位：A 缺的数字 B 有（及反向），补得越多契合越高 */
function gridCompat(ca: Record<number, number>, cb: Record<number, number>): { score: number; desc: string; filled: number[]; lacked: number[] } {
  const missA = Object.keys(ca).filter((k) => ca[+k] === 0).map(Number);
  const missB = Object.keys(cb).filter((k) => cb[+k] === 0).map(Number);
  const filled = [...new Set([...missA.filter((n) => cb[n] > 0), ...missB.filter((n) => ca[n] > 0)])].sort((x, y) => x - y);
  const lacked = [...new Set(missA.filter((n) => cb[n] === 0))].sort((x, y) => x - y);
  const total = new Set([...missA, ...missB]).size;
  const ratio = total === 0 ? 1 : filled.length / total;
  const score = Math.round(ratio * 30);
  const desc = total === 0
    ? '两人九宫格 1-9 齐全，能量都很完整，相处靠的是选择而非填补。'
    : filled.length
      ? `你缺的 ${filled.join('、')} 号能量，对方恰好有 —— 天然互补，能在对方身上学到自己没有的部分。`
      : '两人缺失的数字高度重叠，空白处需要一起向外借力，而不是指望对方补上。';
  return { score, desc, filled, lacked };
}

/**
 * 计算两人契合度。
 * @param a 本人（灵数 / 挑战 / 九宫格）
 * @param b 对方
 */
export function computeSynastry(
  a: { lifePath: number; challenge: ChallengeNumbers; counts: Record<number, number> },
  b: { lifePath: number; challenge: ChallengeNumbers; counts: Record<number, number> }
): SynastryResult {
  // 维度一：灵数同组（40）
  const ga = groupOf(a.lifePath);
  const gb = groupOf(b.lifePath);
  let groupScore: number;
  let groupDesc: string;
  if (ga === gb && ga >= 0) {
    groupScore = 40;
    groupDesc = `同为${['开创组（1·5·7）', '务实组（2·4·8）', '表达组（3·6·9）'][ga]} —— 底层驱动力一致，相处省力，容易一拍即合。`;
  } else if (ga >= 0 && gb >= 0) {
    groupScore = 26;
    groupDesc = `你属${['开创组', '务实组', '表达组'][ga]}，对方属${['开创组', '务实组', '表达组'][gb]} —— 视角不同，既是吸引力来源，也需要多花时间理解彼此的优先级。`;
  } else {
    groupScore = 30;
    groupDesc = '灵数分组判定为中性，需要结合其他维度综合看待。';
  }

  // 维度二：挑战数互补（30，内部已按比例给 20~30）
  const ch = challengeCompat(a.challenge.c3, b.challenge.c3);

  // 维度三：九宫格补位（30）
  const gr = gridCompat(a.counts, b.counts);

  const score = Math.min(100, groupScore + ch.score + gr.score);

  const strengths: string[] = [];
  const frictions: string[] = [];
  strengths.push(groupDesc);
  strengths.push(ch.desc);
  strengths.push(gr.desc);
  if (a.lifePath === b.lifePath) {
    frictions.push('生命灵数相同 —— 优点和盲区高度重合，冲突时会「用同一种方式吵架」，需要有人先退一步。');
  }
  if (gr.lacked.length) {
    frictions.push(`数字 ${gr.lacked.join('、')} 是两人共同的空缺 —— 这部分能量谁也给不了谁，建议借助外部（朋友、兴趣、专业支持）来补足。`);
  }
  if (a.challenge.c1 === b.challenge.c1) {
    frictions.push(`第一挑战同为 ${a.challenge.c1}，早年课题相似，容易在亲密关系里重复同一模式。`);
  }
  if (!frictions.length) frictions.push('没有明显的结构性冲突，关系质量更多取决于日常沟通与共同目标。');

  const headline =
    score >= 85 ? '天作之合级：能量高度同频，又能互相补上对方的空缺' :
    score >= 70 ? '相当合拍：核心驱动力一致，磨合成本低' :
    score >= 55 ? '互补型：差异既是吸引力也是课题，需要主动经营' :
    '挑战型：能量结构差异明显，需要更多耐心与沟通';

  return {
    score,
    headline,
    dims: [
      { key: 'group', label: '灵数同频', score: groupScore, max: 40, desc: groupDesc },
      { key: 'challenge', label: '课题互补', score: ch.score, max: 30, desc: ch.desc },
      { key: 'grid', label: '能量补位', score: gr.score, max: 30, desc: gr.desc },
    ],
    strengths,
    frictions,
  };
}
