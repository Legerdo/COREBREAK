// Layered procedural industrial music. A lookahead scheduler plays 16th-note
// steps; layers are enabled by game state (normal / chain / fever / core).
import { LAYERS } from '../data/balance';
import type { AudioSys } from './audio';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

// minor-ish riff degrees (semitones from root) per 16-step bar, -1 = rest
const BASS_A = [0, -1, -1, 0, -1, -1, 3, -1, 0, -1, -1, 7, -1, 5, -1, 3];
const BASS_B = [0, -1, -1, 0, -1, -1, 3, -1, 5, -1, -1, 3, -1, 10, -1, 7];
const ARP = [0, 7, 12, 15, 12, 7, 3, 7];
const LEAD = [12, -1, 15, -1, 19, 17, 15, -1, 12, -1, 10, -1, 12, 15, 17, 19];
const CORE_CHORDS = [
  [0, 3, 7],
  [-4, 0, 3],
  [-2, 2, 5],
  [-5, -1, 2],
];

export class Music {
  private timer: number | null = null;
  private step = 0;
  private bar = 0;
  private next = 0;
  root = LAYERS[0].music.root;
  bpm = LAYERS[0].music.bpm;
  intensity = 0; // 0..1 chain energy (decays)
  fever = false;
  core = false;
  climax = false;
  private duckUntil = 0;
  private started = false;

  constructor(private a: AudioSys) {}

  start() {
    if (this.started || !this.a.ctx) return;
    this.started = true;
    this.next = this.a.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }
  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.started = false;
  }
  setLayer(i: number) {
    const L = LAYERS[Math.min(i, LAYERS.length - 1)];
    this.root = L.music.root;
    this.bpm = L.music.bpm;
  }
  bump(amount: number) {
    this.intensity = Math.min(1, this.intensity + amount);
  }
  /** Silence the music for a moment (anticipation beats). */
  duck(ms: number) {
    if (!this.a.ctx) return;
    this.duckUntil = this.a.ctx.currentTime + ms / 1000;
    const g = this.a.musicBus.gain;
    const t = this.a.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0.0001, t, 0.015);
    g.setTargetAtTime(this.a.vol.music * 0.55, t + ms / 1000, 0.05);
  }

  private schedule() {
    const ctx = this.a.ctx;
    if (!ctx) return;
    const bpm = this.bpm * (this.fever ? 1.12 : 1) * (this.climax ? 1.08 : 1);
    const stepDur = 60 / bpm / 4;
    if (this.next < ctx.currentTime - 0.5) this.next = ctx.currentTime + 0.05;
    while (this.next < ctx.currentTime + 0.12) {
      if (this.next >= this.duckUntil) this.playStep(this.step, this.next, stepDur);
      this.next += stepDur;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.bar++;
    }
    this.intensity = Math.max(0, this.intensity - 0.004);
  }

  private kick(t: number, v = 0.55) {
    this.a.tone({ type: 'sine', f0: 130, f1: 38, dur: 0.16, vol: v, at: t, dest: this.a.musicBus });
    this.a.tone({ type: 'square', f0: 60, f1: 40, dur: 0.03, vol: v * 0.15, at: t, dest: this.a.musicBus });
  }
  private hat(t: number, v = 0.06, long = false) {
    this.a.noise({ dur: long ? 0.09 : 0.035, vol: v, filter: 'highpass', f0: 7000, at: t, dest: this.a.musicBus });
  }
  private clank(t: number, v = 0.12) {
    this.a.noise({ dur: 0.07, vol: v, filter: 'bandpass', f0: 1900, q: 6, at: t, dest: this.a.musicBus });
    this.a.tone({ type: 'square', f0: 620, f1: 560, dur: 0.05, vol: v * 0.25, at: t, dest: this.a.musicBus });
  }
  private snare(t: number, v = 0.18) {
    this.a.noise({ dur: 0.14, vol: v, filter: 'bandpass', f0: 2200, f1: 1200, q: 0.8, at: t, dest: this.a.musicBus });
    this.a.tone({ type: 'triangle', f0: 220, f1: 160, dur: 0.08, vol: v * 0.5, at: t, dest: this.a.musicBus });
  }
  private bass(t: number, n: number, dur: number, v = 0.12) {
    this.a.tone({ type: 'sawtooth', f0: midi(n), dur, vol: v, at: t, dest: this.a.musicBus });
    this.a.tone({ type: 'square', f0: midi(n - 12), dur: dur * 0.9, vol: v * 0.5, at: t, dest: this.a.musicBus });
  }

  private playStep(s: number, t: number, sd: number) {
    const r = this.root;
    const riff = this.bar % 4 === 3 ? BASS_B : BASS_A;
    if (this.fever) {
      if (s % 4 === 0) this.kick(t, 0.6);
      if (s === 4 || s === 12) this.snare(t, 0.2);
      this.hat(t, s % 2 ? 0.05 : 0.08, s % 4 === 2);
      if (s % 2 === 0) this.bass(t, r + (s % 4 === 0 ? 0 : 12) + (riff[s] > 0 ? riff[s] : 0), sd * 1.6, 0.1);
      const ln = LEAD[s];
      if (ln >= 0) this.a.tone({ type: 'square', f0: midi(r + 24 + ln), dur: sd * 1.8, vol: 0.035, at: t, dest: this.a.musicBus });
      this.a.tone({ type: 'triangle', f0: midi(r + 36 + ARP[s % 8]), dur: sd * 0.9, vol: 0.025, at: t, dest: this.a.musicBus });
      return;
    }
    // base industrial groove
    if (s === 0 || s === 8 || (s === 10 && this.bar % 2 === 1)) this.kick(t, this.core ? 0.65 : 0.5);
    if (s === 4 || s === 12) this.clank(t, 0.1);
    if (s % 2 === 1) this.hat(t, 0.03);
    const b = riff[s];
    if (b >= 0) this.bass(t, r + b, sd * 1.7, 0.09);
    // chain layer
    if (this.intensity > 0.25) {
      if (s % 2 === 0) this.hat(t, 0.045);
      if (s === 2 || s === 6 || s === 14) this.clank(t, 0.06);
    }
    if (this.intensity > 0.55) {
      this.a.tone({ type: 'square', f0: midi(r + 24 + ARP[s % 8]), dur: sd * 0.8, vol: 0.022, at: t, dest: this.a.musicBus });
      if (s === 12) this.snare(t, 0.1);
    }
    // core layer: pad chords & climax lead
    if (this.core && s === 0) {
      const ch = CORE_CHORDS[this.bar % 4];
      for (const n of ch) {
        this.a.tone({ type: 'sawtooth', f0: midi(r + 12 + n), dur: sd * 15, vol: 0.022, attack: 0.3, at: t, dest: this.a.musicBus, detune: 7 });
        this.a.tone({ type: 'sawtooth', f0: midi(r + 12 + n), dur: sd * 15, vol: 0.022, attack: 0.3, at: t, dest: this.a.musicBus, detune: -7 });
      }
    }
    if (this.climax) {
      if (s % 4 === 0) this.kick(t, 0.6);
      const ln = LEAD[s];
      if (ln >= 0) this.a.tone({ type: 'sawtooth', f0: midi(r + 24 + ln), dur: sd * 2, vol: 0.04, at: t, dest: this.a.musicBus, vibrato: 4 });
    }
  }
}
