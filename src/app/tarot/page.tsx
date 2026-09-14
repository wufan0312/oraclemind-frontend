'use client';

import '@/styles/tarot.scss';
import {
  useCallback, useEffect, useMemo, useRef, useState,
  type Dispatch, type SetStateAction,
} from 'react';
import { showToast } from '@/components/ui/Toast';
import {
  tarotDeck, drawCardsFromDeck, buildTarotSummary, generateDailyTarot,
  cardMeaning, SUIT_LABEL, DECK_SIZE, localFallbackText,
  getSpread, getAllSpreads, getBuiltinSpreads, saveCustomSpread, deleteCustomSpread,
  COURT_CARDS, recommendSignificator, ephemeralSpreads,
  type DrawnCard, type DailyTarotDeal, type SpreadInfo,
} from '@/data/tarotData';
import { DIMENSION_META, dimensionsOf } from '@/data/tarotDimensions';
import { mdToHtml, sanitizeAiText } from '@/lib/markdown';
import { printDocument } from '@/lib/print';
import {
  requestInterpretStream, requestTarotDaily, requestTarotChatStream, requestPoster, saveReport,
  type InterpretMeta, type ChatHistoryEntry, type PosterResult, type TarotChatCtx, type TarotDailyData,
  type InterpretStreamOptions,
} from '@/lib/api';
import { pushCrossReading } from '@/lib/crossReadings';
import {
  track, getEvents, filterEvents, countByProp, successRate, avgProp, clearEvents,
  type TrackEvent,
} from '@/lib/track';
import { storage, registerLegacy } from '@/lib/storage';
import { setCloudItem, removeCloudItem } from '@/lib/cloudStore';
import { useVisitor } from '@/components/visitor/VisitorProvider';
import TarotDiary from '@/components/tarot/TarotDiary';
import TarotStudy from '@/components/tarot/TarotStudy';
import PremiumUnlockButton from '@/components/premium/PremiumUnlockButton';
// 逐文件导入，不走 components/ui/index.ts 这个 barrel：
// 否则只需 6 个组件却要把全部 14 个组件（含 RegionPicker 等）拖进本路由
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import OmLoading from '@/components/ui/OmLoading';
import CrossPageLink from '@/components/ui/CrossPageLink';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import Modal from '@/components/ui/Modal';
import SectionTitle from '@/components/ui/SectionTitle';
import SectionIcon from '@/components/ui/SectionIcon';
import Tag from '@/components/ui/Tag';
import { useShare, shareOutToPoster } from '@/hooks/useShare';
import ShareLoginGate from '@/components/share/ShareLoginGate';
import LightFollowUp from '@/components/ai-chat/LightFollowUp';

/**
 * 合成分享海报为单张 PNG（图片 + 下方文案，合并到一张画布）。
 * 不依赖第三方截图库：图片画在上、文案卡片画在下，整体导出。
 */
const POSTER_FONT = '"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", system-ui, sans-serif';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** 按字符宽度折行（兼容中文 + emoji，emoji 按近似 2 字宽估算） */
function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (para.trim() === '') {
      lines.push('');
      continue;
    }
    let cur = '';
    for (const ch of para) {
      const test = cur + ch;
      if (ctx.measureText(test).width > maxWidth && cur !== '') {
        lines.push(cur);
        cur = ch;
      } else {
        cur = test;
      }
    }
    if (cur !== '') lines.push(cur);
  }
  return lines;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

async function composePosterDataUrl(imageUrl: string | null, text: string): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 不可用');

  const W = 720;
  const pad = 28;
  const innerW = W - pad * 2;
  const fontSize = 18;
  const lineHeight = 30;
  const cardPad = 22;

  // 图片（等比缩放铺满内容宽）
  let imgDrawH = 0;
  let img: HTMLImageElement | null = null;
  if (imageUrl) {
    try {
      img = await loadImage(imageUrl);
      imgDrawH = Math.round(innerW * (img.height / img.width));
    } catch {
      img = null;
      imgDrawH = 0;
    }
  }

  // 文案折行（需在设置 canvas 尺寸前用同一 ctx 测量，故先量）
  ctx.font = `${fontSize}px ${POSTER_FONT}`;
  const lines = text.trim() ? wrapCanvasText(ctx, text, innerW - cardPad * 2) : [];
  const cardH = lines.length ? lines.length * lineHeight + cardPad * 2 : 0;

  const gap = 20;
  const totalH = pad + imgDrawH + (imgDrawH ? gap : 0) + cardH + pad;
  canvas.width = W;
  canvas.height = Math.max(totalH, 120);

  // 背景
  ctx.fillStyle = '#0f1226';
  ctx.fillRect(0, 0, W, canvas.height);

  // 改 canvas 尺寸会重置上下文状态，需重设字体 / 基线
  ctx.font = `${fontSize}px ${POSTER_FONT}`;
  ctx.textBaseline = 'top';

  let y = pad;
  if (img) {
    ctx.drawImage(img, pad, y, innerW, imgDrawH);
    y += imgDrawH + gap;
  }

  if (lines.length) {
    roundRectPath(ctx, pad, y, innerW, cardH, 12);
    ctx.fillStyle = '#1a1e38';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#e6e8f0';
    let ty = y + cardPad;
    for (const line of lines) {
      ctx.fillText(line, pad + cardPad, ty);
      ty += lineHeight;
    }
  }

  // 远程图若无 CORS 头会污染 canvas，toDataURL 抛 SecurityError → 降级为纯文字版
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return composePosterDataUrl(null, text);
  }
}

/**
 * 牌阵名。自定义牌阵可能在别的机器上被删（分享链接打开时），
 * 取不到就降级为通称，而不是让整页崩掉 —— 抽牌 / 存档 / 解读 / 统计都要用，
 * 抽成函数避免每处各写一遍兜底。
 */
function spreadNameOf(key: string): string {
  return getSpread(key)?.name ?? '自定义牌阵';
}

/**
 * 牌阵定义已不存在时（分享链接带的自定义牌阵在本机被删），用已抽出的牌面反推一个最小牌阵。
 * cards 里每张都带 pos / posDesc，足以让结果区与牌阵说明正常渲染。
 */
function spreadFromCards(cards: DrawnCard[]): SpreadInfo {
  const positions = cards.map((c) => c.pos);
  return {
    name: '自定义牌阵',
    count: cards.length,
    icon: '🧩',
    scene: '自定义场景',
    positions,
    desc: positions.join(' · '),
    positionDesc: cards.map((c) => c.posDesc || ''),
  };
}

/** 自定义牌阵上限：再多牌位在移动端就会挤成一团、解读也会稀释 */
const MAX_CUSTOM_POSITIONS = 12;

/**
 * 牌阵推荐规则：命中关键词越长、越具体，得分越高（长度加权）。
 * 只做关键词匹配而非语义判断 —— 问题框最多 100 字，关键词命中率足够，
 * 也不需要再为一个「选牌阵」的小功能引入模型调用。
 */
const SPREAD_GUIDE: { key: string; hint: string; kw: string[] }[] = [
  {
    key: 'choice',
    hint: '你在两个选项之间摇摆',
    kw: ['该不该', '要不要', '还是', '二选一', '选择', 'offer', '录取', '答应', '拒绝', '留下', '离职'],
  },
  {
    key: 'love',
    hint: '问题核心是另一个人',
    kw: ['感情', '喜欢', '复合', '表白', '暧昧', '分手', '婚姻', '异地', '对象', '男朋友', '女朋友', '老公', '老婆', '桃花'],
  },
  {
    key: 'career',
    hint: '这是工作与事业上的事',
    kw: ['工作', '事业', '跳槽', '创业', '晋升', '项目', '同事', '老板', '领导', '裁员', '转行', '考研', '考公'],
  },
  {
    key: 'time',
    hint: '你想看它怎么一步步发展',
    kw: ['什么时候', '进展', '发展', '未来', '最近', '走势', '运势', '财运', '结果如何', '会不会'],
  },
  {
    key: 'celtic',
    hint: '局面复杂，需要拆开来看',
    kw: ['全面', '深入', '详细', '复杂', '为什么', '整体', '全盘', '一直', '总是', '卡住', '根源'],
  },
];

/**
 * 可一键填入的问题模板。
 * 「不知道该怎么问」是新手最大的门槛 —— 塔罗解读质量高度依赖问题是否具体，
 * 空问题或不问而抽，AI 只能给出放之四海皆准的空话。
 */
const QUESTION_TEMPLATES: { icon: string; q: string; spread: string }[] = [
  { icon: '💼', q: '我该不该接这个 offer？', spread: 'choice' },
  { icon: '❤️', q: '我和 TA 的关系会怎么发展？', spread: 'love' },
  { icon: '🚀', q: '未来三个月我的事业会有起色吗？', spread: 'career' },
  { icon: '⏳', q: '现阶段我该主动推进还是再等等？', spread: 'time' },
  { icon: '🧭', q: '我为什么总在同样的问题上卡住？', spread: 'celtic' },
  { icon: '💰', q: '今年我的财运走势如何？', spread: 'time' },
];

/**
 * 根据问题推荐牌阵：返回推荐牌阵 key 与理由，无命中返回 null。
 * 命中多个取总分最高的一个（长关键词权重更大）。
 */
function recommendSpread(q: string): { key: string; hint: string } | null {
  const text = q.trim();
  if (!text) return null;
  let best: (typeof SPREAD_GUIDE)[number] | null = null;
  let bestScore = 0;
  for (const g of SPREAD_GUIDE) {
    const score = g.kw.reduce((n, k) => (text.includes(k) ? n + k.length : n), 0);
    if (score > bestScore) {
      bestScore = score;
      best = g;
    }
  }
  return best ? { key: best.key, hint: best.hint } : null;
}

/** 主导元素对应的解读提示（牌面构成统计用） */
const ELEMENT_NOTE: Record<'wands' | 'cups' | 'swords' | 'pentacles', string> = {
  wands: '火元素主导：行动、冲劲与自我主张是主线',
  cups: '水元素主导：情感、关系与内心感受是主线',
  swords: '风元素主导：思维、沟通与纠结判断是主线',
  pentacles: '土元素主导：物质、现实与资源积累是主线',
};

/** 牌义速查模块的花色筛选（与 tarotDeck[].suit 对应） */
const DECK_FILTERS = [
  ['all', '全部'],
  ['major', '大阿卡纳'],
  ['wands', '权杖'],
  ['cups', '圣杯'],
  ['swords', '宝剑'],
  ['pentacles', '星币'],
] as const;

const TAROT_FACTS = [
  { icon: '🃏', text: <>塔罗共 <strong className="tc-text-primary">78 张</strong>：22 张大阿卡纳 + 56 张小阿卡纳</> },
  { icon: '🏛️', text: <>大阿卡纳讲人生旅程；小阿卡纳分四组：权杖（火/行动）、圣杯（水/情感）、宝剑（风/思维）、星币（土/物质）</> },
  { icon: '🎴', text: '逆位不代表「坏」，只代表能量受阻或转向内在，常提示你换个角度看问题' },
  { icon: '💡', text: '抽牌前静心 3 秒、默念问题，专注比仪式更重要' },
  { icon: '📅', text: '塔罗不预测「确切日期」，它揭示的是能量趋势与选择方向' }
];

type DrawState = 'idle' | 'shuffling' | 'done';
type AiStatus = 'idle' | 'streaming' | 'done' | 'error';

/** 今日塔罗（每日三牌）本地持久化 key —— 刷新页面后恢复牌面 / AI 解读 / 当前 tab */
const DAILY_STORAGE_KEY = 'om_tarot_daily';
/** 塔罗占卜历史 key（主占卜，最近 6 次） */
const HISTORY_KEY = 'om_tarot_history';
const HISTORY_LIMIT = 6;
/** 当前这次占卜的快照 key —— 刷新后直接恢复结果区，不必从历史里点回来 */
const CURRENT_KEY = 'om_tarot_current';
// P2-1：旧键（om-tarot-*）惰性迁移到新键（om_tarot_*），首次读取新键时自动回退并迁移
registerLegacy('om-tarot-daily', DAILY_STORAGE_KEY);
registerLegacy('om-tarot-history', HISTORY_KEY);
registerLegacy('om-tarot-current', CURRENT_KEY);
/**
 * 历史 / 快照的数据结构版本。
 * 牌库升级（比如加分维度牌义）后旧记录里的牌义就是脏的，
 * 读取时按版本号丢弃，避免用户看到新旧混杂的牌义。
 */
const SNAPSHOT_SCHEMA = 2;
/** 每日三牌请求超时（毫秒）：后端实测 20-30s，超时后走本地牌义兜底并可重试 */
const DAILY_TIMEOUT_MS = 30000;
/** 同一牌阵 + 同一问题在这个时间窗内再次抽牌，视为「重抽」而非新的一次占卜 */
const REDRAW_WINDOW_MS = 10 * 60 * 1000;
/** 「再抽一次」冷却秒数：每次重抽都会重新洗牌 + 重新请求 LLM，防无意识连点 */
const REDRAW_COOLDOWN_S = 5;
/** 「换个角度再解读」冷却秒数：不洗牌但仍是一次全新 LLM 请求 */
const REREAD_COOLDOWN_S = 3;
/**
 * 追问回传的历史轮次上限（一轮 = 用户 + 助手各一条）。
 * 全量回传会让 prompt 随对话线性膨胀 —— 延迟与成本一起涨，
 * 而塔罗追问的问题通常只跟最近几轮相关。
 */
const CHAT_CONTEXT_TURNS = 6;

/** 每日三牌持久化数据结构 */
interface DailyPersist {
  date: string;
  deal: DailyTarotDeal;
  data: TarotDailyData | null;
  activeTab: number;
  /** 生成这副牌时的逆位口径（老数据没有该字段，按「允许逆位」理解） */
  allowRev?: boolean;
}

/**
 * 一次占卜的完整快照：历史项与「当前占卜」共用同一结构，
 * 这样刷新恢复 / 历史回放走的是同一套字段，不会再出现「历史恢复不全」。
 */
interface ReadingSnapshot {
  /** 数据结构版本，用于牌库升级后作废旧记录 */
  v: number;
  ts: number;
  spreadKey: string;
  spreadName: string;
  question: string;
  cards: DrawnCard[];
  text: string;
  /** 当时的逆位开关：恢复后 UI 与结果口径一致 */
  allowRev: boolean;
  /** 当时是否「只用大阿卡纳」：牌池不同，恢复后不能按默认的 78 张理解 */
  majorOnly: boolean;
  /** 第几副牌：恢复后点「再抽一次」不会让轮次语义跳变 */
  drawNonce: number;
  /** AI 不可用、内容为本地牌义兜底 */
  degraded: boolean;
  /** AI 元信息（provider / 耗时 / tokens / 缓存 / 降级 / 截断） */
  aiMeta: InterpretMeta | null;
  /** 免责声明（AI 返回，恢复后要一起还原） */
  disclaimer: string;
  /** 这次占卜的追问（之前只存内存，恢复历史后全丢） */
  chat?: ChatHistoryEntry[];
  /** 指示牌：代表问卜者本人的那张宫廷牌（未选则为 null） */
  significator?: string | null;
  /**
   * 已生成的分享海报结果。此前海报只活在内存里，刷新或恢复历史后就丢了，
   * 再打开分享弹窗是一片空白，还得重新生成一次（每次生成都要调一次图片接口）。
   */
  poster?: PosterResult | null;
}

/** 自定义牌阵编辑草稿（弹窗表单的状态；id 为 null 表示新建） */
interface SpreadDraft {
  id: string | null;
  name: string;
  icon: string;
  scene: string;
  desc: string;
  positions: { name: string; desc: string }[];
}

/** 占卜历史项 = 一次完整快照 */
type TarotHistoryItem = ReadingSnapshot;

/** 相对时间：历史列表只关心「多久以前」，精确到分钟足够，不显示绝对时间戳 */
function ago(ts: number): string {
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

/** 本地降级：主题牌关键词（接口不可用时用牌库牌义兜底，数据仍随当日牌面动态变化） */
function localThemeKw(deal: DailyTarotDeal): string {
  return cardMeaning(deal.theme.name, deal.theme.isRev);
}

/** 本地降级：今日能量列表 */
function localDailyEnergy(deal: DailyTarotDeal): { k: string; v: string; color?: string }[] {
  return [
    { k: '🔮 能量提醒', v: `今日主题牌 ${deal.theme.isRev ? '逆位' : '正位'}·${deal.theme.name}：${cardMeaning(deal.theme.name, deal.theme.isRev)}`, color: '#4ade80' },
    { k: '💡 行动建议', v: '翻开每日三牌，参考每张牌的牌义提示；重要决定仍应结合现实理性判断。' },
    { k: '⚠️ 避坑指南', v: '小玄今天有点累，已切换本地牌义陪你看' }
  ];
}

/**
 * 每日三牌的今日指引：优先用 AI 输出，但按牌名匹配而非下标。
 * LLM 偶发把主题牌混入 cards 数组导致整体错位，按 name 对齐可避免张冠李戴。
 */
function dailyRead(
  c: DailyTarotDeal['cards'][number],
  dailyData: TarotDailyData | null
): string {
  const hit = dailyData?.cards?.find((x) => x.name === c.name);
  return hit?.read || cardMeaning(c.name, c.isRev);
}

/** 本地降级：AI 综合指引（接口不可用时由三张牌正逆位占比拼一段） */
function localDailySummary(deal: DailyTarotDeal): string {
  const names = deal.cards.map((c) => `${c.isRev ? '逆位' : '正位'}·${c.name}`).join('、');
  const revCount = deal.cards.filter((c) => c.isRev).length;
  let line: string;
  if (revCount === 0) line = '三张牌全部正位，今日能量通畅，宜顺势推进、果断行动。';
  else if (revCount === 1) line = '两张正位一张逆位：大方向向好，留意逆位牌对应的卡点，先化解它再加速。';
  else if (revCount === 2) line = '正逆参半：今日处在拉扯与平衡期，重要决定缓一缓，先理清内心再行动。';
  else line = '逆位偏多：今日能量受阻，不宜硬推；先停下来看清阻碍，再调整节奏。';
  return `${names}。${line}`;
}

/** 今日日期 YYYY-MM-DD */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 把分维度牌义转成中文键传给后端 —— 键名直接进 prompt，
 * 「感情 / 事业 / 财运 / 健康」比 love / career 更好读，模型也更容易对上用户的问法。
 */
function dimPayload(name: string): Record<string, string> | undefined {
  const d = dimensionsOf(name);
  if (!d) return undefined;
  return { 感情: d.love, 事业: d.career, 财运: d.wealth, 健康: d.health };
}

/** 结论卡信息：后端 formatter 保证输出「**🔮 结论**\n\n**倾向**：X　**能量分**：N/100」 */
interface VerdictInfo {
  verdict: '宜' | '中性' | '不宜';
  score: number;
}

/** 单次匹配用（提取倾向与分数） */
const VERDICT_RE = /\*\*🔮\s*结论\*\*\s*\n+\s*\*\*倾向\*\*：\s*(宜|中性|不宜)\s*　\s*\*\*能量分\*\*：\s*(\d{1,3})\s*\/\s*100/;
/** 全局匹配用（从正文中剥离已单独渲染的结论段） */
const VERDICT_PATTERN = new RegExp(VERDICT_RE.source, 'g');

/** 提取失败（后端未返回 verdict 或格式漂移）返回 null，正文按普通文本渲染，不炸 */
function parseVerdict(text: string): VerdictInfo | null {
  const m = VERDICT_RE.exec(text);
  if (!m) return null;
  const score = Number.parseInt(m[2], 10);
  if (!Number.isFinite(score)) return null;
  return { verdict: m[1] as VerdictInfo['verdict'], score: Math.max(0, Math.min(100, score)) };
}

function verdictClass(v: VerdictInfo['verdict']): string {
  if (v === '宜') return 'verdict-pos';
  if (v === '不宜') return 'verdict-neg';
  return 'verdict-mid';
}

/**
 * 塔罗页 —— 牌阵选择 / 洗牌抽牌 / AI 流式解读 / 追问 / 每日三牌 / 牌义速查
 */
export default function TarotPage() {
  const { visitorId } = useVisitor();

  const [spreadKey, setSpreadKey] = useState('time');
  /** 右栏主 tab：牌阵说明 / 抽牌结果（牌位说明信息量大，放左栏 280px 里太挤） */
  const [rightTab, setRightTab] = useState<'intro' | 'result'>('intro');
  /** 「牌阵说明」里当前展开的牌位下标 */
  const [posIdx, setPosIdx] = useState(0);
  const [question, setQuestion] = useState('');
  const [allowRev, setAllowRev] = useState(true);
  /** 只用大阿卡纳（22 张）：新手友好，牌义更聚焦在「人生议题」而非日常细节 */
  const [majorOnly, setMajorOnly] = useState(false);
  const [drawState, setDrawState] = useState<DrawState>('idle');
  const [cards, setCards] = useState<DrawnCard[]>([]);
  /** 抽牌轮次：递增即换一副新牌（实现「再抽一次」） */
  const [drawNonce, setDrawNonce] = useState(0);

  /** 今日塔罗（按日期动态生成 + AI 解读） */
  const [dailyDeal, setDailyDeal] = useState<DailyTarotDeal | null>(null);
  const [dailyData, setDailyData] = useState<TarotDailyData | null>(null);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [dailyRetry, setDailyRetry] = useState(0);
  /** 每日三牌失败原因（超时 / 网络 / 接口异常），此前失败与超时都表现成「静默无数据」 */
  const [dailyError, setDailyError] = useState('');
  const [activeDailyTab, setActiveDailyTab] = useState(0);

  /** AI 主解读（流式） */
  const [aiStatus, setAiStatus] = useState<AiStatus>('idle');
  const [aiText, setAiText] = useState('');
  const [aiMeta, setAiMeta] = useState<InterpretMeta | null>(null);
  const [aiError, setAiError] = useState('');
  const [disclaimer, setDisclaimer] = useState('');
  /** 当前结果配套的牌阵/问题（追问与存档用） */
  const ctxRef = useRef<{ key: string; q: string; drawn: DrawnCard[] } | null>(null);

  /** 追问（多轮对话）：由 LightFollowUp 内部管理输入/流式，这里只保留可恢复/可持久化的历史） */
  const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>([]);
  /** 当前占卜的 key：变更时强制 LightFollowUp 重置，避免上一副牌的追问混入新占卜 */
  const [readingKey, setReadingKey] = useState('');

  /** 历史记录 */
  const [history, setHistory] = useState<TarotHistoryItem[]>([]);

  /** 弹窗：牌义详情 / 分享海报（78 张速查已改为页面内模块，不再走弹窗） */
  const [detailCard, setDetailCard] = useState<DrawnCard | null>(null);
  const [deckFilter, setDeckFilter] = useState<'all' | 'major' | 'wands' | 'cups' | 'swords' | 'pentacles'>('all');
  /** 牌义速查模块的搜索词（匹配牌名或关键词） */
  const [deckQuery, setDeckQuery] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [posterLoading, setPosterLoading] = useState(false);
  const [poster, setPoster] = useState<PosterResult | null>(null);
  /** 分享存档 Hook：登录守卫 + 挂载自动读库（二次进入直接展示）+ persist 落库 */
  const share = useShare('tarot');
  /** 指示牌（significator）：代表问卜者本人的宫廷牌，选了之后 AI 会把解读落到「你」身上 */
  const [significator, setSignificator] = useState<string | null>(null);
  /** 指示牌推荐依据：性别 + 元素（经典规则：男→国王、女→王后，元素定花色） */
  const [sigGender, setSigGender] = useState<'male' | 'female'>('female');
  const [sigElement, setSigElement] = useState<'wands' | 'cups' | 'swords' | 'pentacles'>('wands');
  /**
   * 牌阵列表：内置 5 套 + 用户自建（存 localStorage）。
   * 做成 state 而不是模块常量，是因为增删自定义牌阵要触发重渲染。
   * 注意：初始 state 只放内置牌阵（不读 localStorage），避免 SSR 5 套 / CSR 6 套导致
   * hydration mismatch → Runtime Error。挂载后再由 effect 补上自定义牌阵。
   */
  const [spreads, setSpreads] = useState(() => getBuiltinSpreads());
  /** 自定义牌阵编辑器：null 为关闭 */
  const [draft, setDraft] = useState<SpreadDraft | null>(null);
  /** 使用统计（本地埋点聚合，默认展开） */
  const [stats, setStats] = useState<TarotStats | null>(null);
  /** 78 张牌义速查：默认折叠前 3 行，点「展开全部」才显示完整 78 张 */
  const [deckExpanded, setDeckExpanded] = useState(false);
  // 默认展开使用统计：进入页面即计算一次本地聚合（避免每次渲染都读 localStorage）
  useEffect(() => {
    setStats(computeTarotStats());
  }, []);

  /** 重算 stats：抽牌/解读/追问后调用，让统计面板不落后于事件流水 */
  const refreshStats = useCallback(() => {
    setStats(computeTarotStats());
  }, []);

  // 挂载后再把自定义牌阵并入（首屏初始 state 只用内置，避开 hydration mismatch）
  useEffect(() => {
    setSpreads(getAllSpreads());
  }, []);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const aiReqIdRef = useRef(0);
  const savedRef = useRef(false);
  const areaRef = useRef<HTMLDivElement>(null);
  /** 追问中断器：切牌阵/重抽/重新解读时作废在途追问 */
  const chatAbortRef = useRef<AbortController | null>(null);
  /** 「换个角度再解读」轮次：作为 focus 传入，使缓存键不同，避免命中旧缓存返回同一份文本 */
  const rereadRef = useRef(0);
  /** 当前这次占卜在历史里的 ts —— 追问要挂回同一条记录 */
  const currentTsRef = useRef(0);
  /** 当前这次占卜的身份（牌阵+问题）与 ts —— 重抽时复用同一条记录，避免历史被刷满 */
  const readingIdRef = useRef<{ sig: string; ts: number }>({ sig: '', ts: 0 });
  /** 再抽一次的冷却倒计时（秒）；每次重抽都是一次全新 LLM 请求，防连点烧钱 */
  const [redrawWait, setRedrawWait] = useState(0);
  const redrawTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** 「换个角度再解读」的冷却倒计时（秒）：与重抽同理，每次都是一次真金白银的新请求 */
  const [rereadWait, setRereadWait] = useState(0);
  const rereadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /**
   * 抽牌 → 解读 → 存档是一条跨异步的链路：洗牌定时器 1.5s 后才发请求，
   * 而 startDraw / runInterpret 都是 useCallback 捕获的旧闭包，
   * 直接读 state 会拿到发起请求那一刻之前的值（实测重抽后存档的 drawNonce 比实际小 1，
   * 指示牌改了也可能仍是上一张）。这里放一份「最新值」，链路末端统一从 ref 读。
   */
  const latestRef = useRef({ allowRev, majorOnly, drawNonce, significator, poster });
  latestRef.current = { allowRev, majorOnly, drawNonce, significator, poster };

  /**
   * 当前牌阵：内置 5 套 + 自定义，取不到时（分享链接里的自定义牌阵在本机被删）
   * 用已抽出的牌面反推，避免 spread.name / spread.count 直接让整页崩掉。
   */
  const spread = getSpread(spreadKey) ?? spreadFromCards(cards);
  // 图标已并入牌阵数据（自定义牌阵也带 icon），无需再跨数组查找
  const spreadIcon = spread.icon;
  /**
   * 切牌阵后 positions 长度会变（10 位凯尔特 → 3 位时间之流），
   * 旧的 posIdx 可能越界导致渲染 undefined，这里统一夹到合法范围。
   */
  const safePosIdx = Math.min(Math.max(posIdx, 0), spread.positions.length - 1);

  // ============ 生命周期：清理定时器与在途请求 ============
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (redrawTimerRef.current) clearInterval(redrawTimerRef.current);
      if (rereadTimerRef.current) clearInterval(rereadTimerRef.current);
      abortRef.current?.abort();
      chatAbortRef.current?.abort();
    };
  }, []);

  /**
   * 启动秒级冷却倒计时：写入秒数后每秒递减，归零时清掉定时器。
   * 重抽与「换个角度再解读」共用 —— 两者都会真实发起一次 LLM 请求（实测 ¥0.002-0.003 / 次）。
   */
  const startCooldown = useCallback(
    (
      setWait: Dispatch<SetStateAction<number>>,
      timerRef: { current: ReturnType<typeof setInterval> | null },
      seconds: number
    ) => {
      setWait(seconds);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setWait((w) => {
          if (w <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            return 0;
          }
          return w - 1;
        });
      }, 1000);
    },
    []
  );

  /** 作废在途追问：切牌阵 / 重抽 / 恢复历史 / 重新解读时调用，防止旧流写回新占卜 */
  const cancelPendingChat = useCallback(() => {
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
  }, []);

  /**
   * 把一次快照回填到结果区 —— 刷新恢复与历史回放走同一条路径，
   * 避免两边字段各自维护导致的「历史恢复不全」。
   * 只还原，不重发请求、不重新洗牌。
   */
  const applySnapshot = useCallback((snap: ReadingSnapshot) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
    cancelPendingChat();
    aiReqIdRef.current += 1;
    setSpreadKey(snap.spreadKey);
    setQuestion(snap.question);
    setAllowRev(snap.allowRev);
    // 旧快照没有这个字段（schema v2 之前），按默认的 78 张牌池理解
    setMajorOnly(snap.majorOnly ?? false);
    setDrawNonce(snap.drawNonce);
    setCards(snap.cards);
    setDrawState('done');
    setAiText(snap.text);
    // 没有解读文本（分享链接还原的牌面还没跑 AI）时回落本地牌义，而不是给一块空白面板
    setAiStatus(snap.text ? 'done' : 'idle');
    setAiMeta(snap.aiMeta ?? null);
    setDisclaimer(snap.disclaimer || '');
    setAiError('');
    setChatHistory(snap.chat || []);
    // 指示牌与海报此前都不在快照里：刷新 / 恢复历史后一律丢失，得重新选、再生成一次
    setSignificator(snap.significator ?? null);
    setPoster(snap.poster ?? null);
    setRightTab('result');
    currentTsRef.current = snap.ts; // 后续追问继续挂回这条记录
    savedRef.current = true; // 已是既有记录，不要重复存档
    readingIdRef.current = { sig: `${snap.spreadKey}|${snap.question}`, ts: snap.ts };
    ctxRef.current = { key: snap.spreadKey, q: snap.question, drawn: snap.cards };
  }, [cancelPendingChat]);

  /** 写入「当前占卜」快照（刷新后可恢复）；传 null 表示清除 */
  const persistCurrent = useCallback((snap: ReadingSnapshot | null) => {
    try {
      if (!snap) removeCloudItem(CURRENT_KEY);
      else setCloudItem(CURRENT_KEY, JSON.stringify(snap));
    } catch { /* 存储不可用则跳过 */ }
  }, []);

  // ============ 挂载：恢复今日塔罗 ============
  useEffect(() => {
    const dateStr = todayStr();
    let deal: DailyTarotDeal | null = null;
    try {
      const raw = storage.getItem(DAILY_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as DailyPersist;
        // 逆位口径不一致的旧缓存不能复用：否则关掉「允许逆位」后今日三牌照样出逆位，
        // 而 AI 解读是按提交上去的牌面生成的，展示与口径会同时对不上
        if (saved.date === dateStr && saved.deal && (saved.allowRev ?? true) === allowRev) {
          deal = saved.deal;
          setDailyDeal(deal);
          setActiveDailyTab(Math.min(Math.max(saved.activeTab || 0, 0), deal.cards.length - 1));
          if (saved.data) {
            setDailyData(saved.data);
            setDailyLoading(false);
            return;
          }
        }
      }
    } catch {
      /* 缓存损坏则忽略，重新生成 */
    }
    if (!deal) deal = generateDailyTarot(dateStr, allowRev);
    setDailyDeal(deal);
    setDailyLoading(true);
    setDailyError('');

    // 可中断 + 超时兜底：卸载或跨日翻页时 abort，后端卡住不会一直转圈
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), DAILY_TIMEOUT_MS);
    let cancelled = false; // StrictMode 双挂载时，被 abort 的旧请求不得写 state
    requestTarotDaily(
      {
        date: dateStr,
        theme: { name: deal.theme.name, isRev: deal.theme.isRev },
        cards: deal.cards.map((c) => ({ name: c.name, isRev: c.isRev, position: c.position })),
      },
      ac.signal
    )
      .then((res) => {
        if (cancelled) return;
        setDailyData(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        const e = err as { name?: string };
        setDailyData(null);
        setDailyError(
          e?.name === 'AbortError'
            ? `小玄这次想得久一点（${DAILY_TIMEOUT_MS / 1000}s），先用本地牌义陪你看`
            : '小玄今天连不上，先用本地牌义陪你看'
        );
      })
      .finally(() => {
        clearTimeout(timer);
        if (!cancelled) setDailyLoading(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      ac.abort();
    };
    // allowRev 入依赖：开关一变就重抽当日牌面并重新请求解读（牌面正逆位变了，AI 文案必须跟着变）
  }, [dailyRetry, allowRev]);

  /**
   * 跨天自动换牌：页面长时间开着越过午夜，不能一直显示昨天的三张牌。
   * 依赖 dailyDeal.date，换牌后本 effect 会重跑并比对新的日期。
   */
  useEffect(() => {
    const current = dailyDeal?.date;
    if (!current) return;
    const id = setInterval(() => {
      if (todayStr() !== current) setDailyRetry((n) => n + 1);
    }, 60_000);
    return () => clearInterval(id);
  }, [dailyDeal?.date]);

  // 持久化每日三牌
  useEffect(() => {
    if (!dailyDeal) return;
    try {
      setCloudItem(
        DAILY_STORAGE_KEY,
        JSON.stringify({
          date: dailyDeal.date,
          deal: dailyDeal,
          data: dailyData,
          activeTab: activeDailyTab,
          allowRev,
        } satisfies DailyPersist)
      );
    } catch {
      /* 存储不可用则跳过 */
    }
  }, [dailyDeal, dailyData, activeDailyTab, allowRev]);

  // 跨页融合：把每日三牌结论写入共享池，供综合运势模块读取
  useEffect(() => {
    if (dailyData?.summary) {
      pushCrossReading({ type: 'tarot', label: '塔罗', summary: dailyData.summary });
    }
  }, [dailyData]);

  // 恢复历史记录：版本不匹配的旧快照直接丢弃（牌库升级后里面的牌义是脏的）
  useEffect(() => {
    try {
      const raw = storage.getItem(HISTORY_KEY);
      if (!raw) return;
      const list = JSON.parse(raw) as TarotHistoryItem[];
      setHistory(Array.isArray(list) ? list.filter((i) => i?.v === SNAPSHOT_SCHEMA) : []);
    } catch { /* 忽略 */ }
  }, []);

  // 恢复结果区：分享链接优先，其次上次占卜快照，都没有则保持空态
  useEffect(() => {
    // 1) 别人分享的牌面：只还原牌面与问题，不自动跑 AI（点开链接就烧钱不合适）
    const shared = decodeShare(window.location.search);
    if (shared) {
      setSpreadKey(shared.spreadKey);
      setQuestion(shared.question);
      setAllowRev(shared.allowRev);
      setMajorOnly(shared.majorOnly);
      setCards(shared.cards);
      setSignificator(shared.significator ?? null);
      setDrawState('done');
      setAiStatus('idle');
      setRightTab('result');
      savedRef.current = false;
      ctxRef.current = { key: shared.spreadKey, q: shared.question, drawn: shared.cards };
      // 落一份快照：对方刷新页面后这副牌还在，不至于一刷新就回到空抽牌页。
      // text 留空表示「还没跑 AI」，恢复时展示本地牌义而不是空白面板。
      persistCurrent({
        v: SNAPSHOT_SCHEMA,
        ts: Date.now(),
        spreadKey: shared.spreadKey,
        spreadName: spreadNameOf(shared.spreadKey),
        question: shared.question,
        cards: shared.cards,
        text: '',
        allowRev: shared.allowRev,
        majorOnly: shared.majorOnly,
        drawNonce: 0,
        degraded: false,
        aiMeta: null,
        disclaimer: '',
        significator: shared.significator,
      });
      // 清掉地址栏参数，刷新时不再重复还原
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }
    // 2) 上次占卜快照：刷新后直接看到牌面与解读，不必从「最近占卜」点回来
    try {
      const raw = storage.getItem(CURRENT_KEY);
      if (!raw) return;
      const snap = JSON.parse(raw) as ReadingSnapshot;
      if (snap?.v !== SNAPSHOT_SCHEMA || !snap.cards?.length) return;
      applySnapshot(snap);
    } catch { /* 缓存损坏则忽略 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 首页小玄引导跳转：?autostart=1&q= → 预填问题并自动起卦一次
  //
  // 修法要点（2026-09-02）：
  // React 19 + Next dev 严格Mode 下，组件会 mount → unmount → mount 二次。
  // 这里用微任务延后 startDraw：① 让恢复快照 effect（796 行）先跑完，
  // 避免它内部的 clearTimeout 把我们注册的 setTimeout 清掉；
  // ② 不再用 useRef 守门，二次 mount 会再次排一个微任务，
  // startDraw 内部 clearTimeout + 重注册自然收敛到最新一次。
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('autostart') !== '1') return;
    const q = sp.get('q') || '';
    if (q) setQuestion(q);
    setRightTab('result');
    window.history.replaceState(null, '', window.location.pathname);
    // 微任务：在所有同步 commit 后的 effect 跑完之后再调 startDraw
    Promise.resolve().then(() => {
      // mount #2 重新跑这个 effect 时，URL 已清，但 spreadKey 可能被快照恢复 effect
      // 改写成用户当前牌阵 —— 这是用户期望的「接着用上次的牌阵开新占」
      startDraw(spreadKey, q, drawNonce, majorOnly);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistHistory = useCallback((next: TarotHistoryItem[]) => {
    setHistory(next);
    try {
      setCloudItem(HISTORY_KEY, JSON.stringify(next));
    } catch { /* 忽略 */ }
  }, []);

  // ============ 抽牌 ============
  /** 发起一次占卜：key 牌阵、q 问题、nonce 轮次（递增=换一副牌）、onlyMajor 只用大阿卡纳 */
  const startDraw = useCallback((key: string, q: string, nonce: number, onlyMajor: boolean) => {
    // 取消上一轮：清理定时器 + 中断在途请求（含在途追问）
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
    cancelPendingChat();
    const ac = new AbortController();
    abortRef.current = ac;
    aiReqIdRef.current += 1;
    savedRef.current = false;
    currentTsRef.current = 0;
    // 旧快照已作废：抽牌途中刷新，应回到空态而不是恢复出上一副牌
    persistCurrent(null);

    const seedStr = `${todayStr()}:${key}:${q}#${nonce}`;
    setRightTab('result');
    setDrawState('shuffling');
    setCards([]);
    setAiStatus('idle');
    setAiText('');
    setAiMeta(null);
    setAiError('');
    setDisclaimer('');
    setChatHistory([]);
    // 新一轮占卜：换 key 强制 LightFollowUp 重置（initialHistory 只在挂载时读取），
    // 避免上一副牌的追问混入新占卜。
    setReadingKey(`${key}|${q}#${nonce}`);

    const prev = timerRef.current;
    timerRef.current = setTimeout(() => {
      const sp = getSpread(key);
      // 牌阵已不存在（自定义牌阵被删）：不该发生，兜底避免崩在洗牌回调里
      if (!sp) return;
      const drawn = drawCardsFromDeck(sp, seedStr, onlyMajor).map((c) =>
        allowRev ? c : { ...c, isRev: false }
      );
      setCards(drawn);
      setDrawState('done');
      ctxRef.current = { key, q, drawn };
      track('tarot', 'draw', { spread: key, majorOnly: onlyMajor, nonce });
      // 抽牌完成立即写历史骨架：不等解读完成。否则解读 abort / 失败 / 网络断开时 history 永远是空的，
      // 用户体感「明明占卜了却没记录」。解读完成后会用同 ts 复用更新这条骨架（archiveResult 内部 same 检测）。
      {
        const sig = `${key}|${q}`;
        const ts = Date.now();
        readingIdRef.current = { sig, ts };
        currentTsRef.current = ts;
        if (!savedRef.current) {
          savedRef.current = true;
          archiveResult(key, q, drawn, '', false, null, '');
        }
        refreshStats();
      }
      void runInterpret(key, q, drawn, ac);
      areaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowRev, cancelPendingChat, persistCurrent]);

  /**
   * 只重跑 AI 解读，不重新洗牌抽牌。
   * 牌面由 ctxRef 提供（与上次完全相同），focus 递增使缓存键不同 —— 否则同参数必然命中缓存、
   * 返回与上次一字不差的文本，用户看到「洗了一遍牌、结果一模一样」。
   */
  const handleReread = () => {
    const ctx = ctxRef.current;
    if (!ctx || rereadWait > 0 || aiStatus === 'streaming') return;
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
    cancelPendingChat();
    const ac = new AbortController();
    abortRef.current = ac;
    aiReqIdRef.current += 1;
    savedRef.current = false;
    rereadRef.current += 1;
    setAiStatus('streaming');
    setAiText('');
    setAiMeta(null);
    setAiError('');
    setDisclaimer('');
    startCooldown(setRereadWait, rereadTimerRef, REREAD_COOLDOWN_S);
    void runInterpret(ctx.key, ctx.q, ctx.drawn, ac, 'reread-' + rereadRef.current);
  };

  /**
   * 存档一次占卜：写本地历史 + 云端报告 + 当前快照。
   * 成功与失败都会调用 —— 此前只有成功分支存档，AI 降级时用户看到的本地牌义刷新即失。
   *
   * **重抽去重**：同牌阵 + 同问题且距上次存档在 `REDRAW_WINDOW_MS` 内，视为同一次占卜的迭代
   * —— 替换那条记录（复用 ts，追问仍挂得上）并跳过云端写入。
   * 否则连点「再抽一次」既会挤空 6 条历史，又会把 report 页刷满同一问题的近副本。
   *
   * 逆位开关 / 牌池模式 / 第几副牌 / 指示牌 / 海报统一从 `latestRef` 读取：
   * 存档发生在洗牌定时器与流式请求之后，用闭包里的 state 会拿到发起请求前的旧值。
   */
  const archiveResult = useCallback(
    (
      key: string,
      q: string,
      drawn: DrawnCard[],
      text: string,
      degraded: boolean,
      meta: InterpretMeta | null,
      disc: string
    ) => {
      const { allowRev, majorOnly, drawNonce, significator, poster } = latestRef.current;
      const now = Date.now();
      const sig = `${key}|${q}`;
      const last = readingIdRef.current;
      const same = last.sig === sig && last.ts > 0 && now - last.ts < REDRAW_WINDOW_MS;
      // 复用同一 ts：历史里那条记录得以原地更新，追问与「第几副牌」语义不断裂
      const ts = same ? last.ts : now;
      readingIdRef.current = { sig, ts };
      currentTsRef.current = ts;

      const item: TarotHistoryItem = {
        v: SNAPSHOT_SCHEMA,
        ts,
        spreadKey: key,
        spreadName: spreadNameOf(key),
        question: q,
        cards: drawn,
        text,
        allowRev,
        majorOnly,
        drawNonce,
        degraded,
        aiMeta: meta,
        disclaimer: disc,
        significator,
        poster,
      };
      // 函数式更新：避免闭包里的旧 history 覆盖并发写入
      setHistory((prev) => {
        const next = same
          ? [item, ...prev.filter((i) => i.ts !== ts)]
          : [item, ...prev].slice(0, HISTORY_LIMIT);
        try {
          setCloudItem(HISTORY_KEY, JSON.stringify(next));
        } catch { /* 忽略 */ }
        return next;
      });
      // 当前快照：刷新后可直接恢复结果区
      persistCurrent(item);
      // 重抽产生的中间版本不写云端（后端报告无 update 接口，写了就是一堆近副本）
      if (visitorId && !same) {
        const at = new Date();
        void saveReport({
          visitorId,
          title: `${todayStr()} 塔罗 · ${spreadNameOf(key)}${q ? ` · ${q.slice(0, 12)}` : ''}`,
          params: {
            year: at.getFullYear(),
            month: at.getMonth() + 1,
            day: at.getDate(),
            question: q,
          },
          results: {
            tarot: {
              spreadKey: key,
              spreadName: spreadNameOf(key),
              question: q,
              cards: drawn,
              text,
              degraded,
            },
          },
        }).catch(() => {});
      }
    },
    [persistCurrent, visitorId]
  );

  /** 把本轮追问写回当前占卜的历史项（此前追问只存在内存里，恢复历史后全丢） */
  const persistChatToHistory = useCallback((chat: ChatHistoryEntry[]) => {
    const ts = currentTsRef.current;
    if (!ts) return;
    setHistory((prev) => {
      const next = prev.map((i) => (i.ts === ts ? { ...i, chat } : i));
      try {
        setCloudItem(HISTORY_KEY, JSON.stringify(next));
      } catch { /* 忽略 */ }
      return next;
    });
  }, []);

  /**
   * 海报生成后补写回历史与当前快照。
   * 存档（archiveResult）发生在解读完成时，那时海报还没生成，只能事后补写 ——
   * 否则刷新页面海报就变回空白，用户得再生成一次（每次都要调一次图片接口）。
   */
  const persistPosterToHistory = useCallback((p: PosterResult) => {
    const ts = currentTsRef.current;
    if (!ts) return;
    setHistory((prev) => {
      const next = prev.map((i) => (i.ts === ts ? { ...i, poster: p } : i));
      try {
        setCloudItem(HISTORY_KEY, JSON.stringify(next));
      } catch { /* 忽略 */ }
      return next;
    });
    try {
      const raw = storage.getItem(CURRENT_KEY);
      if (!raw) return;
      const snap = JSON.parse(raw) as ReadingSnapshot;
      if (snap?.ts === ts) persistCurrent({ ...snap, poster: p });
    } catch { /* 缓存损坏则忽略 */ }
  }, [persistCurrent]);

  /** AI 流式解读 */
  const runInterpret = async (
    key: string,
    q: string,
    drawn: DrawnCard[],
    ac: AbortController,
    focus?: string
  ) => {
    const reqId = aiReqIdRef.current;
    const sp = getSpread(key);
    setAiStatus('streaming');
    setAiText('');
    try {
      const res = await requestInterpretStream(
        'tarot',
        {
          spreadKey: key,
          spreadName: spreadNameOf(key),
          question: q,
          count: sp?.count ?? drawn.length,
          positions: sp?.positions ?? drawn.map((c) => c.pos),
          // 指示牌：代表问卜者本人的那张牌，让 AI 把解读落到「你」身上（ai-py 的 tarot prompt 会读取）
          // 从 latestRef 取：本函数由洗牌定时器回调触发，闭包里的可能是改动前的旧选择
          significator: latestRef.current.significator
            ? {
                name: latestRef.current.significator,
                isRev: false,
                sym: tarotDeck[latestRef.current.significator]?.sym ?? '',
              }
            : null,
          cards: drawn.map((c) => ({
            pos: c.pos,
            posDesc: c.posDesc,
            name: c.name,
            isRev: c.isRev,
            upright: c.upright,
            rev: c.rev,
            kw: c.kw,
            // 分维度牌义一并注入：只有一句总牌义时，模型对「感情/事业/财运/健康」只能泛泛而谈
            dim: dimPayload(c.name),
          })),
        },
        {
          signal: ac.signal,
          focus,
          onDelta: (_chunk, full) => {
            if (aiReqIdRef.current === reqId) setAiText(full);
          },
          onMeta: (meta, disc) => {
            if (aiReqIdRef.current === reqId) {
              setAiMeta(meta);
              setDisclaimer(disc);
            }
          },
        }
      );
      if (aiReqIdRef.current !== reqId) return;
      setAiText(res.text);
      setAiMeta(res.meta);
      setDisclaimer(res.disclaimer);
      setAiStatus('done');
      // 埋点：耗时与降级情况是「解读质量」最直观的两个指标
      track('tarot', 'interpret', {
        ok: true,
        spread: key,
        latencyMs: res.meta?.latencyMs ?? 0,
        degraded: !!res.meta?.degraded,
        cacheHit: !!res.meta?.cacheHit,
        truncated: !!res.meta?.truncated,
      });

      // 跨页融合：把主占卜结论写入共享池，供综合报告页「跨页占卜记录」消费。
      // 此前只推每日三牌，用户真正关心的主占卜在 report 页一条都看不到。
      pushCrossReading({
        type: 'tarot',
        label: '塔罗',
        summary: `【${spreadNameOf(key)}】${q ? `问：${q.slice(0, 20)}　` : ''}${res.text.replace(/[*\-#>\s]+/g, ' ').slice(0, 70)}…`,
      });

      // 解读完成后原地更新骨架（同 ts 复用，不创建新条目）
      // 不再用 if(!savedRef.current) 守门——骨架已由抽牌步骤写过，这里只负责补全 text/meta/disclaimer
      archiveResult(key, q, drawn, res.text, false, res.meta, res.disclaimer);
      refreshStats();
    } catch (err) {
      if (aiReqIdRef.current !== reqId) return;
      const e = err as { name?: string; message?: string };
      if (e?.name === 'AbortError') return;
      setAiStatus('error');
      setAiError(e?.message || 'AI 解读失败');
      track('tarot', 'interpret', { ok: false, spread: key, reason: e?.name || 'unknown' });
      // 失败也要存档：用户看到的本地牌义兜底得能找回来（同 ts 复用更新骨架）
      if (drawn.length > 0) {
        archiveResult(key, q, drawn, localFallbackText(drawn), true, null, '');
        refreshStats();
      }
    }
  };

  const handleSelectSpread = (key: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
    cancelPendingChat();
    aiReqIdRef.current += 1;
    setSpreadKey(key);
    track('tarot', 'spread.select', { spread: key });
    // 选牌阵 = 想看这个牌阵怎么摆 → 右栏自动切到放大版说明
    setRightTab('intro');
    setPosIdx(0);
    setDrawNonce(0);
    setDrawState('idle');
    setCards([]);
    setAiStatus('idle');
    setAiText('');
    setAiMeta(null);
    setAiError('');
    setChatHistory([]);
    // 换牌阵即开启新的一次占卜：清掉快照与重抽身份，刷新后不会再恢复出旧结果
    persistCurrent(null);
    readingIdRef.current = { sig: '', ts: 0 };
  };

  /** 打开自定义牌阵编辑器：key 为 null 表示新建 */
  const openSpreadEditor = (key: string | null) => {
    if (key) {
      const info = getSpread(key);
      if (!info) return;
      setDraft({
        id: key,
        name: info.name,
        icon: info.icon,
        scene: info.scene,
        desc: info.desc,
        positions: info.positions.map((p, i) => ({ name: p, desc: info.positionDesc[i] || '' })),
      });
    } else {
      setDraft({
        id: null,
        name: '',
        icon: '🧩',
        scene: '',
        desc: '',
        positions: [
          { name: '现状', desc: '' },
          { name: '阻碍', desc: '' },
          { name: '建议', desc: '' },
        ],
      });
    }
  };

  /** 保存自定义牌阵（新建或覆盖） */
  const handleSaveSpread = () => {
    if (!draft) return;
    const filled = draft.positions.filter((p) => p.name.trim());
    if (filled.length === 0) return;
    const capped = filled.slice(0, MAX_CUSTOM_POSITIONS);
    const info: SpreadInfo = {
      name: draft.name.trim() || '自定义牌阵',
      count: capped.length,
      icon: draft.icon.trim() || '🧩',
      scene: draft.scene.trim() || '自定义场景',
      desc: draft.desc.trim() || capped.map((p) => p.name.trim()).join(' · '),
      positions: capped.map((p) => p.name.trim()),
      positionDesc: capped.map((p) => p.desc.trim()),
    };
    const newId = saveCustomSpread(info, draft.id ?? undefined);
    setSpreads(getAllSpreads());
    track('tarot', 'custom_spread.save', { spread: newId, count: info.count });
    // 新建后直接切到它；编辑时保持原选中状态
    if (!draft.id) handleSelectSpread(newId);
    setDraft(null);
  };

  /** 删除自定义牌阵：若正被选中，退回内置「时间之流」 */
  const handleDeleteSpread = (key: string) => {
    deleteCustomSpread(key);
    setSpreads(getAllSpreads());
    if (spreadKey === key) handleSelectSpread('time');
    track('tarot', 'custom_spread.delete', { spread: key });
  };

  const handleDraw = () => startDraw(spreadKey, question.trim(), drawNonce, majorOnly);

  const handleReshuffle = () => {
    if (redrawWait > 0 || aiStatus === 'streaming') return;
    const next = drawNonce + 1;
    setDrawNonce(next);
    // 同步进 ref：洗牌 1.5s 后才会走存档，闭包里的 drawNonce 那时还是旧值
    latestRef.current = { ...latestRef.current, drawNonce: next };
    track('tarot', 'redraw', { spread: spreadKey, majorOnly });
    startDraw(spreadKey, question.trim(), next, majorOnly);
    startCooldown(setRedrawWait, redrawTimerRef, REDRAW_COOLDOWN_S);
  };

  /**
   * 给已抽出的牌面补跑一次 AI 解读。
   * 典型场景：打开别人分享的链接（牌面已还原但没跑 AI，不替用户花钱）、
   * 或上一次解读被手动中断 —— 这两种情况下操作区原本没有任何「开始解读」的入口。
   */
  const handleInterpretNow = () => {
    const ctx = ctxRef.current;
    if (!ctx || aiStatus === 'streaming') return;
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
    cancelPendingChat();
    const ac = new AbortController();
    abortRef.current = ac;
    aiReqIdRef.current += 1;
    savedRef.current = false;
    setAiError('');
    setDisclaimer('');
    track('tarot', 'interpret.now', { spread: ctx.key });
    void runInterpret(ctx.key, ctx.q, ctx.drawn, ac);
  };

  /**
   * 中断在途的主解读。实测单次解读要 20-30 秒，此前这段时间里页面只有一个转圈提示，
   * 用户想改问题或换牌阵只能干等 —— 中断后回落到本地牌义，至少立刻有内容可看。
   */
  const stopInterpret = () => {
    if (aiStatus !== 'streaming') return;
    aiReqIdRef.current += 1; // 让在途回调作废
    abortRef.current?.abort();
    abortRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    setAiStatus('idle');
    setAiText('');
    setAiMeta(null);
    track('tarot', 'interpret.stop', { spread: spreadKey });
  };

  /**
   * 塔罗追问请求函数：交给 LightFollowUp 统一管理输入/流式/持久化。
   * 复用本次牌面（spread / cards）作为额外上下文；只回传最近若干轮历史，
   * 避免 prompt 随对话线性膨胀（塔罗追问基本只跟最近几轮相关）。
   * ctxRef 用 ref 读取，调用时才拿最新牌面，因此依赖为空数组也安全。
   */
  const tarotChatFn = useCallback(
    (history: ChatHistoryEntry[], question: string, opts: InterpretStreamOptions) => {
      const ctx = ctxRef.current;
      if (!ctx) return Promise.reject(new Error('尚未占卜，无法追问'));
      const tarotCtx: TarotChatCtx = {
        spreadName: spreadNameOf(ctx.key),
        question: ctx.q,
        cards: ctx.drawn.map((c) => ({ pos: c.pos, name: c.name, isRev: c.isRev, upright: c.upright, rev: c.rev })),
      };
      const recent = history.slice(-CHAT_CONTEXT_TURNS * 2);
      return requestTarotChatStream(tarotCtx, recent, question, opts);
    },
    []
  );

  /** 单张牌卡：平铺与凯尔特摆位共用同一份渲染，避免两处各写一遍后走样 */
  const renderCard = (c: DrawnCard, i: number) => (
    <div
      key={i}
      className={'tarot-card-item tarot-card-front fade-in' + (c.isRev ? ' reversed' : '')}
      style={{ animationDelay: i * 0.15 + 's' }}
      role="button"
      tabIndex={0}
      title="点击查看这张牌的完整牌义"
      onClick={() => setDetailCard(c)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setDetailCard(c);
        }
      }}
    >
      {c.isRev && <span className="card-rev-badge">逆位</span>}
      <span className="card-idx">{i + 1}</span>
      <div className="card-symbol">{c.sym}</div>
      <div className="card-name">{c.isRev ? '逆位·' : '正位·'}{c.name}</div>
      <div className="card-pos">{c.pos}</div>
    </div>
  );

  /** 每日三牌：从 tab 面板里点开某张牌的完整牌义（此前只有主结果区的牌能点） */
  const openDailyCardDetail = (c: { name: string; isRev: boolean; position: string; posi: string }) => {
    const base = tarotDeck[c.name];
    if (!base) return;
    setDetailCard({ ...base, name: c.name, isRev: c.isRev, pos: c.position, posDesc: c.posi });
  };

  /** 结果区纯文本（供一键复制）：AI 解读优先，否则退化为逐牌本地牌义 */
  const resultPlainText = () => {
    const head = `【${spread.name}】${question.trim() ? `问：${question.trim()}` : ''}`;
    const body =
      aiStatus === 'done' && aiText
        ? aiText.replace(/\*\*/g, '')
        : cards.map((c) => `${c.pos}：${c.isRev ? '逆位' : '正位'}·${c.name} —— ${c.isRev ? c.rev : c.upright}`).join('\n');
    return `${head}\n\n${body}\n\n—— 玄镜 OracleMind`;
  };

  /** 生成分享海报 */
  const handlePoster = async () => {
    const text = aiStatus === 'done' ? aiText : cards.map((c) => `${c.pos}：${c.isRev ? '逆位' : '正位'}·${c.name}`).join('\n');
    const title = `${spread.name} · 塔罗占卜`;
    setPosterLoading(true);
    setPoster(null);
    try {
      const p = await requestPoster(title, text || '塔罗占卜');
      setPoster(p);
      // 落盘：刷新 / 恢复历史后海报还在，不必再生成一次
      persistPosterToHistory(p);
      // 分享存档：首次生成直接落库；重新生成则覆盖（后端按 user+module upsert）
      void share.persist({ title, shareText: p.shareText, imageUrl: p.imageUrl, imagePrompt: p.imagePrompt });
    } catch (err) {
      const e = err as { message?: string };
      const fallback: PosterResult = {
        shareText: `「${spread.name}」—— 抽牌问心，顺势而为。`,
        imagePrompt: '', imageUrl: null, imageError: e?.message || '生成失败', fallback: true,
      };
      setPoster(fallback);
      persistPosterToHistory(fallback);
      void share.persist({ title, shareText: fallback.shareText, imageUrl: null, imagePrompt: '' });
    } finally {
      setPosterLoading(false);
    }
  };

  const handleDownloadPoster = async () => {
    if (!poster) return;
    try {
      const dataUrl = await composePosterDataUrl(poster.imageUrl ?? null, poster.shareText || '');
      printDocument({ title: '玄镜塔罗分享', html: `<img src="${dataUrl}" alt="玄镜塔罗分享" />` });
    } catch {
      showToast('导出失败，请重试', 'error');
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard?.writeText(text);
    showToast('📋 已复制到剪贴板', 'success');
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
    setShareOpen(true);
  };

  /**
   * 分享弹窗打开后的数据源决策（仅在已登录且已向库请求过存档后执行）：
   * ・库内已有存档（share.saved）→ 直接渲染库内容，省一次 AI 生成 / CogView 配额（二次进入场景）
   * ・库内无存档 → 首次生成并落库
   * ・「重新生成」按钮会主动调用 handlePoster，不受此自动分支影响
   */
  useEffect(() => {
    if (!shareOpen || !share.ready || !share.isAuthed || !share.loaded) return;
    if (share.saved && !poster) {
      setPoster(shareOutToPoster(share.saved));
    } else if (!share.saved && !poster && !posterLoading) {
      void handlePoster();
    }
  }, [shareOpen, share.ready, share.isAuthed, share.loaded, share.saved, poster, posterLoading, handlePoster]);

  /**
   * 恢复历史某次占卜：回填全部字段（逆位开关、第几副牌、AI 元信息、免责声明、追问），
   * 并把它设为「当前占卜」—— 刷新后停留在这次，而不是退回空态。
   */
  const restoreHistory = (item: TarotHistoryItem) => {
    applySnapshot(item);
    persistCurrent(item);
  };

  /** 删除单条历史（此前只能整体清空，误存一条就得全部重来） */
  const removeHistory = (ts: number) => {
    setHistory((prev) => {
      const next = prev.filter((i) => i.ts !== ts);
      try {
        setCloudItem(HISTORY_KEY, JSON.stringify(next));
      } catch { /* 忽略 */ }
      return next;
    });
    // 删掉的正是当前这次：同步清快照，刷新后不会再把它恢复回来
    if (currentTsRef.current === ts) {
      currentTsRef.current = 0;
      readingIdRef.current = { sig: '', ts: 0 };
      persistCurrent(null);
    }
  };

  /** 牌面构成统计：大阿卡纳 / 四元素 / 逆位（suit 与 element 数据齐备，此前完全没用起来） */
  const suitStats = useMemo(() => {
    const counts = { major: 0, wands: 0, cups: 0, swords: 0, pentacles: 0 };
    let rev = 0;
    for (const c of cards) {
      counts[c.suit] += 1;
      if (c.isRev) rev += 1;
    }
    const total = cards.length;
    const ratio = (n: number) => (total ? n / total : 0);
    // 专业解读里最常看的两条：大阿卡纳占比（事件量级）与主导元素（能量性质）
    let note = '';
    if (total) {
      if (ratio(counts.major) >= 0.5) {
        note = `大阿卡纳 ${counts.major}/${total}：不是日常小事，是命运级的转折，外力强于个人选择。`;
      } else if (ratio(rev) >= 0.6) {
        note = `逆位 ${rev}/${total}：能量普遍受阻，先化解卡点再谈推进。`;
      } else {
        const el = (['wands', 'cups', 'swords', 'pentacles'] as const).reduce((a, b) => (counts[b] > counts[a] ? b : a));
        if (ratio(counts[el]) >= 0.5) {
          note = `${ELEMENT_NOTE[el]}（${counts[el]}/${total}）`;
        }
      }
    }
    return { counts, rev, total, note };
  }, [cards]);

  /** 速查模块当前展示的牌：先按花色筛，再按搜索词（牌名 / 关键词）过滤 */
  /** 凯尔特十字完整牌面（10 张）才走摆位图，其余牌阵仍是平铺 */
  const isCeltic = spreadKey === 'celtic' && cards.length === 10;

  /** 按当前问题推荐牌阵（无命中为 null） */
  const recSpread = useMemo(() => recommendSpread(question), [question]);

  const deckNames = Object.keys(tarotDeck).filter((n) => {
    if (deckFilter !== 'all' && tarotDeck[n].suit !== deckFilter) return false;
    const q = deckQuery.trim();
    if (!q) return true;
    return n.includes(q) || tarotDeck[n].kw.some((k) => k.includes(q));
  });

  /** 详情弹窗里那张牌的分维度牌义（数据缺失时为 null，整块不渲染） */
  const detailDims = detailCard ? dimensionsOf(detailCard.name) : null;
  /** 结论卡数据：从 AI 正文里提取（后端 formatter 保证格式，提取不到就不渲染卡片） */
  const verdictInfo = aiStatus === 'done' ? parseVerdict(aiText) : null;
  /** 结论已单独渲染成卡片，正文里去掉这一小段，避免重复 */
  const bodyText = verdictInfo ? aiText.replace(VERDICT_PATTERN, '').trim() : aiText;

  return (
    <ErrorBoundary
      name="塔罗占卜"
      onError={(err) => track('tarot', 'render.error', { ok: false, reason: err.message.slice(0, 80) })}
    >
      <div className="page active" id="page-tarot">
        <div className="page-header">
          <div>
            <div className="page-title">🃏 塔罗占卜</div>
            <div className="page-subtitle">选择牌阵 → 洗牌抽牌 → AI 情境化解读（{DECK_SIZE} 张完整牌库）</div>
          </div>
        </div>

        {/* 牌阵选择：从左侧窄栏搬到顶部整条，做成响应式卡片网格，避免窄栏里竖向堆叠像内容面板 */}
        <section className="spread-picker" aria-label="选择牌阵">
          <div className="spread-picker-head">
            <h2 className="spread-picker-title">选择牌阵</h2>
            <span className="spread-picker-sub">选一个贴合你问题的场景，右侧可展开每个牌位的含义</span>
          </div>
          <div className="spread-grid">
            {spreads.map(({ key, info: s, custom }) => {
              const active = spreadKey === key;
              return (
                // 外层用 div：自定义牌阵的「编辑 / 删除」按钮不能嵌在牌阵按钮里（button 嵌套非法），
                // 但通过 position: relative + 内部 ops 绝对定位，让编辑/删除视觉上「在卡片内部」
                <div key={key} className={'spread-card-wrap' + (custom ? ' is-custom' : '')}>
                  <button
                    type="button"
                    className={'spread-card' + (active ? ' active' : '')}
                    aria-pressed={active}
                    onClick={() => handleSelectSpread(key)}
                  >
                    <span className="spread-card-icon">{s.icon}</span>
                    <span className="spread-card-body">
                      <span className="spread-card-name">{s.name}</span>
                      <span className="spread-card-count">{s.count} 张</span>
                    </span>
                    <span className="spread-card-scene">{s.scene}</span>
                    {active && <span className="spread-card-check" aria-hidden="true">✓</span>}
                  </button>
                  {custom && (
                    <div className="spread-card-ops">
                      <button
                        type="button"
                        className="spread-card-op"
                        title="编辑这个牌阵"
                        onClick={() => openSpreadEditor(key)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="spread-card-op is-danger"
                        title="删除这个牌阵"
                        onClick={() => handleDeleteSpread(key)}
                      >
                        删除
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* 自建牌阵：内置 5 套覆盖不了「三人关系」「事业+感情并行」这类具体问题 */}
            <button
              type="button"
              className="spread-card spread-card-add"
              onClick={() => openSpreadEditor(null)}
            >
              <span className="spread-card-icon">＋</span>
              <span className="spread-card-body">
                <span className="spread-card-name">自定义牌阵</span>
                <span className="spread-card-count">按需设定</span>
              </span>
              <span className="spread-card-scene">自己定义每个牌位代表什么</span>
            </button>
          </div>
        </section>

        <div className="tarot-layout">
          <div>
            <div className="tarot-question-card">
              <div className="tarot-q-title">你的问题</div>
              <input
                className="form-input field-pill mb-0"
                placeholder="例如：我该不该接这个 offer？"
                maxLength={100}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleDraw(); }}
              />

              {/* 问题模板：不知道怎么开口是新手第一道坎，点一下直接填并切到对应牌阵 */}
              <div className="tarot-q-templates">
                {QUESTION_TEMPLATES.map((t) => (
                  <button
                    key={t.q}
                    type="button"
                    className="tarot-q-template"
                    onClick={() => {
                      setQuestion(t.q);
                      if (t.spread !== spreadKey) handleSelectSpread(t.spread);
                      track('tarot', 'template.use', { spread: t.spread });
                    }}
                  >
                    {t.icon} {t.q}
                  </button>
                ))}
              </div>

              {/* 按问题内容推荐牌阵：只提示、不强制，用户点一下才切 */}
              {recSpread && recSpread.key !== spreadKey && (
                <div className="tarot-rec">
                  <span className="tarot-rec-tag">💡 更像「{spreadNameOf(recSpread.key)}」</span>
                  <span>—— {recSpread.hint}</span>
                  <button
                    type="button"
                    className="tarot-rec-btn"
                    onClick={() => {
                      handleSelectSpread(recSpread.key);
                      track('tarot', 'recommend.accept', { spread: recSpread.key });
                    }}
                  >
                    换用这个
                  </button>
                </div>
              )}

              {/*
                指示牌（significator）：代表问卜者本人的那张牌，传统塔罗里从 16 张宫廷牌里选。
                选了之后 AI 会把解读落到「你」身上，而不是对一群人泛泛而谈。
                它不参与抽牌 —— 指示牌是预先挑出来代表你的，不是抽出来的。
              */}
              <div className="tarot-sig">
                <div className="tarot-sig-head">
                  <span className="tarot-sig-title">指示牌（代表「你」的那张牌）</span>
                  {significator && (
                    <button type="button" className="tarot-sig-clear" onClick={() => setSignificator(null)}>
                      不使用
                    </button>
                  )}
                </div>
                <div className="tarot-sig-row">
                  <select
                    className="tarot-sig-select"
                    value={significator ?? ''}
                    onChange={(e) => setSignificator(e.target.value || null)}
                    aria-label="选择指示牌"
                  >
                    <option value="">不使用指示牌</option>
                    {COURT_CARDS.map((n) => (
                      <option key={n} value={n}>{tarotDeck[n].sym} {n}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="tarot-sig-auto"
                    onClick={() => {
                      const picked = recommendSignificator(sigGender, sigElement);
                      setSignificator(picked);
                      track('tarot', 'significator.recommend', { card: picked });
                    }}
                  >
                    ✨ 按下列信息推荐
                  </button>
                </div>
                <div className="tarot-sig-row">
                  <label className="tarot-sig-field">
                    性别
                    <select
                      className="tarot-sig-select-s"
                      value={sigGender}
                      onChange={(e) => setSigGender(e.target.value as 'male' | 'female')}
                    >
                      <option value="female">女</option>
                      <option value="male">男</option>
                    </select>
                  </label>
                  <label className="tarot-sig-field">
                    元素
                    <select
                      className="tarot-sig-select-s"
                      value={sigElement}
                      onChange={(e) => setSigElement(e.target.value as typeof sigElement)}
                    >
                      <option value="wands">火</option>
                      <option value="cups">水</option>
                      <option value="swords">风</option>
                      <option value="pentacles">土</option>
                    </select>
                  </label>
                </div>
                {significator && (
                  <div className="tarot-sig-preview">
                    {tarotDeck[significator]?.sym ?? '🃏'} <strong>{significator}</strong> ·{' '}
                    {cardMeaning(significator, false) || '（暂无牌义）'}
                  </div>
                )}
              </div>

              <div className="tarot-option-row">
                <div className="tarot-option-switches">
                  <label className="tarot-switch form-check">
                    <input type="checkbox" checked={allowRev} onChange={(e) => setAllowRev(e.target.checked)} />
                    <span>允许逆位</span>
                  </label>
                  <label className="tarot-switch form-check" title="只用 22 张大阿卡纳：讲的是人生议题与大方向，不含日常细节牌">
                    <input type="checkbox" checked={majorOnly} onChange={(e) => setMajorOnly(e.target.checked)} />
                    <span>只用大阿卡纳（22 张）</span>
                  </label>
                </div>
                <span className="tarot-q-counter">{question.length}/100</span>
              </div>
              <Button variant="submit" className="tarot-draw-btn" onClick={handleDraw} disabled={drawState === 'shuffling'}>
                🎴 {drawState === 'shuffling' ? '洗牌中…' : '洗牌抽牌'}
              </Button>
            </div>
            <div className="tarot-hint">
              💡 默念问题、静心 3 秒再抽牌，占卜更聚焦
              <br />
              已选牌阵：<strong className="tc-gold">{spread.name}（{spread.count}张）</strong>
              {drawNonce > 0 && <span className="tc-muted"> · 第 {drawNonce + 1} 副牌</span>}
              <br />
              <button
                type="button"
                className="tarot-hint-link"
                onClick={() => { setRightTab('intro'); setPosIdx(0); }}
              >
                👉 右侧「牌阵说明」查看每个牌位含义
              </button>
            </div>

          </div>

          <div>
            {/* 右栏主 tab：牌阵说明（信息量大，放右栏展开） / 抽牌结果 */}
            <div className="tarot-right-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === 'intro'}
                className={'tarot-right-tab' + (rightTab === 'intro' ? ' active' : '')}
                onClick={() => setRightTab('intro')}
              >
                📋 牌阵说明
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === 'result'}
                className={'tarot-right-tab' + (rightTab === 'result' ? ' active' : '')}
                onClick={() => setRightTab('result')}
              >
                🎴 抽牌结果{cards.length > 0 ? `（${cards.length}）` : ''}
              </button>
            </div>

            {rightTab === 'intro' ? (
              <div className="spread-intro">
                <div className="spread-intro-head">
                  <div className="spread-intro-icon">{spreadIcon}</div>
                  <div className="spread-intro-meta">
                    <div className="spread-intro-name">
                      {spread.name}
                      <span className="spread-intro-count">{spread.count} 张</span>
                    </div>
                    <div className="spread-intro-desc">{spread.desc}</div>
                  </div>
                </div>

                <div className="spread-intro-subtitle">👇 点击下方牌位，查看这个位置代表什么</div>
                <div className="spread-pos-tabs" role="tablist">
                  {spread.positions.map((p, i) => (
                    <button
                      key={p}
                      type="button"
                      role="tab"
                      aria-selected={i === safePosIdx}
                      className={'spread-pos-tab' + (i === safePosIdx ? ' active' : '')}
                      onClick={() => setPosIdx(i)}
                    >
                      <span className="spread-pos-no">{i + 1}</span>
                      <span className="spread-pos-label">{p}</span>
                    </button>
                  ))}
                </div>

                <div className="spread-pos-panel">
                  <div className="spread-pos-index">第 {safePosIdx + 1} 位 / 共 {spread.count} 位</div>
                  <div className="spread-pos-title">{spread.positions[safePosIdx]}</div>
                  <div className="spread-pos-text">{spread.positionDesc[safePosIdx]}</div>
                </div>

                <div className="spread-intro-foot">
                  💡 想换牌阵？点左侧列表切换 ·{' '}
                  <button type="button" className="tarot-hint-link" onClick={() => setRightTab('result')}>
                    去「抽牌结果」开始抽牌 →
                  </button>
                </div>
              </div>
            ) : (
              <>
              <div className="tarot-cards-area" ref={areaRef}>
                {/* 指示牌单独展示在牌阵上方：它代表「你」本身，混进牌位里会被当成一个牌位 */}
                {significator && drawState === 'done' && (
                  <div className="tarot-significator">
                    <div className="tarot-sig-card">
                      <span className="tarot-sig-card-sym">{tarotDeck[significator]?.sym ?? '🃏'}</span>
                      <div className="tarot-sig-card-meta">
                        <div className="tarot-sig-card-label">指示牌 · 代表你</div>
                        <div className="tarot-sig-card-name">{significator}</div>
                      </div>
                    </div>
                    <div className="tarot-sig-card-tip">
                      {cardMeaning(significator, false) || '（暂无牌义）'}
                    </div>
                  </div>
                )}
                {drawState === 'idle' && (
                  <div className="tarot-empty">
                    <div className="tarot-empty-icon">🎴</div>
                    <div>选择牌阵后点击「洗牌抽牌」</div>
                    <div className="tarot-empty-sub">牌面将为你翻转…</div>
                  </div>
                )}
                {drawState === 'shuffling' && (
                  <>
                    <div className="cards-row">
                      {Array.from({ length: spread.count }, (_, i) => (
                        <div key={i} className="tarot-card-item tarot-card-back shuffling" />
                      ))}
                    </div>
                    <div className="shuffle-text">🎴 洗牌中… 请集中注意力</div>
                  </>
                )}
                {drawState === 'done' && cards.length > 0 && (
                  isCeltic ? (
                    // 凯尔特十字：还原「中心十字 + 右侧竖列」的空间结构，平铺会把它读成一排
                    <div className="celtic-layout">
                      <div className="celtic-grid">
                        <div className="celtic-slot slot-5">{renderCard(cards[4], 4)}</div>
                        <div className="celtic-slot slot-4">{renderCard(cards[3], 3)}</div>
                        <div className="celtic-slot slot-1">{renderCard(cards[0], 0)}</div>
                        <div className="celtic-slot slot-2">{renderCard(cards[1], 1)}</div>
                        <div className="celtic-slot slot-6">{renderCard(cards[5], 5)}</div>
                        <div className="celtic-slot slot-3">{renderCard(cards[2], 2)}</div>
                        <div className="celtic-slot slot-7">{renderCard(cards[6], 6)}</div>
                        <div className="celtic-slot slot-8">{renderCard(cards[7], 7)}</div>
                        <div className="celtic-slot slot-9">{renderCard(cards[8], 8)}</div>
                        <div className="celtic-slot slot-10">{renderCard(cards[9], 9)}</div>
                      </div>
                      <div className="celtic-tip">
                        中心十字：1 现状 · 2 阻碍（横跨 1 号位）· 3 潜意识（下）· 4 过去（左）· 5 目标（上）· 6 未来（右）；
                        右侧竖列自下而上 7→10：你的态度、环境、希望与恐惧、结果。
                      </div>
                    </div>
                  ) : (
                    <div className="cards-row">{cards.map(renderCard)}</div>
                  )
                )}

                {/* 牌面构成统计：大阿卡纳 / 四元素 / 逆位 */}
                {drawState === 'done' && suitStats.total > 0 && (
                  <div className="tarot-suit-stats">
                    <span className="stat-item">🃏 大阿卡纳 <strong>{suitStats.counts.major}</strong>/{suitStats.total}</span>
                    <span className="stat-item">🔥 火 <strong>{suitStats.counts.wands}</strong></span>
                    <span className="stat-item">💧 水 <strong>{suitStats.counts.cups}</strong></span>
                    <span className="stat-item">🌪 风 <strong>{suitStats.counts.swords}</strong></span>
                    <span className="stat-item">🪨 土 <strong>{suitStats.counts.pentacles}</strong></span>
                    <span className="stat-item">🔄 逆位 <strong>{suitStats.rev}</strong></span>
                  </div>
                )}
                {drawState === 'done' && suitStats.note && (
                  <div className="tarot-suit-note">{suitStats.note}</div>
                )}
              </div>

              {/* AI 解读区 */}
              {drawState === 'done' && (
                <div className="side-card ai-interpretation mt-20">
                  <div className="ai-interp-header">
                    <div className="ai-interp-avatar"><img src="/images/spirit_avatar.png" alt="小玄" /></div>
                    <div>
                      <div className="ai-title-line">小玄陪你问问这张牌</div>
                      <div className="ai-subtitle-line">
                        {aiStatus === 'streaming'
                          ? `${spread.name} · ${spread.count}张牌串联 · 小玄在认真听你说话…`
                          : aiMeta
                            ? `${spread.name} · 小玄把心里话都告诉你`
                            : `${spread.name} · ${spread.count}张牌串联 · 小玄准备好了，随时开始`}
                      </div>
                    </div>
                  </div>

                  {/* 结论卡：用户问「该不该 / 要不要」时，此前六段全是描述、没有倾向，体感「不准」 */}
                  {verdictInfo && (
                    <div className="tarot-verdict">
                      <div className="tarot-verdict-head">
                        <span className="tarot-verdict-title">🔮 塔罗结论</span>
                        <span className={'tarot-verdict-tag ' + verdictClass(verdictInfo.verdict)}>
                          {verdictInfo.verdict}
                        </span>
                      </div>
                      <div className="tarot-verdict-bar">
                        <span
                          className={'tarot-verdict-fill ' + verdictClass(verdictInfo.verdict)}
                          style={{ width: verdictInfo.score + '%' }}
                        />
                      </div>
                      <div className="tarot-verdict-score">能量 {verdictInfo.score}/100</div>
                    </div>
                  )}

                  <div className="ai-interp-text">
                    {/* 首字节未到：统一 loading 占位，实测这个阶段要 10-30 秒 */}
                    {aiStatus === 'streaming' && !aiText && <OmLoading label="正在调用 AI 生成解读，约需 10-30 秒…" mode="inline" />}
                    {aiStatus === 'streaming' && aiText && (
                      <>
                        {/* 用 bodyText：结论已单独渲染成卡片，正文里的结论段要剥掉，否则重复一遍 */}
                        <div dangerouslySetInnerHTML={{ __html: mdToHtml(bodyText) }} />
                        <span className="bubble-typing"><span></span><span></span><span></span></span>
                      </>
                    )}
                    {aiStatus === 'done' && (
                      <>
                        <div dangerouslySetInnerHTML={{ __html: mdToHtml(bodyText) }} />
                        {aiMeta?.truncated && <div className="ai-interp-warn">⚠️ 解读内容较长，输出被截断，可点击「再解读一次」获取完整版。</div>}
                        {disclaimer && <div className="ai-interp-disclaimer">⚠️ {disclaimer}</div>}
                      </>
                    )}
                    {(aiStatus === 'idle' || aiStatus === 'error') && (
                      <>
                        {/* 失败原因此前只 set 不读（死状态），超时 / 限流 / 网络失败无法区分 */}
                        {aiStatus === 'error' && aiError && (
                          <div className="ai-interp-warn">⚠️ 解读失败：{aiError}</div>
                        )}
                        {cards.map((c) => (
                          <p key={c.pos}>
                            <strong>{c.pos} — {c.isRev ? '逆位' : '正位'}{c.name}：</strong>
                            {c.isRev ? c.rev : c.upright}
                          </p>
                        ))}
                        <div
                          className="tarot-summary-divider"
                          dangerouslySetInnerHTML={{ __html: buildTarotSummary(cards) }}
                        />
                      </>
                    )}
                  </div>

                  {aiMeta && (
                    <div className="tarot-meta-line">
                      {aiMeta.tokens && <span>🪙 {aiMeta.tokens.prompt + aiMeta.tokens.completion} tokens</span>}
                      {aiMeta.degraded && <Tag variant="warn" baseClass="dream-tag">降级输出</Tag>}
                    </div>
                  )}

                  {/* 操作区：再抽一次 / 重试 / 分享 / 复制解读 */}
                  <div className="tarot-card-actions">
                    <Button variant="ghost" onClick={handleReshuffle} disabled={aiStatus === 'streaming' || redrawWait > 0}>
                      {redrawWait > 0 ? `🔄 再抽一次（${redrawWait}s）` : '🔄 再抽一次'}
                    </Button>
                    {/* 牌面已就位但还没跑过 AI（分享链接还原 / 上次被中断）：给个明确入口 */}
                    {aiStatus === 'idle' && (
                      <Button variant="primary" onClick={handleInterpretNow}>✨ 让小玄帮你解读</Button>
                    )}
                    {/* 流式期间给「停止」：实测要等 20-30 秒，中途想改问题不能干等着 */}
                    {aiStatus === 'streaming' ? (
                      <Button variant="ghost" onClick={stopInterpret}>⏹ 停止生成</Button>
                    ) : (
                      (aiStatus === 'error' || aiStatus === 'done') && (
                        <Button variant="ghost" onClick={handleReread} disabled={rereadWait > 0}>
                          {aiStatus === 'error'
                            ? '↻ 重试解读'
                            : rereadWait > 0
                              ? `↻ 换个角度（${rereadWait}s）`
                              : '↻ 换个角度再解读'}
                        </Button>
                      )
                    )}
                    <Button variant="ghost" onClick={handleOpenShare}>📤 保存/分享</Button>
                    {/* 复制纯文本解读：此前只能复制海报文案或裸链接，正文拿不走 */}
                    <Button variant="ghost" onClick={() => copyText(resultPlainText())}>📋 复制解读</Button>
                    {/* 付费进阶：深度长文解读（支付通道未配置时为占位，可免费继续查看） */}
                    <PremiumUnlockButton item="tarot_deep" label="🔓 深度长文解读" unlockedLabel="✅ 深度解读已解锁" />
                  </div>

                  {/* 追问：复用全站统一的轻量聊天窗口 LightFollowUp（输入/流式/持久化内部托管，取代原先各自实现的 tarot-ask） */}
                  {aiStatus === 'done' && (
                    <LightFollowUp
                      key={readingKey}
                      module="tarot"
                      context={resultPlainText()}
                      chatFn={tarotChatFn}
                      initialHistory={chatHistory}
                      onHistoryChange={(h) => { setChatHistory(h); persistChatToHistory(h); }}
                      onAbortController={(c) => { chatAbortRef.current = c; }}
                      title="针对这次牌面继续追问"
                      subtitle={`上下文保留最近 ${CHAT_CONTEXT_TURNS} 轮`}
                      placeholder="例如：第三张牌说的阻碍，具体指什么？"
                      maxLength={100}
                    />
                  )}
                </div>
              )}
              </>
            )}
          </div>
        </div>

        {/* 内容网格：今日能量 / 每日三牌 / 小知识 */}
        <div className="tarot-side-grid">
          <Card variant="mood">
            <SectionTitle icon="zap"> 今日塔罗能量</SectionTitle>
            {dailyDeal ? (
              <>
                {/* 主题牌：mini 牌居中 + 标题/简介，柔和渐变包裹作视觉锚点 */}
                <div className="tarot-energy-hero">
                  <div className="tarot-card-item tarot-energy-card">
                    {dailyDeal.theme.isRev && <span className="card-rev-badge">逆位</span>}
                    <div className="card-symbol">{dailyDeal.theme.sym}</div>
                    <div className="card-name">{dailyDeal.theme.isRev ? '逆位·' : '正位·'}{dailyDeal.theme.name}</div>
                  </div>
                  <div className="tarot-energy-meta">
                    <div className="tarot-energy-eyebrow">今日主题牌</div>
                    <div className="tarot-energy-title">{dailyDeal.theme.isRev ? '逆位' : '正位'} · {dailyDeal.theme.name}</div>
                    <div className="tarot-energy-sub">{(dailyData?.themeKw || localThemeKw(dailyDeal)).split(/[·、，,\s]+/).filter(Boolean).slice(0, 4).map((kw, i) => (
                      <span key={i} className="tarot-energy-chip">{kw}</span>
                    ))}</div>
                  </div>
                </div>

                {/* 能量要点：2 列网格（替代原纵向列表，6 项一行 2 一目了然） */}
                <div className="tarot-energy-grid">
                  {dailyLoading ? (
                    <div className="tarot-energy-skeleton" aria-busy="true">
                      <div className="tarot-skeleton-line" style={{ width: '46%' }} />
                      <div className="tarot-skeleton-line" style={{ width: '82%' }} />
                      <div className="tarot-skeleton-line" style={{ width: '64%' }} />
                      <div className="tarot-skeleton-tip">🔮 今日能量生成中…</div>
                    </div>
                  ) : (
                    (dailyData?.energy?.length ? dailyData.energy : localDailyEnergy(dailyDeal)).map((e) => {
                      const color = (e as { color?: string }).color;
                      // 提取 emoji 作为图标（label 里第一个 emoji）
                      const match2 = /(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}])/u.exec(e.k);
                      const emoji = match2 ? match2[0] : '✦';
                      const label = e.k.replace(/(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}])/gu, '').trim();
                      return (
                        <div key={e.k} className="tarot-energy-cell">
                          <div className="tarot-energy-cell-head">
                            <span className="tarot-energy-icon" style={color ? { background: `${color}22`, color } : undefined}>{emoji}</span>
                            <span className="tarot-energy-cell-label">{label}</span>
                          </div>
                          <div className="tarot-energy-cell-value" style={color ? { color } : undefined}>{e.v}</div>
                        </div>
                      );
                    })
                  )}
                </div>
                {!dailyLoading && !dailyData && (
                  <div className="tarot-retry-row">
                    <span className="tc-muted">{dailyError || '小玄今天有点累，先用本地牌义陪你看'}</span>
                    <Button variant="ghost" onClick={() => setDailyRetry((n) => n + 1)}>重试</Button>
                  </div>
                )}
              </>
            ) : (
              <OmLoading label="正在抽取牌面…" mode="inline" />
            )}
          </Card>

          <Card variant="mood">
            <SectionTitle icon="layers"> 今日指引 · 每日三牌</SectionTitle>
            <div className="tarot-mini-tabs" role="tablist">
              {dailyDeal?.cards.map((c, i) => {
                const active = activeDailyTab === i;
                return (
                  <div
                    key={i}
                    className={'tarot-mini-tab' + (active ? ' active' : '') + (c.isRev ? ' reversed' : '')}
                    role="tab"
                    tabIndex={0}
                    aria-selected={active}
                    onClick={() => setActiveDailyTab(i)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveDailyTab(i);
                      }
                    }}
                    title={`点击查看 ${c.position} · ${c.name}`}
                  >
                    {/* 逆位此前只有主结果区有标识，同一页三种牌卡表达不一致 */}
                    {c.isRev && <span className="card-rev-badge">逆位</span>}
                    <div className={'mini-sym' + (c.isRev ? ' is-rev' : '')}>{c.sym}</div>
                    <div className="mini-name">{c.name}</div>
                    <div className="mini-posi">{c.position} · {c.posi}</div>
                  </div>
                );
              })}
            </div>
            <div className="tarot-mini-panel">
              {dailyLoading ? (
                <div className="tarot-skeleton" aria-busy="true">
                  <div className="tarot-skeleton-line" style={{ width: '40%' }} />
                  <div className="tarot-skeleton-line" />
                  <div className="tarot-skeleton-line" style={{ width: '78%' }} />
                  <div className="tarot-skeleton-tip">🔮 今日指引生成中…</div>
                </div>
              ) : dailyDeal ? (
                (() => {
                  const c = dailyDeal.cards[activeDailyTab];
                  return (
                    <div className="tarot-mini-read">
                      <div className="tarot-mini-read-title">{c.position} · {c.name}（{c.posi}）</div>
                      <div className="tarot-mini-read-text">{dailyRead(c, dailyData)}</div>
                      <button
                        type="button"
                        className="tarot-mini-detail-link"
                        onClick={() => openDailyCardDetail(c)}
                      >
                        📖 查看这张牌的完整牌义
                      </button>
                    </div>
                  );
                })()
              ) : (
                <div className="tarot-read-empty">👆 点击上方牌面查看今日指引</div>
              )}
            </div>
            <div className="tarot-daily-summary">
              <div className="tarot-daily-summary-title">📌 AI 综合指引</div>
              {dailyLoading ? (
                <div className="tarot-skeleton" aria-busy="true">
                  <div className="tarot-skeleton-line" />
                  <div className="tarot-skeleton-line" style={{ width: '86%' }} />
                  <div className="tarot-skeleton-line" style={{ width: '62%' }} />
                  <div className="tarot-skeleton-tip">🧠 综合指引生成中…</div>
                </div>
              ) : dailyDeal ? (
                <div className="tarot-daily-summary-text">{dailyData?.summary || localDailySummary(dailyDeal)}</div>
              ) : null}
            </div>
          </Card>

          {/* 最近占卜：原先挂在左侧问题卡下方（一条横条，与右栏信息块视觉不统一），
              移到右栏与「今日塔罗能量」并排，同样用 Card 包裹，整体感一致。
              即使暂无记录也保留 Card 框——避免"登录进来右栏突然缺一块"，内部展示空态提示。 */}
          <Card variant="mood">
            <div className="tarot-history-head">
              <span className="tarot-history-label"><SectionIcon name="history" size={16} /> 最近占卜</span>
              {history.length > 0 && (
                <button
                  type="button"
                  className="tarot-history-clear"
                  onClick={() => { persistHistory([]); persistCurrent(null); currentTsRef.current = 0; }}
                >
                  清空
                </button>
              )}
            </div>
            {history.length > 0 ? (
              <div className="tarot-history-scroll tarot-history-scroll--stack">
                {history.map((h) => (
                  // 外层用 div：删除按钮不能嵌在恢复按钮里（button 嵌套非法，且点击会冒泡触发恢复）
                  <div key={h.ts} className="tarot-history-chip">
                    <button
                      type="button"
                      className="tarot-history-main"
                      onClick={() => restoreHistory(h)}
                      title={`${h.spreadName}${h.question ? ` · ${h.question}` : ''}`}
                    >
                      <span className="tarot-history-spread">{h.spreadName}</span>
                      <span className="tarot-history-q">{h.question || '（未填问题）'}</span>
                      <span className="tarot-history-time">{ago(h.ts)}</span>
                    </button>
                    <button
                      type="button"
                      className="tarot-history-del"
                      aria-label={`删除这次占卜：${h.spreadName}`}
                      title="删除这条记录"
                      onClick={() => removeHistory(h.ts)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              // 空态：保留 Card 框，仅展示提示。给用户"这里有占卜记录"的位置感，引导去起卦
              <div className="tarot-history-empty">
                <div className="tarot-history-empty-icon" aria-hidden="true">🔮</div>
                <div className="tarot-history-empty-text">暂无占卜记录</div>
                <div className="tarot-history-empty-hint">起一卦，结果会自动留在这里</div>
              </div>
            )}
          </Card>
        </div>

        {/* 78 张牌义速查：原为弹窗，78 格塞在弹窗里既挤又要点两次，改为页面模块 */}
        <div className="side-card tarot-deck-section" id="tarot-deck">
          <div className="tarot-deck-head">
            <div>
              <div className="tarot-deck-title"><SectionIcon name="book-open" /> 78 张牌义速查</div>
              <div className="tarot-deck-sub">点击任意一张牌，查看正位 / 逆位牌义与关键词</div>
            </div>
            {/* 写成单个模板串：拆成多个表达式会被 React 插入 <!-- --> 注释节点 */}
            <div className="tarot-deck-count">{`${deckNames.length} / ${DECK_SIZE} 张`}</div>
          </div>

          <div className="tarot-deck-toolbar">
            <input
              className="form-input mb-0 tarot-deck-search"
              placeholder="搜牌名或关键词，如「恋人」「等待」"
              value={deckQuery}
              onChange={(e) => setDeckQuery(e.target.value)}
            />
            <div className="tarot-deck-filter">
              {DECK_FILTERS.map(([k, label]) => (
                <button
                  key={k}
                  className={'tarot-deck-chip' + (deckFilter === k ? ' active' : '')}
                  onClick={() => setDeckFilter(k)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className={'tarot-deck-grid tarot-deck-grid--page' + (deckExpanded ? '' : ' deck-collapsed')}>
            {deckNames.map((n) => {
              const c = tarotDeck[n];
              return (
                <button
                  key={n}
                  className="tarot-deck-item"
                  onClick={() => setDetailCard({ ...c, name: n, isRev: false, pos: '牌义速查', posDesc: '' })}
                  title={c.upright}
                >
                  <span className="tarot-deck-sym">{c.sym}</span>
                  <span className="tarot-deck-name">{n}</span>
                </button>
              );
            })}
          </div>

          {deckNames.length === 0 && (
            <div className="tarot-deck-empty">🔍 没有匹配的牌，换个关键词或切换花色试试</div>
          )}

          {deckNames.length > 0 && (
            <button
              type="button"
              className="tarot-deck-more"
              aria-expanded={deckExpanded}
              onClick={() => setDeckExpanded(!deckExpanded)}
            >
              {deckExpanded ? '收起 ▲' : `展开全部 ${deckNames.length} 张 ▾`}
            </button>
          )}
        </div>

        {/* 学习 & 日记：牌义学习模式 + 塔罗日记（补齐旧报告缺失的「学习模式 / 日记追踪」） */}
        <section className="tarot-learn-diary" aria-label="学习 & 日记">
          <TarotStudy />
          <TarotDiary
            seed={
              history[0]
                ? {
                    question: history[0].question,
                    spreadName: history[0].spreadName,
                    cards: history[0].cards.map((c) => ({ name: c.name, isRev: c.isRev })),
                  }
                : null
            }
          />
        </section>

        {/* 使用统计 / 小知识 / 跨页联动：原先纵向堆叠，改一行三栏，减少页面纵向长度 */}
        <div className="tarot-info-row">
          {/* 使用统计：此前全站零埋点，无法回答「哪个牌阵用得最多」「解读成功率多少」 */}
          <div className="side-card tarot-stats">
            <div className="tarot-stats-title"><SectionIcon name="chart-bar" /> 我的塔罗使用统计</div>

            {stats && (
              <div className="tarot-stats-body">
                {stats.total === 0 ? (
                  <div className="tarot-stats-empty">还没有记录，抽一次牌就有数据了。</div>
                ) : (
                <>
                  {/* 近 30 天占卜趋势：把原「占卜次数」单值升级成时间维度洞察 */}
                  {stats.daily.length > 0 && (() => {
                    const max = Math.max(1, ...stats.daily.map((d) => d.count));
                    return (
                      <div className="tarot-trend">
                        <div className="tarot-trend-head">
                          <span className="tarot-trend-title">近 30 天占卜趋势</span>
                          <span className="tarot-trend-total">共 {stats.draws} 次</span>
                        </div>
                        <div className="tarot-trend-bars">
                          {stats.daily.map((d, i) =>
                            d.count === 0 ? null : (
                              <span
                                key={i}
                                className={`tarot-trend-bar${i === stats.daily.length - 1 ? ' is-today' : ''}`}
                                style={{ height: `${Math.max(12, Math.round((d.count / max) * 100))}%` }}
                                title={`${d.date}：${d.count} 次`}
                              />
                            )
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="tarot-stats-grid">
                    <div className="tarot-stat">
                      <div className="tarot-stat-num">
                        {stats.successRate === null ? '—' : Math.round(stats.successRate * 100) + '%'}
                      </div>
                      <div className="tarot-stat-label">解读成功率</div>
                    </div>
                    <div className="tarot-stat">
                      <div className="tarot-stat-num">
                        {stats.avgLatencyMs === null ? '—' : (stats.avgLatencyMs / 1000).toFixed(1) + 's'}
                      </div>
                      <div className="tarot-stat-label">平均耗时</div>
                    </div>
                    <div className="tarot-stat">
                      <div className="tarot-stat-num">{stats.asks}</div>
                      <div className="tarot-stat-label">追问轮次</div>
                    </div>
                  </div>

                  {stats.bySpread.length > 0 && (
                    <div className="tarot-stats-block">
                      <div className="tarot-stats-sub">牌阵使用分布</div>
                      {stats.bySpread.map((s) => (
                        <div key={s.key} className="tarot-stats-row">
                          <span className="tarot-stats-row-label">{s.key}</span>
                          <span className="tarot-stats-bar">
                            <span
                              className="tarot-stats-bar-fill"
                              style={{ width: `${Math.round((s.count / stats.draws) * 100)}%` }}
                            />
                          </span>
                          <span className="tarot-stats-row-num">{s.count}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="tarot-stats-foot">
                    <span className="tc-muted">
                      共 {stats.draws} 次占卜，仅保存在本机浏览器，不会上传
                    </span>
                    <button
                      type="button"
                      className="tarot-stats-clear"
                      onClick={() => {
                        clearEvents();
                        setStats(computeTarotStats());
                      }}
                    >
                      清空统计
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          </div>

          {/* 塔罗小知识：原在右栏「今日塔罗能量」旁，移到三栏信息行，与统计 / 跨页联动同排 */}
          <Card variant="mood">
            <SectionTitle icon="book-open"> 塔罗小知识</SectionTitle>
            <div className="dream-fact-list">
              {TAROT_FACTS.map((f, i) => (
                <div key={i} className="dream-fact-item">
                  <span className="dream-fact-icon">{f.icon}</span>
                  <div>{f.text}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* 跨页联动 CTA */}
          <CrossPageLink
            description="塔罗看「当下能量与选择」，八字看「命局底色与流年」。两者结合，占卜更立体。"
            links={[
              { icon: '☯️', label: '去八字排盘', href: '/bugua' },
              { icon: '📋', label: '综合报告', href: '/report', variant: 'primary' },
            ]}
          />
        </div>

        {/* 单张牌义详情 */}
        <Modal
          open={!!detailCard}
          onClose={() => setDetailCard(null)}
          icon={detailCard?.sym}
          title={detailCard ? `${detailCard.name}（${detailCard.isRev ? '逆位' : '正位'}）` : ''}
        >
          {detailCard && (
            <div className="tarot-detail">
              <div className="tarot-detail-meta">
                <Tag variant="good" baseClass="dream-tag">{SUIT_LABEL[detailCard.suit]}</Tag>
                <span>编号 {detailCard.num}</span>
                {/* 大阿卡纳存的是占星对应（水星/月亮/金牛…），小阿卡纳存的是四元素，统一写「元素」会显示成「元素 水星」 */}
                <span>{detailCard.suit === 'major' ? '占星对应' : '元素'} {detailCard.element}</span>
              </div>
              {/* 从速查模块点进来时 pos 是占位的「牌义速查」，没有真实牌位，不展示 */}
              {detailCard.posDesc && (
                <p><strong>牌位：</strong>{detailCard.pos}　{detailCard.posDesc}</p>
              )}
              <p><strong>{detailCard.isRev ? '逆位牌义' : '正位牌义'}：</strong>{detailCard.isRev ? detailCard.rev : detailCard.upright}</p>
              <p><strong>另一面：</strong>{detailCard.isRev ? detailCard.upright : detailCard.rev}</p>
              <p><strong>关键词：</strong>{detailCard.kw.join(' · ')}</p>

              {/* 分维度牌义：一句总牌义撑不起「感情/事业/财运/健康」这些高频问法 */}
              {detailDims && (
                <div className="tarot-detail-dims">
                  <div className="tarot-detail-dims-title">
                    分维度（正位口径{detailCard.isRev ? '，逆位按受阻 / 内化理解' : ''}）
                  </div>
                  {DIMENSION_META.map(({ key, label, icon }) => (
                    <div key={key} className="tarot-detail-dim">
                      <span className="dim-label">{icon} {label}</span>
                      <span className="dim-text">{detailDims[key]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* 自定义牌阵编辑器 */}
        <Modal
          open={!!draft}
          onClose={() => setDraft(null)}
          icon="🧩"
          title={draft?.id ? '编辑自定义牌阵' : '新建自定义牌阵'}
        >
          {draft && (
            <div className="spread-editor">
              <div className="spread-editor-row">
                <label className="spread-editor-field">
                  牌阵名
                  <input
                    className="form-input mb-0"
                    placeholder="例如：三人关系"
                    maxLength={12}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </label>
                <label className="spread-editor-field spread-editor-field-icon">
                  图标
                  <input
                    className="form-input mb-0"
                    maxLength={4}
                    value={draft.icon}
                    onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
                  />
                </label>
              </div>
              <label className="spread-editor-field">
                适合什么场景
                <input
                  className="form-input mb-0"
                  placeholder="例如：牵涉三个人的关系"
                  maxLength={30}
                  value={draft.scene}
                  onChange={(e) => setDraft({ ...draft, scene: e.target.value })}
                />
              </label>

              <div className="spread-editor-sub">
                牌位（{Math.min(draft.positions.filter((p) => p.name.trim()).length, MAX_CUSTOM_POSITIONS)} / {MAX_CUSTOM_POSITIONS}）
                —— 牌位名会一并交给 AI，写得越具体，解读越贴题
              </div>
              {draft.positions.map((p, i) => (
                <div className="spread-editor-pos" key={i}>
                  <span className="spread-editor-pos-no">{i + 1}</span>
                  <input
                    className="form-input mb-0"
                    placeholder="牌位名，如：现状"
                    maxLength={12}
                    value={p.name}
                    onChange={(e) => {
                      const next = draft.positions.slice();
                      next[i] = { ...p, name: e.target.value };
                      setDraft({ ...draft, positions: next });
                    }}
                  />
                  <input
                    className="form-input mb-0"
                    placeholder="这个位置代表什么（选填）"
                    maxLength={60}
                    value={p.desc}
                    onChange={(e) => {
                      const next = draft.positions.slice();
                      next[i] = { ...p, desc: e.target.value };
                      setDraft({ ...draft, positions: next });
                    }}
                  />
                  <button
                    type="button"
                    className="spread-editor-del"
                    aria-label={`删除第 ${i + 1} 个牌位`}
                    disabled={draft.positions.length <= 1}
                    onClick={() =>
                      setDraft({ ...draft, positions: draft.positions.filter((_, j) => j !== i) })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}

              <div className="spread-editor-actions">
                <Button
                  variant="ghost"
                  disabled={draft.positions.length >= MAX_CUSTOM_POSITIONS}
                  onClick={() =>
                    setDraft({ ...draft, positions: [...draft.positions, { name: '', desc: '' }] })
                  }
                >
                  ＋ 加一个牌位
                </Button>
                <Button variant="primary" onClick={handleSaveSpread}>
                  保存牌阵
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* 分享海报 */}
        <Modal open={shareOpen} onClose={() => setShareOpen(false)} variant="share">
          {!share.ready ? (
            <div className="poster-loading">⏳ 正在检查登录状态…</div>
          ) : !share.isAuthed ? (
            <ShareLoginGate context="保存 / 分享" />
          ) : (
            <>
              {posterLoading && <div className="poster-loading">⏳ 正在生成专属海报…</div>}
              {poster && (
                <div className="poster-preview">
                  {poster.imageUrl ? (
                    <img className="poster-img" src={poster.imageUrl} alt="玄镜塔罗海报" loading="lazy" decoding="async" />
                  ) : (
                    <div className="poster-fallback-note">
                      ⚠️ 海报图片生成失败{poster.imageError ? `（${poster.imageError}）` : ''}，可复制下方文案分享。
                    </div>
                  )}
                  {poster.shareText && (
                    <div className="poster-share-text">
                      {sanitizeAiText(poster.shareText).split('\n').filter(Boolean).map((line, i) => (
                        <span key={i}>{line}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="tarot-share-btns">
                {(poster?.imageUrl || poster?.shareText) && <Button variant="ghost" onClick={() => void handleDownloadPoster()}>⬇️ 导出 PDF</Button>}
                <Button
                  variant="ghost"
                  onClick={() => copyText(poster?.shareText || `「${spread.name}」塔罗占卜 · 玄镜 OracleMind`)}
                >
                  📋 复制文案
                </Button>
                {/* 带牌面状态的分享链接：对方打开能看到同一副牌，而不是空抽牌页 */}
                <Button
                  variant="ghost"
                  onClick={() =>
                    copyText(
                      cards.length
                        ? encodeShare({
                            spreadKey,
                            question: question.trim(),
                            cards,
                            significator,
                            allowRev,
                            majorOnly,
                          })
                        : window.location.href
                    )
                  }
                >
                  🔗 复制链接
                </Button>
                {/* 重新生成：重跑 AI 生成 + 再次落库覆盖 */}
                {(poster?.imageUrl || poster?.shareText) && (
                  <Button variant="ghost" onClick={() => void handlePoster()} disabled={posterLoading}>
                    🔄 重新生成
                  </Button>
                )}
              </div>
            </>
          )}
        </Modal>
      </div>
    </ErrorBoundary>
  );
}

/** 塔罗页使用统计（本地埋点聚合结果） */
interface TarotStats {
  /** 事件总条数 */
  total: number;
  /** 抽牌次数（含重抽） */
  draws: number;
  /** 追问轮次 */
  asks: number;
  /** 各牌阵使用次数（降序，已换成牌阵中文名） */
  bySpread: { key: string; count: number }[];
  /** 解读成功率（样本为空时为 null，与「0%」区分） */
  successRate: number | null;
  /** 解读平均耗时（毫秒） */
  avgLatencyMs: number | null;
  /** 近 30 天每日占卜次数（含重抽），无记录的日子补 0，末位为今天 */
  daily: { date: string; count: number }[];
}

/** 从本地事件流水聚合出塔罗页的使用统计 */
function computeTarotStats(): TarotStats {
  const events = filterEvents(getEvents(), 'tarot');
  // 抽牌 = draw + redraw（重抽），此前只数 draw 会漏算「再抽一次」，与注释「含重抽」不符
  const drawEvents = events.filter((e) => e.action === 'draw' || e.action === 'redraw');
  const interps = events.filter((e) => e.action === 'interpret');
  return {
    total: events.length,
    draws: drawEvents.length,
    asks: events.filter((e) => e.action === 'ask').length,
    bySpread: countByProp(drawEvents, 'spread').map((x) => ({
      key: spreadNameOf(x.key),
      count: x.count,
    })),
    successRate: successRate(interps),
    avgLatencyMs: avgProp(interps, 'latencyMs'),
    daily: buildDailyDraws(drawEvents, 30),
  };
}

/** 构建近 N 天每日占卜次数序列（末位为今天，无记录日补 0）。按本地时区归桶。 */
function buildDailyDraws(events: TrackEvent[], days: number): { date: string; count: number }[] {
  const dayMs = 86400000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = today.getTime() - (days - 1) * dayMs;
  const buckets: { date: string; count: number }[] = [];
  const idxByDay = new Map<number, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start + i * dayMs);
    buckets.push({ date: `${d.getMonth() + 1}/${d.getDate()}`, count: 0 });
    idxByDay.set(Math.floor(d.getTime() / dayMs), i);
  }
  for (const e of events) {
    const bucket = idxByDay.get(Math.floor(e.ts / dayMs));
    if (bucket !== undefined) buckets[bucket].count += 1;
  }
  return buckets;
}

/** AI 解读来源徽章文案（与 bugua 页保持一致） */
function providerLabel(p: string): string {
  if (p === 'local-rules') return '本地规则';
  if (p === 'cache') return '';
  const names: Record<string, string> = { aliyun: '阿里云', deepseek: 'DeepSeek' };
  return names[p] || p;
}

/** 生成分享链接所需的全部状态（参数较多，用对象而不是一长串位置参数） */
interface ShareInput {
  spreadKey: string;
  question: string;
  cards: DrawnCard[];
  significator?: string | null;
  /** 逆位口径与牌池模式也要带上：对方打开后「再抽一次」得按同一套设置抽 */
  allowRev: boolean;
  majorOnly: boolean;
}

/**
 * 生成可还原牌面的分享链接：?s=<牌阵>&c=<牌库下标>[R],...&q=<问题>
 * 传下标而不是牌名，牌名里混着中文与符号，拼在 URL 里更难解析也更占长度。
 */
function encodeShare(input: ShareInput): string {
  const { spreadKey, question, cards, significator, allowRev, majorOnly } = input;
  const names = Object.keys(tarotDeck);
  const c = cards
    .map((card) => `${names.indexOf(card.name)}${card.isRev ? 'R' : ''}`)
    .filter((token) => !token.startsWith('-1'))
    .join(',');
  const params = new URLSearchParams({ s: spreadKey, c });
  if (question) params.set('q', question);
  if (significator) params.set('sig', significator);
  // 只在非默认时写进 URL：默认值占多数，短链接更好分享
  if (!allowRev) params.set('rev', '0');
  if (majorOnly) params.set('mj', '1');
  // 自定义牌阵要把牌阵定义一并带上：否则对方本机没有这套牌阵，牌位会整片空掉
  if (spreadKey.startsWith('custom:')) {
    const info = getSpread(spreadKey);
    if (info) {
      params.set(
        'sp',
        encodeURIComponent(
          JSON.stringify([info.name, info.positions, info.positionDesc, info.icon, info.scene, info.desc])
        )
      );
    }
  }
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

/** 分享链接里的自定义牌阵在本机不存在时，用链接自带的牌阵定义兜底 */
function resolveSharedSpread(key: string, p: URLSearchParams): SpreadInfo | undefined {
  if (!key.startsWith('custom:')) return undefined;
  const spRaw = p.get('sp');
  if (!spRaw) return undefined;
  try {
    const [name, positions, positionDesc, icon, scene, desc] = JSON.parse(
      decodeURIComponent(spRaw)
    ) as [string, string[], string[], string, string, string];
    const info: SpreadInfo = {
      name,
      count: positions.length,
      icon: icon || '🧩',
      scene: scene || '自定义场景',
      desc: desc || '',
      positions,
      positionDesc,
    };
    // 挂到模块级兜底表，后续「牌阵说明」等渲染也能查到
    ephemeralSpreads[key] = info;
    return info;
  } catch {
    return undefined;
  }
}

/**
 * 解析分享链接。牌阵非法或一张牌都对不上时返回 null —— 宁可当普通访问，
 * 也不要渲染出「半个牌阵」把用户搞懵。
 */
function decodeShare(
  search: string
): {
  spreadKey: string;
  question: string;
  cards: DrawnCard[];
  significator: string | null;
  allowRev: boolean;
  majorOnly: boolean;
} | null {
  const p = new URLSearchParams(search);
  const key = p.get('s');
  const raw = p.get('c');
  if (!key || !raw) return null;
  const spread = getSpread(key) ?? resolveSharedSpread(key, p);
  if (!spread) return null;
  const names = Object.keys(tarotDeck);
  const cards: DrawnCard[] = [];
  raw.split(',').forEach((token, i) => {
    const isRev = token.endsWith('R');
    const idx = Number.parseInt(isRev ? token.slice(0, -1) : token, 10);
    const name = names[idx];
    if (!name || i >= spread.positions.length) return;
    cards.push({
      ...tarotDeck[name],
      name,
      isRev,
      pos: spread.positions[i],
      posDesc: spread.positionDesc[i],
    });
  });
  if (!cards.length) return null;
  return {
    spreadKey: key,
    question: p.get('q') || '',
    cards,
    significator: p.get('sig') || null,
    // 缺省即默认口径（允许逆位 / 全牌库），与 encodeShare 的「非默认才写」对称
    allowRev: p.get('rev') !== '0',
    majorOnly: p.get('mj') === '1',
  };
}
