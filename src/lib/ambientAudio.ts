// ============================================================================
// 玄镜 OracleMind · 环境声景引擎（纯 Web Audio 合成，无需音频素材）
// 用于：冥想背景声、助眠白噪音、睡前声景。
// 生成类型：white(白噪) / pink(粉噪) / brown(棕噪·雨感) / rain(雨声) /
//          ocean(海浪) / bowl(颂钵) / none(静音)
//
// 音质要点（避免"难听"）：
//  - 噪音缓冲首尾淡变 + 4 秒长度，消除循环接缝爆音
//  - 启动时整体淡入，消除开头"啪"声
//  - 各噪声经低通，去掉刺耳高频嘶嘶
//  - 颂钵为 OM 基音呼吸 + 周期性轻敲衰减包络，而非持续嗡鸣
//  - 海浪增益受控不溢出失真
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

/** 生成 4 秒循环噪音缓冲，首尾各 100ms 线性淡变，消除循环接缝爆音 */
function makeNoiseBuffer(ctx: AudioContext, kind: 'white' | 'pink' | 'brown'): AudioBuffer {
  const len = ctx.sampleRate * 4;
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
  // 首尾淡变（消除循环爆音）
  const fade = Math.min(len - 1, Math.floor(ctx.sampleRate * 0.1));
  for (let i = 0; i < fade; i++) {
    const w = i / fade;
    data[i] *= w;
    data[len - 1 - i] *= w;
  }
  return buf;
}

export function startAmbient(type: AmbientType, initialVolume = 0.3): AmbientHandle | null {
  if (type === 'none') return null;
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;

  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0; // 启动淡入，避免开头爆音
  master.connect(ctx.destination);

  const stoppers: (() => void)[] = [];

  // 通用噪声源：4 秒缓冲循环 + 可选低通
  const startNoise = (kind: 'white' | 'pink' | 'brown', gain: number, lowpassFreq?: number) => {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, kind);
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = gain;
    let node: AudioNode = src;
    if (lowpassFreq) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpassFreq;
      src.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(master);
    src.start();
    stoppers.push(() => { try { src.stop(); } catch { /* */ } });
  };

  // 带链式滤波的噪声（用于雨丝：高通取高频 + 低通限顶）
  const startFilteredNoise = (
    kind: 'white' | 'pink' | 'brown',
    gain: number,
    filters: { type: BiquadFilterType; freq: number }[],
  ) => {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, kind);
    src.loop = true;
    let node: AudioNode = src;
    const chain: BiquadFilterNode[] = [];
    for (const flt of filters) {
      const f = ctx.createBiquadFilter();
      f.type = flt.type;
      f.frequency.value = flt.freq;
      node.connect(f);
      node = f;
      chain.push(f);
    }
    const g = ctx.createGain();
    g.gain.value = gain;
    node.connect(g);
    g.connect(master);
    src.start();
    stoppers.push(() => { try { src.stop(); } catch { /* */ } });
  };

  if (type === 'white') {
    startNoise('white', 0.3, 7000); // 低通去刺耳高频
  } else if (type === 'pink') {
    startNoise('pink', 0.55, 6000);
  } else if (type === 'brown') {
    startNoise('brown', 0.6, 500); // 低沉柔和
  } else if (type === 'rain') {
    // 棕噪打底（雨幕） + 细窄高频雨丝
    startNoise('brown', 0.42, 500);
    startFilteredNoise('white', 0.04, [
      { type: 'highpass', freq: 1800 },
      { type: 'lowpass', freq: 9000 },
    ]);
  } else if (type === 'ocean') {
    // 棕噪 + 慢速幅度起伏（海浪），增益受控不溢出
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, 'brown');
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 450;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    src.connect(lp);
    lp.connect(g);
    g.connect(master);
    // LFO 调制音量模拟潮汐（0.5 ± 0.18，不会超过 1）
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.1;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.18;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    src.start();
    lfo.start();
    stoppers.push(() => { try { src.stop(); } catch { /* */ } try { lfo.stop(); } catch { /* */ } });
  } else if (type === 'bowl') {
    // 颂钵：OM 基音（136.1Hz）呼吸式延续 + 周期性轻敲衰减泛音
    const baseFreqs = [136.1, 272.2];
    const baseGains = [0.09, 0.035];
    baseFreqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = baseGains[i];
      // 呼吸 LFO（缓慢起伏，似钵的余韵呼吸）
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = baseGains[i] * 0.5;
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);
      osc.connect(g);
      g.connect(master);
      osc.start();
      lfo.start();
      stoppers.push(() => { try { osc.stop(); } catch { /* */ } try { lfo.stop(); } catch { /* */ } });
    });
    // 周期性轻敲：高泛音短促包络（attack 快 + 指数衰减），模拟钵被轻击
    const strike = () => {
      const t = ctx.currentTime;
      [543, 815, 1088].forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05 / (i + 1), t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 2.4);
      });
    };
    strike();
    const strikeId = window.setInterval(strike, 7000);
    stoppers.push(() => window.clearInterval(strikeId));
  }

  // 浏览器自动播放策略：用户手势触发后 resume
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);

  // 整体淡入到目标音量（0.25s 时间常数），消除启动爆音
  const t0 = ctx.currentTime;
  master.gain.cancelScheduledValues(t0);
  master.gain.setValueAtTime(0, t0);
  master.gain.setTargetAtTime(Math.max(0, Math.min(1, initialVolume)), t0, 0.25);

  return {
    stop: () => {
      stoppers.forEach((s) => s());
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
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
      master.gain.linearRampToValueAtTime(0.0001, t + Math.max(1, seconds));
      window.setTimeout(() => {
        stoppers.forEach((s) => s());
        void ctx.close().catch(() => undefined);
      }, Math.max(1, seconds) * 1000 + 200);
    },
  };
}
