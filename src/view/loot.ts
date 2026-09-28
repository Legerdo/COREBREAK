// Loose treasure on the field + everything that flies into the machine.
import Phaser from 'phaser';
import { FIELD_BOTTOM, FIELD_W, FIELD_X, FIELD_Y, NOZZLE, TILE } from '../config';
import type { LootKind, TileType } from '../data/balance';
import { tileFrame } from '../art/sprites';
import type { Game } from '../sim/game';
import type { Loot, Pt } from '../sim/types';
import { D } from './depth';
import type { FieldView } from './field';
import type { Particles } from './particles';

type State = 'air' | 'rest' | 'wait' | 'fly';

interface Item {
  id: number;
  kind: LootKind;
  value: number;
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: State;
  t: number;
  delay: number;
  dur: number;
  sx: number;
  sy: number;
  cx: number;
  cy: number;
  crash?: Pt;
  trail: number;
  big: boolean;
  tracked: boolean; // exists in game.loot (loose)
}

const KEY: Record<LootKind, string> = { ore: 'loot_ore', gold: 'loot_gold', shard: 'loot_shard', core: 'loot_core' };
const GRAV = 560;

export class LootView {
  private items = new Map<number, Item>();
  private flyers: Item[] = [];
  private pool: Phaser.GameObjects.Image[] = [];
  private seq = -1;
  onArrive: (value: number, kind: LootKind, big: boolean) => void = () => {};
  onCrash: (p: Pt) => void = () => {};
  storm = false;

  constructor(private scene: Phaser.Scene, private field: FieldView, private game: Game, private parts: Particles) {}

  get flying(): number {
    return this.flyers.length;
  }
  get looseCount(): number {
    return this.items.size;
  }

  private img(kind: LootKind, frame?: number): Phaser.GameObjects.Image {
    const im = this.pool.pop() ?? this.scene.add.image(0, 0, KEY[kind]);
    im.setTexture(KEY[kind], frame ?? (kind === 'ore' || kind === 'gold' ? Math.floor(Math.random() * 2) : undefined));
    im.setVisible(true).setActive(true).setDepth(D.loot).setAlpha(1).setScale(1).clearTint().setOrigin(0.5);
    return im;
  }
  private free(it: Item) {
    it.img.setVisible(false).setActive(false);
    this.pool.push(it.img);
  }

  /** Recreate loose loot from the sim (after load). */
  rebuild() {
    for (const it of this.items.values()) this.free(it);
    this.items.clear();
    for (const l of this.game.loot.values()) this.spawn(l, false);
  }

  spawn(l: Loot, burst = true) {
    const x = FIELD_X + l.x;
    const y = FIELD_Y + l.y;
    const it: Item = {
      id: l.id,
      kind: l.kind,
      value: l.value,
      img: this.img(l.kind),
      x,
      y,
      vx: burst ? (Math.random() - 0.5) * 150 : 0,
      vy: burst ? -60 - Math.random() * 130 : 0,
      state: 'air',
      t: 0,
      delay: 0,
      dur: 0,
      sx: 0,
      sy: 0,
      cx: 0,
      cy: 0,
      trail: 0,
      big: false,
      tracked: true,
    };
    this.items.set(l.id, it);
    it.img.setPosition(Math.round(x), Math.round(y));
  }

  /** Ore that goes straight to the machine when a tile breaks. */
  direct(at: Pt, value: number, kind: LootKind, n: number) {
    const x = FIELD_X + at.x;
    const y = FIELD_Y + at.y;
    const each = value / n;
    for (let i = 0; i < n; i++) {
      const it = this.makeFlyer(kind === 'core' ? 'gold' : kind, x + (Math.random() - 0.5) * 6, y, each, false);
      it.delay = 40 + Math.random() * 90;
      it.vy = -90 - Math.random() * 60;
      it.vx = (Math.random() - 0.5) * 90;
      it.state = 'wait';
      it.dur = 300 + Math.random() * 160;
    }
  }

  private makeFlyer(kind: LootKind, x: number, y: number, value: number, big: boolean, frame?: number): Item {
    const it: Item = {
      id: this.seq--,
      kind,
      value,
      img: this.img(kind, frame),
      x,
      y,
      vx: 0,
      vy: 0,
      state: 'wait',
      t: 0,
      delay: 0,
      dur: 400,
      sx: x,
      sy: y,
      cx: 0,
      cy: 0,
      trail: 0,
      big,
      tracked: false,
    };
    it.img.setDepth(D.lootFly).setPosition(Math.round(x), Math.round(y));
    this.flyers.push(it);
    return it;
  }

  /** Gold tile ripped out of the wall by the magnet. */
  rip(cellPx: Pt, layer: number, tt: TileType, value: number, delay: number) {
    const it = this.makeFlyer('gold', FIELD_X + cellPx.x, FIELD_Y + cellPx.y, value, true);
    it.img.setTexture('tiles', tileFrame(layer, tt, 0, 1));
    it.delay = delay;
    it.dur = 380 + Math.random() * 180;
  }

  heart(at: Pt, delay: number, value: number) {
    const it = this.makeFlyer('core', FIELD_X + at.x, FIELD_Y + at.y, value, true);
    it.delay = delay;
    it.dur = 900;
  }

  collect(id: number, delay: number, crashAt?: Pt) {
    const it = this.items.get(id);
    if (!it) return;
    this.items.delete(id);
    it.tracked = false;
    it.state = 'wait';
    it.vx = 0;
    it.vy = 0;
    it.delay = delay;
    it.t = 0;
    it.dur = Math.min(720, 280 + Math.hypot(it.x - NOZZLE.x, it.y - NOZZLE.y) * 0.9);
    if (crashAt) it.crash = { x: FIELD_X + crashAt.x, y: FIELD_Y + crashAt.y };
    it.img.setDepth(D.lootFly);
    this.flyers.push(it);
  }

  /** Push resting loot away from an explosion. */
  impulse(x: number, y: number, radius: number, power: number) {
    for (const it of this.items.values()) {
      const dx = it.x - x;
      const dy = it.y - y;
      const d = Math.hypot(dx, dy);
      if (d > radius || d < 0.01) continue;
      const k = (1 - d / radius) * power;
      it.vx += (dx / d) * k;
      it.vy += (dy / d) * k - k * 0.6;
      it.state = 'air';
    }
  }

  /** The wall slid down one row. */
  shift(pushed: { id: number; value: number }[]) {
    for (const it of this.items.values()) {
      it.y += TILE;
      it.img.y = Math.round(it.y);
    }
    for (const p of pushed) {
      const it = this.items.get(p.id);
      if (!it) {
        this.onArrive(p.value, 'ore', false);
        continue;
      }
      this.collect(p.id, Math.random() * 120);
    }
  }

  update(dt: number) {
    const s = Math.min(0.05, dt / 1000);
    const floorY = FIELD_BOTTOM - 3;
    for (const it of this.items.values()) {
      if (it.state === 'rest') {
        if (!this.field.solidAt(it.x, it.y + 3) && it.y < floorY - 0.5 && !this.field.sliding) it.state = 'air';
        else continue;
      }
      it.vy += GRAV * s;
      let nx = it.x + it.vx * s;
      let ny = it.y + it.vy * s;
      if (nx < FIELD_X + 3 || nx > FIELD_X + FIELD_W - 3) {
        it.vx = -it.vx * 0.5;
        nx = Math.max(FIELD_X + 3, Math.min(FIELD_X + FIELD_W - 3, nx));
      }
      if (this.field.solidAt(nx, it.y)) {
        it.vx = -it.vx * 0.4;
        nx = it.x;
      }
      if (ny < FIELD_Y + 3) {
        ny = FIELD_Y + 3;
        it.vy = Math.abs(it.vy) * 0.3;
      }
      if (it.vy > 0 && (this.field.solidAt(nx, ny + 3) || ny >= floorY)) {
        // land on top of the cell below
        if (ny >= floorY) ny = floorY;
        else ny = Math.floor((ny + 3 - FIELD_Y) / TILE) * TILE + FIELD_Y - 3;
        if (it.vy > 70) {
          it.vy = -it.vy * 0.32;
          it.vx *= 0.7;
        } else {
          it.vy = 0;
          it.vx = 0;
          it.state = 'rest';
          const l = this.game.loot.get(it.id);
          if (l) {
            l.x = nx - FIELD_X;
            l.y = ny - FIELD_Y;
          }
        }
      } else if (it.vy < 0 && this.field.solidAt(nx, ny - 2)) {
        it.vy = 20;
        ny = it.y;
      }
      // stuck inside a solid tile (e.g. after a wall slide) -> pop upward
      if (this.field.solidAt(nx, ny) && !this.field.sliding) {
        ny = Math.floor((ny - FIELD_Y) / TILE) * TILE + FIELD_Y - 3;
        it.vy = -40;
      }
      it.x = nx;
      it.y = ny;
      it.img.setPosition(Math.round(it.x), Math.round(it.y));
    }

    // things flying into the machine
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const it = this.flyers[i];
      it.t += dt;
      if (it.state === 'wait') {
        if (it.vx || it.vy) {
          // little pop before being sucked in
          it.vy += GRAV * 0.7 * s;
          it.x += it.vx * s;
          it.y += it.vy * s;
        } else if (it.tracked === false && !it.big) {
          // magnet grab: tremble & lift
          const lift = Math.min(1, it.t / Math.max(1, it.delay)) * 6;
          it.img.setPosition(Math.round(it.x + (Math.floor(it.t / 30) % 2 ? 1 : -1)), Math.round(it.y - lift));
        }
        if (it.big) {
          const sh = Math.floor(it.t / 35) % 2 ? 1 : -1;
          it.img.setPosition(Math.round(it.x + sh), Math.round(it.y));
        } else if (it.vx || it.vy) it.img.setPosition(Math.round(it.x), Math.round(it.y));
        if (it.t >= it.delay) {
          it.state = 'fly';
          it.t = 0;
          if (!it.vx && !it.vy && !it.big) it.y -= 6;
          it.sx = it.x;
          it.sy = it.y;
          const side = it.sx < NOZZLE.x ? -1 : 1;
          if (it.crash) {
            it.cx = it.crash.x;
            it.cy = it.crash.y;
          } else {
            it.cx = (it.sx + NOZZLE.x) / 2 + side * Math.min(60, Math.abs(it.sy - NOZZLE.y) * 0.35);
            it.cy = Math.min(it.sy, NOZZLE.y) - 24 - Math.random() * 20;
          }
        }
        continue;
      }
      // fly along quadratic bezier with acceleration
      const u = Math.min(1, it.t / it.dur);
      const e = u * u * (this.storm ? 0.7 + 0.3 * u : 1);
      const a = (1 - e) * (1 - e);
      const b = 2 * (1 - e) * e;
      const c = e * e;
      const x = a * it.sx + b * it.cx + c * NOZZLE.x;
      const y = a * it.sy + b * it.cy + c * NOZZLE.y;
      if (it.crash && e > 0.5) {
        this.onCrash(it.crash);
        it.crash = undefined;
      }
      it.trail -= dt;
      if (it.trail <= 0) {
        it.trail = it.big ? 18 : 40;
        this.parts.spawn({ key: 'spark', frames: 3, x, y, life: it.big ? 260 : 160, depth: D.lootFly - 1, vx: 0, vy: 0 });
      }
      it.img.setPosition(Math.round(x), Math.round(y));
      if (u >= 1) {
        this.flyers.splice(i, 1);
        this.free(it);
        this.onArrive(it.value, it.kind, it.big);
      }
    }
  }

  /** Flush everything instantly (used when leaving the scene). */
  flushAll() {
    for (const it of this.flyers) {
      this.onArrive(it.value, it.kind, false);
      this.free(it);
    }
    this.flyers = [];
  }
}
