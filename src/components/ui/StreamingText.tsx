'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * 流式文本组件 — 逐字渐进显示文本，模拟 AI 流式输出效果
 * 文本到达后立即开始流式显示，避免长时间空白等待
 */
interface StreamingTextProps {
  text: string;
  speed?: number; // 每帧追加字符数，默认 2
  className?: string;
  /** 是否显示打字光标 */
  cursor?: boolean;
  onComplete?: () => void;
}

export function StreamingText({ text, speed = 2, className, cursor = true, onComplete }: StreamingTextProps) {
  const [displayed, setDisplayed] = useState('');
  const doneRef = useRef(false);

  useEffect(() => {
    setDisplayed('');
    doneRef.current = false;
    if (!text) return;

    let i = 0;
    const timer = setInterval(() => {
      i += speed;
      const chunk = text.slice(0, i);
      setDisplayed(chunk);
      if (i >= text.length) {
        clearInterval(timer);
        doneRef.current = true;
        onComplete?.();
      }
    }, 16); // ~60fps

    return () => clearInterval(timer);
  }, [text, speed]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDone = displayed.length >= text.length && text.length > 0;

  return (
    <span className={className}>
      {displayed}
      {cursor && !isDone && <span className="stream-cursor">▌</span>}
    </span>
  );
}

/**
 * 流式段落组件 — 支持多段文本流式输出
 * 每段文本依次流式显示，前一段完成后才开始下一段
 */
interface StreamingSectionProps {
  title: string;
  text: string;
  /** 前一段是否已完成（控制本段是否开始流式） */
  canStart: boolean;
  onComplete: () => void;
  speed?: number;
}

export function StreamingSection({ title, text, canStart, onComplete, speed = 2 }: StreamingSectionProps) {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (canStart && !started) setStarted(true);
  }, [canStart, started]);

  if (!canStart) {
    return (
      <div className="interpret-section stream-pending">
        <div className="is-title">{title}</div>
        <div className="is-text stream-placeholder">
          <span className="stream-dots"><span>.</span><span>.</span><span>.</span></span>
        </div>
      </div>
    );
  }

  return (
    <div className="interpret-section">
      <div className="is-title">{title}</div>
      <div className="is-text">
        <StreamingText text={text} speed={speed} onComplete={onComplete} />
      </div>
    </div>
  );
}

/**
 * 流式列表组件 — 逐条显示列表项
 */
interface StreamingListProps {
  title: string;
  items: string[];
  canStart: boolean;
  onComplete: () => void;
  speed?: number;
}

export function StreamingList({ title, items, canStart, onComplete, speed = 2 }: StreamingListProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [showCursor, setShowCursor] = useState(false);

  useEffect(() => {
    if (!canStart || items.length === 0) return;
    setVisibleCount(0);
    setCurrentText('');
    setShowCursor(true);
  }, [canStart, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!canStart) {
    return (
      <div className="adv-block stream-pending">
        <div className="adv-title">{title}</div>
        <div className="stream-placeholder">
          <span className="stream-dots"><span>.</span><span>.</span><span>.</span></span>
        </div>
      </div>
    );
  }

  // 流式显示当前条目文本
  const fullItem = items[visibleCount] || '';
  const isCurrentDone = currentText.length >= fullItem.length && fullItem.length > 0;

  if (!isCurrentDone && showCursor) {
    // 逐字增加当前条目文本
    const timer = setTimeout(() => {
      const nextLen = Math.min(currentText.length + speed, fullItem.length);
      setCurrentText(fullItem.slice(0, nextLen));
      if (nextLen >= fullItem.length) {
        setShowCursor(false);
      }
    }, 16);
    // 防止 effect 依赖问题，用 setTimeout 代替
    if (currentText !== fullItem.slice(0, currentText.length)) {
      // noop
    }
  }

  const handleNext = () => {
    if (visibleCount < items.length - 1) {
      setVisibleCount(visibleCount + 1);
      setCurrentText('');
      setShowCursor(true);
    } else {
      onComplete?.();
    }
  };

  // 使用 StreamingText 来流式显示当前条目
  const currentFullItem = items[visibleCount] || '';

  return (
    <div className="adv-block">
      <div className="adv-title">{title}</div>
      <ul>
        {items.slice(0, visibleCount).map((item, i) => (
          <li key={i}>{item}</li>
        ))}
        {visibleCount < items.length && (
          <li key={visibleCount}>
            <StreamingText
              text={currentFullItem}
              speed={speed}
              cursor={true}
              onComplete={handleNext}
            />
          </li>
        )}
      </ul>
    </div>
  );
}

export default StreamingText;
