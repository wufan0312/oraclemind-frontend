// ============================================================================
// 玄镜 OracleMind · 环境声景引擎（纯 Web Audio 合成，无需音频素材）
// 用于：冥想背景声、助眠白噪音、睡前声景。
// 生成类型：white(白噪) / pink(粉噪) / brown(棕噪·雨感) / rain(雨声) /
//          ocean(海浪) / bowl(颂钵) / none(静音)
// ============================================================================

export type AmbientType = 'none' | 'white' | 'pink' | 'brown' | 'rain' | 'ocean' | 'bowl';

export interface AmbientHandle {
  stop: () => void;
  setVolume: (v: number) => void;
  /** 在指定秒数后平滑淡出并停止（助眠定时用） */
  fadeOutAndStop: (seconds: number) => void;
}

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || null;
}

/** 生成 2 秒循环噪音缓冲 */
function makeNoiseBuffer(ctx: AudioContext, kind: 'white' | 'pink' | 'brown'): AudioBuffer {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  if (kind === 'white') {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  } else if (kind === 'pink') {
    // 近似粉噪：白噪经一阶低通累加
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = 0.98 * last + 0.02 * white;
      data[i] = last * 3.2;
    }
  } else {
    // 棕噪：积分白噪，听感低沉如远雷/雨幕
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }
  return buf;
}

export function startAmbient(type: AmbientType, initialVolume = 0.3): AmbientHandle | null {
  if (type === 'none') return null;
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;

  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = initialVolume;
  master.connect(ctx.destination);

  const stoppers: (() => void)[] = [];
  const oscillators: OscillatorNode[] = [];

  const startNoise = (kind: 'white' | 'pink' | 'brown', gain: number, filter?: BiquadFilterType, freq?: number) => {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, kind);
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = gain;
    let node: AudioNode = src;
    if (filter && freq) {
      const f = ctx.createBiquadFilter();
      f.type = filter;
      f.frequency.value = freq;
      src.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(master);
    src.start();
    stoppers.push(() => { try { src.stop(); } catch { /* */ } });
  };

  if (type === 'white') {
    startNoise('white', 0.5);
  } else if (type === 'pink') {
    startNoise('pink', 0.7);
  } else if (type === 'brown') {
    startNoise('brown', 0.9);
  } else if (type === 'rain') {
    // 棕噪打底 + 少量白噪高频做雨丝
    startNoise('brown', 0.7);
    startNoise('white', 0.08, 'highpass', 1200);
  } else if (type === 'ocean') {
    // 棕噪 + 慢速幅度起伏（海浪）
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, 'brown');
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0.8;
    src.connect(g);
    g.connect(master);
    // LFO 调制音量模拟潮汐
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.5;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    src.start();
    lfo.start();
    stoppers.push(() => { try { src.stop(); } catch { /* */ } try { lfo.stop(); } catch { /* */ } });
  } else if (type === 'bowl') {
    // 颂钵：基频 + 谐波 + 轻微失谐泛音 + 慢速颤音
    const freqs = [110, 110 * 2.01, 164.81, 220];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.18 / (i + 1);
      const trem = ctx.createOscillator();
      trem.frequency.value = 0.12 + i * 0.03;
      const tremGain = ctx.createGain();
      tremGain.gain.value = 0.06;
      trem.connect(tremGain);
      tremGain.connect(g.gain);
      osc.connect(g);
      g.connect(master);
      osc.start();
      trem.start();
      oscillators.push(osc, trem);
    });
  }

  // 浏览器自动播放策略：用户手势触发后 resume
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);

  return {
    stop: () => {
      stoppers.forEach((s) => s());
      oscillators.forEach((o) => { try { o.stop(); } catch { /* */ } });
      void ctx.close().catch(() => undefined);
    },
    setVolume: (v: number) => {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), t, 0.05);
    },
    fadeOutAndStop: (seconds: number) => {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0.0001, t + Math.max(1, seconds));
      window.setTimeout(() => {
        stoppers.forEach((s) => s());
        oscillators.forEach((o) => { try { o.stop(); } catch { /* */ } });
        void ctx.close().catch(() => undefined);
      }, Math.max(1, seconds) * 1000 + 200);
    },
  };
}
