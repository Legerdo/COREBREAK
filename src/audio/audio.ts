// Procedural Web Audio: every sound effect is synthesized, no sample files.
import { Music } from './music';

type Filt = BiquadFilterType;

interface ToneOpts {
  type?: OscillatorType;
  f0: number;
  f1?: number;
  dur: number;
  vol: number;
  attack?: number;
  at?: number;
  curve?: 'exp' | 'lin';
  dest?: AudioNode;
  detune?: number;
  vibrato?: number;
}

interface NoiseOpts {
  dur: number;
  vol: number;
  filter?: Filt;
  f0?: number;
  f1?: number;
  q?: number;
  attack?: number;
  at?: number;
  dest?: AudioNode;
}

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioSys {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  comp!: DynamicsCompressorNode;
  private noiseBuf!: AudioBuffer;
  private shaper!: WaveShaperNode;
  private last = new Map<string, number>();
  private pickupIdx = 0;
  private pickupAt = 0;
  private humNodes: { osc: OscillatorNode[]; g: GainNode } | null = null;
  music: Music | null = null;
  vol = { master: 0.8, music: 0.6, sfx: 0.8 };

  /** Must be called from a user gesture. Safe to call many times. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const ctx = this.ctx;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14;
      this.comp.knee.value = 10;
      this.comp.ratio.value = 5;
      this.comp.attack.value = 0.003;
      this.comp.release.value = 0.18;
      this.master = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfxBus.connect(this.comp);
      this.musicBus.connect(this.comp);
      this.comp.connect(this.master);
      this.master.connect(ctx.destination);
      const len = ctx.sampleRate * 2;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.shaper = ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        const x = (i / 1023) * 2 - 1;
        curve[i] = Math.tanh(x * 3.2);
      }
      this.shaper.curve = curve;
      this.shaper.connect(this.sfxBus);
      this.applyVolumes();
      this.music = new Music(this);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(master: number, music: number, sfx: number) {
    this.vol = { master, music, sfx };
    this.applyVolumes();
  }
  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.02);
  }

  private ok(key: string, gapMs: number): boolean {
    if (!this.ctx || this.ctx.state !== 'running') return false;
    const now = performance.now();
    const l = this.last.get(key) ?? 0;
    if (now - l < gapMs) return false;
    this.last.set(key, now);
    return true;
  }

  get t() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  tone(o: ToneOpts) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = o.at ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(Math.max(20, o.f0), t0);
    if (o.f1 !== undefined) {
      if (o.curve === 'lin') osc.frequency.linearRampToValueAtTime(Math.max(20, o.f1), t0 + o.dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + o.dur);
    }
    if (o.detune) osc.detune.value = o.detune;
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 6;
      lg.gain.value = o.vibrato;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + o.dur + 0.05);
    }
    const a = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g).connect(o.dest ?? this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
  }

  noise(o: NoiseOpts) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = o.at ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.filter ?? 'lowpass';
    f.frequency.setValueAtTime(o.f0 ?? 2000, t0);
    if (o.f1 !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.f1), t0 + o.dur);
    f.Q.value = o.q ?? 0.8;
    const g = ctx.createGain();
    const a = o.attack ?? 0.003;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f).connect(g).connect(o.dest ?? this.sfxBus);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + o.dur + 0.02);
  }

  // ------------------------------------------------------------ effects

  uiClick() {
    if (!this.ok('ui', 30)) return;
    this.tone({ type: 'square', f0: 900, f1: 1300, dur: 0.05, vol: 0.08 });
  }
  uiHover() {
    if (!this.ok('hover', 40)) return;
    this.tone({ type: 'triangle', f0: 1400, dur: 0.03, vol: 0.04 });
  }
  targetSelect() {
    if (!this.ok('target', 40)) return;
    this.tone({ type: 'square', f0: 620, f1: 940, dur: 0.07, vol: 0.07 });
    this.tone({ type: 'triangle', f0: 1240, dur: 0.06, vol: 0.05, at: this.t + 0.04 });
  }
  denied() {
    if (!this.ok('deny', 80)) return;
    this.tone({ type: 'square', f0: 180, f1: 140, dur: 0.1, vol: 0.06 });
  }
  leverPull() {
    if (!this.ok('lever', 60)) return;
    this.noise({ dur: 0.12, vol: 0.25, filter: 'bandpass', f0: 1200, f1: 400, q: 2 });
    this.tone({ type: 'square', f0: 220, f1: 90, dur: 0.14, vol: 0.12 });
    this.tone({ type: 'sine', f0: 90, f1: 50, dur: 0.18, vol: 0.4, at: this.t + 0.06 });
  }
  reelSpin(ms: number, fast = false) {
    const ctx = this.ctx;
    if (!ctx || !this.ok('spin', 50)) return;
    const n = Math.floor(ms / (fast ? 32 : 42));
    for (let i = 0; i < n; i++) {
      const at = ctx.currentTime + (i * ms) / 1000 / n;
      this.tone({ type: 'square', f0: 1500 + i * 25, dur: 0.018, vol: 0.035, at });
    }
  }
  reelStop(i: number, special = false) {
    if (!this.ok('stop' + i, 20)) return;
    this.noise({ dur: 0.06, vol: 0.3, filter: 'bandpass', f0: 2600, q: 3 });
    this.tone({ type: 'square', f0: 330 + i * 60, f1: 160, dur: 0.07, vol: 0.12 });
    this.tone({ type: 'sine', f0: 110, f1: 60, dur: 0.12, vol: 0.35 });
    if (special) this.tone({ type: 'triangle', f0: 880 + i * 220, dur: 0.18, vol: 0.12, at: this.t + 0.02 });
  }
  tease() {
    if (!this.ok('tease', 100)) return;
    this.tone({ type: 'sawtooth', f0: 300, f1: 1200, dur: 0.45, vol: 0.06, curve: 'lin' });
  }
  drillSpin(level: number) {
    if (!this.ok('dspin', 60)) return;
    const big = level >= 3;
    this.tone({ type: 'sawtooth', f0: big ? 90 : 160, f1: big ? 520 : 880, dur: big ? 0.4 : 0.22, vol: big ? 0.14 : 0.09, curve: 'lin' });
    this.noise({ dur: big ? 0.4 : 0.2, vol: 0.12, filter: 'highpass', f0: 3000 });
  }
  drillHit(power: number, pitch = 1) {
    if (!this.ok('dhit', 22)) return;
    const big = power >= 3;
    this.noise({ dur: big ? 0.16 : 0.08, vol: big ? 0.55 : 0.35, filter: 'bandpass', f0: 1800 * pitch, f1: 500, q: 1.2, dest: big ? this.shaper : undefined });
    this.tone({ type: 'square', f0: 140 * pitch, f1: 60, dur: 0.07, vol: big ? 0.22 : 0.14 });
    this.tone({ type: 'sine', f0: 95, f1: 45, dur: big ? 0.2 : 0.1, vol: big ? 0.6 : 0.4 });
  }
  crack() {
    if (!this.ok('crack', 25)) return;
    this.noise({ dur: 0.05, vol: 0.2, filter: 'highpass', f0: 2500 });
    this.tone({ type: 'square', f0: 1800, f1: 900, dur: 0.03, vol: 0.05 });
  }
  rockBreak(kind: string, pitch = 1) {
    if (!this.ok('break', 16)) return;
    const f = kind === 'hard' ? 700 : kind === 'crystal' ? 3200 : kind === 'gold' ? 1600 : 1100;
    this.noise({ dur: 0.11, vol: 0.3, filter: 'bandpass', f0: f * pitch, f1: f * 0.4, q: 1 });
    this.tone({ type: 'triangle', f0: 180 * pitch, f1: 70, dur: 0.08, vol: 0.14 });
    if (kind === 'crystal') {
      this.tone({ type: 'sine', f0: 2600 * pitch, dur: 0.25, vol: 0.09 });
      this.tone({ type: 'sine', f0: 3900 * pitch, dur: 0.18, vol: 0.06, at: this.t + 0.03 });
    }
    if (kind === 'gold') this.tone({ type: 'triangle', f0: 1760, dur: 0.12, vol: 0.06 });
  }
  pebbles(delay = 0.18) {
    if (!this.ok('pebble', 120)) return;
    for (let i = 0; i < 4; i++) this.noise({ dur: 0.03, vol: 0.08, filter: 'bandpass', f0: 2400 + Math.random() * 1600, q: 4, at: this.t + delay + i * 0.05 + Math.random() * 0.03 });
  }
  fuse(ms: number) {
    if (!this.ok('fuse', 60)) return;
    this.noise({ dur: ms / 1000, vol: 0.12, filter: 'highpass', f0: 5000, attack: 0.01 });
    for (let i = 0; i < 4; i++) this.noise({ dur: 0.012, vol: 0.12, filter: 'highpass', f0: 3000, at: this.t + (i * ms) / 4000 });
  }
  explosion(size: number, kind: string) {
    const key = size >= 3 ? 'expBig' : 'exp';
    if (!this.ok(key, size >= 3 ? 40 : 34)) return;
    const gas = kind === 'gas';
    const vol = [0, 0.45, 0.6, 0.85, 1][Math.min(4, size)];
    const len = [0, 0.35, 0.55, 1.0, 1.8][Math.min(4, size)];
    this.noise({ dur: len, vol, filter: 'lowpass', f0: gas ? 3200 : 2400, f1: 90, q: 0.7, dest: this.shaper });
    this.tone({ type: 'sine', f0: gas ? 140 : 110, f1: 30, dur: len * 0.8, vol: vol * 0.9 });
    this.tone({ type: 'square', f0: gas ? 260 : 70, f1: 40, dur: 0.12, vol: vol * 0.25 });
    if (size >= 3) {
      this.noise({ dur: 0.08, vol: 0.5, filter: 'highpass', f0: 1500 });
      this.pebbles(0.35);
    } else if (size >= 2) this.pebbles(0.22);
  }
  gasChain(n: number) {
    if (!this.ok('gas', 30)) return;
    const p = Math.min(2.2, 1 + n * 0.04);
    this.noise({ dur: 0.28, vol: 0.4, filter: 'bandpass', f0: 900 * p, f1: 200, q: 0.9, dest: this.shaper });
    this.tone({ type: 'sine', f0: 150 * p, f1: 50, dur: 0.22, vol: 0.4 });
    this.tone({ type: 'triangle', f0: midi(60 + PENTA[Math.min(PENTA.length - 1, n % 16)]), dur: 0.12, vol: 0.05 });
  }
  shardZing() {
    if (!this.ok('shard', 40)) return;
    this.tone({ type: 'triangle', f0: 3000, f1: 1800, dur: 0.12, vol: 0.07 });
  }
  bounce() {
    if (!this.ok('bounce', 40)) return;
    this.tone({ type: 'square', f0: 700, f1: 1500, dur: 0.08, vol: 0.09 });
    this.tone({ type: 'sine', f0: 2200, dur: 0.15, vol: 0.06 });
  }
  magnetHum(ms: number, storm: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.ok('hum', 80)) return;
    const t0 = ctx.currentTime;
    const dur = ms / 1000;
    for (const [f, dt] of [
      [storm ? 70 : 110, 0],
      [storm ? 71.5 : 112, 0],
      [storm ? 140 : 220, 5],
    ]) {
      this.tone({ type: 'sawtooth', f0: f, f1: f * (storm ? 2.2 : 1.6), dur, vol: storm ? 0.06 : 0.045, attack: 0.08, at: t0, detune: dt, curve: 'lin' });
    }
    this.noise({ dur, vol: 0.05, filter: 'bandpass', f0: 600, f1: 1800, q: 4, attack: 0.1 });
  }
  pickup(kind: string) {
    if (!this.ok('pick', 24)) return;
    const now = performance.now();
    if (now - this.pickupAt > 450) this.pickupIdx = 0;
    this.pickupAt = now;
    const n = PENTA[Math.min(PENTA.length - 1, this.pickupIdx++)];
    const base = kind === 'gold' ? 76 : kind === 'shard' ? 81 : kind === 'core' ? 72 : 72;
    this.tone({ type: kind === 'gold' ? 'triangle' : 'square', f0: midi(base + n), dur: 0.07, vol: kind === 'gold' ? 0.1 : 0.05 });
    if (kind === 'gold' || kind === 'core') this.tone({ type: 'sine', f0: midi(base + n + 12), dur: 0.1, vol: 0.05, at: this.t + 0.02 });
  }
  counterTick() {
    if (!this.ok('ctick', 45)) return;
    this.tone({ type: 'square', f0: 2400, dur: 0.012, vol: 0.02 });
  }
  mega(sym: string) {
    if (!this.ok('mega', 200)) return;
    const root = sym === 'D' ? 57 : sym === 'B' ? 52 : 60;
    for (const [i, n] of [0, 7, 12, 16].entries()) {
      this.tone({ type: 'sawtooth', f0: midi(root + n), dur: 0.5, vol: 0.07, at: this.t + i * 0.035 });
      this.tone({ type: 'square', f0: midi(root + n + 12), dur: 0.3, vol: 0.03, at: this.t + i * 0.035 });
    }
    this.tone({ type: 'sine', f0: 60, f1: 30, dur: 0.6, vol: 0.5 });
    this.noise({ dur: 0.4, vol: 0.2, filter: 'highpass', f0: 800, f1: 6000 });
  }
  chainTick(n: number) {
    if (!this.ok('chain', 45)) return;
    this.tone({ type: 'square', f0: midi(67 + PENTA[Math.min(PENTA.length - 1, Math.floor(n / 2))]), dur: 0.05, vol: 0.04 });
  }
  feverReady() {
    if (!this.ok('fready', 300)) return;
    for (const [i, n] of [84, 91, 96].entries()) this.tone({ type: 'sine', f0: midi(n), dur: 0.9, vol: 0.15, at: this.t + i * 0.06 });
    this.tone({ type: 'triangle', f0: midi(108), dur: 0.5, vol: 0.05 });
  }
  feverStart() {
    if (!this.ok('fstart', 300)) return;
    this.noise({ dur: 0.5, vol: 0.3, filter: 'bandpass', f0: 300, f1: 6000, q: 1.2 });
    this.tone({ type: 'sawtooth', f0: 110, f1: 880, dur: 0.45, vol: 0.12, curve: 'lin' });
    for (const [i, n] of [57, 64, 69, 76, 81].entries()) this.tone({ type: 'square', f0: midi(n), dur: 0.35, vol: 0.06, at: this.t + 0.3 + i * 0.05 });
    this.tone({ type: 'sine', f0: 70, f1: 35, dur: 0.8, vol: 0.6, at: this.t + 0.3 });
  }
  feverEnd() {
    if (!this.ok('fend', 300)) return;
    this.tone({ type: 'sawtooth', f0: 660, f1: 110, dur: 0.6, vol: 0.08 });
  }
  layerClear() {
    if (!this.ok('layer', 500)) return;
    const seq = [60, 64, 67, 72, 67, 72, 76, 79];
    seq.forEach((n, i) => {
      this.tone({ type: 'square', f0: midi(n), dur: 0.2, vol: 0.07, at: this.t + i * 0.09 });
      this.tone({ type: 'triangle', f0: midi(n - 12), dur: 0.2, vol: 0.08, at: this.t + i * 0.09 });
    });
    this.tone({ type: 'sawtooth', f0: midi(84), dur: 1.0, vol: 0.06, at: this.t + seq.length * 0.09, vibrato: 6 });
  }
  upgrade() {
    if (!this.ok('upg', 100)) return;
    [72, 76, 79, 84].forEach((n, i) => this.tone({ type: 'square', f0: midi(n), dur: 0.12, vol: 0.07, at: this.t + i * 0.05 }));
  }
  cardShow(i: number) {
    this.tone({ type: 'triangle', f0: midi(67 + i * 5), dur: 0.1, vol: 0.06 });
  }
  reelSwap() {
    if (!this.ok('swap', 100)) return;
    this.noise({ dur: 0.2, vol: 0.15, filter: 'bandpass', f0: 1000, f1: 4000, q: 2 });
    this.tone({ type: 'square', f0: 440, f1: 880, dur: 0.18, vol: 0.07 });
  }
  botBeep(kind: string) {
    if (!this.ok('bot' + kind, 120)) return;
    const f = kind === 'drill' ? 1200 : kind === 'bomb' ? 900 : 1500;
    this.tone({ type: 'square', f0: f, dur: 0.04, vol: 0.04 });
    this.tone({ type: 'square', f0: f * 1.5, dur: 0.04, vol: 0.04, at: this.t + 0.05 });
  }
  advance() {
    if (!this.ok('adv', 90)) return;
    this.noise({ dur: 0.16, vol: 0.14, filter: 'lowpass', f0: 500, f1: 150 });
    this.tone({ type: 'square', f0: 70, f1: 50, dur: 0.12, vol: 0.08 });
  }
  heartPull(left: number) {
    if (!this.ok('heart', 150)) return;
    this.tone({ type: 'sawtooth', f0: 80, f1: 400 + (3 - left) * 200, dur: 0.6, vol: 0.14, curve: 'lin' });
    this.noise({ dur: 0.6, vol: 0.3, filter: 'bandpass', f0: 400, f1: 3000, q: 2 });
    this.tone({ type: 'sine', f0: midi(72 + (3 - left) * 5), dur: 0.8, vol: 0.12, at: this.t + 0.4 });
  }
  coreCrack(i: number) {
    this.noise({ dur: 0.25, vol: 0.5, filter: 'highpass', f0: 1500 + i * 600, dest: this.shaper });
    this.tone({ type: 'sine', f0: 50, f1: 30, dur: 0.5, vol: 0.6 });
    this.tone({ type: 'triangle', f0: midi(84 + i * 3), dur: 0.6, vol: 0.08 });
  }
  coreBreak() {
    const t = this.t;
    this.noise({ dur: 3.2, vol: 1, filter: 'lowpass', f0: 3000, f1: 60, q: 0.6, dest: this.shaper });
    this.tone({ type: 'sine', f0: 90, f1: 22, dur: 3, vol: 0.9 });
    this.tone({ type: 'sawtooth', f0: 55, f1: 28, dur: 2.5, vol: 0.2 });
    [60, 67, 72, 76, 79, 84, 88, 91].forEach((n, i) => this.tone({ type: 'sine', f0: midi(n), dur: 2.5, vol: 0.06, at: t + 0.4 + i * 0.12 }));
    for (let i = 0; i < 14; i++) this.noise({ dur: 0.04, vol: 0.12, filter: 'bandpass', f0: 1800 + Math.random() * 3000, q: 3, at: t + 0.8 + i * 0.14 + Math.random() * 0.1 });
  }
  stopHum() {
    this.humNodes = null;
  }
}

export const audio = new AudioSys();
