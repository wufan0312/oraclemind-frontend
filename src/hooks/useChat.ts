'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import type { AiChatMessage } from '@/components/ai-chat/AiChatWindow';
import type { ChatHistoryEntry } from '@/lib/api';

/**
 * useChat —— 全站统一的「多轮 AI 对话」逻辑 hook
 * --------------------------------------------------------------------------
 * 把首页 / dream / healing 三个页面重复的聊天逻辑（消息状态、流式累积、
 * 中止、清空、自动贴底、可选去重、可选持久化）收敛到这里，页面只负责：
 *   - 提供 request（调哪个后端：home agent / generic dream / generic healing）
 *   - 通过 onSend / onMeta / onCommitted 挂差异逻辑（清 CTA、触发游戏化、接 CTA）
 *   - 通过 transformStreaming / dedupCommit 注入去重策略（首页五层防御等）
 *
 * 渲染统一交给 <AiChatWindow />，做到「样式 + 功能双统一」。
 */

/** 与 AiChatWindow 的 AiChatMessage 兼容，并允许页面附加自定义字段（source / perspective 等） */
export type ChatMessage = AiChatMessage & Record<string, unknown>;

export interface ChatRequestOptions {
  signal: AbortSignal;
  onDelta: (chunk: string, full: string) => void;
  onMeta?: (meta: any) => void;
}

/** 页面提供的请求函数：统一签名，内部决定调哪个后端 */
export type ChatRequestFn = (
  history: ChatHistoryEntry[],
  question: string,
  opts: ChatRequestOptions
) => Promise<{ text: string; disclaimer?: string }>;

export interface ChatPersist {
  load: () => ChatMessage[] | null;
  save: (messages: ChatMessage[]) => void;
  clear: () => void;
}

export interface UseChatConfig {
  request: ChatRequestFn;
  initialMessages?: ChatMessage[];
  persist?: ChatPersist;
  /** 持久化节流（ms），默认 1000 */
  persistThrottleMs?: number;
  /** 流式过程中对 full 文本做清洗/去重（如首页五层防御的前三层） */
  transformStreaming?: (full: string) => string;
  /** 流结束后对最终文本做最终+跨轮去重（hook 维护 prevAiTextRef 供跨轮比对） */
  dedupCommit?: (cleaned: string, prevAcc: string) => string;
  /** 请求时最多带多少条 history（0 = 不限制）；默认 0 */
  maxHistory?: number;
  /** 发送前钩子：清 CTA、触发游戏化等 */
  onSend?: (question: string) => void;
  /** 单轮提交完成钩子 */
  onCommitted?: (finalText: string) => void;
  /** 后端 meta 事件钩子（首页 CTA 等） */
  onMeta?: (meta: any) => void;
}

export interface UseChatResult {
  messages: ChatMessage[];
  input: string;
  setInput: (v: string) => void;
  send: (text?: string) => void;
  streaming: boolean;
  stop: () => void;
  clear: () => void;
  /** 从外部（如持久化快照）灌入消息，并重建跨轮去重基线；用于刷新/路由回跳后恢复对话 */
  hydrate: (messages: ChatMessage[]) => void;
  scrollRef: (node: HTMLDivElement | null) => void;
  hydrated: boolean;
}

let _uid = 0;
function uid(prefix = 'm'): string {
  _uid += 1;
  return `${prefix}_${Date.now().toString(36)}_${_uid}`;
}

export function useChat(config: UseChatConfig): UseChatResult {
  const {
    request,
    initialMessages,
    persist,
    persistThrottleMs = 1000,
    transformStreaming,
    dedupCommit,
    onSend,
    onCommitted,
    onMeta,
    maxHistory = 0,
  } = config;

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? []);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [hydrated, setHydrated] = useState(!persist);

  const { ref: scrollRef, scrollToBottom } = useAutoScroll<HTMLDivElement>([messages, streaming]);

  const messagesRef = useRef<ChatMessage[]>(initialMessages ?? []);
  const prevAiTextRef = useRef('');
  const abortRef = useRef<AbortController | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 恢复持久化
  useEffect(() => {
    if (!persist) return;
    const loaded = persist.load();
    if (loaded && loaded.length) {
      messagesRef.current = loaded;
      setMessages(loaded);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist]);

  // 持久化（节流）：流式期间不写，避免每个 chunk 都刷 localStorage
  useEffect(() => {
    if (!persist || !hydrated || streaming) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      persist.save(messagesRef.current);
    }, persistThrottleMs);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [messages, persist, hydrated, streaming, persistThrottleMs]);

  const send = useCallback(
    async (text?: string) => {
      const q = (text ?? input).trim();
      if (!q || streaming) return;
      onSend?.(q);

      const userMsg: ChatMessage = { id: uid('u'), role: 'user', content: q };
      const assistantMsg: ChatMessage = { id: uid('a'), role: 'assistant', content: '', streaming: true };
      const next = [...messagesRef.current, userMsg, assistantMsg];
      messagesRef.current = next;
      setMessages(next);
      setInput('');
      setStreaming(true);
      // 用户主动发问 → 无条件恢复跟随（上一轮若手动上滑暂停过）
      scrollToBottom();

      const controller = new AbortController();
      abortRef.current = controller;
      // 传给后端的 history：不含末尾空 assistant / welcome / 空内容；
      // 首条必须是 user（避免 assistant 开头让模型困惑）；超长则截断尾部
      let history: ChatHistoryEntry[] = next
        .slice(0, -1)
        .filter((m) => m.content && !m.welcome)
        .map((m) => ({ role: m.role, content: m.content }));
      while (history.length && history[0].role !== 'user') history = history.slice(1);
      if (maxHistory && history.length > maxHistory) {
        history = history.slice(history.length - maxHistory);
        while (history.length && history[0].role !== 'user') history = history.slice(1);
      }

      try {
        await request(history, q, {
          signal: controller.signal,
          onDelta: (_chunk, full) => {
            const cleaned = transformStreaming ? transformStreaming(full) : full;
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.role === 'assistant') {
                copy[copy.length - 1] = { ...last, content: cleaned };
              }
              return copy;
            });
          },
          onMeta: (m) => onMeta?.(m),
        });
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.role === 'assistant') {
              copy[copy.length - 1] = {
                ...last,
                content: '⚠️ 暂时不可用，请稍后再试。',
                streaming: false,
              };
            }
            return copy;
          });
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === 'assistant') {
            let cleaned = last.content;
            if (dedupCommit) cleaned = dedupCommit(cleaned, prevAiTextRef.current);
            if (cleaned) {
              prevAiTextRef.current += (prevAiTextRef.current ? '\n\n' : '') + cleaned;
            }
            copy[copy.length - 1] = { ...last, content: cleaned, streaming: false };
            onCommitted?.(cleaned);
          }
          messagesRef.current = copy;
          return copy;
        });
      }
    },
    [request, input, streaming, transformStreaming, dedupCommit, onSend, onMeta, onCommitted, scrollToBottom]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    messagesRef.current = [];
    prevAiTextRef.current = '';
    setMessages([]);
    setInput('');
    setStreaming(false);
    persist?.clear();
  }, [persist]);

  // 卸载时中断在途请求，避免向已卸载组件写状态
  useEffect(() => () => abortRef.current?.abort(), []);

  /** 从外部灌入消息（恢复持久化 / 重置欢迎语），重建跨轮去重基线 */
  const hydrate = useCallback((msgs: ChatMessage[]) => {
    messagesRef.current = msgs;
    prevAiTextRef.current = msgs
      .filter((m) => m.role === 'assistant' && m.content)
      .map((m) => m.content)
      .join('\n\n');
    setMessages(msgs);
  }, []);

  return { messages, input, setInput, send, streaming, stop, clear, hydrate, scrollRef, hydrated };
}
