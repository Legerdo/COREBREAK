// Tiny looping animations on upgrade cards so the effect can be understood without reading.
import Phaser from 'phaser';
import type { Sym } from '../data/balance';
import { P } from '../data/palette';
import { pixelRing } from './ui';

const CS = 8; // mini cell size
const LOOP = 2600;

type Cells = (string | null)[][];

export class Preview {
  private g: Phaser.GameObjects.Graphics;
  private t = 0;
  private icons: Phaser.GameObjects.Image[] = [];
  private cols: number;
  private rows: number;

  constructor(
    private scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    private x: number,
    private y: number,
    private w: number,
    private h: number,
    private kind: string,
    private extra: { reel?: Sym[]; from?: number; to?: Sym } = {},
  ) {
    this.g = scene.add.graphics();
    parent.add(this.g);
    this.cols = Math.floor(w / CS);
    this.rows = Math.floor(h / CS);
    if (kind === 'reel_swap' && extra.reel) {
      const n = extra.reel.length;
      const gap = Math.floor((w - n * 16) / (n + 1));
      extra.reel.forEach((s, i) => {
        const im = scene.add.image(x + gap + i * (16 + gap) + 8, y + h / 2, 'symS_' + s);
        this.icons.push(im);
        parent.add(im);
      });
    }
    if (kind === 'bot') {
      const im = scene.add.sprite(x + 10, y + h - 4, 'bot_drill', 0).setOrigin(0.5, 1);
      this.icons.push(im);
      parent.add(im);
    }
    if (kind === 'ore' || kind === 'fever') {
      const im = scene.add.image(x + w / 2, y + h / 2, kind === 'ore' ? 'loot_ore_icon' : 'fever_icon');
      this.icons.push(im);
      parent.add(im);
    }
  }

  private grid(fill: (c: number, r: number) => string | null): Cells {
    const cells: Cells = [];
    for (let r = 0; r < this.rows; r++) {
      const row: (string | null)[] = [];
      for (let c = 0; c < this.cols; c++) row.push(fill(c, r));
      cells.push(row);
    }
    return cells;
  }

  private drawCells(cells: Cells) {
    const g = this.g;
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const k = cells[r][c];
        if (!k) continue;
        const x = this.x + c * CS;
        const y = this.y + r * CS;
        const [m, l, d] =
          k === 'gas' ? [P.amber, P.yellow, P.orange] : k === 'gold' ? [P.amber, P.yellow, P.darkBrown] : k === 'hard' ? [P.darkBrown, P.rust, P.plum] : [P.rust, P.clay, P.darkBrown];
        g.fillStyle(m, 1).fillRect(x, y, CS, CS);
        g.fillStyle(l, 1).fillRect(x, y, CS, 1).fillRect(x, y, 1, CS);
        g.fillStyle(d, 1).fillRect(x, y + CS - 1, CS, 1).fillRect(x + CS - 1, y, 1, CS);
        if (k === 'gas') g.fillStyle(P.white, 1).fillRect(x + 2, y + 2, 1, 1);
      }
  }

  private cx(c: number) {
    return this.x + c * CS + CS / 2;
  }
  private cy(r: number) {
    return this.y + r * CS + CS / 2;
  }

  private drill(x: number, y: number, dx = 0, dy = -1) {
    const g = this.g;
    const ang = Math.atan2(dx, -dy);
    const pts = [
      [0, -5],
      [3, 2],
      [-3, 2],
    ].map(([px, py]) => [x + px * Math.cos(ang) - py * Math.sin(ang), y + px * Math.sin(ang) + py * Math.cos(ang)]);
    g.fillStyle(P.silver, 1).fillTriangle(pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
    g.fillStyle(P.amber, 1).fillRect(Math.round(x - dx * 3) - 2, Math.round(y - dy * 3) - 1, 4, 3);
  }

  private boom(x: number, y: number, r: number, u: number, color: number = P.amber) {
    if (u < 0 || u > 1) return;
    const g = this.g;
    const rr = r * (0.5 + 0.5 * u);
    const cx = Math.round(x);
    const cy = Math.round(y);
    if (u < 0.2) g.fillStyle(P.white, 1).fillCircle(cx, cy, Math.round(rr));
    else {
      g.fillStyle(u < 0.6 ? P.orange : P.crimson, 1 - u * 0.6).fillCircle(cx, cy, Math.round(rr));
      g.fillStyle(color, 1 - u).fillCircle(cx, cy, Math.round(rr * 0.65));
      if (u < 0.5) g.fillStyle(P.white, 1).fillCircle(cx, cy, Math.max(1, Math.round(rr * 0.25)));
    }
    pixelRing(g, x, y, rr + 2, P.yellow, 1 - u);
  }

  private dot(x: number, y: number, color: number = P.cyan) {
    this.g.fillStyle(P.ink, 1).fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
    this.g.fillStyle(color, 1).fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
  }

  update(dt: number) {
    this.t = (this.t + dt) % LOOP;
    const t = this.t;
    const g = this.g;
    g.clear();
    g.fillStyle(0x140e16, 1).fillRect(this.x, this.y, this.w, this.h);
    const C = this.cols;
    const R = this.rows;
    const mid = Math.floor(C / 2);
    switch (this.kind) {
      case 'drill_len': {
        const row = Math.max(0, R - 1 - Math.floor(t / 150));
        const cells = this.grid((c, r) => (c === mid && r >= row && t < 2200 ? null : 'rock'));
        this.drawCells(cells);
        if (t < 2200) this.drill(this.cx(mid), this.cy(row));
        break;
      }
      case 'drill_twin': {
        const k = Math.floor(t / 170);
        const cells = this.grid((c, r) => {
          const d = R - 1 - r;
          if (t < 2200 && d <= k && (c === mid - d || c === mid + d)) return null;
          return 'rock';
        });
        this.drawCells(cells);
        if (t < 2200) {
          const d = Math.min(k, R - 1);
          this.drill(this.cx(mid - d), this.cy(R - 1 - d), -1, -1);
          this.drill(this.cx(mid + d), this.cy(R - 1 - d), 1, -1);
        }
        break;
      }
      case 'ricochet': {
        const path: [number, number][] = [];
        const sc = 3;
        for (let r = R - 1; r >= 0; r--) path.push([sc, r]);
        for (let k = 1; k < R; k++) path.push([sc + k, k]);
        const n = Math.min(path.length, Math.floor(t / 110));
        const dead = new Set(path.slice(0, n).map(([c, r]) => c + ',' + r));
        this.drawCells(this.grid((c, r) => (t < 2300 && dead.has(c + ',' + r) ? null : 'rock')));
        if (t < 2300 && n > 0) {
          const [c, r] = path[Math.min(n - 1, path.length - 1)];
          const up = n <= R;
          this.drill(this.cx(c), this.cy(r), up ? 0 : 1, up ? -1 : 1);
          if (n === R || n === R + 1) pixelRing(g, this.cx(sc), this.y + 1, 4, P.white, 1);
        }
        break;
      }
      case 'drill_tip': {
        const row = Math.max(2, R - 1 - Math.floor(t / 170));
        const blastT = (t - 170 * (R - 3) - 100) / 400;
        const cells = this.grid((c, r) => {
          if (t >= 2300) return 'rock';
          if (c === mid && r >= row) return null;
          if (blastT > 0 && Math.hypot(c - mid, r - 2) <= 1.6) return null;
          return 'rock';
        });
        this.drawCells(cells);
        if (blastT <= 0) this.drill(this.cx(mid), this.cy(row));
        this.boom(this.cx(mid), this.cy(2), 14, blastT);
        break;
      }
      case 'bomb_size': {
        const land = 700;
        const u = Math.min(1, t / land);
        const bx = this.x + this.w / 2;
        const by = this.cy(3);
        const e = (t - land - 150) / 450;
        this.drawCells(this.grid((c, r) => (e > 0 && t < 2300 && Math.hypot(c - mid, r - 3) <= 3.2 ? null : 'rock')));
        if (e <= 0) {
          const x = bx;
          const y = this.y + this.h + (by - this.y - this.h) * u - Math.sin(u * Math.PI) * 14;
          g.fillStyle(P.black, 1).fillCircle(Math.round(x), Math.round(y), 3);
          g.fillStyle(P.yellow, 1).fillRect(Math.round(x) + 1, Math.round(y) - 4, 1, 1);
        }
        this.boom(bx, by, 26, e, P.orange);
        break;
      }
      case 'cluster': {
        const e1 = (t - 300) / 400;
        const spots: [number, number][] = [
          [3, 1],
          [C - 3, 2],
          [mid + 1, R - 1],
        ];
        const cells = this.grid((c, r) => {
          if (t > 2300) return 'rock';
          if (e1 > 0 && Math.hypot(c - mid, r - 3) <= 1.6) return null;
          for (const [i, [sc, sr]] of spots.entries()) {
            const e2 = (t - 900 - i * 120) / 350;
            if (e2 > 0 && Math.hypot(c - sc, r - sr) <= 1.2) return null;
          }
          return 'rock';
        });
        this.drawCells(cells);
        this.boom(this.cx(mid), this.cy(3), 12, e1);
        spots.forEach(([sc, sr], i) => {
          const fu = (t - 600 - i * 120) / 300;
          if (fu > 0 && fu < 1) this.dot(this.cx(mid) + (this.cx(sc) - this.cx(mid)) * fu, this.cy(3) + (this.cy(sr) - this.cy(3)) * fu - Math.sin(fu * Math.PI) * 8, P.red);
          this.boom(this.cx(sc), this.cy(sr), 8, (t - 900 - i * 120) / 350);
        });
        break;
      }
      case 'gas_chain':
      case 'chain_spawn': {
        const vein = this.kind === 'gas_chain' ? Array.from({ length: C - 4 }, (_, i) => [2 + i, 3 + (i % 3 === 1 ? -1 : 0)] as [number, number]) : ([[3, 3], [4, 3], [4, 4]] as [number, number][]);
        const step = this.kind === 'gas_chain' ? 70 : 120;
        const start = 400;
        const gone = (i: number) => t > start + i * step && t < 2350;
        const cells = this.grid((c, r) => {
          const i = vein.findIndex(([vc, vr]) => vc === c && vr === r);
          if (i >= 0) return gone(i) ? null : 'gas';
          return 'rock';
        });
        if (this.kind === 'chain_spawn') {
          const e = (t - 1200) / 380;
          for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (e > 0 && t < 2350 && Math.hypot(c - (C - 4), r - 2) <= 1.4) cells[r][c] = null;
        }
        this.drawCells(cells);
        vein.forEach(([vc, vr], i) => this.boom(this.cx(vc), this.cy(vr), 9, (t - start - i * step) / 300, P.yellow));
        if (this.kind === 'chain_spawn') {
          const fu = (t - 800) / 400;
          if (fu > 0 && fu < 1) this.dot(this.cx(4) + (this.cx(C - 4) - this.cx(4)) * fu, this.cy(4) + (this.cy(2) - this.cy(4)) * fu - Math.sin(fu * Math.PI) * 12, P.red);
          this.boom(this.cx(C - 4), this.cy(2), 12, (t - 1200) / 380);
        }
        break;
      }
      case 'magnet_range':
      case 'storm':
      case 'magnet_crash':
      case 'magnet_sweep': {
        const storm = this.kind === 'storm';
        const crash = this.kind === 'magnet_crash';
        const sweep = this.kind === 'magnet_sweep';
        const baseX = this.x + this.w / 2;
        const baseY = this.y + this.h - 2;
        const cells = this.grid((c, r) => {
          if (crash) return r >= 3 && r <= 4 && c % 3 !== 0 ? 'rock' : null;
          if (sweep) return (c === mid - 2 || c === mid + 2) && r >= 2 && r <= 4 ? 'gold' : null;
          return r === R - 1 && (c < 3 || c > C - 4) ? 'rock' : null;
        });
        const dots: [number, number][] = [];
        const n = storm ? 18 : crash ? 5 : sweep ? 4 : 8;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const rr = storm ? 20 + (i % 3) * 12 : crash || sweep ? 0 : 14 + (i % 2) * 8;
          dots.push(crash || sweep ? [this.x + 14 + i * ((this.w - 28) / Math.max(1, n - 1)), this.y + 5] : [baseX + Math.cos(a) * rr * 1.6, this.y + this.h / 2 - 6 + Math.sin(a) * rr * 0.6]);
        }
        const pull = (t - 700) / 700;
        if (crash && pull > 0.35 && t < 2350) for (let r = 3; r <= 4; r++) for (let c = 0; c < C; c++) cells[r][c] = null;
        if (sweep && pull > 0.3 && t < 2350) for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (cells[r][c] === 'gold') cells[r][c] = null;
        this.drawCells(cells);
        if (!crash && !sweep && pull < 0.2) {
          const rad = storm ? 60 : 30 + Math.min(1, t / 700) * 14;
          pixelRing(g, baseX, this.y + this.h / 2 - 6, rad * (1 - Math.max(0, pull) * 3), P.sky, 0.8);
        }
        for (const [dx, dy] of dots) {
          const u = Math.max(0, Math.min(1, pull));
          const e = u * u;
          if (t > 2350) continue;
          this.dot(dx + (baseX - dx) * e, dy + (baseY - dy) * e, P.cyan);
        }
        if (sweep && pull > 0.3 && pull < 1) {
          const e = ((pull - 0.3) / 0.7) ** 2;
          for (const c of [mid - 2, mid + 2]) for (let r = 2; r <= 4; r++) this.dot(this.cx(c) + (baseX - this.cx(c)) * e, this.cy(r) + (baseY - this.cy(r)) * e, P.yellow);
        }
        // machine intake
        g.fillStyle(P.slate, 1).fillRect(baseX - 8, baseY - 1, 16, 3);
        break;
      }
      case 'reel_swap': {
        const i = this.extra.from ?? -1;
        const ic = this.icons[i];
        const to = this.extra.to;
        if (ic && to && this.extra.reel) {
          const phase = t / LOOP;
          const flip = phase > 0.35 && phase < 0.5 ? 1 - Math.abs((phase - 0.425) / 0.075) : 0;
          ic.setScale(1 - flip, 1);
          ic.setTexture('symS_' + (phase > 0.425 ? to : this.extra.reel[i]));
          if (phase > 0.43) {
            g.lineStyle(1, P.yellow, 1).strokeRect(Math.round(ic.x - 10) + 0.5, Math.round(ic.y - 10) + 0.5, 19, 19);
          }
        }
        break;
      }
      case 'ore': {
        const ic = this.icons[0];
        const u = (t % 900) / 900;
        ic.y = Math.round(this.y + this.h / 2 + 4 - Math.sin(u * Math.PI) * 10);
        for (let i = 0; i < 5; i++) {
          const k = ((t + i * 180) % 900) / 900;
          this.dot(this.x + 18 + i * 22, this.y + this.h - 6 - k * 30, P.cyan);
        }
        break;
      }
      case 'fever': {
        const u = Math.min(1, t / 1500);
        g.fillStyle(P.black, 1).fillRect(this.x + 8, this.y + this.h - 14, this.w - 16, 8);
        g.fillStyle(t > 1500 && Math.floor(t / 80) % 2 ? P.yellow : P.hotpink, 1).fillRect(this.x + 9, this.y + this.h - 13, Math.round((this.w - 18) * u), 6);
        this.icons[0].y = Math.round(this.y + 14 + (t > 1500 ? Math.sin(t / 50) * 2 : 0));
        break;
      }
      case 'bot': {
        const cells = this.grid((c, r) => (r >= 2 && r <= 4 && !(t > 1100 && t < 2400 && c === mid && r === 4) ? 'rock' : null));
        this.drawCells(cells);
        const bot = this.icons[0] as Phaser.GameObjects.Sprite;
        const u = Math.min(1, t / 900);
        const back = Math.max(0, Math.min(1, (t - 1500) / 800));
        const tx = this.cx(mid);
        const ty = this.cy(5) + 4;
        const hx = this.x + 12;
        const hy = this.y + this.h - 2;
        const x = back > 0 ? tx + (hx - tx) * back : hx + (tx - hx) * u;
        const y = back > 0 ? ty + (hy - ty) * back : hy + (ty - hy) * u - Math.sin(u * Math.PI) * 10;
        bot.setPosition(Math.round(x), Math.round(y));
        bot.setFrame(u < 1 || back > 0 ? 2 : Math.floor(t / 80) % 2);
        if (t > 1100 && t < 1300) this.boom(this.cx(mid), this.cy(4), 7, (t - 1100) / 200);
        break;
      }
    }
    // frame
    g.lineStyle(1, P.black, 1).strokeRect(this.x - 0.5, this.y - 0.5, this.w + 1, this.h + 1);
  }
}
