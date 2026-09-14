'use client';

import '@/components/ai-chat/LightFollowUp.scss';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  requestGenericChatStream,
  type ChatHistoryEntry,
  type InterpretStreamOptions,
} from '@/lib/api';
import { mdToHtml } from '@/lib/markdown';
import { applyTextDedup, dedupCrossTurn } from '@/lib/textDedup';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import './LightFollowUp.scss';
import { AiAvatar } from '@/components/ui/AIInterpretation';

export interface LightFollowUpProps {
  /** 后端 chat/stream 的 module 字符串（如 numerology / summary / horoscope） */
  module: string;
  /** 原始解读文本，作为追问上下文；为空时入口禁用 */
  context: string;
  /** 预设追问胶囊（点击即发，零输入门槛） */
  chips?: string[];
  /** 是否展示追问胶囊，默认 true */
  showChips?: boolean;
  /** 区块标题 */
  title?: ReactNode;
  /** 标题旁的图标，默认 💬 */
  icon?: ReactNode;
  /** 标题下方的补充说明（如上下文保留轮数） */
  subtitle?: ReactNode;
  /** 自由输入占位符 */
  placeholder?: string;
  /** 每轮上限字数 */
  maxLength?: number;
  /** 初始对话历史（用于从快照/历史恢复） */
  initialHistory?: ChatHistoryEntry[];
  /** 对话历史变化回调（含用户新问题与 AI 完整回复后） */
  onHistoryChange?: (history: ChatHistoryEntry[]) => void;
  /**
   * 自定义流式请求函数。
   * 传入时优先使用；否则走默认的 requestGenericChatStream(module, context, history, question)。
   * 适用于 tarot 等需要额外上下文（牌阵/牌面）的模块。
   */
  chatFn?: (
    history: ChatHistoryEntry[],
    question: string,
    opts: InterpretStreamOptions
  ) => Promise<{ text: string; disclaimer: string }>;
  /**
   * 每次发起新请求时，把当前请求的 AbortController 暴露给父组件。
   * 父组件可在切牌阵/重抽/重新解读时调用 abort() 作废在途追问。
   */
  onAbortController?: (controller: AbortController) => void;

  /** 清空对话后的回调（父组件可同步清掉持久化的历史） */
  onClear?: () => void;
  /** 是否展示助手/用户头像，默认 false（与首页对话气泡一致：不展示头像） */
  showAvatar?: boolean;
  /** 是否展示「停止生成」按钮（流式期间），默认 true */
  allowStop?: boolean;
  /** 是否展示「清空对话」按钮（有对话后出现），默认 true */
  allowClear?: boolean;
  /** 是否展示输入框字数计数，默认 true */
  showCharCount?: boolean;
  /** 是否展示每条 AI 回复的「复制」按钮，默认 true */
  showCopy?: boolean;
  /** 用户头像（默认 🧑），可传图片 URL 或任意节点 */
  userAvatar?: ReactNode;
  /** 助手头像（默认小玄 spirit_avatar.png），可传图片 URL 或任意节点 */
  aiAvatar?: ReactNode;
  /** 顶栏右侧额外内容 */
  headerExtra?: ReactNode;
  /** 外层容器额外 className */
  className?: string;
}

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

const DEFAULT_CHIPS = [
  '能说得再具体一点吗？',
  '这和我的事业有关吗？',
  '感情方面怎么看？',
  '有什么需要注意的？',
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 空回复兜底文案。
 * 服务端异常（LLM 超时/降级）或内容被去重/清洗流水线整段吞掉时，
 * 若写入空字符串会渲染成一个「空气泡」——用户看不到任何反馈，只会觉得点了没反应。
 */
export const EMPTY_REPLY_TIP =
  '小玄这次没能组织好语言，你可以再问一次，或换个问法试试～';

/**
 * 轻量追问入口：在 AI 解读下方展示一排预设胶囊，点击即发，
 * 流式追问结果内联渲染，支持多轮。相比 tarot/dream 的完整聊天框更省空间。
 *
 * 全站统一组件，样式与交互一致；通过 props 控制标题、胶囊、占位符与自定义请求函数。
 * 内置：手动停止生成、清空对话、头像、流式「正在输入」指示、字数计数、复制回复、回到底部。
 */
export default function LightFollowUp({
  module,
  context,
  chips = DEFAULT_CHIPS,
  showChips = true,
  title = '还想深入聊聊？',
  icon = '💬',
  subtitle,
  placeholder = '或输入你自己的问题…',
  maxLength = 100,
  initialHistory = [],
  onHistoryChange,
  chatFn,
  onAbortController,
  onClear,
  showAvatar = false,
  allowStop = true,
  allowClear = true,
  showCharCount = true,
  showCopy = true,
  userAvatar = '🧑',
  aiAvatar,
  headerExtra,
  className,
}: LightFollowUpProps) {
  const [history, setHistory] = useState<Turn[]>(initialHistory);
  const [streaming, setStreaming] = useState(''); // 正在流式输出的助手文本
  const [pending, setPending] = useState(false);
  const [input, setInput] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null); // 复制成功的消息下标（短暂高亮）
  const abortRef = useRef<AbortController | null>(null);
  const historyRef = useRef<Turn[]>(initialHistory); // 避免闭包读到旧 history
  const didInitRef = useRef(false);
  // 自动贴底：history / streaming 任一变化都会滚到底，
  // 保证「当前正在输出的这句」始终停在可视区内（流式期间用 instant，避免动画互相打断）
  const { ref: scrollRef, scrollToBottom, atBottom } = useAutoScroll<HTMLDivElement>([
    history,
    streaming,
  ]);
  // 区块根节点：发起追问时用它把整块对话区带进浏览器视口
  const rootRef = useRef<HTMLDivElement | null>(null);
  // 历史所有 AI 回复的累积文本，供跨轮去重比对（不含当前轮）
  const prevAiTextRef = useRef<string>('');

  const disabled = !context || !context.trim();

  // 向父组件同步历史变化（跳过首次渲染，避免把 initialHistory 反向写回）
  useEffect(() => {
    if (!didInitRef.current) {
      didInitRef.current = true;
      return;
    }
    onHistoryChange?.(history);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  /**
   * AI 文本 → HTML：先过 GLM-4-Flash 兜底流水线（折叠相邻重复 / 标题去重 /
   * 编号递增修正），再交给 mdToHtml。流式中间态也会走这里，
   * 让「1. 1. 1. 1.」在生成过程中就显示成 1./2./3./4.
   *
   * 防线：清洗/渲染后若得到空 HTML（模型输出整体被去重或 sanitize 吞掉），
   * 回退为转义后的纯文本 —— 否则气泡里什么都没有，用户以为追问没反应。
   */
  const renderAiText = useCallback((raw: string) => {
    const html = mdToHtml(applyTextDedup(raw));
    if (html.trim()) return html;
    const plain = escapeHtml(raw || '').replace(/\n{1,}/g, '<br/>');
    return plain.trim() ? `<p>${plain}</p>` : '';
  }, []);

  const ask = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || pending || disabled) return;
      // 先把用户问题写进历史，再作为上下文发给后端（不含助手本轮）
      const userTurn: Turn = { role: 'user', content: question };
      const prevHistory = historyRef.current;
      const nextHistory = [...prevHistory, userTurn];
      historyRef.current = nextHistory;
      setHistory(nextHistory);
      setInput('');
      setPending(true);
      setStreaming('');

      const controller = new AbortController();
      abortRef.current = controller;
      onAbortController?.(controller);

      // 新一轮开始：无条件恢复跟随（上一轮若被手动上滑暂停过），
      // 并把对话区带进浏览器视口——页面很长，否则新回答会在视口外悄悄生成。
      scrollToBottom();
      requestAnimationFrame(() => {
        rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });

      try {
        const doRequest =
          chatFn ??
          ((h: ChatHistoryEntry[], q: string, opts: InterpretStreamOptions) =>
            requestGenericChatStream(module, context, h, q, opts));
        const res = await doRequest(prevHistory, question, {
          signal: controller.signal,
          onDelta: (_chunk, full) => setStreaming(full),
        });
        // 单轮去重 + 跨轮兜底：把原始解读也纳入历史，
        // 避免追问答案整段复述已经展示过的解读内容
        let cleaned = applyTextDedup(res.text);
        const prevAcc = [context.trim(), prevAiTextRef.current].filter(Boolean).join('\n\n');
        cleaned = dedupCrossTurn(cleaned, prevAcc);
        // 空回复兜底：服务端异常（LLM 超时/降级）或内容被去重/清洗流水线整段吞掉时，
        // 若写入空字符串会渲染成「空气泡」——用户看不到任何反馈，误以为点了没反应。
        let isEmptyTip = false;
        if (!cleaned.trim()) {
          cleaned = EMPTY_REPLY_TIP;
          isEmptyTip = true;
        }
        // 兜底提示不计入跨轮去重历史，避免污染后续比对基线
        if (!isEmptyTip) {
          prevAiTextRef.current = prevAcc ? `${prevAcc}\n\n${cleaned}` : cleaned;
        }
        const assistantTurn: Turn = { role: 'assistant', content: cleaned };
        historyRef.current = [...nextHistory, assistantTurn];
        setHistory([...nextHistory, assistantTurn]);
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          const msg = e?.message || '追问失败，请稍后重试';
          const errTurn: Turn = { role: 'assistant', content: `⚠️ ${msg}` };
          historyRef.current = [...nextHistory, errTurn];
          setHistory([...nextHistory, errTurn]);
        }
      } finally {
        setPending(false);
        setStreaming('');
        abortRef.current = null;
        // 收尾滚动交给 useAutoScroll：history 变化会触发贴底；
        // 若用户中途上滑看历史，跟随已暂停，不会被强行拽回。
      }
    },
    [module, context, pending, disabled, scrollToBottom, chatFn, onAbortController]
  );

  // 卸载时中断在途请求，避免向已卸载组件写状态
  useEffect(() => () => abortRef.current?.abort(), []);

  /** 手动停止生成：中止在途请求，用户问题保留、本轮答案不写入 */
  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** 清空对话：重置内部状态（流式期间隐藏清空按钮，故无需 abort） */
  const handleClear = useCallback(() => {
    historyRef.current = [];
    prevAiTextRef.current = '';
    setHistory([]);
    setStreaming('');
    setInput('');
    setCopiedIdx(null);
    onClear?.();
  }, [onClear]);

  /** 复制某条 AI 回复到剪贴板，并短暂高亮反馈 */
  const copy = useCallback(async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      window.setTimeout(() => {
        setCopiedIdx((cur) => (cur === idx ? null : cur));
      }, 1200);
    } catch {
      /* 剪贴板不可用时静默失败 */
    }
  }, []);

  const effectiveChips = showChips ? chips : [];
  const hasConversation = history.length > 0 || streaming;

  const renderAvatar = (role: 'user' | 'assistant') => {
    if (!showAvatar) return null;
    const node =
      role === 'user'
        ? userAvatar
        : aiAvatar ?? <img src="/images/spirit_avatar.png" alt="小玄" />;
    return <span className={`lfu-avatar is-${role}`}>{node}</span>;
  };

  return (
    <div className={['lfu', className].filter(Boolean).join(' ')} ref={rootRef}>
      <div className="lfu-head">
        {/* {icon && <span className="lfu-icon">{icon}</span>} */}
        <AiAvatar />
        <span className="lfu-title">{title}</span>
        {subtitle && <span className="lfu-subtitle">{subtitle}</span>}
        <div className="lfu-head-actions">
          {headerExtra}
          {allowClear && hasConversation && !pending && (
            <button
              type="button"
              className="lfu-clear-btn"
              onClick={handleClear}
              title="清空对话，重新开始"
            >
              🗑 清空
            </button>
          )}
        </div>
      </div>

      {disabled ? (
        <div className="lfu-hint">解读生成后，可在此继续追问～</div>
      ) : (
        <>
          {effectiveChips.length > 0 && (
            <div className="lfu-chips">
              {effectiveChips.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  className="chat-suggest-chip lfu-chip"
                  onClick={() => void ask(c)}
                  disabled={pending}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <div className="lfu-input-row chat-pill">
            <input
              className="form-input field-pill mb-0"
              placeholder={placeholder}
              maxLength={maxLength}
              value={input}
              disabled={pending}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) void ask(input);
              }}
            />
            {allowStop && pending ? (
              <button
                className="ai-send-btn chat-send-btn lfu-stop"
                type="button"
                onClick={stop}
                aria-label="停止生成"
                title="停止生成"
              >
                <svg
                  className="iconfont icon-lg"
                  viewBox="0 0 24 24"
                  width="1em"
                  height="1em"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                className="ai-send-btn chat-send-btn"
                type="button"
                onClick={() => void ask(input)}
                disabled={pending || !input.trim()}
                aria-label="追问"
                title={pending ? '生成中…' : '追问'}
              >
                <svg
                  className="iconfont icon-lg"
                  viewBox="0 0 24 24"
                  width="1em"
                  height="1em"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M22 2 11 13" />
                  <path d="M22 2 15 22 11 13 2 9" />
                </svg>
              </button>
            )}
          </div>

          {showCharCount && (
            <div className="lfu-charcount">
              {input.length}/{maxLength}
            </div>
          )}

          {hasConversation && (
            <div className="lfu-list" ref={scrollRef}>
              {history.map((m, i) => (
                <div
                  key={i}
                  className={'lfu-msg ' + (m.role === 'user' ? 'is-user' : 'is-ai')}
                >
                  {renderAvatar(m.role as 'user' | 'assistant')}
                  <div className="lfu-msg-body">
                    <div className="lfu-bubble">
                      <div
                        className="lfu-text"
                        dangerouslySetInnerHTML={{
                          __html:
                            m.role === 'user'
                              ? escapeHtml(m.content)
                              : renderAiText(m.content),
                        }}
                      />
                      {showCopy && m.role === 'assistant' && (
                        <button
                          type="button"
                          className={'lfu-copy' + (copiedIdx === i ? ' is-copied' : '')}
                          onClick={() => void copy(m.content, i)}
                          title="复制回复"
                          aria-label="复制回复"
                        >
                          {copiedIdx === i ? '✓ 已复制' : '⧉ 复制'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* 流式输出：未拿到首 token 前显示「正在输入」，拿到后实时渲染 */}
              {streaming ? (
                <div className="lfu-msg is-ai">
                  {renderAvatar('assistant')}
                  <div className="lfu-msg-body">
                    <div className="lfu-bubble">
                      <div
                        className="lfu-text is-streaming"
                        dangerouslySetInnerHTML={{ __html: renderAiText(streaming) }}
                      />
                    </div>
                  </div>
                </div>
              ) : pending ? (
                <div className="lfu-msg is-ai">
                  {renderAvatar('assistant')}
                  <div className="lfu-msg-body">
                    <div className="lfu-bubble">
                      <div className="lfu-text lfu-typing" aria-label="小玄正在输入">
                        <span className="lfu-typing-dot" />
                        <span className="lfu-typing-dot" />
                        <span className="lfu-typing-dot" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {!atBottom && (
                <button
                  type="button"
                  className="lfu-tobottom"
                  onClick={() => scrollToBottom('smooth')}
                  title="回到底部"
                >
                  ↓ 回到底部
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
