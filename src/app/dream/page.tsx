'use client';

import '@/styles/dream.scss';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  DREAM_CATEGORIES,
  CATEGORY_KEYWORDS,
  matchCategory,
  buildDreamFallback,
  dreamEmoji,
  keywordDreamEmoji
} from '@/data/dreamData';
import type { DreamEntry, DreamCategoryKey } from '@/data/dreamData';
import { requestDreamInterpret, requestDreamInterpretStream, requestDreamChatStream, requestPoster, type InterpretStreamOptions, type ChatHistoryEntry, type PosterResult } from '@/lib/api';
import type { InterpretResponse, DreamPerspective, InterpretMeta } from '@/lib/api';
import { mdToHtml } from '@/lib/markdown';
import { hashStr } from '@/lib/hash';
import { cleanAiTplResidue } from '@/lib/aiText';
import { printDocument } from '@/lib/print';
import Modal from '@/components/ui/Modal';
import CrossPageLink from '@/components/ui/CrossPageLink';
import SectionIcon from '@/components/ui/SectionIcon';
import { showToast } from '@/components/ui/Toast';
import PremiumPurchaseModal from '@/components/PremiumPurchaseModal';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useVisitor } from '@/components/visitor/VisitorProvider';
import DreamVision from '@/components/dream/DreamVision';
import VoiceRecordButton from '@/components/dream/VoiceRecordButton';
import LucidDreamGuide from '@/components/dream/LucidDreamGuide';
import { useShare, shareOutToPoster } from '@/hooks/useShare';
import ShareLoginGate from '@/components/share/ShareLoginGate';
import AiChatWindow from '@/components/ai-chat/AiChatWindow';
import { storage, registerLegacy } from '@/lib/storage';
import { setCloudItem, removeCloudItem } from '@/lib/cloudStore';

/** 梦境分类快捷入口（10 个高频词，保留原有交互） */
const QUICK_KEYWORDS = [
  { label: '🦷 掉牙', keyword: '梦见掉牙' },
  { label: '🐍 蛇', keyword: '梦见蛇' },
  { label: '🪶 飞翔', keyword: '梦见飞' },
  { label: '🌊 水', keyword: '梦见水' },
  { label: '📝 考试', keyword: '梦见考试' },
  { label: '👻 已故亲人', keyword: '梦见去世的亲人' },
  { label: '🏃 被追赶', keyword: '梦见被追' },
  { label: '🤰 怀孕', keyword: '梦见怀孕' },
  { label: '💍 结婚', keyword: '梦见结婚' },
  { label: '💰 发财', keyword: '梦见发财' }
];

const DREAM_FACTS = [
  { icon: '🌙', text: <>每人每晚平均做 <strong>4~6 个梦</strong>，合计约 2 小时</> },
  { icon: '💤', text: '90% 的梦在醒来 5 分钟内被遗忘，想记住就立刻写下来' },
  { icon: '🧠', text: '做梦时大脑的活跃程度，与清醒时几乎相同' },
  { icon: '🎨', text: '约 12% 的人只做黑白梦，老年人占比更高' },
  { icon: '📈', text: <>梦多集中在 REM 期，一夜会经历 <strong>4~5 个周期</strong>，越靠近清晨梦越清晰</> }
];

/** 梦境符号速查：点击常见意象，即时查看一句解读（纯前端，意象解读口吻） */
const DREAM_SYMBOLS: Array<{ icon: string; name: string; mean: string }> = [
  { icon: '🦷', name: '掉牙', mean: '多与健康焦虑、失控感或重要关系变动有关，提醒你关注身体与边界。' },
  { icon: '🕊️', name: '飞翔', mean: '象征渴望自由与突破，近期可能有新机会，或想摆脱某种束缚。' },
  { icon: '📝', name: '考试', mean: '常映射现实中的被评价压力，未必真关乎学业，多是自我要求过高。' },
  { icon: '🐍', name: '蛇', mean: '代表潜藏的欲望、智慧或危机直觉，也可能指向某段需要警惕的关系。' },
  { icon: '🏃', name: '被追', mean: '往往是现实压力的具象化——你在回避某件事，或某个人。' },
  { icon: '🌊', name: '水', mean: '对应情绪之海：平静的水是顺遂，汹涌的水是内心波动。' },
  { icon: '🪞', name: '镜子', mean: '照见真实的自己，可能是你不愿面对的一面，或自我认知的转折。' },
  { icon: '💰', name: '金钱', mean: '关乎自我价值与安全感，梦见得失多在反思「我是否值得」。' },
  { icon: '🚪', name: '迷路', mean: '暗示人生方向感模糊，你正站在某个需要抉择的路口。' },
  { icon: '👤', name: '前任', mean: '未必是想复合，多是未完结的情绪、或未说出口的话在回响。' },
  { icon: '🔥', name: '着火', mean: '多与情绪爆发、创造力或突发危机有关，留意近期的失控感。' },
  { icon: '✈️', name: '迟到', mean: '常是准备不足或怕错失机会的焦虑，反映对当下节奏的不安。' },
  { icon: '🌧️', name: '下雨', mean: '多对应情绪释放与净化，也可能是低落心境的映射，或一场「洗刷」后的重启。' },
  { icon: '🏠', name: '房子', mean: '象征自我与心智的不同层面，房间代表不同状态，空房常是未被察觉的内心角落。' },
  { icon: '🐶', name: '动物', mean: '映射本能或性格的某一面；具体动物有不同寓意，温顺者多指信任，凶猛者多指被压抑的冲动。' },
  { icon: '💍', name: '婚礼', mean: '关乎结合、承诺，或对关系 / 自我整合的渴望，未必指向现实婚恋。' }
];

/** 梦境日记 localStorage 键 */
const DIARY_KEY = 'om_dream_diary';
/** 日记最大保留条数 */
const DIARY_MAX = 30;
/** 对话会话列表 localStorage 键 */
const CHAT_SESSIONS_KEY = 'om_dream_chat_sessions';
// P2-1：旧键（oraclemind_*）惰性迁移到新键
registerLegacy('oraclemind_dream_diary_v1', DIARY_KEY);
registerLegacy('oraclemind_chat_sessions_v1', CHAT_SESSIONS_KEY);
/** 对话会话最大保留条数 */
const CHAT_SESSIONS_MAX = 20;

/** 对话会话持久化结构 */
interface ChatSession {
  id: string;
  dream: string;
  context?: string;
  keyword: string;
  messages: ChatMsg[];
  date: string;
  lastActive: string;
}

interface DiaryItem {
  id: string;
  dream: string;
  title: string;
  emoji: string;
  date: string;
  source: 'local' | 'ai';
}

type AiState = InterpretResponse | 'loading' | 'error' | null;

/** 类型谓词：判断 AI 状态是否为已返回的解读结果（避免 typeof 链式比较触发 TS2367） */
function isAiResult(s: AiState): s is InterpretResponse {
  return !!s && s !== 'loading' && s !== 'error';
}

/** 多轮对话消息条目 */
interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: 'local' | 'ai' | 'perspective';
  perspective?: DreamPerspective;
  streaming?: boolean;
}

/** 生成消息 ID */
const msgId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** 4 视角（前端『换个角度再看』按钮）：key 与 oraclemind-ai DreamPerspective 对齐 */
const PERSPECTIVES: Array<{
  key: DreamPerspective;
  label: string;
  short: string;
  hint: string;
  badge: string;
}> = [
  { key: 'jung',      label: '荣格原型心理学', short: '荣格',   hint: '原型/阴影/补偿/个体化', badge: '🧠' },
  { key: 'freud',     label: '弗洛伊德精神分析', short: '弗洛伊德', hint: '显梦→隐梦/愿望满足/童年溯源', badge: '💭' },
  { key: 'cognitive', label: '认知行为 (CBT)', short: '认知',   hint: '日间线索/认知偏差/应对练习', badge: '🧩' },
  { key: 'fortune',   label: '东方运势视角',   short: '运势',   hint: '周公传统释义/五行取象/宜忌', badge: '🎋' }
];
const DEFAULT_PERSPECTIVE = '__default__';
type PerspectiveKey = DreamPerspective | typeof DEFAULT_PERSPECTIVE;

/**
 * 进入页面时的欢迎消息（小玄，固定 ID 以便判别 / 永不被自动持久化）。
 * 引导用户描述梦境或选快捷入口。
 */
const WELCOME_MSG: ChatMsg = {
  id: '__welcome__',
  role: 'assistant',
  source: 'ai',
  content:
    '嗨，我是小玄 🌙\n\n' +
    '把昨晚的梦讲给我听吧 —— 越细越好。哪怕只是一个画面、一种情绪，我都能帮你「读」出来。\n\n' +
    '下方这些常见梦境也可以直接点 👇',
  streaming: false,
};

/** 聊天窗口空状态引导胶囊（点击直接发起一次解读） */
const CHAT_QUICK_PROMPTS: Array<{ emoji: string; label: string; kw: string }> = [
  { emoji: '🦷', label: '梦见掉牙', kw: '梦见掉牙' },
  { emoji: '🐍', label: '梦见蛇',   kw: '梦见蛇' },
  { emoji: '🪶', label: '梦见飞',   kw: '梦见飞' },
  { emoji: '🌊', label: '梦见水',   kw: '梦见水' },
  { emoji: '🏃', label: '梦见被追', kw: '梦见被追' },
  { emoji: '💰', label: '梦见发财', kw: '梦见发财' },
];

interface DreamEnergy {
  keyword: string;
  yi: string;
  ji: string;
  score: number;
  level: 'low' | 'mid' | 'high';
  levelLabel: string;
  typeEmoji: string;
  typeLabel: string;
  luckyColor: { name: string; hex: string };
  luckyNumber: number;
  luckyDir: string;
  luckyHour: string;
  oracle: string;
}

const ENERGY_TYPES = [
  { emoji: '🌊', label: '疗愈净化型', yi: '独处放空 · 温水沐浴', ji: '硬扛情绪 · 过度社交',
    oracle: ['水面的涟漪，是你昨夜替自己流走的委屈。', '允许自己被温柔地冲刷一遍，明天会轻一些。', '有些答案不在脑海里，而在你愿意松手的瞬间。'] },
  { emoji: '⚡', label: '行动觉醒型', yi: '迈出一步 · 主动表达', ji: '拖延犹豫 · 空想不决',
    oracle: ['梦里推门的手，现实里也该动一动了。', '你比自己以为的，更接近那个转折点。', '收拾好勇气，今天适合把“想”变成“做”。'] },
  { emoji: '🔮', label: '灵感涌动型', yi: '记录灵感 · 自由发散', ji: '自我否定 · 困在逻辑',
    oracle: ['潜意识递来的牌，别急着塞回袖子里。', '今天适合让念头先飞，再落地。', '你忽略的那个意象，藏着下一步的线索。'] },
  { emoji: '🌑', label: '潜意识清理型', yi: '早睡养神 · 写下杂念', ji: '熬夜内耗 · 翻旧账',
    oracle: ['黑不是结束，是你在替白天的自己清场。', '把压住的念头写下来，它就不再是暗涌。', '梦在替你收拾，你只需别再添乱。'] },
  { emoji: '💡', label: '创意迸发型', yi: '尝试新法 · 跨界联想', ji: '墨守成规 · 拒绝变化',
    oracle: ['熟悉的路看腻了，梦给你指了条野路。', '今天适合把两件不相关的事揉在一起。', '灵感的火苗很小，但足够点燃一件事。'] }
] as const;

const LUCKY_COLORS = [
  { name: '月白', hex: '#E8E6FF' },
  { name: '靛蓝', hex: '#5C7CE6' },
  { name: '紫晶', hex: '#9B5CFF' },
  { name: '青碧', hex: '#5CE1E6' },
  { name: '流金', hex: '#FFD98A' },
  { name: '绯樱', hex: '#FF8FA3' },
  { name: '黛绿', hex: '#6FD6A8' },
  { name: '雾紫', hex: '#B9A6E6' }
] as const;

const LUCKY_DIRS = ['正东', '东南', '正南', '西南', '正西', '西北', '正北', '东北'];
const LUCKY_HOURS = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时'];

/**
 * 今日梦境能量：基于最近一次解梦/记录动态生成（无记录时用当天日期作种子，保证“今日感”）。
 * 同个梦 → 结果稳定一致；换梦/换天 → 内容随之变化，可截图分享。
 */
function todayEnergy(seedIn: string | null): DreamEnergy {
  const clean = seedIn && seedIn !== 'AI 梦境解读' ? seedIn : '';
  const base = clean || new Date().toLocaleDateString('zh-CN');
  const t = ENERGY_TYPES[hashStr(base) % ENERGY_TYPES.length];
  const score = 42 + (hashStr(base + 's') % 54); // 42~95
  const level: DreamEnergy['level'] = score >= 80 ? 'high' : score >= 62 ? 'mid' : 'low';
  const levelLabel = level === 'high' ? '能量满格' : level === 'mid' ? '稳中有光' : '蓄势待发';
  const color = LUCKY_COLORS[hashStr(base + 'c') % LUCKY_COLORS.length];
  const luckyNumber = (hashStr(base + 'n') % 9) + 1;
  const luckyDir = LUCKY_DIRS[hashStr(base + 'd') % LUCKY_DIRS.length];
  const luckyHour = LUCKY_HOURS[hashStr(base + 'h') % LUCKY_HOURS.length];
  const oracle = t.oracle[hashStr(base + 'o') % t.oracle.length];
  const keyword = clean
    ? clean.replace(/^梦见/, '').replace(/[—\-].*$/, '').replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '').slice(0, 6) || '转机 · 表达'
    : '转机 · 表达';
  return {
    keyword,
    yi: t.yi,
    ji: t.ji,
    score,
    level,
    levelLabel,
    typeEmoji: t.emoji,
    typeLabel: t.label,
    luckyColor: color,
    luckyNumber,
    luckyDir,
    luckyHour,
    oracle
  };
}

/** Catmull-Rom → 三次贝塞尔，生成平滑曲线 path（用于情绪折线） */
function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/**
 * 解梦页 —— 复刻原型 dream.html 并升级：
 * ① 词库 8 → 48 条、8 大分类浏览；② 真实 AI 深度解读（可选近期背景）；
 * ③ 梦境日记 localStorage 持久化 + 重复追踪；④ 解梦海报生成。
 */
export default function DreamPage() {
  const router = useRouter();
  const { birth: visitorBirth, visitorId } = useVisitor();
  const [keyword, setKeyword] = useState('梦见掉牙');
  const [context, setContext] = useState('');
  const [activeCat, setActiveCat] = useState<DreamCategoryKey>('animal');
  const [result, setResult] = useState<DreamEntry | null>(null);
  const [aiState, setAiState] = useState<AiState>(null);
  const [diary, setDiary] = useState<DiaryItem[]>([]);
  const [showShare, setShowShare] = useState(false);
  /** 一键分享：AI 生图 + 分享文案 */
  const [posterLoading, setPosterLoading] = useState(false);
  const [posterResult, setPosterResult] = useState<PosterResult | null>(null);
  /** 分享存档 Hook：登录守卫 + 挂载自动读库（二次进入直接展示）+ persist 落库 */
  const share = useShare('dream');
  /** 专家解读/社区入口：会员升级弹窗 */
  const [showVipModal, setShowVipModal] = useState(false);
  /** 会员弹窗来源（用于区分哪个入口点击） */
  const [vipModalSrc, setVipModalSrc] = useState<'expert' | 'community'>('expert');
  /** 真实付费弹层（解梦会员，接后端 premium） */
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [quickSym, setQuickSym] = useState<string | null>(DREAM_SYMBOLS[0]?.name ?? null);
  const resultRef = useRef<HTMLDivElement>(null);
  const aiReqIdRef = useRef(0);
  const [fadeKey, setFadeKey] = useState(0);

  // ==== 多视角切换（『换个角度再看』4 按钮） ====
  /** 按视角缓存的解读结果；__default__ 键表示默认通用解读（不指定 perspective） */
  const [perspResults, setPerspResults] = useState<
    Partial<Record<PerspectiveKey, InterpretResponse>>
  >({});
  /** 各视角加载中状态（避免多按钮同时 loading） */
  const [perspLoading, setPerspLoading] = useState<Partial<Record<PerspectiveKey, boolean>>>({});
  /** 当前展示的视角（默认通用解读 → __default__） */
  const [activePersp, setActivePersp] = useState<PerspectiveKey>(DEFAULT_PERSPECTIVE);
  const perspReqRef = useRef(0);

  // ==== 多轮对话窗口 ====
  /** 对话消息列表（初始含小玄欢迎语，让聊天窗口一进页面就有内容） */
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([WELCOME_MSG]);
  /** 底部输入框 */
  const [chatInput, setChatInput] = useState('');
  /** 是否已进入对话模式（默认 true：页面就绪即显示聊天窗口） */
  const [chatMode, setChatMode] = useState(true);
  /** 对话流式中 */
  const [chatStreaming, setChatStreaming] = useState(false);
  /** 梦境图是否已生成并显示 */
  const [visionShown, setVisionShown] = useState(false);
  /** 梦境图生成中（流式绘制动画） */
  const [visionGenerating, setVisionGenerating] = useState(false);
  /** 梦境图 canvas key（强制重渲染触发流式绘制） */
  const [visionKey, setVisionKey] = useState(0);

  /** 生成/重新生成梦境图 */
  const handleGenerateVision = useCallback(() => {
    setVisionShown(true);
    setVisionGenerating(true);
    setVisionKey((k) => k + 1);
  }, []);

  /** 梦境图流式绘制完成回调 */
  const handleVisionDone = useCallback(() => {
    setVisionGenerating(false);
  }, []);
  /** 对话 AbortController */
  const chatAbortRef = useRef<AbortController | null>(null);
  /** 记住初始梦境描述（作为 chat 请求的 dream 参数） */
  const chatDreamRef = useRef('');
  /** 记住初始背景（context） */
  const chatContextRef = useRef<string | undefined>(undefined);
  /** 对话窗口自动贴底：消息/流式内容一变就滚到当前这句；用户上滑看历史时暂停跟随 */
  const { ref: chatScrollRef, scrollToBottom: scrollChatToBottom } = useAutoScroll<HTMLDivElement>([
    chatMessages,
    chatMode,
  ]);

  // ==== 对话会话持久化 ====
  /** 所有历史对话会话 */
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  /** 当前活跃会话 ID */
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  /** 当前梦境关键词（供持久化使用） */
  const sessionKeywordRef = useRef('梦见掉牙');

  // ==== 分类操作历史（已移除，保留占位注释）====

  /** 日期只展示到日，不含时间：兼容空格("2026/8/21 15:38:56"→"2026/8/21") 与 ISO("2026-08-18T03:29:01.462Z"→"2026-08-18") */
  const dateOnly = (dt: string) => {
    const sp = dt.indexOf(' ');
    if (sp >= 0) return dt.slice(0, sp);
    const tp = dt.indexOf('T');
    return tp >= 0 ? dt.slice(0, tp) : dt;
  };

  // ==== 流式打字机 + 停止生成 ====
  const streamAbortRef = useRef<AbortController | null>(null);
  /** 真正触发重渲染的流式状态标志（ref 变化不会 rerender） */
  const [isStreaming, setIsStreaming] = useState(false);
  const makePlaceholderMeta = (m: 'dream' = 'dream'): InterpretMeta => ({
    requestId: 'streaming-placeholder',
    module: m,
    promptVersion: 'streaming',
    provider: 'streaming',
    model: 'streaming',
    cacheHit: false,
    degraded: false,
    degradedReason: null,
    tokens: null,
    costYuan: 0,
    latencyMs: 0,
    truncated: false,
  });

  /** 停止当前正在进行的流式解读（保留已生成文本） */
  const handleStopStream = () => {
    streamAbortRef.current?.abort();
  };

  /**
   * 通用流式解梦：onUpdate 会被回调多次（每次一个 chunk），
   * 返回最终聚合的 InterpretResponse（用于写入缓存）。
   * - reqIdCheck：当存在竞态快照时，若 ID 不匹配则静默丢弃（避免旧请求覆盖新 state）
   * - 若用户中途 abort：返回一个空占位（不抛错），调用方保留已 set 的 partial state 即可
   */
  const runDreamStream = async (
    kw: string,
    ctx: string | undefined,
    perspective: DreamPerspective | undefined,
    onUpdate: (current: InterpretResponse) => void,
    reqIdCheck?: { ref: { current: number }; id: number }
  ): Promise<InterpretResponse> => {
    streamAbortRef.current?.abort();
    const ctrl = new AbortController();
    streamAbortRef.current = ctrl;
    setIsStreaming(true);
    const reqCheckFn = () => !reqIdCheck || reqIdCheck.ref.current === reqIdCheck.id;
    let aborted = false;
    try {
      const finalRes = await requestDreamInterpretStream(kw, ctx, {
        signal: ctrl.signal,
        onDelta: (_chunk, fullText) => {
          if (!reqCheckFn()) return;
          onUpdate({ text: fullText, disclaimer: '', meta: makePlaceholderMeta() });
        },
        onMeta: (meta, disclaimer, fullText) => {
          if (!reqCheckFn()) return;
          onUpdate({ text: fullText, disclaimer, meta });
        },
      }, perspective);
      if (reqCheckFn()) onUpdate(finalRes);
      return finalRes;
    } catch (e: any) {
      if (e?.name === 'AbortError' || /AbortError/.test(String(e?.message || ''))) {
        aborted = true;
        return { text: '', disclaimer: '', meta: makePlaceholderMeta() };
      }
      throw e;
    } finally {
      if (streamAbortRef.current === ctrl) {
        streamAbortRef.current = null;
        setIsStreaming(false);
      }
      void aborted;
    }
  };

  // 加载梦境日记（localStorage 持久化）
  useEffect(() => {
    try {
      const raw = storage.getItem(DIARY_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) setDiary(list.slice(0, DIARY_MAX));
      }
    } catch {
      /* 存储不可用则忽略 */
    }
  }, []);

  // 加载对话会话列表（localStorage 持久化）
  useEffect(() => {
    try {
      const raw = storage.getItem(CHAT_SESSIONS_KEY);
      if (raw) {
        const list = JSON.parse(raw) as ChatSession[];
        if (Array.isArray(list)) {
          setChatSessions(list.slice(0, CHAT_SESSIONS_MAX));
          if (list.length > 0) {
            const latest = list[0];
            setActiveSessionId(latest.id);
            setChatMode(true);
            setChatMessages(latest.messages);
            setKeyword(latest.keyword);
            sessionKeywordRef.current = latest.keyword;
            chatDreamRef.current = latest.dream;
            chatContextRef.current = latest.context;
          }
        }
      }
    } catch {
      /* 存储不可用则忽略 */
    }
  }, []);

  // （分类操作历史已移除，不再恢复上次选中分类）

  /** 重复梦境统计（按内容分组，标记反复出现的主题） */
  const repeatCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of diary) m[d.dream] = (m[d.dream] || 0) + 1;
    return m;
  }, [diary]);

  /** 当前展示的解读标题（海报/日记用） */
  const currentTitle = useMemo(() => {
    if (isAiResult(aiState)) {
      return 'AI 梦境解读';
    }
    return result?.title ?? null;
  }, [aiState, result]);

  const showResult = (kw: string, opts?: { scroll?: boolean }) => {
    // AI 生成解读模式：不再使用本地词库匹配，直接触发 AI 解读
    setKeyword(kw);
    setAiState(null);
    setPerspResults({});
    setActivePersp(DEFAULT_PERSPECTIVE);
    setFadeKey((k) => k + 1);
    if (opts?.scroll) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // 自动触发 AI 解读
    handleInterpret(kw);
  };

  /** 主解梦流程：AI 深度解读（失败本地兜底） */
  /** 首次解梦 → 进入对话模式 */
  const handleInterpret = async (overrideKw?: string) => {
    const kw = (overrideKw || keyword).trim() || '梦见掉牙';
    setKeyword(kw);
    const hasCtx = context.trim().length > 0;
    const reqId = ++aiReqIdRef.current;

    // 记住初始梦境和背景（后续 chat 请求需要）
    chatDreamRef.current = kw;
    chatContextRef.current = hasCtx ? context.trim() : undefined;
    sessionKeywordRef.current = kw;

    // 进入对话模式，清空旧消息 + 视角缓存
    setChatMode(true);
    setChatMessages([]);
    setPerspResults({});
    setActivePersp(DEFAULT_PERSPECTIVE);
    setActiveSessionId(null);
    setVisionShown(false);
    setVisionGenerating(false);
    streamAbortRef.current?.abort();
    chatAbortRef.current?.abort();

    // 添加用户消息（梦境描述）
    const userMsg: ChatMsg = { id: msgId(), role: 'user', content: kw };

    // AI 深度解读 → 流式首条
    setChatMessages([userMsg, { id: msgId(), role: 'assistant', content: '', source: 'ai', streaming: true }]);
    setAiState('loading');
    setResult(null);
    setChatStreaming(true);
    scrollChatToBottom(); // 新一轮开始，无条件恢复贴底跟随
    try {
      const res = await runDreamStream(
        kw,
        context.trim() || undefined,
        undefined,
        (partial) => {
          if (aiReqIdRef.current !== reqId) return;
          setAiState(partial);
          setPerspResults((m) => ({ ...m, [DEFAULT_PERSPECTIVE]: partial }));
          setChatMessages((prev) => prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: partial.text } : m
          ));
        },
        { ref: aiReqIdRef, id: reqId }
      );
      if (aiReqIdRef.current === reqId && res?.text) {
        setAiState(res);
        setPerspResults((m) => ({ ...m, [DEFAULT_PERSPECTIVE]: res }));
        setChatMessages((prev) => prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, content: res.text, streaming: false } : m
        ));
        setFadeKey((k) => k + 1);
      }
    } catch {
      if (aiReqIdRef.current === reqId) {
        setAiState('error');
        setResult(buildDreamFallback(kw));
        setChatMessages((prev) => prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, content: '解读生成失败，请稍后重试。', streaming: false } : m
        ));
      }
    } finally {
      if (aiReqIdRef.current === reqId) setChatStreaming(false);
    }
    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /** 用户追问 → 调 /chat/stream 流式回复 */
  const handleChatSend = async () => {
    const q = chatInput.trim();
    if (!q || chatStreaming) return;

    // 构建 history：当前所有消息（转为 {role, content}，去掉 streaming 标记，纯文本）
    const history: ChatHistoryEntry[] = chatMessages
      .filter((m) => m.content && !m.streaming)
      .map((m) => ({
        role: m.role,
        // local 消息的 content 是 HTML，转纯文本给后端
        content: m.source === 'local' ? m.content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : m.content,
      }));

    // 添加用户消息 + 空 assistant 消息
    const userMsg: ChatMsg = { id: msgId(), role: 'user', content: q };
    const assistantId = msgId();
    setChatMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '', source: 'ai', streaming: true }]);
    setChatInput('');
    setChatStreaming(true);
    scrollChatToBottom(); // 新一轮开始，无条件恢复贴底跟随

    const ctrl = new AbortController();
    chatAbortRef.current = ctrl;
    try {
      await requestDreamChatStream(
        chatDreamRef.current,
        chatContextRef.current,
        history,
        q,
        {
          signal: ctrl.signal,
          onDelta: (_chunk, fullText) => {
            setChatMessages((prev) => prev.map((m) =>
              m.id === assistantId ? { ...m, content: fullText } : m
            ));
          },
        }
      );
      setChatMessages((prev) => prev.map((m) =>
        m.id === assistantId ? { ...m, streaming: false } : m
      ));
    } catch (e: any) {
      if (e?.name === 'AbortError' || /AbortError/.test(String(e?.message || ''))) {
        setChatMessages((prev) => prev.map((m) =>
          m.id === assistantId ? { ...m, streaming: false } : m
        ));
      } else {
        setChatMessages((prev) => prev.map((m) =>
          m.id === assistantId ? { ...m, content: '回复失败，请稍后重试。', streaming: false } : m
        ));
      }
    } finally {
      if (chatAbortRef.current === ctrl) {
        chatAbortRef.current = null;
        setChatStreaming(false);
      }
    }
  };

  /** 停止对话流式（保留已生成文本） */
  const handleStopChat = () => {
    chatAbortRef.current?.abort();
    streamAbortRef.current?.abort();
  };

  /** 清空对话 → 回到欢迎消息（窗口保留） */
  const handleClearChat = () => {
    chatAbortRef.current?.abort();
    streamAbortRef.current?.abort();
    setChatMessages([WELCOME_MSG]);
    setChatInput('');
    setChatStreaming(false);
    setAiState(null);
    setPerspResults({});
    setActivePersp(DEFAULT_PERSPECTIVE);
    setKeyword('');
    setActiveSessionId(null);
  };

  /** 创建新会话并保存到会话列表 */
  const createSession = (kw: string, messages: ChatMsg[], context?: string) => {
    const now = new Date();
    const sessionId = now.getTime().toString(36) + Math.random().toString(36).slice(2, 6);
    const session: ChatSession = {
      id: sessionId,
      dream: kw,
      context,
      keyword: kw,
      messages,
      date: now.toLocaleDateString('zh-CN'),
      lastActive: now.toLocaleDateString('zh-CN'),
    };
    setActiveSessionId(sessionId);
    sessionKeywordRef.current = kw;
    const next = [session, ...chatSessions.filter((s) => s.id !== sessionId)].slice(0, CHAT_SESSIONS_MAX);
    setChatSessions(next);
    try {
      setCloudItem(CHAT_SESSIONS_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
    return sessionId;
  };

  /** 更新当前会话的消息（对话进行中自动保存） */
  const updateSession = (kw: string, messages: ChatMsg[]) => {
    if (!activeSessionId || messages.length === 0) return;
    const now = new Date().toLocaleDateString('zh-CN');
    const next = chatSessions.map((s) =>
      s.id === activeSessionId
        ? { ...s, keyword: kw, messages, lastActive: now }
        : s
    );
    setChatSessions(next);
    try {
      setCloudItem(CHAT_SESSIONS_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
  };

  /** 恢复历史会话 */
  const restoreSession = (session: ChatSession) => {
    setActiveSessionId(session.id);
    setChatMode(true);
    setChatMessages(session.messages);
    setKeyword(session.keyword);
    sessionKeywordRef.current = session.keyword;
    chatDreamRef.current = session.dream;
    chatContextRef.current = session.context;
    setFadeKey((k) => k + 1);
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  /** 删除会话 */
  const deleteSession = (id: string) => {
    const next = chatSessions.filter((s) => s.id !== id);
    setChatSessions(next);
    try {
      setCloudItem(CHAT_SESSIONS_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setChatMode(false);
      setChatMessages([]);
      setKeyword('');
    }
  };

  /** 自动保存会话：对话模式下消息变化时触发（跳过只剩欢迎消息的空状态） */
  useEffect(() => {
    if (!chatMode || chatMessages.length === 0) return;
    const hasReal = chatMessages.some((m) => m.id !== WELCOME_MSG.id);
    if (!hasReal) return;
    if (!activeSessionId) {
      // 首次进入对话模式，创建新会话
      createSession(sessionKeywordRef.current, chatMessages, chatContextRef.current);
    } else {
      updateSession(sessionKeywordRef.current, chatMessages);
    }
  }, [chatMessages, chatMode]);

  /** 视角切换 → 追加该视角的 AI 消息到对话 */
  const handleInterpretPerspective = async (p: DreamPerspective) => {
    const kw = chatDreamRef.current || keyword.trim() || '梦见掉牙';
    const ctx = chatContextRef.current;
    const pMeta = PERSPECTIVES.find((x) => x.key === p);
    const question = `请用${pMeta?.label || p}视角重新解读我的梦境`;

    // 构建 history（当前所有消息）
    const history: ChatHistoryEntry[] = chatMessages
      .filter((m) => m.content && !m.streaming)
      .map((m) => ({
        role: m.role,
        content: m.source === 'local' ? m.content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : m.content,
      }));

    // 追加 user 消息 + 空 assistant 消息
    const userMsg: ChatMsg = { id: msgId(), role: 'user', content: question };
    const assistantId = msgId();
    setChatMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '', source: 'perspective', perspective: p, streaming: true }]);
    setChatStreaming(true);
    setPerspLoading((m) => ({ ...m, [p]: true }));
    scrollChatToBottom(); // 新一轮开始，无条件恢复贴底跟随

    const ctrl = new AbortController();
    chatAbortRef.current = ctrl;
    try {
      await requestDreamChatStream(
        kw,
        ctx,
        history,
        question,
        {
          signal: ctrl.signal,
          onDelta: (_chunk, fullText) => {
            setChatMessages((prev) => prev.map((m) =>
              m.id === assistantId ? { ...m, content: fullText } : m
            ));
          },
        },
        p
      );
      setChatMessages((prev) => prev.map((m) =>
        m.id === assistantId ? { ...m, streaming: false } : m
      ));
    } catch (e: any) {
      if (e?.name === 'AbortError' || /AbortError/.test(String(e?.message || ''))) {
        setChatMessages((prev) => prev.map((m) =>
          m.id === assistantId ? { ...m, streaming: false } : m
        ));
      } else {
        setChatMessages((prev) => prev.map((m) =>
          m.id === assistantId ? { ...m, content: '视角解读失败，请稍后重试。', streaming: false } : m
        ));
      }
    } finally {
      if (chatAbortRef.current === ctrl) {
        chatAbortRef.current = null;
        setChatStreaming(false);
      }
      setPerspLoading((m) => ({ ...m, [p]: false }));
    }
  };

  /** 当前生效的 AI 文本：优先按 activePersp 取；否则回落到 aiState（默认 AI 结果） */
  const activeAiText = useMemo<InterpretResponse | null>(() => {
    if (activePersp !== DEFAULT_PERSPECTIVE && perspResults[activePersp]) {
      return perspResults[activePersp] as InterpretResponse;
    }
    return isAiResult(aiState) ? aiState : null;
  }, [activePersp, perspResults, aiState]);

  /** 当前生效的视角名（用于标题显示当前视角） */
  const activePerspLabel = useMemo(() => {
    if (activePersp === DEFAULT_PERSPECTIVE) return '通用解读';
    return PERSPECTIVES.find((x) => x.key === activePersp)?.label ?? '通用解读';
  }, [activePersp]);

  const handleQuick = (kw: string) => {
    setKeyword(kw);
    aiReqIdRef.current++; // 使进行中的 AI 请求失效
    showResult(kw, { scroll: true });
  };

  const handleSelectCat = (key: DreamCategoryKey) => {
    setActiveCat(key);
  };

  /** 当前分类下的关键词 */
  const catEntries = useMemo(() => {
    return CATEGORY_KEYWORDS[activeCat] || [];
  }, [activeCat]);

  // ===== 梦境趋势分析：基于日记记录的纵向洞察 =====
  /** 每条日记附加分类与标签聚合结果（词库未命中则退化为未分类） */
  const diaryTrend = useMemo(() => {
    type C = DreamCategoryKey;
    const categoryCount = new Map<C, number>();
    const symbolCount = new Map<string, number>(); // dream核心词 → 次数
    const themeTags = new Map<string, { count: number; cls: string }>();
    const moodList: { date: string; pos: number; neg: number; neu: number; title: string }[] = [];

    for (const d of diary) {
      const cat: C = matchCategory(d.dream);
      categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);

      // 符号：用 dream 文案去掉"梦见"作为核心词，加 emoji 易读
      const core = d.dream.replace(/^梦见/, '') || d.dream;
      const symKey = `${d.emoji} ${core}`;
      symbolCount.set(symKey, (symbolCount.get(symKey) || 0) + 1);

      // 情绪：无固定词库，默认中性
      let pos = 0, neg = 0, neu = 0;
      neu = 1;
      moodList.push({ date: d.date, pos, neg, neu, title: core });
    }

    // 分类分布：按次数倒序
    const categoryDist = [...categoryCount.entries()]
      .map(([key, count]) => {
        const cat = DREAM_CATEGORIES.find((c) => c.key === key);
        return {
          key,
          label: cat ? `${cat.icon} ${cat.label}` : '🌌 其他类',
          count,
          percent: diary.length ? Math.round((count / diary.length) * 100) : 0
        };
      })
      .sort((a, b) => b.count - a.count);

    // 最常出现符号 Top 8
    const topSymbols = [...symbolCount.entries()]
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // 最常出现主题（标签）Top 8
    const topThemes = [...themeTags.entries()]
      .map(([text, v]) => ({ text, cls: v.cls, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // 情绪曲线：按记录时间升序（每条梦境一个节点）
    const moodData = [...moodList].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    return {
      total: diary.length,
      categoryDist,
      topSymbols,
      topThemes,
      moodData
    };
  }, [diary]);

  /** 情绪标签 → 颜色 */
  const moodColor = (cls: string) => {
    if (cls === 'tag-good') return 'var(--good, #4ade80)';
    if (cls === 'tag-warn') return 'var(--warn, #fbbf24)';
    if (cls === 'tag-bad') return 'var(--bad, #f87171)';
    return 'var(--primary-light, #9b8cff)';
  };

  /** 保存梦境日记 */
  const handleSaveDiary = () => {
    const raw = keyword.trim();
    if (!raw) {
      showToast('先写下你的梦境再保存吧～', 'warn');
      return;
    }
    // 自动补全：若输入不含"梦"字，前缀添加"梦见"以便词库匹配和展示规范
    const kw = /梦/.test(raw) ? raw : `梦见${raw}`;
    const isAi = isAiResult(aiState);
    // 仅当 result 与当前关键词匹配时才复用其标题，否则用关键词
    const resultTitle = result && result.title && result.title.includes(kw)
      ? result.title
      : kw;
    const title = resultTitle
      .replace(/—\s*解梦结果/, '')
      .replace(/—\s*深度解读/, '')
      .trim();
    const baseEmoji = result && result.title && result.title.includes(kw)
      ? dreamEmoji(result.title)
      : '🌙';
    const item: DiaryItem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      dream: kw,
      title: title.replace(/^\S+\s/, '') || kw,
      emoji: baseEmoji !== '🌙' ? baseEmoji : keywordDreamEmoji(kw, '🌙'),
      date: new Date().toLocaleDateString('zh-CN'),
      source: isAi ? 'ai' : 'local'
    };
    const next = [item, ...diary].slice(0, DIARY_MAX);
    setDiary(next);
    try {
      setCloudItem(DIARY_KEY, JSON.stringify(next));
    } catch {
      /* 存储不可用则跳过 */
    }
    setKeyword('');
    showToast('🌙 梦境已保存，回头看看它想告诉你什么', 'success');
  };

  /** 删除单条日记 */
  const handleDeleteDiary = (id: string) => {
    const next = diary.filter((d) => d.id !== id);
    setDiary(next);
    try {
      setCloudItem(DIARY_KEY, JSON.stringify(next));
    } catch {
      /* 忽略 */
    }
  };

  /** 一键分享：调用 AI 服务生成精美图片 + 分享文案 */
  const handlePoster = async () => {
    const kw = keyword.trim() || (result?.title ?? '梦境');
    const interpText = isAiResult(aiState)
      ? aiState.text
      : (result?.content ?? '').replace(/<[^>]+>/g, '');

    setPosterLoading(true);
    setPosterResult(null);
    try {
      const r = await requestPoster(kw, interpText);
      setPosterResult(r);
      // 分享存档：首次生成直接落库；重新生成则覆盖（后端按 user+module upsert）
      void share.persist({ title: kw, shareText: r.shareText, imageUrl: r.imageUrl, imagePrompt: r.imagePrompt });
    } catch (err: any) {
      const fallback: PosterResult = {
        shareText: `「${kw.replace(/^梦见/, '')}」——梦境是潜意识写给你的信。`,
        imagePrompt: '',
        imageUrl: null,
        imageError: err?.message || '生成失败',
        fallback: true,
      };
      setPosterResult(fallback);
      void share.persist({ title: kw, shareText: fallback.shareText, imageUrl: null, imagePrompt: '' });
    } finally {
      setPosterLoading(false);
    }
  };

  /** 打开分享弹窗：未登录先让用户在弹窗内登录；已登录进入内容态 */
  const handleOpenShare = () => {
    if (!share.ready) {
      showToast('正在检查登录状态，请稍候…', 'info');
      return;
    }
    if (!share.isAuthed) {
      showToast('请先登录后再保存 / 分享', 'info');
    }
    setShowShare(true);
  };

  /**
   * 分享弹窗打开后的数据源决策（仅在已登录且已向库请求过存档后执行）：
   * ・库内已有存档（share.saved）→ 直接渲染库内容，省一次 AI 生成（二次进入场景）
   * ・库内无存档 → 等待用户在弹窗内点「立即生成」（保留原交互，首次生成后落库）
   */
  useEffect(() => {
    if (!showShare || !share.ready || !share.isAuthed || !share.loaded) return;
    if (share.saved && !posterResult) {
      setPosterResult(shareOutToPoster(share.saved));
    }
  }, [showShare, share.ready, share.isAuthed, share.loaded, share.saved, posterResult]);

  /** 下载 AI 生成的图片 */
  const handleDownloadPoster = async () => {
    if (!posterResult?.imageUrl) return;
    try {
      const resp = await fetch(posterResult.imageUrl);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '玄镜解梦海报.png';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(posterResult.imageUrl, '_blank');
    }
  };

  const energy = todayEnergy(diary[0]?.dream || currentTitle);
  // 旧：const aiText = isAiResult(aiState) ? aiState : null; —— 已替换为 activeAiText（支持多视角）

  return (
    <div className="page active" id="page-dream">
      {/* 页面头部 */}
      <div className="page-header">
        <div>
          <div className="page-title">🌙 周公解梦</div>
          <div className="page-subtitle">AI 结合传统解梦 + 心理学双视角解读</div>
        </div>
      </div>

      {/* 搜索区 */}
      <div className="dream-search">
        <div className="dream-search-hint"><svg className="iconfont icon-lg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg> 昨夜的梦，藏着今天想告诉你的话</div>
        <div className="dream-input-row chat-pill">
          <input
            className="dream-input field-pill"
            placeholder="描述你的梦境，例如：梦见一条黑蛇追我…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInterpret()}
          />
          <button className="ai-send-btn chat-send-btn" onClick={() => handleInterpret()} aria-label="解梦">
            <svg className="iconfont icon-lg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9"/></svg>
          </button>
        </div>
        <div className="dream-categories">
          {QUICK_KEYWORDS.map((c) => (
            <div key={c.keyword} className="dream-cat" onClick={() => handleQuick(c.keyword)}>
              {c.label}
            </div>
          ))}
        </div>
      </div>

      {/* 分类浏览：胶囊标签，点击分类切换词条 */}
      <div className="dream-browser">
        <div className="dream-cat-row">
          <span className="dream-cat-row-label">分类</span>
          {DREAM_CATEGORIES.map((c) => (
            <span
              key={c.key}
              className={'dream-cat' + (activeCat === c.key ? ' active' : '')}
              onClick={() => handleSelectCat(c.key)}
            >
              {c.icon} {c.label}
            </span>
          ))}
        </div>
        <div className="dream-cat-row">
          <span className="dream-cat-row-label">词条</span>
          {catEntries.map((k) => (
            <span key={k} className="dream-cat" onClick={() => handleQuick(k)}>
              {k.replace('梦见', '')}
            </span>
          ))}
        </div>
      </div>

      {/* 双栏主布局 */}
      <div className="dream-layout">
        {/* 左栏：结果 + 小知识 */}
        <div className="dream-main">
          <div className="dream-result active fade-in" key={fadeKey} ref={resultRef}>

            {/* 多轮对话窗口：复用全站统一的 AiChatWindow 组件 */}
            {chatMode ? (
              <div style={{ marginTop: 20 }}>
                <AiChatWindow
                  title="小玄陪你聊聊这个梦"
                  // iconSrc="/images/dream-icons/line/chat.svg"
                  messages={chatMessages.map((m) => {
                    const pMeta = m.perspective ? PERSPECTIVES.find((x) => x.key === m.perspective) : null;
                    const isWelcome = m.id === WELCOME_MSG.id;
                    let tag: React.ReactNode = null;
                    if (!isWelcome) {
                      if (m.source === 'local') tag = <span className="ai-chat-tag">📖 本地词库</span>;
                      else if (m.source === 'perspective' && pMeta) tag = <span className="ai-chat-tag">{pMeta.badge} {pMeta.short}</span>;
                      else if (m.streaming) tag = <span className="ai-chat-tag ai-chat-tag-streaming">正在生成</span>;
                    }
                    return {
                      id: m.id,
                      role: m.role,
                      content: m.content,
                      streaming: m.streaming,
                      welcome: isWelcome,
                      tag,
                      contentFormat: m.source === 'local' ? 'html' : 'markdown',
                      quickPrompts: isWelcome ? CHAT_QUICK_PROMPTS : undefined,
                    };
                  })}
                  renderContent={(msg) => {
                    const body = msg.content + (msg.streaming ? '▍' : '');
                    if (msg.contentFormat === 'html') {
                      return <div dangerouslySetInnerHTML={{ __html: body }} />;
                    }
                    return <div dangerouslySetInnerHTML={{ __html: mdToHtml(cleanAiTplResidue(body)) }} />;
                  }}
                  input={chatInput}
                  onInputChange={setChatInput}
                  onSend={handleChatSend}
                  inputPlaceholder="追问梦境细节、补充情绪背景…"
                  inputDisabled={chatStreaming}
                  onClear={handleClearChat}
                  onQuickPrompt={(p) => handleQuick(p.kw)}
                  scrollRef={chatScrollRef}
                  aboveMessages={chatStreaming ? (
                    <button type="button" className="ai-interp-stop-btn" onClick={handleStopChat} title="停止生成（保留已输出内容）">
                      ■ 停止生成
                    </button>
                  ) : null}
                />
              </div>
            ) : (
              /* 非对话模式：本地词库结果展示（词条点击时） */
              result && (
                <>
                  <div className="dream-result-title">{result.title}</div>
                  <div className="dream-tags">
                    {result.tags.map((t) => (
                      <span key={t.text} className={'dream-tag ' + t.cls}>{t.text}</span>
                    ))}
                  </div>
                  <div className="dream-result-text" dangerouslySetInnerHTML={{ __html: result.content }} />
                  {result.related.length > 0 && (
                    <div className="dream-related">
                      <div className="dream-related-label">相似梦境：</div>
                      <div className="dream-categories dream-categories-start">
                        {result.related.map((k) => (
                          <span key={k} className="dream-cat" onClick={() => handleQuick(k)}>
                            {k.replace('梦见', '')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
            )}

            {/* 🔁 换个角度再看 · 对话模式下显示 4 视角胶囊 */}
            {chatMode && (
              <div className="dream-perspectives">
                <div className="dream-perspectives-title">
                  <i className="iconfont icon-24gl-swapHorizontal2"></i>  换个角度再看
                </div>
                <div className="dream-perspectives-row">
                  {PERSPECTIVES.map((p) => {
                    const loading = !!perspLoading[p.key];
                    return (
                      <button
                        key={p.key}
                        type="button"
                        className={'dream-persp-chip' + (loading ? ' loading' : '')}
                        title={p.hint}
                        onClick={() => handleInterpretPerspective(p.key)}
                        disabled={loading || chatStreaming}
                      >
                        <span className="dream-persp-badge">{p.badge}</span>
                        <span className="dream-persp-name">{p.short}</span>
                        {loading && <span className="dream-persp-spinner" aria-hidden />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="dream-result-actions">
              {/* 重新生成梦境图按钮已注释 */}
              {/*
              {chatMode && visionShown && (
                <button
                  className="nav-btn btn-ghost"
                  onClick={handleGenerateVision}
                  disabled={visionGenerating}
                >
                  ✨ {visionGenerating ? '正在生成…' : '重新生成梦境图'}
                </button>
              )}
              */}
              <button className="nav-btn btn-ghost" onClick={handleOpenShare}>
                 <i className="iconfont icon-fenxiang"></i>  一键分享
              </button>
              <button className="nav-btn btn-primary" onClick={() => router.push('/healing')}>
                 <i className="iconfont icon-shengchengtupian"></i>  
                 情绪需要安抚？
              </button>
            </div>
          </div>

          {/* 关于梦的小知识 */}
          <div className="mood-tracker">
            <div className="result-card-title"><SectionIcon name="book-open" /> 关于梦的小知识</div>
            <div className="dream-fact-list">
              {DREAM_FACTS.map((f, i) => (
                <div key={i} className="dream-fact-item">
                  <span className="dream-fact-icon">{f.icon}</span>
                  <div>{f.text}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 梦境符号速查：点符号即时出解读，实用且易停留 */}
          <div className="mood-tracker dream-symbol-lookup">
            <div className="result-card-title">
              <SectionIcon name="type" />
              梦境符号速查
            </div>
            <div className="dream-symbol-hint">梦到某个意象？点一下切换解读</div>
            <div className="dream-symbol-grid">
              {DREAM_SYMBOLS.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  className={'dream-symbol-chip' + (quickSym === s.name ? ' active' : '')}
                  onClick={() => setQuickSym(s.name)}
                >
                  <span className="dream-symbol-ico">{s.icon}</span>
                  <span className="dream-symbol-name">{s.name}</span>
                </button>
              ))}
            </div>
            {quickSym && (() => {
              const s = DREAM_SYMBOLS.find((x) => x.name === quickSym);
              return s ? (
                <div className="dream-symbol-result">
                  <span className="dream-symbol-result-ico">{s.icon}</span>
                  <div>
                    <div className="dream-symbol-result-name">梦见「{s.name}」</div>
                    <div className="dream-symbol-result-text">{s.mean}</div>
                  </div>
                </div>
              ) : null;
            })()}
          </div>

          {/* 清醒梦引导：认识 / 技法练习 / 打卡日志 */}
          <LucidDreamGuide />

        </div>

        {/* 右栏：能量 + 日记 + 联动 */}
        <div className="dream-side">
          <div className="mood-tracker dream-energy-card">
            <div className="result-card-title"><SectionIcon name="zap" /> 今日梦境能量</div>
            <div className="dream-energy-source">{diary.length > 0 ? `基于你最近记录的梦 · ${energy.keyword}` : '今日专属 · 每天不同'}</div>

            {/* 能量罗盘：环形评分（加载时从 0 动画到 score） */}
            <div className={`dream-energy-ring-wrap is-${energy.level}`}>
              <svg className="dream-energy-ring" viewBox="0 0 120 120" aria-hidden="true">
                <circle className="ring-track" cx="60" cy="60" r="52" />
                <circle
                  className="ring-fill"
                  cx="60" cy="60" r="52"
                  style={{ strokeDasharray: 326.7, strokeDashoffset: 326.7 * (1 - energy.score / 100) }}
                />
              </svg>
              <div className="dream-energy-ring-center">
                <div className="dream-energy-score">{energy.score}</div>
                <div className="dream-energy-score-unit">能量值</div>
                <div className="dream-energy-score-label">{energy.levelLabel}</div>
              </div>
            </div>

            {/* 能量类型徽章 */}
            <div className="dream-energy-type">
              <span className="dream-energy-type-emoji">{energy.typeEmoji}</span>
              {energy.typeLabel}
            </div>

            {/* 幸运四件套：可截图分享的钩子 */}
            <div className="dream-lucky-grid">
              <div className="dream-lucky-item">
                <span className="dream-lucky-k">幸运色</span>
                <span className="dream-lucky-v"><i className="dream-lucky-dot" style={{ background: energy.luckyColor.hex, color: energy.luckyColor.hex }} /> {energy.luckyColor.name}</span>
              </div>
              <div className="dream-lucky-item">
                <span className="dream-lucky-k">幸运数字</span>
                <span className="dream-lucky-v">{energy.luckyNumber}</span>
              </div>
              <div className="dream-lucky-item">
                <span className="dream-lucky-k">幸运方位</span>
                <span className="dream-lucky-v">{energy.luckyDir}</span>
              </div>
              <div className="dream-lucky-item">
                <span className="dream-lucky-k">幸运时辰</span>
                <span className="dream-lucky-v">{energy.luckyHour}</span>
              </div>
            </div>

            {/* 宜忌 */}
            <div className="dream-energy-list">
              <div className="dream-energy-item"><span>今日宜</span><strong className="tc-green">{energy.yi}</strong></div>
              <div className="dream-energy-item"><span>今日忌</span><strong className="tc-red">{energy.ji}</strong></div>
            </div>

            {/* 一句签文 */}
            <div className="dream-energy-oracle">「{energy.oracle}」</div>
          </div>

          <div className="mood-tracker dream-trend">
            <div className="result-card-title"><SectionIcon name="notebook-pen" /> 梦境日记 · 趋势洞察</div>
            <div className="dream-diary-hint">
              记录梦境，追踪反复出现的主题 · 本地匿名统计，不联网 · 已记 {diaryTrend.total} 条
            </div>
  
            {/* 输入 + 保存 */}
            <textarea
              className="form-input dream-diary-input"
              placeholder="昨晚梦见了什么？写下它，别让它溜走…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <button className="btn-submit btn-sm" onClick={handleSaveDiary}>
              <i className="iconfont icon-baocun"></i>  
              保存梦境记录
            </button>

            {/* 语音录梦：识别文本追加到输入框，可继续编辑后保存 */}
            <VoiceRecordButton onAppend={(delta) => setKeyword((prev) => (prev.trim() ? `${prev.trim()}${delta}` : delta))} />
  
            {/* 趋势聚合：有记录才显示 */}
            {diaryTrend.total > 0 && (
              <>
                <hr className="dream-trend-divider" />
                <div className="dream-trend-sub" style={{ marginTop: 0 }}>
                  <i className="iconfont icon-shixianmengxiang"></i>  
                   基于上方记录聚合出的洞察
                </div>
  
                {/* 1. 符号热力图（分类分布条） */}
                <div className="dream-trend-block">
                  <div className="dream-trend-label">符号分布 · 你常梦到的类型</div>
                  <div className="dream-heatmap">
                    {diaryTrend.categoryDist.map((c) => (
                      <div key={c.key} className="dream-heat-row" title={`${c.count} 次 · ${c.percent}%`}>
                        <span className="dream-heat-label">{c.label}</span>
                        <div className="dream-heat-bar">
                          <div className="dream-heat-fill" style={{ width: `${c.percent}%` }} />
                        </div>
                        <span className="dream-heat-count">{c.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
  
                {/* 2. 情绪曲线（近期梦境情绪净值走势 · 自绘 SVG 平滑折线 + 渐变面积） */}
                <div className="dream-trend-block">
                  <div className="dream-trend-label">📈 情绪曲线 · 近期梦境情绪变化</div>
                  {diaryTrend.moodData.length === 0 ? (
                    <div className="dream-trend-empty">暂无日期数据</div>
                  ) : (
                    (() => {
                      const data = diaryTrend.moodData;
                      const W = 280, H = 104, padL = 8, padR = 8, padT = 14, padB = 20;
                      const n = data.length;
                      const innerW = W - padL - padR;
                      const innerH = H - padT - padB;
                      const baseline = padT + innerH * 0.5; // 中性 0.5
                      const pts = data.map((d, i) => {
                        const denom = Math.max(1, d.pos + d.neg + d.neu);
                        const raw = (d.pos - d.neg) / denom; // 正-负 净值 ∈ [-1,1]
                        const score = (raw + 1) / 2; // 0..1
                        const x = n === 1 ? padL + innerW / 2 : padL + (innerW * i) / (n - 1);
                        const y = padT + (1 - score) * innerH;
                        const sentiment: 'good' | 'bad' | 'neu' = d.pos > d.neg ? 'good' : d.neg > d.pos ? 'bad' : 'neu';
                        return { x, y, sentiment, d };
                      });
                      const linePath = buildSmoothPath(pts.map((p) => ({ x: p.x, y: p.y })));
                      const areaPath =
                        n > 0
                          ? `${linePath} L ${pts[n - 1].x.toFixed(2)} ${(H - padB).toFixed(2)} L ${pts[0].x.toFixed(2)} ${(H - padB).toFixed(2)} Z`
                          : '';
                      const colorOf = (s: 'good' | 'bad' | 'neu') =>
                        s === 'good' ? '#4ade80' : s === 'bad' ? '#f87171' : '#9b8cff';
                      return (
                        <div className="dream-mood-chart">
                          <svg className="dream-mood-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="近期梦境情绪净值走势">
                            <defs>
                              <linearGradient id="moodAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#7c5cff" stopOpacity="0.38" />
                                <stop offset="100%" stopColor="#7c5cff" stopOpacity="0.02" />
                              </linearGradient>
                            </defs>
                            {/* 中性基线 */}
                            <line x1={padL} y1={baseline} x2={W - padR} y2={baseline} className="dream-mood-baseline" />
                            {/* 渐变面积 */}
                            <path d={areaPath} fill="url(#moodAreaGrad)" />
                            {/* 平滑折线 */}
                            <path d={linePath} className="dream-mood-line" />
                            {/* 数据点 + 悬浮提示 */}
                            {pts.map((p, i) => (
                              <g key={i}>
                                <circle cx={p.x} cy={p.y} r={3.2} fill={colorOf(p.sentiment)} className="dream-mood-dot">
                                  <title>{`${dateOnly(p.d.date)} · ${p.d.title} · 正${p.d.pos} 中${p.d.neu} 警${p.d.neg}`}</title>
                                </circle>
                                <text x={p.x} y={H - 6} textAnchor="middle" className="dream-mood-date">
                                  {`梦${i + 1}`}
                                </text>
                              </g>
                            ))}
                          </svg>
                          <div className="dream-mood-legend">
                            <span><i className="dot-s dot-s-good" /> 偏正向</span>
                            <span><i className="dot-s dot-s-neu" /> 中性</span>
                            <span><i className="dot-s dot-s-neg" /> 偏警示</span>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
  
              </>
            )}
  
            {/* 分隔：趋势 → 记录列表 */}
            <hr className="dream-trend-divider" />
            <div className="dream-trend-label">🧾 已保存的梦境</div>
  
            {/* 记录列表（标题+日期一行紧凑布局；旧🌙记录智能补图标） */}
            <div className="dream-diary-entries dream-diary-entries-compact">
              {diary.length === 0 && (
                <div className="dream-diary-empty">还没有记录，保存第一个梦吧 🌙</div>
              )}
              {diary.map((d) => {
                const rep = repeatCount[d.dream] || 0;
                // 旧记录兜底：如果是默认🌙，按 dream 关键词重新匹配
                const emoji = d.emoji && d.emoji !== '🌙' ? d.emoji : keywordDreamEmoji(d.dream, '🌙');
                return (
                  <div key={d.id} className="dream-diary-entry dream-diary-entry-compact">
                    <div className="dream-diary-emoji">{emoji}</div>
                    <div className="dream-diary-text dream-diary-text-compact">
                      <span className="dream-diary-title dream-diary-title-inline">
                        {d.title}
                        {/* {d.source === 'ai' && <span className="dream-diary-badge">AI</span>} */}
                        {rep > 1 && <span className="dream-diary-badge dream-diary-badge-rep">重复 {rep}</span>}
                      </span>
                      <span className="dream-diary-meta dream-diary-meta-inline">{dateOnly(d.date)}</span>
                    </div>
                    <button className="dream-diary-del" title="删除" onClick={() => handleDeleteDiary(d.id)}>✕</button>
                  </div>
                );
              })}
            </div>
          </div>




        </div>
      </div>

      {/* 底部三栏横行：历史对话 · 深入解梦 · 社区互助（页面最底部） */}
      <div className="dream-footer-row">
        {/* 1. 社区 · 互助解梦 */}
        <div className="mood-tracker dream-cta-card dream-footer-col" onClick={() => { setVipModalSrc('community'); setShowVipModal(true); }} style={{ cursor: 'pointer' }}>
          <div className="result-card-title"><SectionIcon name="users" /> 社区 · 互助解梦</div>
          <div className="cta-text">
            发布你的梦境，让社群一起帮你解读；也可以看看别人的梦有没有与你相似的经历。
            <br /><span style={{ fontSize: '13px', opacity: 0.85 }}>💡 二期上线社区论坛功能，敬请期待</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <button
              type="button"
              className="btn-submit btn-sm"
              onClick={(e) => { e.stopPropagation(); setVipModalSrc('community'); setShowVipModal(true); }}
            >
              🚪 进入社区
            </button>
          </div>
        </div>

        {/* 2. 跨页联动 */}
        <CrossPageLink
          title="继续深挖"
          description={visitorBirth
            ? <>已记录你的生辰（{visitorBirth.date} {visitorBirth.time}），将以八字 + 紫微 + 六爻多角度印证此梦寓意，点击即自动生成觉察档案。</>
            : '结合你的生辰，AI 从八字 + 紫微 + 六爻多角度交叉印证梦境寓意；首次填写后跨页自动复用。'}
          links={[
            { icon: '☯️', label: visitorBirth ? '结合生辰深解此梦' : '前往卜卦页深入解读', href: `/bugua?autodiv=1&q=${encodeURIComponent(keyword.trim() || '梦境解读')}` },
            { icon: '📋', label: '生成综合报告', href: '/report', variant: 'primary' },
          ]}
        />

         {/* 3. 历史对话（始终渲染以保证三列布局饱满） */}
        <div className="mood-tracker dream-footer-col">
          <div className="result-card-title"><SectionIcon name="history" /> 历史对话</div>
          {chatSessions.length > 0 ? (
            <div className="dream-diary-entries dream-diary-entries-compact">
              {chatSessions.map((s) => {
                const isActive = s.id === activeSessionId;
                const userMsg = s.messages.find((m) => m.role === 'user');
                const preview = userMsg?.content || s.keyword;
                const emoji = keywordDreamEmoji(s.keyword, '🌙');
                return (
                  <div
                    key={s.id}
                    className={'dream-diary-entry dream-diary-entry-compact' + (isActive ? ' active-session' : '')}
                    style={{ cursor: 'pointer' }}
                    onClick={() => restoreSession(s)}
                  >
                    <div className="dream-diary-emoji">{emoji}</div>
                    <div className="dream-diary-text dream-diary-text-compact" style={{ flex: 1, minWidth: 0 }}>
                      <span className="dream-diary-title dream-diary-title-inline" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {preview}
                        {isActive && <span className="dream-diary-badge dream-diary-badge-rep">当前</span>}
                      </span>
                      <span className="dream-diary-meta dream-diary-meta-inline">
                        {s.messages.length} 条消息 · {dateOnly(s.lastActive)}
                      </span>
                    </div>
                    <button
                      className="dream-diary-del"
                      title="删除对话"
                      onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                    >✕</button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="dream-diary-empty">还没有历史对话，开始一次解梦吧 🌙</div>
          )}
        </div>


      </div>

      {/* 一键分享弹窗 → AI 生图 + 分享文案 */}
      <Modal
        open={showShare}
        onClose={() => { setShowShare(false); setPosterResult(null); }}
        variant="share"
        footer={
          posterResult ? (
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="modal-btn" style={{ background: 'rgba(0, 0, 0, 0.2)', color: 'var(--text-muted)' }} onClick={() => { setShowShare(false); setPosterResult(null); }}>
                <i className="iconfont icon-guanbi"></i>  关闭
              </button>
              {posterResult.imageUrl && (
                <button
                  className="modal-btn"
                  style={{ background: 'linear-gradient(135deg, #7c5cff 0%, #5b3fff 100%)', color: '#fff' }}
                  onClick={handleDownloadPoster}
                >
                  <i className="iconfont icon-baocun"></i> 保存图片
                </button>
              )}
              <button
                className="modal-btn"
                style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', color: '#1a1035' }}
                onClick={() => { navigator.clipboard?.writeText(posterResult.shareText); showToast('📋 文案已复制到剪贴板', 'success'); }}
              >
                <i className="iconfont icon-fuzhi"></i> 复制文案
              </button>
            </div>
          ) : null
        }
      >
        {!share.ready ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ color: 'var(--text-secondary)' }}>⏳ 正在检查登录状态…</p>
          </div>
        ) : !share.isAuthed ? (
          <ShareLoginGate context="保存 / 分享" />
        ) : (
          <>
            {!posterResult && !posterLoading && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  AI 将根据你的梦境生成精美图片和分享文案
                </p>
                <button
                  className="modal-btn"
                  style={{ background: 'linear-gradient(135deg, #7c5cff 0%, #5b3fff 100%)', color: '#fff' }}
                  onClick={handlePoster}
                >
                  ✨ 立即生成
                </button>
              </div>
            )}
            {posterLoading && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎨</div>
                <p style={{ color: 'var(--text-secondary)' }}>AI 正在生成精美图片和文案…</p>
              </div>
            )}
            {posterResult && (
              <div style={{ padding: '4px 0' }}>
                {posterResult.imageUrl ? (
                  <div style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                    <img
                      src={posterResult.imageUrl}
                      alt="梦境海报"
                      style={{ width: '100%', display: 'block' }}
                      loading="eager"
                    />
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', marginBottom: '16px', color: 'var(--text-muted)' }}>
                    图片生成失败：{posterResult.imageError}
                  </div>
                )}
                <div style={{
                  background: 'rgba(124,92,255,0.1)',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid rgba(124,92,255,0.2)',
                }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>✨ AI 分享文案</div>
                  <p style={{ color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
                    {posterResult.shareText}
                  </p>
                </div>
                {/* 重新生成：重跑 AI 生成 + 再次落库覆盖 */}
                <div style={{ textAlign: 'center', marginTop: '14px' }}>
                  <button
                    className="modal-btn"
                    style={{ background: 'rgba(0, 0, 0, 0.2)', color: 'var(--text-primary)' }}
                    onClick={() => void handlePoster()}
                    disabled={posterLoading}
                  >
                    🔄 重新生成
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* 会员升级弹窗：专家人工解读 / 社区入口 */}
      <Modal
        open={showVipModal}
        onClose={() => setShowVipModal(false)}
        icon={vipModalSrc === 'expert' ? '👤' : '🧑‍🤝‍🧑'}
        title={vipModalSrc === 'expert' ? '专家人工解读 · 会员专享' : '社区 · 互助解梦 · 会员专享'}
        footer={
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button className="modal-btn" style={{ background: 'transparent', color: 'var(--text-muted)' }} onClick={() => setShowVipModal(false)}>
              再想想
            </button>
            <button
              className="modal-btn"
              style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', color: '#1a1035' }}
              onClick={() => { setShowVipModal(false); setPremiumOpen(true); }}
            >
              👑 开通会员
            </button>
          </div>
        }
      >
        <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '72px', height: '72px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #fde68a 0%, #fbbf24 100%)',
            fontSize: '36px', marginBottom: '16px',
            boxShadow: '0 8px 24px rgba(251, 191, 36, 0.35)',
          }}>
            {vipModalSrc === 'expert' ? '🧙‍♂️' : '🌐'}
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>
            {vipModalSrc === 'expert'
              ? <>资深解梦师 · 1对1 深度解读</>
              : <>社区论坛 · 梦境互助讨论</>}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.7, marginBottom: '20px' }}>
            {vipModalSrc === 'expert' ? (
              <>
                持证心理咨询师 + 传统文化顾问双重背书<br />
                语音/文字沟通，解读深度是 AI 的 3 倍以上<br />
                <span style={{ color: '#fbbf24' }}>平均响应 30 分钟内 · 支持反复追问</span>
              </>
            ) : (
              <>
                万千梦友在线互助解梦，看别人的梦启发自己<br />
                梦境相似匹配，找到与你同梦的人<br />
                <span style={{ color: '#fbbf24' }}>匿名发布 · 隐私保护 · 精华帖推荐</span>
              </>
            )}
          </div>

          {/* 会员权益对比 */}
          <div style={{
            background: 'rgba(251, 191, 36, 0.08)',
            border: '1px solid rgba(251, 191, 36, 0.2)',
            borderRadius: '12px',
            padding: '14px 16px',
            textAlign: 'left',
            fontSize: '14px',
          }}>
            <div style={{ fontWeight: 600, marginBottom: '10px', color: '#fbbf24' }}>
              👑 玄镜会员 · 解锁全部
            </div>
            {[
              { icon: '🧙‍♂️', label: '专家 1 对 1 人工解读（每月 3 次）', vip: true },
              { icon: '🧑‍🤝‍🧑', label: '社区互助解梦 · 发贴/评论', vip: true },
              { icon: '🔮', label: 'AI 无限次解梦（去次数限制）', vip: true },
              { icon: '📊', label: '深度梦境趋势分析报告', vip: true },
              { icon: '🖼️', label: '解梦高清海报 · 无水印', vip: true },
            ].map((item) => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0',
                opacity: item.vip ? 1 : 0.4,
              }}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
                <span style={{ marginLeft: 'auto', color: '#fbbf24', fontSize: '12px' }}>
                  ✓ 会员
                </span>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* 真实付费弹层：解梦会员（接后端 premium） */}
      <PremiumPurchaseModal
        open={premiumOpen}
        onClose={() => setPremiumOpen(false)}
        itemId="dream_member"
        visitorId={visitorId}
      />
    </div>
  );
}

/** 简易 Markdown → HTML（列表 / 加粗 / 引用 / 段落，与塔罗页同款） */
