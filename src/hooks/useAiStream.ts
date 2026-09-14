'use client';

import { useCallback, useRef, useState } from 'react';

export type StreamStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error';

export interface AiStreamCallbacks<TMeta = unknown> {
  signal: AbortSignal;
  onDelta: (fullSoFar: string) => void;
  onMeta?: (meta: TMeta, disclaimer: string | undefined, finalText: string) => void;
}

export interface AiStreamResult<TMeta = unknown> {
  text: string;
  disclaimer?: string;
  meta?: TMeta;
}

export type AiStreamFetcher<TMeta = unknown> = (
  cb: AiStreamCallbacks<TMeta>
) => Promise<AiStreamResult<TMeta>>;

export interface UseAiStreamConfig<TMeta = unknown> {
  /** 业务侧 fetcher：内部调用对应 requestXxxStream，把 onDelta/onMeta/signal 透传 */
  fetcher: AiStreamFetcher<TMeta>;
  /** 流式过程中对 full 文本做清洗（如首页五层防御的前三层） */
  transformStreaming?: (full: string) => string;
  /** 流结束回调（最终文本 + meta） */
  onDone?: (text: string, meta: TMeta | undefined) => void;
}

export interface UseAiStreamReturn<TMeta = unknown> {
  status: StreamStatus;
  displayText: string;
  fullText: string;
  disclaimer: string;
  meta: TMeta | undefined;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

/**
 * 统一 AI 流式状态机。
 * 此前各页各自重写「requestXxxStream → onDelta 累计 → AbortController 竞态 →
 * loading/streaming/done/error」逻辑（约 9 处），现收敛到此 hook：
 * - 内置请求竞态保护（reqId + AbortController），快速切换维度不会两路流打架
 * - 统一的 status 机 + displayText（清洗后）/fullText（原始）双轨
 * - 卸载/重开自动 abort，避免向已卸载组件 setState
 *
 * 业务侧只需提供一个 fetcher，把底层 requestXxxStream 的 onDelta/onMeta/signal 透传即可。
 */
export function useAiStream<TMeta = unknown>(
  config: UseAiStreamConfig<TMeta>
): UseAiStreamReturn<TMeta> {
  const { fetcher, transformStreaming, onDone } = config;
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [displayText, setDisplayText] = useState('');
  const [fullText, setFullText] = useState('');
  const [disclaimer, setDisclaimer] = useState('');
  const [meta, setMeta] = useState<TMeta | undefined>(undefined);

  const abortRef = useRef<AbortController | null>(null);
  const reqIdRef = useRef(0);
  const fullTextRef = useRef('');

  const applyDisplay = useCallback(
    (raw: string) => {
      const t = transformStreaming ? transformStreaming(raw) : raw;
      setDisplayText(t);
      return t;
    },
    [transformStreaming]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    reqIdRef.current += 1;
    setStatus('idle');
    setDisplayText('');
    setFullText('');
    setDisclaimer('');
    setMeta(undefined);
    fullTextRef.current = '';
  }, []);

  const start = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const reqId = ++reqIdRef.current;

    setStatus('loading');
    setDisplayText('');
    setFullText('');
    setDisclaimer('');
    setMeta(undefined);
    fullTextRef.current = '';

    const stale = () => ctrl.signal.aborted || reqId !== reqIdRef.current;

    try {
      const res = await fetcher({
        signal: ctrl.signal,
        onDelta: (fullSoFar) => {
          if (stale()) return;
          fullTextRef.current = fullSoFar;
          setStatus((s) => (s === 'loading' ? 'streaming' : s));
          applyDisplay(fullSoFar);
        },
        onMeta: (m, d, finalText) => {
          if (stale()) return;
          if (d) setDisclaimer(d);
          if (finalText) {
            fullTextRef.current = finalText;
            setFullText(finalText);
            applyDisplay(finalText);
          }
          setMeta(m);
        },
      });
      if (stale()) return;
      const finalText = res.text ?? fullTextRef.current;
      fullTextRef.current = finalText;
      setFullText(finalText);
      applyDisplay(finalText);
      if (res.disclaimer) setDisclaimer(res.disclaimer);
      if (res.meta !== undefined) setMeta(res.meta);
      setStatus('done');
      onDone?.(finalText, res.meta);
    } catch {
      if (stale()) return;
      setStatus('error');
    }
  }, [fetcher, applyDisplay, onDone]);

  return { status, displayText, fullText, disclaimer, meta, start, stop, reset };
}
