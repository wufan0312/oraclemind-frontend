'use client';

import '@/styles/home.scss';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { requestHomeAgentStream, type ChatHistoryEntry, type HomeAgentCta } from '@/lib/api';
import { loadHomeChat, saveHomeChat, clearHomeChat } from '@/lib/homeChatStore';
import { dedupAdjacentParagraphs, dedupListItemsByTitle, renumberStandaloneNumberedHeadings, dedupCrossTurn } from '@/lib/textDedup';
import { mdToHtml } from '@/lib/markdown';
import { useChat, type ChatMessage } from '@/hooks/useChat';
import { resolveBirthHint } from '@/lib/birthHintExtractor';
import AiChatWindow from '@/components/ai-chat/AiChatWindow';
import OnboardingTour from '@/components/home/OnboardingTour';

const SUGGESTIONS = [
  'home.sug1',
  'home.sug2',
  'home.sug3',
  'home.sug4',
  'home.sug5'
];

const FEATURES = [
  { href: '/bugua', iconSrc: '/images/nav-icons/bagua.svg', nameKey: 'home.feat.bugua', descKey: 'home.feat.buguaDesc' },
  { href: '/ming', iconSrc: '/images/nav-icons/ming.svg', nameKey: 'home.feat.ming', descKey: 'home.feat.mingDesc' },
  { href: '/tarot', iconSrc: '/images/nav-icons/tarot.svg', nameKey: 'home.feat.tarot', descKey: 'home.feat.tarotDesc' },
  { href: '/horoscope', iconSrc: '/images/nav-icons/horoscope.svg', nameKey: 'home.feat.horoscope', descKey: 'home.feat.horoscopeDesc' },
  { href: '/numerology', iconSrc: '/images/nav-icons/numerology.svg', nameKey: 'home.feat.numerology', descKey: 'home.feat.numerologyDesc' },
  { href: '/dream', iconSrc: '/images/nav-icons/dream.svg', nameKey: 'home.feat.dream', descKey: 'home.feat.dreamDesc' },
  { href: '/fengshui', iconSrc: '/images/nav-icons/fengshui.svg', nameKey: 'home.feat.fengshui', descKey: 'home.feat.fengshuiDesc' }
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
    '可以问我事业、感情、财运、健康等问题；\n涉及八字、紫微、塔罗等完整命盘时，我会引导你去卜卦页深入分析。',
  welcome: true,
};

/**
 * 首页 —— 全站顶部导航 + hero + AI 对话面板（首页通用命理助手 Agent）+ 功能入口 6 宫格
 * 聊天逻辑（消息/流式/中止/清空/自动贴底/五层去重/持久化）统一收敛到 useChat，
 * 渲染统一交给 <AiChatWindow />，与 dream / healing 三页样式功能一致。
 */
export default function HomePage() {
  const { t } = useI18n();
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

  return (
    <div className="page active" id="page-home">
      <div className="hero-section">
        <div className="hero-badge">{t('home.badge')}</div>
        <h1 className="hero-title">
          <span className="gradient-text">{t('home.title')}</span>
        </h1>
        <div className="hero-subtitle">
          <p>{t('home.sub1')}</p>
          <p className="hero-subtitle-sub">{t('home.sub2')}</p>
        </div>
      </div>

      {/* AI 对话面板（首页通用命理助手）—— 统一渲染壳 AiChatWindow */}
      <AiChatWindow
        className="home-chat"
        title={t('home.assistantTitle')}
        status={t('home.assistantStatus')}
        messages={messages}
        input={chat.input}
        onInputChange={chat.setInput}
        onSend={() => chat.send()}
        inputPlaceholder={t('home.inputPlaceholder')}
        inputDisabled={streaming}
        onClear={clearChat}
        scrollRef={chat.scrollRef}
        headerExtra={
          <Link href="/bugua" className="hero-cta">{t('home.cta')}</Link>
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
                <div key={s} className="ai-suggestion-chip" onClick={() => chat.send(t(s))}>
                  {t(s)}
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
          <Link key={f.href} href={f.href} className={`feature-card${f.href === '/bugua' ? ' feature-card--hot' : ''}`}>
            <div className="feature-icon">
              <img src={f.iconSrc} className="feature-icon-img" alt={t(f.nameKey)} />
            </div>
            <div className="feature-name">{t(f.nameKey)}</div>
            <div className="feature-desc">{t(f.descKey)}</div>
          </Link>
        ))}
      </div>

      {/* 新手引导浮层（首次访问） */}
      <OnboardingTour />
    </div>
  );
}
