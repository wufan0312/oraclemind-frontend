'use client';

import { useChat } from '@/hooks/useChat';
import AiChatWindow from '@/components/ai-chat/AiChatWindow';
import { requestGenericChatStream } from '@/lib/api';
import { mdToHtml } from '@/lib/markdown';
import { type HealingSave } from '@/data/healingData';

export interface XuanChatProps {
  save: HealingSave;
  onAddXp: (n: number, reason: string) => void;
  onChatCount: () => void;
  /** 对话模块名：healing / classics / meditation —— 透传给后端 chat/stream */
  module: string;
  title: string;
  status: string;
  greeting: string;
  suggestions: { q: string }[];
  placeholder: string;
  belowText: string;
}

// ============================================================================
// 小玄对话（三版块共享）：参数化 module + 文案，复用同一套对话 UI
// ============================================================================
export function XuanChat({
  save, onAddXp, onChatCount, module, title, status, greeting, suggestions, placeholder, belowText,
}: XuanChatProps) {
  const {
    messages,
    input,
    setInput,
    send,
    streaming,
    stop,
    clear,
    scrollRef,
  } = useChat({
    request: async (history, question, opts) => {
      const res = await requestGenericChatStream(module, '', history, question, {
        signal: opts.signal,
        onDelta: opts.onDelta,
      });
      return { text: res.text };
    },
    initialMessages: [
      {
        id: 'xuan-welcome',
        role: 'assistant',
        content: greeting,
        welcome: true,
        quickPrompts: suggestions.map((s) => ({ label: s.q, kw: s.q })),
      },
    ],
    onSend: () => {
      if (!save.quests.chat) {
        onChatCount();
        onAddXp(2, '与小玄聊天');
      }
    },
  });

  return (
    <AiChatWindow
      title={title}
      status={status}
      messages={messages}
      input={input}
      onInputChange={setInput}
      onSend={send}
      inputPlaceholder={placeholder}
      inputDisabled={streaming}
      onClear={clear}
      onQuickPrompt={(p) => send(p.kw)}
      scrollRef={scrollRef}
      aboveMessages={
        streaming ? (
          <button
            type="button"
            className="ai-interp-stop-btn"
            onClick={stop}
            title="停止生成（保留已输出内容）"
          >
            ■ 停止生成
          </button>
        ) : null
      }
      belowMessages={
        <div className="xuan-chat-foot">{belowText}</div>
      }
      renderContent={(msg) => (
        <div dangerouslySetInnerHTML={{ __html: mdToHtml(msg.content) }} />
      )}
    />
  );
}
