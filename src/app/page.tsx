'use client';

import '@/styles/home.scss';
import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { requestHomeAgentStream, type ChatHistoryEntry, type HomeAgentCta } from '@/lib/api';
import { loadHomeChat, saveHomeChat, clearHomeChat } from '@/lib/homeChatStore';
import { dedupAdjacentParagraphs, dedupListItemsByTitle, renumberStandaloneNumberedHeadings, dedupCrossTurn } from '@/lib/textDedup';
import { mdToHtml } from '@/lib/markdown';
import { useChat, type ChatMessage } from '@/hooks/useChat';
import { resolveBirthHint } from '@/lib/birthHintExtractor';
import AiChatWindow from '@/components/ai-chat/AiChatWindow';
import OnboardingTour from '@/components/home/OnboardingTour';

const SUGGESTIONS = [
  '💰 今年财运怎么样？',
  '💕 我和TA适合在一起吗？',
  '🌙 最近总是失眠做噩梦',
  '🚀 事业转型时机分析',
  '🔥 我的五行缺什么？'
];

const FEATURES = [
  { href: '/bugua', iconSrc: '/images/nav-icons/bagua.svg', name: '卜卦', desc: '多术数觉察档案 · 点击开始' },
  { href: '/ming', iconSrc: '/images/nav-icons/ming.svg', name: '测字起名', desc: '测字·五格·起名·合婚' },
  { href: '/tarot', iconSrc: '/images/nav-icons/tarot.svg', name: '塔罗', desc: '5种牌阵·AI情境解读' },
  { href: '/horoscope', iconSrc: '/images/nav-icons/horoscope.svg', name: '星座', desc: '本命盘·运势·配对' },
  { href: '/numerology', iconSrc: '/images/nav-icons/numerology.svg', name: '数字密码', desc: '生命灵数·九宫格·流年' },
  { href: '/dream', iconSrc: '/images/nav-icons/dream.svg', name: '周公解梦', desc: '梦境解析·心灵洞察' },
  { href: '/assessment', iconSrc: '/images/nav-icons/assessment.svg', name: '复原力测评', desc: '自我觉察·压力与资源·与生辰无关' },
  { href: '/scales', iconSrc: '/images/nav-icons/scales.svg', name: '心理量表', desc: '经典量表·多维自我评估·成长导向' }
];

/**
 * 根据后端下发的 CTA 动态构造跳转链接，把用户的问题带到对应模块页面。
 * prefill 分两态（与后端 home_agent 两态方案对齐）：
 * - 有实质诉求：预填问题 ?q=（卜卦 autodiv / 塔罗 autostart 自动开一局）
 * - 无诉求（随便看看）：不拼 q，目标页自动开「整体指引」局，问题框留空
 *   由情境推荐 chips 引导用户具体化。禁止把「随便看看推荐」这类元信息当问题带过去。
 */
function buildCtaHref(cta: HomeAgentCta): string {
  const prefill = (cta.prefill || '').trim();
  const params = new URLSearchParams();

  if (prefill) {
    params.set('q', prefill);
  }

  // 若 AI 已提取到结构化生辰，一并带给目标页，避免用户重复填写性别/时辰
  const bh = cta.birthHint;
  if (bh && bh.year && bh.month && bh.day) {
    const mm = String(bh.month).padStart(2, '0');
    const dd = String(bh.day).padStart(2, '0');
    params.set('date', `${bh.year}-${mm}-${dd}`);
    if (bh.timeText) params.set('time', bh.timeText);
    if (bh.gender) params.set('gender', bh.gender);
  }

  switch (cta.target) {
    case '/bugua': {
      params.set('autodiv', '1');
      const qs = params.toString();
      return `/bugua${qs ? `?${qs}` : ''}`;
    }
    case '/tarot': {
      params.set('autostart', '1');
      const qs = params.toString();
      return `/tarot${qs ? `?${qs}` : ''}`;
    }
    default: {
      const qs = params.toString();
      return `${cta.target}${qs ? `?${qs}` : ''}`;
    }
  }
}

/**
 * 轻量 Markdown 渲染：**统一走 `lib/markdown.ts::mdToHtml`**（全站唯一渲染实现）。
 *
 * ⚠️ 不要再在本文件里另写一套解析。历史坑（2026-09-10 第三次复发）：
 * 本组件曾自行按「连续 `\d+. ` 行」合并 `<ol>`，而 AI 常在有序条目之间插空行，
 * 于是每条各自成为一个独立 `<ol>`，浏览器各自从 1 开始编号 → 用户看到 1.1.1.1.。
 * mdToHtml 已处理「跨空行累积 `ol`」与「编号不信任模型、逐项 +1」，
 * 并额外支持标题 / 引用 / 表格 / 行内代码，能力是旧实现的全集。
 */
function MdContent({ text }: { text: string }) {
  return <div className="md-content" dangerouslySetInnerHTML={{ __html: mdToHtml(text) }} />;
}

const WELCOME_ID = 'home-welcome';
const HOME_WELCOME: ChatMessage = {
  id: WELCOME_ID,
  role: 'assistant',
  content:
    '可以问我事业、感情、成长、状态调整等问题；\n想深入了解自己时，我会引导你去对应模块生成专属的觉察档案。',
  welcome: true,
};

/**
 * 首页 —— 全站顶部导航 + hero + AI 对话面板（首页通用命理助手 Agent）+ 功能入口 6 宫格
 * 聊天逻辑（消息/流式/中止/清空/自动贴底/五层去重/持久化）统一收敛到 useChat，
 * 渲染统一交给 <AiChatWindow />，与 dream / healing 三页样式功能一致。
 */
export default function HomePage() {
  const [cta, setCta] = useState<HomeAgentCta | null>(null);
  const [restored, setRestored] = useState(false);
  // CTA 是首页专属逻辑（后端 meta 事件下发），单独用 ref 承接，落盘时一并写入
  const ctaRef = useRef<HomeAgentCta | null>(null);
  const readyRef = useRef(false);

  const chat = useChat({
    request: async (history, question, opts) => {
      // 从用户自然语言消息中提取结构化生辰；提取成功时传给后端，
      // 让 AI 直接调用排盘工具并生成准确的 CTA 回填参数。
      // 当前消息没带生辰（如「那我今年财运呢」这类追问）时，回溯历史里最近一次
      // 完整生辰，避免第二轮起排盘依据丢失。
      const birthHint = resolveBirthHint(
        question,
        history.filter((h) => h.role === 'user').map((h) => h.content),
      );
      const res = await requestHomeAgentStream(
        question,
        { signal: opts.signal, onDelta: opts.onDelta, onMeta: opts.onMeta },
        history,
        birthHint,
      );
      return { text: res.text };
    },
    initialMessages: [HOME_WELCOME],
    maxHistory: 20,
    // 流式过程中的三层兜底：相邻去重 → 列表标题去重 → 编号修正
    transformStreaming: (full) => {
      try {
        return renumberStandaloneNumberedHeadings(
          dedupListItemsByTitle(dedupAdjacentParagraphs(full)),
        );
      } catch {
        return full;
      }
    },
    // 流结束后最终去重 + 跨轮去重（消除 LLM 重复之前轮次已说内容的问题）
    dedupCommit: (cleaned, prevAcc) => {
      try {
        return dedupCrossTurn(
          renumberStandaloneNumberedHeadings(
            dedupListItemsByTitle(dedupAdjacentParagraphs(cleaned)),
          ),
          prevAcc,
        );
      } catch {
        return cleaned;
      }
    },
    onSend: () => {
      // 新一轮提问 → 清掉上一轮 CTA
      ctaRef.current = null;
      setCta(null);
    },
    onMeta: (m) => {
      if (m?.cta) {
        ctaRef.current = m.cta;
        setCta(m.cta);
      }
    },
  });

  const { messages, streaming } = chat;
  const hasUserMsg = messages.some((m) => m.role === 'user');

  // 恢复上次对话（路由跳回 / 刷新后仍能接着聊，多轮上下文一并接上）
  useEffect(() => {
    const snap = loadHomeChat();
    if (snap && snap.messages.length) {
      chat.hydrate(
        snap.messages
          .filter((e: ChatHistoryEntry) => e.role && typeof e.content === 'string')
          .map((e: ChatHistoryEntry, i: number) => ({
            id: `hm_${i}`,
            role: e.role,
            content: e.content,
          })),
      );
      if (snap.cta) {
        ctaRef.current = snap.cta;
        setCta(snap.cta);
      }
      setRestored(true);
    } else {
      chat.hydrate([HOME_WELCOME]);
    }
    readyRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 落盘。流式期间不写，避免每个 chunk 都刷 localStorage；
  // 这样即使用户回答途中跳走，也只会丢最后不到即时内容。
  useEffect(() => {
    if (!readyRef.current || streaming) return;
    const toSave = messages
      .filter((m) => m.content && m.id !== WELCOME_ID)
      .map((m) => ({ role: m.role, content: m.content }));
    // 空快照不落盘：首次挂载（含 StrictMode 双挂载）时 messages 还是初始的
    // [HOME_WELCOME]，过滤后为空，若照常写入会把刚从 localStorage 读出来的
    // 存档删掉（表现为「跳走再回首页，对话没了」）。清空走 clearChat 的
    // clearHomeChat()，不依赖这里的空写入。
    if (toSave.length === 0) return;
    saveHomeChat(toSave, ctaRef.current);
  }, [messages, streaming]);

  const clearChat = () => {
    chat.clear();
    ctaRef.current = null;
    setCta(null);
    setRestored(false);
    clearHomeChat();
  };

  const isLast = (id: string) => messages.length > 0 && messages[messages.length - 1].id === id;

  /** 用户在首页说过的最后一句诉求（跳过「随便看看」这类无实质诉求） */
  const lastUserQ = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === 'user' && m.content && m.content.trim()) {
        const t = m.content.trim();
        // 只排除明确「随便逛逛」的浏览意图；「不知道该不该换工作」这类仍是真诉求
        if (t.length >= 2 && !/随便看看|随便逛逛|只是看看|先看看|随便转转/.test(t)) return t;
        return '';
      }
    }
    return '';
  }, [messages]);

  /**
   * 宫格 / 头部入口跳转：首页已说过困扰时，把问题带进目标页（与 AI CTA 同款行为）。
   * - bugua：?autodiv=1&q= 预填「所问之事」并自动起局
   * - tarot：?autostart=1&q= 预填问题并自动开牌
   * - horoscope / numerology：?q= 顶部提示条承接
   */
  const buildNavHref = (href: string): string => {
    if (!lastUserQ) return href;
    if (!['/bugua', '/tarot', '/horoscope', '/numerology'].includes(href)) return href;
    // 超长诉求截断：目标页输入框只承接「一句话困扰」，避免整段对话塞进 URL
    const q = lastUserQ.length > 60 ? `${lastUserQ.slice(0, 60)}…` : lastUserQ;
    const params = new URLSearchParams({ q });
    if (href === '/bugua') params.set('autodiv', '1');
    if (href === '/tarot') params.set('autostart', '1');
    return `${href}?${params.toString()}`;
  };

  // 顶部导航（TopNav）是独立组件拿不到 lastUserQ state，持久化到 sessionStorage 供其点击时读取；
  // 诉求为空（清空对话/只说了闲逛意图）时同步移除，避免带旧参。
  useEffect(() => {
    try {
      if (lastUserQ) window.sessionStorage.setItem('om_home_lastq', lastUserQ);
      else window.sessionStorage.removeItem('om_home_lastq');
    } catch { /* ignore */ }
  }, [lastUserQ]);

  return (
    <div className="page active" id="page-home">
      <div className="hero-section">
        <div className="hero-badge">✨ AI 驱动 · 多维度自我觉察 · 一站式认识自己</div>
        <h1 className="hero-title">
          <span className="gradient-text">探索未知的自己，从玄镜开始</span>
        </h1>
        <div className="hero-subtitle">
          <p>跨越东西方千年智慧，融汇八字、紫微、塔罗、星座与数字密码之精髓</p>
          <p className="hero-subtitle-sub">AI 为您量身推演专属自我觉察方案，让每一步抉择皆有迹可循。</p>
        </div>
      </div>

      {/* AI 对话面板（首页通用命理助手）—— 统一渲染壳 AiChatWindow */}
      <AiChatWindow
        className="home-chat"
        title="小玄 · 通用觉察助手"
        status="在线 · 事业/感情/财运/健康都能聊"
        messages={messages}
        input={chat.input}
        onInputChange={chat.setInput}
        onSend={() => chat.send()}
        inputPlaceholder="例如：我最近事业遇到瓶颈，不知道该不该换工作…"
        inputDisabled={streaming}
        onClear={clearChat}
        scrollRef={chat.scrollRef}
        headerExtra={
          <Link href={buildNavHref('/bugua')} className="hero-cta">免费生成我的觉察档案 →</Link>
        }
        belowMessages={
          <div className="home-chat-foot">
            {hasUserMsg || restored ? (
              <div className="chat-history-bar">
                <span className="chat-history-tip">
                  {restored ? '已恢复上次的对话，可以直接接着问' : '对话会自动保存，回来可继续'}
                </span>
              </div>
            ) : null}
            <div className="ai-suggestions">
              {SUGGESTIONS.map((s) => (
                <div key={s} className="ai-suggestion-chip" onClick={() => chat.send(s)}>
                  {s}
                </div>
              ))}
            </div>
          </div>
        }
        renderContent={(m) => (
          <>
            {m.content ? (
              <MdContent text={m.content} />
            ) : streaming && isLast(m.id) ? (
              <span className="chat-thinking">
                <span className="thinking-dot" />
                <span className="thinking-dot" />
                <span className="thinking-dot" />
                思考中
              </span>
            ) : null}
            {m.role === 'assistant' && cta && isLast(m.id) && m.content ? (
              <Link href={buildCtaHref(cta)} className="chat-cta">{cta.label}</Link>
            ) : null}
          </>
        )}
      />

      {/* 功能入口 6 宫格 */}
      <div className="feature-grid">
        {FEATURES.map((f) => (
          <Link key={f.href} href={buildNavHref(f.href)} className={`feature-card${f.href === '/bugua' ? ' feature-card--hot' : ''}`}>
            <div className="feature-icon">
              <img src={f.iconSrc} className="feature-icon-img" alt={f.name} />
            </div>
            <div className="feature-name">{f.name}</div>
            <div className="feature-desc">{f.desc}</div>
          </Link>
        ))}
      </div>

      {/* 新手引导浮层（首次访问） */}
      <OnboardingTour />
    </div>
  );
}
