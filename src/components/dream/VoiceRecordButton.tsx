'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  createSpeechRecognizer,
  isSpeechSupported,
  speechErrorText,
  type SpeechHandle,
} from '@/lib/speechInput';

/**
 * 语音录梦按钮 —— 点击开始说话，识别文本实时追加到父级输入框（可继续编辑后保存）。
 * 基于浏览器原生 Web Speech API，不支持的浏览器给出降级提示。
 */
export default function VoiceRecordButton({
  onAppend,
  className = '',
}: {
  onAppend: (delta: string) => void;
  className?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const handle = useRef<SpeechHandle | null>(null);

  useEffect(() => {
    setSupported(isSpeechSupported());
    return () => {
      // 卸载时确保停止识别，避免麦克风常驻
      handle.current?.stop();
      handle.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    handle.current?.stop();
    handle.current = null;
    setListening(false);
    setInterim('');
  }, []);

  const start = useCallback(() => {
    setError(null);
    const h = createSpeechRecognizer({
      onStart: () => setListening(true),
      onFinal: (text) => {
        const t = text.trim();
        if (t) onAppend(t);
        setInterim('');
      },
      onInterim: (text) => setInterim(text),
      onError: (err) => {
        // 无语音不视为错误中断，仅提示
        if (err === 'no-speech') return;
        setError(speechErrorText(err));
        handle.current = null;
        setListening(false);
        setInterim('');
      },
      onEnd: () => {
        handle.current = null;
        setListening(false);
        setInterim('');
      },
    });
    if (!h) {
      setError(speechErrorText('unsupported'));
      return;
    }
    handle.current = h;
  }, [onAppend]);

  return (
    <div className={'voice-record ' + className}>
      <button
        type="button"
        className={'voice-record-btn' + (listening ? ' listening' : '')}
        onClick={() => (listening ? stop() : start())}
        disabled={!supported}
        title={supported ? '点击说话记录梦境' : '当前浏览器不支持语音识别'}
      >
        {listening ? '⏹ 停止录音' : '🎤 语音录梦'}
      </button>

      {listening && (
        <div className="voice-live">
          <span className="voice-dot" aria-hidden />
          <span className="voice-live-text">正在聆听…</span>
          {interim && <span className="voice-interim">{interim}</span>}
        </div>
      )}

      {!supported && (
        <div className="voice-tip">当前浏览器不支持语音识别，建议用 Chrome / Edge，或直接手写记录</div>
      )}
      {error && <div className="voice-err">{error}</div>}
    </div>
  );
}
