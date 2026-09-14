'use client';

/**
 * 语音输入封装（语音录梦）
 * --------------------------------------------------------------------------
 * 基于浏览器原生 Web Speech API（SpeechRecognition），零后端、零依赖。
 * 兼容性：Chrome / Edge / 新版 Safari 支持；Firefox 默认不支持 → 走降级提示。
 *
 * 用法：createSpeechRecognizer({ onFinal, onInterim, onError, onEnd })
 *      识别到的 final 片段通过 onFinal 抛出（不自动拼接，由调用方决定）。
 */

// 浏览器原生类型未进 TS 标准库，这里做最小声明（避免 any 泛滥）
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechResultEventLike) => void) | null;
  onerror: ((e: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechResultEventLike {
  resultIndex: number;
  results: {
    length: number;
    [i: number]: {
      isFinal: boolean;
      length: number;
      [j: number]: { transcript: string; confidence: number };
    };
  };
}

type SpeechCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition as SpeechCtor) || (w.webkitSpeechRecognition as SpeechCtor) || null;
}

/** 当前浏览器是否支持语音识别 */
export function isSpeechSupported(): boolean {
  return getCtor() !== null;
}

export interface SpeechHandlers {
  /** 一段已确认文本（可直接追加） */
  onFinal?: (text: string) => void;
  /** 实时未确认文本（用于字幕预览，不应追加） */
  onInterim?: (text: string) => void;
  /** 出错（not-allowed = 用户拒绝麦克风权限） */
  onError?: (err: string) => void;
  /** 识别结束（无论正常或异常） */
  onEnd?: () => void;
  /** 识别真正开始 */
  onStart?: () => void;
}

export interface SpeechHandle {
  stop: () => void;
}

/** 创建并开始一次连续识别；返回句柄可主动 stop */
export function createSpeechRecognizer(handlers: SpeechHandlers = {}): SpeechHandle | null {
  const Ctor = getCtor();
  if (!Ctor) {
    handlers.onError?.('unsupported');
    return null;
  }

  const rec = new Ctor();
  rec.lang = 'zh-CN';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  rec.onstart = () => handlers.onStart?.();

  rec.onresult = (e: SpeechResultEventLike) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const t = r[0]?.transcript || '';
      if (r.isFinal) {
        handlers.onFinal?.(t);
      } else {
        interim += t;
      }
    }
    // 未确认片段整体回传（覆盖式，调用方只做展示）
    handlers.onInterim?.(interim);
  };

  rec.onerror = (e) => {
    handlers.onError?.(e.error || 'unknown');
  };

  rec.onend = () => handlers.onEnd?.();

  try {
    rec.start();
  } catch {
    handlers.onError?.('start-failed');
    return null;
  }

  return { stop: () => rec.stop() };
}

/** 错误码 → 中文提示 */
export function speechErrorText(err: string): string {
  switch (err) {
    case 'unsupported':
      return '当前浏览器不支持语音识别，建议用 Chrome / Edge，或直接手写记录';
    case 'not-allowed':
    case 'service-not-allowed':
      return '麦克风权限被拒绝，请在浏览器地址栏允许麦克风后重试';
    case 'no-speech':
      return '没听到声音，再说一次试试';
    case 'network':
      return '语音识别服务不可用（需联网），请改用文字记录';
    case 'audio-capture':
      return '找不到麦克风设备';
    default:
      return '语音识别中断，请重试或改用文字记录';
  }
}
