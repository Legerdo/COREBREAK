import Phaser from 'phaser';
import { COLS, FIELD_H, FIELD_W, FIELD_X, FIELD_Y, ROWS, TILE } from '../config';
import { LAYERS, type TileType } from '../data/balance';
import { P } from '../data/palette';
import { tileFrame } from '../art/sprites';
import type { Game } from '../sim/game';
import type { AdvanceResult, Cell, Tile } from '../sim/types';
import { D } from './depth';

export interface TileSpr {
  id: number;
  img: Phaser.GameObjects.Image;
  crack: Phaser.GameObjects.Image | null;
  c: number;
  r: number;
  tt: TileType;
  layer: number;
  v: number;
  phase: number;
  shock: number;
  flash: number;
}

const VARIANTS: Record<TileType, number> = { rock: 4, hard: 2, gold: 2, gas: 1, crystal: 2, bombrock: 1, armor: 2, unstable: 1, heart: 1 };

export const cellX = (c: number) => FIELD_X + c * TILE;
export const cellY = (r: number) => FIELD_Y + r * TILE;
export const cellCX = (c: number) => FIELD_X + c * TILE + TILE / 2;
export const cellCY = (r: number) => FIELD_Y + r * TILE + TILE / 2;

export class FieldView {
  sprites = new Map<number, TileSpr>();
  vgrid: (TileSpr | null)[] = new Array(COLS * ROWS).fill(null);
  private pool: Phaser.GameObjects.Image[] = [];
  private crackPool: Phaser.GameObjects.Image[] = [];
  bg: Phaser.GameObjects.Image;
  private bgNext: Phaser.GameObjects.Image;
  private bgLayer = -1;
  marker: Phaser.GameObjects.Graphics;
  heart: Phaser.GameObjects.Sprite | null = null;
  heartStage = 0;
  private t = 0;
  hover: Cell | null = null;
  sliding = false;
  private lamps: Phaser.GameObjects.Image[] = [];

  constructor(private scene: Phaser.Scene, private game: Game) {
    this.bg = scene.add.image(FIELD_X, FIELD_Y, 'bg_0').setOrigin(0).setDepth(D.bg);
    this.bgNext = scene.add.image(FIELD_X, FIELD_Y, 'bg_0').setOrigin(0).setDepth(D.bg + 1).setAlpha(0);
    this.marker = scene.add.graphics().setDepth(D.marker);
    for (let i = 0; i < 3; i++) {
      const l = scene.add.image(FIELD_X + 47 + i * 170 + 7, FIELD_Y + 50 + i * 20, 'lamp', 2).setDepth(D.bgfx).setAlpha(0.35);
      this.lamps.push(l);
    }
  }

  setLayer(li: number, instant = false) {
    if (li === this.bgLayer) return;
    this.bgLayer = li;
    if (instant) {
      this.bg.setTexture('bg_' + li);
      return;
    }
    this.bgNext.setTexture('bg_' + li).setAlpha(0);
    this.scene.tweens.add({
      targets: this.bgNext,
      alpha: 1,
      duration: 1400,
      onComplete: () => {
        this.bg.setTexture('bg_' + li);
        this.bgNext.setAlpha(0);
      },
    });
  }

  private frameFor(s: TileSpr, f: number): string {
    return tileFrame(s.layer, s.tt, s.v % VARIANTS[s.tt], f);
  }

  private make(tile: Tile, c: number, r: number): TileSpr {
    const img = this.pool.pop() ?? this.scene.add.image(0, 0, 'tiles');
    img.setOrigin(0).setDepth(D.tiles).setVisible(tile.t !== 'heart').setActive(true).setAlpha(1).clearTint().setFlipX(false);
    const s: TileSpr = { id: tile.id, img, crack: null, c, r, tt: tile.t, layer: Math.min(tile.layer, LAYERS.length - 1), v: tile.v, phase: Math.random() * 10, shock: 0, flash: 0 };
    if (tile.t === 'gas') img.setFlipX(tile.v % 2 === 1);
    if (tile.t !== 'heart') img.setFrame(this.frameFor(s, 0));
    img.setPosition(cellX(c), cellY(r));
    this.sprites.set(tile.id, s);
    this.vgrid[r * COLS + c] = s;
    const max = tileMaxHp(tile.t);
    if (tile.hp < max) this.setCrack(s, tile.hp, max);
    return s;
  }

  build() {
    for (const s of this.sprites.values()) this.release(s);
    this.sprites.clear();
    this.vgrid.fill(null);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const t = this.game.mine.get(c, r);
        if (t) this.make(t, c, r);
      }
    this.syncHeart();
  }

  private release(s: TileSpr) {
    s.img.setVisible(false).setActive(false).clearTint();
    this.pool.push(s.img);
    if (s.crack) {
      s.crack.setVisible(false);
      this.crackPool.push(s.crack);
      s.crack = null;
    }
  }

  private setCrack(s: TileSpr, hp: number, max: number) {
    if (s.tt === 'gas' || s.tt === 'heart') return;
    const stage = hp / max <= 0.4 ? 2 : 1;
    if (!s.crack) {
      s.crack = this.crackPool.pop() ?? this.scene.add.image(0, 0, 'tiles', 'crack1');
      s.crack.setOrigin(0).setDepth(D.crack).setVisible(true).setAlpha(0.85);
    }
    s.crack.setFrame(stage === 2 ? 'crack2' : 'crack1');
    s.crack.setPosition(s.img.x, s.img.y);
  }

  get(id: number) {
    return this.sprites.get(id);
  }

  /** A tile appears during play (Heart Core regrowing its shell). */
  addTile(tile: Tile, c: number, r: number): TileSpr {
    const old = this.vgrid[r * COLS + c];
    if (old) this.remove(old.id);
    const s = this.make(tile, c, r);
    s.flash = 90;
    s.shock = 120;
    return s;
  }

  hit(id: number, hp: number, maxHp: number) {
    const s = this.sprites.get(id);
    if (!s) return;
    s.flash = 50;
    s.shock = 70;
    this.setCrack(s, hp, maxHp);
  }

  pass(id: number) {
    const s = this.sprites.get(id);
    if (!s) return;
    s.shock = 120;
  }

  /** Remove a tile sprite (broken). Returns its info for effects. */
  remove(id: number): TileSpr | null {
    const s = this.sprites.get(id);
    if (!s) return null;
    this.sprites.delete(id);
    const idx = s.r * COLS + s.c;
    if (this.vgrid[idx] === s) this.vgrid[idx] = null;
    const info = { ...s };
    this.release(s);
    return info;
  }

  solidAt(sx: number, sy: number): boolean {
    const c = Math.floor((sx - FIELD_X) / TILE);
    const r = Math.floor((sy - FIELD_Y) / TILE);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
    return !!this.vgrid[r * COLS + c];
  }

  cellAt(sx: number, sy: number): Cell | null {
    const c = Math.floor((sx - FIELD_X) / TILE);
    const r = Math.floor((sy - FIELD_Y) / TILE);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
    return { c, r };
  }

  /** Slide the wall one row towards the machine. */
  advance(res: AdvanceResult, ms: number, onCrush: (s: TileSpr) => void) {
    this.sliding = true;
    // crushed bottom row
    for (const cr of res.crushed) {
      const s = this.sprites.get(cr.id);
      if (!s) continue;
      this.sprites.delete(cr.id);
      onCrush({ ...s });
      const img = s.img;
      const crack = s.crack;
      s.crack = null;
      this.scene.tweens.add({
        targets: crack ? [img, crack] : [img],
        y: img.y + TILE,
        duration: ms,
        onComplete: () => {
          img.setVisible(false).setActive(false);
          this.pool.push(img);
          if (crack) {
            crack.setVisible(false);
            this.crackPool.push(crack);
          }
        },
      });
    }
    // shift others
    const moving: Phaser.GameObjects.Image[] = [];
    for (const s of this.sprites.values()) {
      s.r += 1;
      moving.push(s.img);
      if (s.crack) moving.push(s.crack);
    }
    // new row enters from above
    res.newRow.forEach((t, c) => {
      if (!t) return;
      const s = this.make(t, c, 0);
      s.img.y = cellY(0) - TILE;
      if (s.crack) s.crack.y = s.img.y;
      moving.push(s.img);
      if (s.crack) moving.push(s.crack);
      s.r = 0;
    });
    for (const img of moving) {
      const ty = img.y + TILE;
      this.scene.tweens.add({ targets: img, y: ty, duration: ms, ease: 'Quad.easeIn' });
    }
    // rebuild the visual grid now (positions settle at the end of the tween)
    this.vgrid.fill(null);
    for (const s of this.sprites.values()) if (s.r < ROWS) this.vgrid[s.r * COLS + s.c] = s;
    this.scene.time.delayedCall(ms + 5, () => {
      this.sliding = false;
      for (const s of this.sprites.values()) {
        s.img.setPosition(cellX(s.c), cellY(s.r));
        if (s.crack) s.crack.setPosition(s.img.x, s.img.y);
      }
      this.syncHeart();
    });
  }

  syncHeart() {
    const g = this.game;
    const hasHeart = g.core.locked && !g.core.done && [...this.sprites.values()].some((s) => s.tt === 'heart');
    if (hasHeart && !this.heart) {
      const hc = g.heartCenter();
      this.heart = this.scene.add.sprite(FIELD_X + hc.x, FIELD_Y + hc.y, 'heart', 0).setDepth(D.heart);
    }
    if (!hasHeart && this.heart) {
      this.heart.destroy();
      this.heart = null;
    }
  }

  setHeartStage(stage: number) {
    this.heartStage = stage;
  }

  update(dt: number, target: Cell | null, hintCell: Cell | null, allowHover: boolean) {
    this.t += dt;
    const t = this.t;
    for (const s of this.sprites.values()) {
      let f = 0;
      switch (s.tt) {
        case 'gas':
          f = Math.floor(t / 170 + s.phase) % 3;
          break;
        case 'gold':
          f = (t / 1000 + s.phase) % 3.2 < 0.14 ? 1 : 0;
          break;
        case 'crystal':
          f = Math.floor(t / 520 + s.phase) % 2;
          break;
        case 'bombrock':
          f = Math.sin(t / 110 + s.phase) > 0.2 ? 1 : 0;
          break;
        case 'unstable':
          f = Math.floor(t / 240 + s.phase) % 2;
          break;
      }
      if (s.tt !== 'rock' && s.tt !== 'hard' && s.tt !== 'armor' && s.tt !== 'heart') s.img.setFrame(this.frameFor(s, f));
      if (!this.sliding) {
        let ox = 0;
        if (s.shock > 0) {
          s.shock -= dt;
          ox = s.shock > 0 ? (Math.floor(s.shock / 25) % 2 ? 1 : -1) : 0;
        }
        s.img.x = cellX(s.c) + ox;
        s.img.y = cellY(s.r);
        if (s.crack) s.crack.setPosition(s.img.x, s.img.y);
      }
      if (s.flash > 0) {
        s.flash -= dt;
        if (s.flash > 0) s.img.setTintFill(P.white);
        else s.img.clearTint();
      }
    }
    // heart glow
    if (this.heart) {
      const glow = Math.floor(t / 300) % 2;
      this.heart.setFrame(Math.min(3, this.heartStage) * 2 + glow);
      const pulse = Math.round(Math.sin(t / 260));
      this.heart.y = FIELD_Y + this.game.heartCenter().y + pulse;
    }
    for (const [i, l] of this.lamps.entries()) l.setAlpha(Math.sin(t / 700 + i * 2) > 0.6 ? 0.5 : 0.2);
    this.drawMarker(target, hintCell, allowHover);
  }

  private drawMarker(target: Cell | null, hint: Cell | null, allowHover: boolean) {
    const g = this.marker;
    g.clear();
    const t = this.t;
    if (hint) {
      const x = cellX(hint.c);
      const y = cellY(hint.r);
      const p = Math.floor(t / 90) % 6;
      const a = 0.55 + 0.35 * Math.sin(t / 150);
      g.fillStyle(P.white, a * 0.35).fillRect(x, y, TILE, TILE);
      g.lineStyle(1, P.yellow, 1);
      for (let k = 0; k < 2; k++) {
        const o = 2 + k * 3 + (p % 3);
        g.lineStyle(1, k ? P.amber : P.yellow, 1 - k * 0.4);
        g.strokeRect(x - o + 0.5, y - o + 0.5, TILE + o * 2 - 1, TILE + o * 2 - 1);
      }
    }
    if (allowHover && this.hover && !(target && target.c === this.hover.c && target.r === this.hover.r)) {
      const x = cellX(this.hover.c);
      const y = cellY(this.hover.r);
      g.lineStyle(1, P.white, 0.45);
      g.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    }
    if (target) {
      const x = cellX(target.c);
      const y = cellY(target.r);
      const pulse = Math.floor(t / 200) % 2;
      const o = 2 + pulse;
      const L = 5;
      const col = pulse ? P.white : P.yellow;
      const solid = this.game.mine.get(target.c, target.r);
      g.fillStyle(P.black, 1);
      const corners: [number, number, number, number][] = [
        [x - o, y - o, 1, 1],
        [x + TILE + o - 1, y - o, -1, 1],
        [x - o, y + TILE + o - 1, 1, -1],
        [x + TILE + o - 1, y + TILE + o - 1, -1, -1],
      ];
      for (const [cx, cy, sx, sy] of corners) {
        const x0 = sx > 0 ? cx : cx - L + 1;
        const y0 = sy > 0 ? cy : cy - L + 1;
        g.fillStyle(P.black, 1);
        g.fillRect(x0 - 1, cy - 1, L + 2, 3);
        g.fillRect(cx - 1, y0 - 1, 3, L + 2);
      }
      for (const [cx, cy, sx, sy] of corners) {
        const x0 = sx > 0 ? cx : cx - L + 1;
        const y0 = sy > 0 ? cy : cy - L + 1;
        g.fillStyle(col, solid ? 1 : 0.75);
        g.fillRect(x0, cy, L, 1);
        g.fillRect(cx, y0, 1, L);
      }
      g.fillStyle(col, 0.9);
      g.fillRect(x + TILE / 2 - 1, y + TILE / 2 - 1, 2, 2);
    }
  }
}

export function tileMaxHp(t: TileType): number {
  switch (t) {
    case 'hard':
      return 3;
    case 'crystal':
      return 2;
    case 'armor':
      return 4;
    case 'unstable':
      return 3;
    default:
      return 1;
  }
}

export const FIELD_RECT = new Phaser.Geom.Rectangle(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
