// Lightweight pooled particle system. Positions are integer-snapped every frame
// (no fractional jitter) and it runs on world time so hit-stop freezes it.
import Phaser from 'phaser';

export interface PartOpts {
  key: string;
  frame?: number | string;
  frames?: number; // animate frames 0..frames-1 over life
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  g?: number;
  drag?: number;
  life: number;
  tint?: number;
  scale?: number;
  alpha?: number;
  fade?: boolean;
  depth?: number;
  floor?: number;
  bounce?: number;
  add?: boolean;
  flipX?: boolean;
  delay?: number;
}

interface Part extends PartOpts {
  img: Phaser.GameObjects.Image;
  age: number;
  bounced: number;
}

export class Particles {
  private pool: Phaser.GameObjects.Image[] = [];
  private live: Part[] = [];
  mult = 1;
  max = 900;

  constructor(private scene: Phaser.Scene, private baseDepth: number) {}

  get count() {
    return this.live.length;
  }

  spawn(o: PartOpts): void {
    if (this.live.length >= this.max) return;
    const img = this.pool.pop() ?? this.scene.add.image(0, 0, o.key);
    img.setTexture(o.key, o.frame ?? (o.frames ? 0 : undefined));
    img.setActive(true).setVisible(!(o.delay && o.delay > 0));
    img.setOrigin(0.5);
    img.setScale(o.scale ?? 1);
    img.setAlpha(o.alpha ?? 1);
    img.setDepth(o.depth ?? this.baseDepth);
    img.setFlipX(!!o.flipX);
    img.setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    if (o.tint !== undefined) img.setTint(o.tint);
    else img.clearTint();
    img.setPosition(Math.round(o.x), Math.round(o.y));
    this.live.push({ ...o, img, age: -(o.delay ?? 0), bounced: 0, vx: o.vx ?? 0, vy: o.vy ?? 0 });
  }

  /** Spawn n particles, scaled by the particle setting. */
  burst(n: number, fn: (i: number) => PartOpts) {
    const m = Math.max(1, Math.round(n * this.mult));
    for (let i = 0; i < m; i++) this.spawn(fn(i));
  }

  update(dt: number) {
    const s = dt / 1000;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.age += dt;
      if (p.age < 0) continue;
      if (!p.img.visible) p.img.setVisible(true);
      if (p.age >= p.life) {
        this.kill(i);
        continue;
      }
      if (p.drag) {
        const k = Math.pow(1 - p.drag, s * 60);
        p.vx! *= k;
        p.vy! *= k;
      }
      p.vy! += (p.g ?? 0) * s;
      p.x += p.vx! * s;
      p.y += p.vy! * s;
      if (p.floor !== undefined && p.y > p.floor && p.vy! > 0) {
        p.y = p.floor;
        if (p.bounced < 1 && Math.abs(p.vy!) > 40) {
          p.vy = -p.vy! * (p.bounce ?? 0.35);
          p.vx! *= 0.6;
          p.bounced++;
        } else {
          p.vy = 0;
          p.vx! *= 0.8;
        }
      }
      const t = p.age / p.life;
      if (p.frames) p.img.setFrame(Math.min(p.frames - 1, Math.floor(t * p.frames)));
      if (p.fade) p.img.setAlpha((p.alpha ?? 1) * (t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4));
      p.img.setPosition(Math.round(p.x), Math.round(p.y));
    }
  }

  private kill(i: number) {
    const p = this.live[i];
    p.img.setVisible(false).setActive(false);
    this.pool.push(p.img);
    this.live.splice(i, 1);
  }

  clear() {
    for (let i = this.live.length - 1; i >= 0; i--) this.kill(i);
  }
}
