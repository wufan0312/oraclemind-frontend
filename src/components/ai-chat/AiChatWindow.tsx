'use client';

import '@/components/ai-chat/AiChatWindow.scss';
/**
 * AiChatWindow —— 全站统一的「完整多轮对话窗口」组件
 * --------------------------------------------------------------------------
 * 形态特征：顶栏（图标 + 标题 + 在线状态）+ 消息列表（头像气泡）+ 输入栏
 * 适用范围：Dream 解梦聊天、首页通用命理助手 等「不依赖前置测算结果也能开聊」的对话窗口。
 * 不适用：结果区 AI 解读面板（MingAIPanel / AIInterpretation）、
 *        LightFollowUp 轻量追问条、Tarot 紧凑追问区。
 *
 * 所有数据/持久化/上下文由调用方管理，本组件只负责渲染壳。
 */

import { useState, type ReactNode, type Ref } from 'react';
import { AiAvatar } from '@/components/ui/AIInterpretation';

export interface QuickPrompt {
  emoji?: string;
  label: string;
  kw: string;
  title?: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  /** 气泡上方的徽章：例如「正在生成」「📖 本地词库」「🧠 荣格」 */
  tag?: ReactNode;
  /** 标记为「欢迎消息」：气泡加宽 + 渐变描边，下方自动挂载 quickPrompts */
  welcome?: boolean;
  /** 欢迎消息下方的快捷胶囊（仅 welcome=true 时显示） */
  quickPrompts?: QuickPrompt[];
  /** content 的渲染格式：默认 'markdown'，'html' 时 renderContent 直接渲染 content */
  contentFormat?: 'html' | 'markdown';
}

export interface AiChatWindowProps {
  /** 顶栏标题 */
  title: string;
  /** 在线状态文案，默认「小玄在线」 */
  status?: string;
  /** 顶栏图标 URL */
  iconSrc?: string;
  /** 消息列表 */
  messages: AiChatMessage[];
  /** 是否显示「✕ 新对话」按钮：默认 messages 中存在非 welcome 消息即显示 */
  showClear?: boolean;
  /** 点击清空按钮 */
  onClear?: () => void;

  /** 输入框受控值 */
  input: string;
  /** 输入框变化 */
  onInputChange: (v: string) => void;
  /** 触发发送（回车或点击发送按钮均会调） */
  onSend: () => void;
  inputPlaceholder?: string;
  inputDisabled?: boolean;

  /** 渲染气泡正文（默认 mdToHtml 风格的调用方已在外层处理） */
  renderContent: (msg: AiChatMessage) => ReactNode;
  /** AI 头像：默认小玄 spirit_avatar.png */
  renderAiAvatar?: (msg: AiChatMessage) => ReactNode;
  /** 用户头像：默认 🧑 */
  renderUserAvatar?: (msg: AiChatMessage) => ReactNode;
  /** 快捷胶囊点击回调 */
  onQuickPrompt?: (prompt: QuickPrompt) => void;

  /** 容器 ref，用于自动贴底（兼容 callback ref / useRef ref） */
  scrollRef?: Ref<HTMLDivElement>;

  /** 顶栏右侧额外内容（如 dream 的「✕ 新对话」按钮） */
  headerExtra?: ReactNode;
  /** 消息列表上方额外内容（如首页的「已恢复上次对话」提示条） */
  aboveMessages?: ReactNode;
  /** 消息列表下方、输入栏上方的额外内容（如首页的「5 个建议 chip」） */
  belowMessages?: ReactNode;

  /** 外层容器额外 className（如 margin-top） */
  className?: string;
}

export default function AiChatWindow({
  title,
  status = '小玄在线',
  iconSrc = '/images/spirit_avatar.png',
  messages,
  showClear,
  onClear,
  input,
  onInputChange,
  onSend,
  inputPlaceholder = '说说你在想的事…',
  inputDisabled,
  renderContent,
  renderAiAvatar,
  renderUserAvatar,
  onQuickPrompt,
  scrollRef,
  headerExtra,
  aboveMessages,
  belowMessages,
  className,
}: AiChatWindowProps) {
  const [localInputFocused, setLocalInputFocused] = useState(false);

  // 默认清空按钮可见性：messages 中存在非 welcome 消息
  const computedShowClear = showClear ?? messages.some((m) => !m.welcome);

  return (
    <div className={['ai-chat-window', className].filter(Boolean).join(' ')}>
      <div className="ai-chat-header">
        <div className="ai-chat-header-left">
          {/* {iconSrc && <img className="ai-chat-icon" src={iconSrc} alt="" />} */}
          <AiAvatar />
          <span className="ai-chat-title">{title}</span>
          {status && (
            <span className="ai-chat-status">
              <span className="ai-chat-status-dot" />
              {status}
            </span>
          )}
        </div>
        <div className="ai-chat-header-right">
          {headerExtra}
          {computedShowClear && onClear && (
            <button type="button" className="ai-chat-clear-btn" onClick={onClear} title="清空对话，重新开始">
              ✕ 新对话
            </button>
          )}
        </div>
      </div>

      {aboveMessages}

      <div className="ai-chat-messages" ref={scrollRef}>
        {messages.map((msg) => {
          const isAssistant = msg.role === 'assistant';
          const avatar = isAssistant
            ? (renderAiAvatar ? renderAiAvatar(msg) : <img src="/images/spirit_avatar.png" alt="小玄" />)
            : (renderUserAvatar ? renderUserAvatar(msg) : '🧑');
          return (
            <div
              key={msg.id}
              className={`ai-chat-msg ${msg.role}${msg.welcome ? ' is-welcome' : ''}`}
            >
              {/* <div className="ai-chat-avatar">{avatar}</div> */}
              <div className={`ai-chat-bubble${msg.streaming ? ' streaming' : ''}`}>
                {msg.tag}
                {renderContent(msg)}
                {msg.welcome && msg.quickPrompts && msg.quickPrompts.length > 0 && (
                  <div className="ai-chat-quickprompts">
                    {msg.quickPrompts.map((p) => (
                      <button
                        key={p.kw}
                        type="button"
                        className="ai-chat-quickchip"
                        onClick={() => onQuickPrompt?.(p)}
                        title={p.title || `让小玄聊聊「${p.label}」`}
                      >
                        {p.emoji && <span className="ai-chat-quickchip-emoji">{p.emoji}</span>}
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {belowMessages}

      <div className="ai-chat-input-bar">
        <div className="chat-pill">
          <input
            className="ai-chat-input field-pill"
            placeholder={inputPlaceholder}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onFocus={() => setLocalInputFocused(true)}
            onBlur={() => setLocalInputFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !inputDisabled && input.trim()) {
                e.preventDefault();
                onSend();
              }
            }}
            disabled={inputDisabled}
            aria-label={inputPlaceholder}
          />
          <button
            type="button"
            className="ai-send-btn chat-send-btn"
            onClick={onSend}
            disabled={inputDisabled || !input.trim()}
            aria-label="发送"
            title={localInputFocused ? '' : '发送'}
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
        </div>
      </div>
    </div>
  );
}