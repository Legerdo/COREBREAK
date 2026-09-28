import Phaser from 'phaser';
import { H, W } from '../config';
import { pixelRing } from './ui';

/** Spring-based camera impulses + short shakes. Always integer offsets. */
export class CameraFx {
  private ox = 0;
  private oy = 0;
  private vx = 0;
  private vy = 0;
  private shakeT = 0;
  private shakeDur = 1;
  private shakeAmp = 0;
  mult = 1;

  constructor(private cam: Phaser.Cameras.Scene2D.Camera) {}

  impulse(dx: number, dy: number) {
    if (this.mult <= 0) return;
    this.vx += dx * 60 * this.mult;
    this.vy += dy * 60 * this.mult;
  }
  shake(amp: number, ms: number) {
    if (this.mult <= 0) return;
    const a = amp * this.mult;
    if (a >= this.shakeAmp * (this.shakeT / this.shakeDur)) {
      this.shakeAmp = a;
      this.shakeT = ms;
      this.shakeDur = ms;
    }
  }
  update(dt: number) {
    // fixed 4ms substeps keep the stiff spring stable at any frame rate / game speed
    const k = 900;
    const c = 30;
    let left = Math.min(250, dt);
    while (left > 0) {
      const s = Math.min(4, left) / 1000;
      left -= 4;
      this.vx += (-k * this.ox - c * this.vx) * s;
      this.vy += (-k * this.oy - c * this.vy) * s;
      this.ox += this.vx * s;
      this.oy += this.vy * s;
    }
    if (!Number.isFinite(this.ox + this.oy + this.vx + this.vy)) this.ox = this.oy = this.vx = this.vy = 0;
    let sx = 0;
    let sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeT / this.shakeDur);
      sx = (Math.random() * 2 - 1) * a;
      sy = (Math.random() * 2 - 1) * a;
    }
    const lim = 10;
    this.cam.setScroll(Math.round(Phaser.Math.Clamp(this.ox + sx, -lim, lim)), Math.round(Phaser.Math.Clamp(this.oy + sy, -lim, lim)));
  }
}

interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  life: number;
  age: number;
  color: number;
  thick: number;
  alpha: number;
}

/** Expanding / contracting pixel rings (shockwaves, magnet pulses). */
export class Rings {
  private g: Phaser.GameObjects.Graphics;
  private list: Ring[] = [];
  constructor(scene: Phaser.Scene, depth: number) {
    this.g = scene.add.graphics().setDepth(depth);
  }
  add(x: number, y: number, r0: number, r1: number, life: number, color: number, thick = 1, alpha = 1, delay = 0) {
    this.list.push({ x, y, r0, r1, life, age: -delay, color, thick, alpha });
  }
  update(dt: number) {
    this.g.clear();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const r = this.list[i];
      r.age += dt;
      if (r.age >= r.life) {
        this.list.splice(i, 1);
        continue;
      }
      if (r.age < 0) continue;
      const t = r.age / r.life;
      const e = 1 - Math.pow(1 - t, 2);
      const rad = r.r0 + (r.r1 - r.r0) * e;
      const a = r.alpha * (t < 0.5 ? 1 : 1 - (t - 0.5) * 2);
      pixelRing(this.g, r.x, r.y, rad, r.color, Math.max(0.15, a), Math.max(1, Math.round(r.thick * (1 - t * 0.5))));
    }
  }
}

/** Full-screen flash overlay. */
export class Flash {
  private rect: Phaser.GameObjects.Rectangle;
  private a = 0;
  mult = 1;
  constructor(scene: Phaser.Scene, depth: number) {
    this.rect = scene.add.rectangle(W / 2, H / 2, W + 40, H + 40, 0xffffff, 0).setDepth(depth).setScrollFactor(0);
  }
  flash(alpha: number, color = 0xffffff) {
    const v = alpha * this.mult;
    if (v <= this.a) return;
    this.a = Math.min(0.85, v);
    this.rect.setFillStyle(color, this.a);
  }
  update(dt: number) {
    if (this.a <= 0) return;
    this.a = Math.max(0, this.a - dt / 180);
    this.rect.setAlpha(1);
    this.rect.setFillStyle(this.rect.fillColor, this.a);
  }
}
