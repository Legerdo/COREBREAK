// Little helper robots that live on the machine deck and fly into the mine.
import Phaser from 'phaser';
import { FIELD_X, FIELD_Y } from '../config';
import type { BotKind } from '../data/upgrades';
import type { Game } from '../sim/game';
import type { Pt } from '../sim/types';
import { D } from './depth';
import type { Particles } from './particles';

interface Bot {
  kind: BotKind;
  slot: number;
  spr: Phaser.GameObjects.Sprite;
  home: number;
  x: number;
  y: number;
  dir: number;
  state: 'drop' | 'idle' | 'go' | 'work' | 'back' | 'party';
  t: number;
  dur: number;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  hop: number;
}

const DECK_Y = 216;
const HOME: Record<BotKind, [number, number]> = { drill: [150, 250], bomb: [470, 560], magnet: [388, 460] };

export class BotsView {
  private bots: Bot[] = [];
  constructor(private scene: Phaser.Scene, private game: Game, private parts: Particles) {}

  sync(drop = true) {
    for (const k of ['drill', 'bomb', 'magnet'] as BotKind[]) {
      const n = this.game.bots[k].count;
      const have = this.bots.filter((b) => b.kind === k);
      for (let i = have.length; i < n; i++) this.add(k, i, drop);
    }
  }

  private add(kind: BotKind, slot: number, drop: boolean) {
    const [a, b] = HOME[kind];
    const home = a + ((slot * 37 + 11) % (b - a));
    const spr = this.scene.add.sprite(home, drop ? -20 : DECK_Y, `bot_${kind}`, 0).setOrigin(0.5, 1).setDepth(D.bots);
    this.bots.push({ kind, slot, spr, home, x: home, y: drop ? -20 : DECK_Y, dir: 1, state: drop ? 'drop' : 'idle', t: 0, dur: 700, fx: home, fy: -20, tx: home, ty: DECK_Y, hop: 0 });
  }

  go(kind: BotKind, slot: number, to: Pt, ms: number) {
    const b = this.bots.find((x) => x.kind === kind && x.slot === slot);
    if (!b) return;
    b.state = 'go';
    b.t = 0;
    b.dur = ms;
    b.fx = b.x;
    b.fy = b.y;
    b.tx = FIELD_X + to.x;
    b.ty = FIELD_Y + to.y;
  }

  party() {
    for (const b of this.bots) {
      b.state = 'party';
      b.t = Math.random() * 400;
    }
  }
  calm() {
    for (const b of this.bots) if (b.state === 'party') b.state = 'idle';
  }

  update(dt: number) {
    for (const b of this.bots) {
      b.t += dt;
      const on = this.game.bots[b.kind].on;
      let frame = 0;
      switch (b.state) {
        case 'drop': {
          const u = Math.min(1, b.t / b.dur);
          b.y = -20 + (DECK_Y + 20) * (u * u);
          frame = 2;
          if (u >= 1) {
            b.state = 'idle';
            b.hop = 200;
            this.puff(b.x, DECK_Y);
          }
          break;
        }
        case 'idle': {
          if (!on) {
            frame = 0;
            break;
          }
          const [a, c] = HOME[b.kind];
          b.x += b.dir * dt * 0.012;
          if (b.x > c) b.dir = -1;
          if (b.x < a) b.dir = 1;
          frame = Math.floor(b.t / 160) % 2;
          if (Math.random() < dt * 0.0003) b.hop = 180;
          break;
        }
        case 'go': {
          const u = Math.min(1, b.t / b.dur);
          const e = 1 - (1 - u) * (1 - u);
          b.x = b.fx + (b.tx - b.fx) * e;
          b.y = b.fy + (b.ty - b.fy) * e - Math.sin(u * Math.PI) * 26;
          frame = 2;
          if (Math.floor(b.t / 40) !== Math.floor((b.t - dt) / 40)) this.parts.spawn({ key: 'spark', frames: 3, x: b.x, y: b.y + 2, vy: 30, life: 180, depth: D.bots - 1 });
          if (u >= 1) {
            b.state = 'work';
            b.t = 0;
          }
          break;
        }
        case 'work': {
          frame = Math.floor(b.t / 60) % 2 ? 2 : 0;
          b.y = b.ty + (Math.floor(b.t / 80) % 2);
          if (b.t > 420) {
            b.state = 'back';
            b.t = 0;
            b.fx = b.x;
            b.fy = b.y;
            b.dur = 520;
          }
          break;
        }
        case 'back': {
          const u = Math.min(1, b.t / b.dur);
          const e = u * u * (3 - 2 * u);
          b.x = b.fx + (b.home - b.fx) * e;
          b.y = b.fy + (DECK_Y - b.fy) * e - Math.sin(u * Math.PI) * 20;
          frame = 2;
          if (u >= 1) {
            b.state = 'idle';
            b.y = DECK_Y;
            b.hop = 120;
          }
          break;
        }
        case 'party': {
          frame = Math.floor(b.t / 90) % 3;
          b.x += Math.sin(b.t / 300 + b.slot) * dt * 0.05;
          b.y = DECK_Y - Math.abs(Math.sin(b.t / 160 + b.slot)) * 12;
          break;
        }
      }
      let hy = 0;
      if (b.hop > 0) {
        b.hop -= dt;
        hy = -Math.round(Math.sin((1 - Math.max(0, b.hop) / 200) * Math.PI) * 4);
      }
      b.spr.setFrame(frame);
      b.spr.setFlipX(b.dir < 0);
      b.spr.setAlpha(on || b.state !== 'idle' ? 1 : 0.55);
      b.spr.setPosition(Math.round(b.x), Math.round(b.y + hy));
    }
  }

  private puff(x: number, y: number) {
    for (let i = 0; i < 5; i++) this.parts.spawn({ key: 'dust', frames: 5, x: x + (i - 2) * 3, y: y - 2, vx: (i - 2) * 12, vy: -10, life: 380, depth: D.bots - 1 });
  }
}
