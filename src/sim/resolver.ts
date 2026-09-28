// Resolves one machine activation (or one bot action) into a timeline of events.
// The grid is mutated in the exact time order the events are emitted, so the
// presentation can replay them faithfully and chains stay causal.
import { COLS, NOZZLE_LOCAL, ROWS, TILE } from '../config';
import {
  BOMB,
  BOTS,
  CHAIN_ORE_BONUS,
  CHAIN_ORE_BONUS_CAP,
  CORE,
  DRILL,
  EXPLOSION,
  FEVER,
  LOOT_CAP,
  LOOT_VALUE_SHARE_DIRECT,
  MAGNET,
  MAGNET_RIP_MULT,
  TILE_DEF,
  type Sym,
  type TileType,
} from '../data/balance';
import type { BotKind, Mods } from '../data/upgrades';
import type { Mine } from './mine';
import type { Rng } from './rng';
import type { Cause, Cell, Dir, ExplKind, GEvent, Loot, Pt, Resolution, Tile } from './types';

export interface ActionSpec {
  sym: Sym;
  level: number;
  span?: number; // how many reels produced this action
}

/** What the resolver needs from the game state. */
export interface ResolveHost {
  mine: Mine;
  mods: Mods;
  rng: Rng;
  loot: Map<number, Loot>;
  newLootId(): number;
  tileValue(t: Tile): number;
  gain(v: number): void;
  addFever(n: number): void;
  onBroken(t: TileType): void;
  core: { locked: boolean; left: number; done: boolean };
  onCoreDone(): void;
}

interface QItem {
  t: number;
  s: number;
  fn: () => void;
}

class Heap {
  a: QItem[] = [];
  get size() {
    return this.a.length;
  }
  private less(i: number, j: number) {
    const x = this.a[i];
    const y = this.a[j];
    return x.t < y.t || (x.t === y.t && x.s < y.s);
  }
  push(it: QItem) {
    const a = this.a;
    a.push(it);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop(): QItem | undefined {
    const a = this.a;
    if (!a.length) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.less(l, m)) m = l;
        if (r < a.length && this.less(r, m)) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

export const center = (c: number, r: number): Pt => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 });
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export function snapDir(from: Pt, to: Pt): Dir {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const ang = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 = straight up
  const a = Math.abs(ang);
  const sx = ang >= 0 ? 1 : -1;
  if (a <= 30) return { dx: 0, dy: -1 };
  if (a <= 70) return { dx: sx, dy: -1 };
  return { dx: sx, dy: 0 };
}

const DIRS8: Dir[] = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 1, dy: 1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: -1, dy: -1 },
];
const dirIndex = (d: Dir) => DIRS8.findIndex((x) => x.dx === d.dx && x.dy === d.dy);
const rot = (d: Dir, steps: number): Dir => DIRS8[(dirIndex(d) + steps + 8) % 8];

function dmgFor(t: TileType, cause: Cause, power: number): number {
  if (cause === 'crush' || cause === 'core') return 999;
  switch (t) {
    case 'hard':
      return cause === 'drill' ? 3 : cause === 'blast' ? power : 1;
    case 'armor':
      return cause === 'drill' ? (power >= 3 ? 4 : 2) : cause === 'blast' ? power : 1;
    case 'unstable':
      return cause === 'blast' ? 3 * power : 1;
    case 'crystal':
      return cause === 'blast' ? 2 : 1;
    default:
      return 99;
  }
}

const MAJOR = new Set(['drillStep', 'drillEnd', 'hit', 'break', 'explode', 'fuse', 'magnetPulse', 'rip', 'bombLaunch', 'shard', 'heart', 'grow', 'finale']);

export class Resolver {
  ev: GEvent[] = [];
  private q = new Heap();
  private seq = 0;
  now = 0;
  chain = 0;
  broken = 0;
  ore = 0;
  private explosions = 0;
  private bomblets = 0;
  private lineSeq = 0;
  private lastT = 0;
  private leadEnd: Cell | null = null;
  private finaleAt = -1;

  constructor(private h: ResolveHost, private fever: boolean) {}

  private at(t: number, fn: () => void) {
    this.q.push({ t, s: this.seq++, fn });
  }
  private run() {
    for (;;) {
      const it = this.q.pop();
      if (!it) break;
      this.now = it.t;
      it.fn();
    }
  }
  private emit(e: GEvent) {
    this.ev.push(e);
    if (MAJOR.has(e.k) && e.t > this.lastT) this.lastT = e.t;
  }
  private gain(v: number) {
    this.ore += v;
    this.h.gain(v);
  }
  private bumpChain() {
    this.chain++;
    this.emit({ t: this.now, k: 'chain', n: this.chain });
  }
  private chainMult() {
    return 1 + Math.min(CHAIN_ORE_BONUS_CAP, this.chain * CHAIN_ORE_BONUS);
  }

  result(): Resolution {
    this.ev.sort((a, b) => a.t - b.t);
    return { events: this.ev, duration: this.lastT + 120, chain: this.chain, broken: this.broken, ore: this.ore };
  }

  // ------------------------------------------------------------ top level

  spin(actions: ActionSpec[], target: Cell): Resolution {
    let t = 0;
    let drillEnd: Cell | null = null;
    let reel = 0;
    for (const a of actions) {
      const span = a.span ?? a.level;
      this.emit({ t, k: 'act', sym: a.sym, level: a.level, reels: [reel, Math.min(2, reel + span - 1)] });
      reel += span;
      if (a.level >= 3) {
        this.emit({ t, k: 'mega', sym: a.sym });
        t += 160;
      }
      if (a.sym === 'D') {
        this.leadEnd = null;
        this.drill(t, target, a.level);
        this.run();
        drillEnd = this.leadEnd;
      } else if (a.sym === 'B') {
        const at = drillEnd ?? target;
        this.bomb(t, at, a.level, !!drillEnd);
        this.run();
        drillEnd = null;
      } else {
        this.magnet(t, target, a.level);
        this.run();
      }
      t = Math.max(t + 120, this.lastT + 70);
      if (this.h.core.done) break; // nothing after the final blow
    }
    return this.result();
  }

  // ------------------------------------------------------------ tiles

  private damage(c: number, r: number, cause: Cause, power: number) {
    const mine = this.h.mine;
    const tile = mine.get(c, r);
    if (!tile) return;
    if (tile.t === 'heart') return;
    if (tile.t === 'gas') {
      if (cause === 'drill' || cause === 'ore') {
        this.emit({ t: this.now, k: 'pass', cell: { c, r }, id: tile.id });
        return;
      }
      this.breakTile(c, r, tile, cause, power);
      if (cause === 'crush' || cause === 'core') return;
      const d = Math.max(EXPLOSION.gasDelayMin, EXPLOSION.gasDelayBase - this.chain * EXPLOSION.gasDelayDecay) * (this.h.mods.gasChain ? 0.78 : 1);
      this.at(this.now + d, () => {
        this.explode(c, r, EXPLOSION.gasRadius + this.h.mods.gasChain * EXPLOSION.gasRadiusPerUpgrade, 1, 'gas');
        this.maybeBomblet(c, r);
      });
      return;
    }
    const dmg = dmgFor(tile.t, cause, power);
    tile.hp -= dmg;
    if (tile.hp > 0) {
      this.emit({ t: this.now, k: 'hit', cell: { c, r }, id: tile.id, hp: tile.hp, maxHp: TILE_DEF[tile.t].hp, cause, power });
      return;
    }
    this.breakTile(c, r, tile, cause, power);
    if (cause === 'crush' || cause === 'core') return;
    if (tile.t === 'bombrock') {
      this.at(this.now + 70, () => {
        this.explode(c, r, EXPLOSION.bombRockRadius + this.h.mods.gasChain * 0.5, 2, 'bombrock');
        this.maybeBomblet(c, r);
      });
    } else if (tile.t === 'crystal') {
      this.shatter(c, r);
    }
  }

  private breakTile(c: number, r: number, tile: Tile, cause: Cause, power: number) {
    const h = this.h;
    h.mine.set(c, r, null);
    this.broken++;
    h.onBroken(tile.t);
    this.emit({ t: this.now, k: 'break', cell: { c, r }, id: tile.id, tt: tile.t, layer: tile.layer, cause, power });
    const def = TILE_DEF[tile.t];
    h.addFever(def.fever);
    let value = h.tileValue(tile) * this.chainMult() * (this.fever ? FEVER.oreMult : 1);
    if (cause === 'core') value *= 3;
    if (value <= 0) return;
    const p = center(c, r);
    if (cause === 'crush' || cause === 'core' || h.loot.size >= LOOT_CAP) {
      this.gain(value);
      this.emit({ t: this.now, k: 'oreDirect', at: p, value, kind: def.lootKind, n: cause === 'core' ? 2 : 1 });
      return;
    }
    const direct = value * LOOT_VALUE_SHARE_DIRECT;
    this.gain(direct);
    this.emit({ t: this.now, k: 'oreDirect', at: p, value: direct, kind: def.lootKind, n: 1 });
    const loose = value - direct;
    const n = def.loot;
    for (let i = 0; i < n; i++) {
      const l: Loot = {
        id: h.newLootId(),
        kind: def.lootKind,
        value: loose / n,
        x: p.x + (h.rng.next() - 0.5) * 8,
        y: p.y + (h.rng.next() - 0.5) * 8,
      };
      h.loot.set(l.id, l);
      this.emit({ t: this.now, k: 'lootSpawn', loot: { ...l } });
    }
  }

  // ------------------------------------------------------------ explosions

  private explode(cc: number, cr: number, radius: number, power: number, kind: ExplKind) {
    if (this.explosions++ > EXPLOSION.maxChainExplosions) return;
    if (kind === 'gas' || kind === 'bombrock' || kind === 'bomblet' || kind === 'tip') this.bumpChain();
    const p = center(cc, cr);
    this.emit({ t: this.now, k: 'explode', at: p, radius, kind, chain: this.chain, power });
    const R = Math.ceil(radius);
    for (let r = cr - R; r <= cr + R; r++)
      for (let c = cc - R; c <= cc + R; c++) {
        if (!this.h.mine.inb(c, r)) continue;
        const d = Math.hypot(c - cc, r - cr);
        if (d > radius + 0.01) continue;
        const delay = d * EXPLOSION.waveMsPerTile;
        this.at(this.now + delay, () => this.damage(c, r, 'blast', power));
      }
  }

  private maybeBomblet(c: number, r: number) {
    if (!this.h.mods.chainSpawn || this.bomblets > 40) return;
    const rng = this.h.rng;
    if (!rng.chance(0.5)) return;
    this.bomblets++;
    const ang = rng.next() * Math.PI * 2;
    const d = rng.range(2.2, 3.6);
    const tc = Math.max(0, Math.min(COLS - 1, Math.round(c + Math.cos(ang) * d)));
    const tr = Math.max(0, Math.min(ROWS - 1, Math.round(r + Math.sin(ang) * d)));
    const flight = 190;
    this.emit({ t: this.now, k: 'bombLaunch', from: center(c, r), to: center(tc, tr), level: 1, flight, small: true });
    this.at(this.now + flight + 40, () => this.explode(tc, tr, EXPLOSION.bombletRadius, 1, 'bomblet'));
  }

  private shatter(c: number, r: number) {
    this.bumpChain();
    const from = center(c, r);
    const diag = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    for (const [dx, dy] of diag) {
      let hitCell: Cell | null = null;
      let k = 1;
      for (; k <= 3; k++) {
        const x = c + dx * k;
        const y = r + dy * k;
        if (!this.h.mine.inb(x, y)) break;
        const t = this.h.mine.get(x, y);
        if (t && t.t !== 'heart') {
          hitCell = { c: x, r: y };
          break;
        }
      }
      const kk = Math.min(k, 3);
      const to = hitCell ? center(hitCell.c, hitCell.r) : center(c + dx * kk, r + dy * kk);
      const ms = 35 * kk + 20;
      this.emit({ t: this.now, k: 'shard', from, to, ms });
      if (hitCell) {
        const hc = hitCell;
        this.at(this.now + ms, () => this.damage(hc.c, hc.r, 'shard', 1));
      }
    }
  }

  // ------------------------------------------------------------ DRILL

  private drill(t: number, target: Cell, level: number) {
    const mods = this.h.mods;
    const to = center(target.c, target.r);
    const dir = snapDir(NOZZLE_LOCAL, to);
    const flight = DRILL.flightMs;
    this.emit({ t, k: 'drillLaunch', to: target, dir, level, flight, from: { ...NOZZLE_LOCAL } });
    const len = level >= 3 ? DRILL.len[3] : DRILL.len[level] + mods.drillLen + (this.fever ? 1 : 0);
    const dirs = mods.drillTwin ? [rot(dir, -1), rot(dir, 1)] : [dir];
    const offsets = level >= 3 ? [0, -1, 1] : [0];
    let first = true;
    for (const d of dirs) {
      const perp = d.dy === 0 ? { dx: 0, dy: 1 } : { dx: 1, dy: 0 };
      for (const off of offsets) {
        const start = { c: target.c + perp.dx * off, r: target.r + perp.dy * off };
        const lead = off === 0;
        const isFirst = first && lead;
        first = false;
        this.drillLine(t + flight, start, d, len, level, lead, (end) => {
          if (isFirst) this.leadEnd = end;
          if (lead && (mods.drillTip > 0 || level >= 3)) {
            const rad = level >= 3 ? DRILL.megaTipRadius + mods.drillTip * 0.5 : 0.9 + mods.drillTip * 0.6;
            this.explode(end.c, end.r, rad, level >= 3 ? 2 : 1, 'tip');
          }
        });
      }
    }
  }

  private drillLine(t0: number, start: Cell, dir: Dir, len: number, level: number, lead: boolean, onEnd: (end: Cell) => void, stepScale = 1) {
    const mine = this.h.mine;
    const line = this.lineSeq++;
    let pos = { ...start };
    let d = { ...dir };
    let left = len;
    let steps = 0;
    let bounces = 0;
    let wall = this.h.mods.ricochet;
    let last = { ...start };
    const stepMs = DRILL.stepMs[Math.min(3, level)] * stepScale;
    const finish = () => {
      this.emit({ t: this.now, k: 'drillEnd', cell: { ...last }, dir: { ...d }, line, level });
      onEnd({ ...last });
    };
    const step = () => {
      if (left <= 0 || steps > 70) return finish();
      if (!mine.inb(pos.c, pos.r)) {
        const offTop = pos.r < 0;
        const offSide = pos.c < 0 || pos.c >= COLS;
        if (wall > 0 && (offTop || offSide) && steps > 0) {
          wall--;
          if (offSide) d = { dx: -d.dx, dy: d.dy };
          if (offTop) d = { dx: d.dx, dy: -d.dy };
          if (d.dx === 0 && d.dy === 1 && offTop) d = { dx: pos.c < COLS / 2 ? 1 : -1, dy: 1 };
          this.emit({ t: this.now, k: 'drillBounce', cell: { ...last }, dir: { ...d }, line, wall: true });
          pos = { c: last.c + d.dx, r: last.r + d.dy };
          left += 2;
          this.at(this.now + stepMs, step);
          return;
        }
        return finish();
      }
      steps++;
      const cell = { ...pos };
      const tile = mine.get(cell.c, cell.r);
      const solid = !!tile && tile.t !== 'gas';
      this.emit({ t: this.now, k: 'drillStep', cell, dir: { ...d }, level, line, hit: solid, lead });
      if (tile) {
        if (tile.t === 'crystal' || tile.t === 'heart') {
          if (tile.t === 'crystal') this.damage(cell.c, cell.r, 'drill', level);
          if (bounces < 8) {
            bounces++;
            this.bumpChain();
            let nd = rot(d, tile.v % 2 === 0 ? 2 : -2);
            if (nd.dy > 0) nd = rot(d, tile.v % 2 === 0 ? -2 : 2);
            if (nd.dy > 0) nd = { dx: -d.dx, dy: -d.dy };
            d = nd;
            this.emit({ t: this.now, k: 'drillBounce', cell, dir: { ...d }, line, wall: false });
            left += 2;
          } else left--;
        } else if (tile.t === 'gas') {
          this.damage(cell.c, cell.r, 'drill', level);
        } else {
          this.damage(cell.c, cell.r, 'drill', level);
          left--;
        }
      }
      last = cell;
      pos = { c: cell.c + d.dx, r: cell.r + d.dy };
      this.at(this.now + (solid ? stepMs : stepMs * 0.55), step);
    };
    this.at(t0, step);
  }

  // ------------------------------------------------------------ BOMB

  private bomb(t: number, at: Cell, level: number, inside: boolean) {
    const mods = this.h.mods;
    const p = center(at.c, at.r);
    const flight = BOMB.flightMs + (level >= 3 ? 60 : 0);
    this.emit({ t, k: 'bombLaunch', from: { ...NOZZLE_LOCAL }, to: p, level, flight, small: false });
    const fuse = BOMB.fuseMs + (level >= 3 ? 220 : 0);
    this.emit({ t: t + flight, k: 'fuse', at: p, level, ms: fuse });
    this.at(t + flight + fuse, () => {
      const R = BOMB.radius[Math.min(3, level)] + mods.bombSize + (inside ? BOMB.insideBonus : 0) + (this.fever ? 0.3 : 0);
      this.explode(at.c, at.r, R, BOMB.power[Math.min(3, level)], level >= 3 ? 'mega' : 'bomb');
      if (level >= 3) {
        // Shockwave: everything just outside the blast gets cracked / knocked loose.
        const outer = R + BOMB.megaShockExtra;
        this.at(this.now + 60, () => {
          this.emit({ t: this.now, k: 'explode', at: p, radius: outer, kind: 'shock', chain: this.chain, power: 1 });
          const O = Math.ceil(outer);
          for (let r = at.r - O; r <= at.r + O; r++)
            for (let c = at.c - O; c <= at.c + O; c++) {
              const d = Math.hypot(c - at.c, r - at.r);
              if (d <= R || d > outer) continue;
              this.at(this.now + (d - R) * 16, () => this.damage(c, r, 'blast', 1));
            }
        });
      }
      const n = mods.cluster + (level >= 3 ? 2 : 0);
      for (let i = 0; i < n; i++) {
        const rng = this.h.rng;
        const ang = rng.next() * Math.PI * 2;
        const d = rng.range(R * 0.6, R + 2.6);
        const tc = Math.max(0, Math.min(COLS - 1, Math.round(at.c + Math.cos(ang) * d)));
        const tr = Math.max(0, Math.min(ROWS - 1, Math.round(at.r + Math.sin(ang) * d)));
        const fl = 200 + i * 35;
        this.emit({ t: this.now + 30, k: 'bombLaunch', from: p, to: center(tc, tr), level: 1, flight: fl, small: true });
        this.at(this.now + 30 + fl + 50, () => this.explode(tc, tr, EXPLOSION.bombletRadius, 1, 'bomblet'));
      }
    });
  }

  // ------------------------------------------------------------ MAGNET

  private magnet(t: number, target: Cell, level: number) {
    const h = this.h;
    const mods = h.mods;
    const storm = level >= 3 || (level === 2 && mods.magnetStorm);
    const p = center(target.c, target.r);
    const flight = MAGNET.flightMs;
    this.emit({ t, k: 'magnetLaunch', to: p, level: storm ? 3 : level, flight });
    this.at(t + flight, () => {
      const lv = Math.min(2, level);
      const R = storm ? 9999 : (MAGNET.radiusTiles[lv] + mods.magnetRange + (this.fever ? 1.5 : 0)) * TILE;
      const GR = storm ? 9999 : (MAGNET.goldRadiusTiles[lv] + mods.magnetRange * 0.5 + (this.fever ? 1 : 0)) * TILE;
      this.emit({ t: this.now, k: 'magnetPulse', at: p, radius: Math.min(R, 900), level: storm ? 3 : level, storm });
      const items = [...h.loot.values()].filter((l) => dist(l, p) <= R).sort((a, b) => dist(a, p) - dist(b, p));
      let crash = 0;
      const ripped = new Set<number>();
      const rip = (c: number, r: number, delay: number) => {
        const tile = h.mine.get(c, r);
        if (!tile || tile.t !== 'gold' || ripped.has(tile.id)) return;
        ripped.add(tile.id);
        h.mine.set(c, r, null);
        this.broken++;
        h.onBroken('gold');
        h.addFever(TILE_DEF.gold.fever);
        const value = h.tileValue(tile) * MAGNET_RIP_MULT * (this.fever ? FEVER.oreMult : 1);
        this.gain(value);
        this.emit({ t: this.now, k: 'rip', cell: { c, r }, id: tile.id, tt: tile.t, layer: tile.layer, value, delay });
      };
      items.forEach((l, i) => {
        h.loot.delete(l.id);
        this.gain(l.value);
        const delay = 140 + Math.min(i * 7, 480) + (storm ? h.rng.next() * 220 : 0);
        let crashAt: Pt | undefined;
        if (mods.magnetCrash && crash < 18) {
          const cell = this.firstSolidOnPath(l, NOZZLE_LOCAL);
          if (cell) {
            crash++;
            crashAt = center(cell.c, cell.r);
            const cc = cell;
            this.at(this.now + delay + 110, () => this.damage(cc.c, cc.r, 'ore', 1));
          }
        }
        this.emit({ t: this.now, k: 'collect', id: l.id, delay, crashAt });
        if (mods.magnetSweep && ripped.size < 40) {
          for (const cell of this.cellsNearPath(l, NOZZLE_LOCAL)) rip(cell.c, cell.r, delay + 60);
        }
      });
      const golds = h.mine.find((tl) => tl.t === 'gold').filter((cl) => dist(center(cl.c, cl.r), p) <= GR);
      golds.sort((a, b) => dist(center(a.c, a.r), p) - dist(center(b.c, b.r), p));
      golds.forEach((cl, i) => rip(cl.c, cl.r, 120 + Math.min(i * 22, 500) + (storm ? h.rng.next() * 200 : 0)));
      // Heart Core: one exposed fragment per magnet, then the shell grows back.
      if (h.core.locked && !h.core.done && h.core.left > 0 && this.heartExposed()) {
        const hc = center(CORE.centerCol, 5);
        if (storm || dist(hc, p) <= R + TILE * 2) {
          h.core.left--;
          const value = h.tileValue({ id: 0, t: 'unstable', hp: 1, layer: 4, v: 0 }) * CORE.fragmentValue;
          this.gain(value);
          this.emit({ t: this.now, k: 'heart', left: h.core.left, at: hc, delay: 260, value });
          if (h.core.left <= 0) this.at(this.now + 700, () => this.finale());
          else this.at(this.now + CORE.regrowMs, () => this.regrow());
        }
      }
    });
  }

  private firstSolidOnPath(from: Pt, to: Pt): Cell | null {
    const n = Math.ceil(dist(from, to) / 6);
    for (let i = 1; i < n; i++) {
      const x = from.x + ((to.x - from.x) * i) / n;
      const y = from.y + ((to.y - from.y) * i) / n;
      const c = Math.floor(x / TILE);
      const r = Math.floor(y / TILE);
      const t = this.h.mine.get(c, r);
      if (t && t.t !== 'heart' && t.t !== 'gas') return { c, r };
    }
    return null;
  }

  private cellsNearPath(from: Pt, to: Pt): Cell[] {
    const out: Cell[] = [];
    const n = Math.ceil(dist(from, to) / 8);
    for (let i = 1; i < n; i++) {
      const x = from.x + ((to.x - from.x) * i) / n;
      const y = from.y + ((to.y - from.y) * i) / n;
      const c = Math.floor(x / TILE);
      const r = Math.floor(y / TILE);
      for (const [dc, dr] of [
        [0, 0],
        [1, 0],
        [-1, 0],
      ]) {
        const t = this.h.mine.get(c + dc, r + dr);
        if (t && t.t === 'gold') out.push({ c: c + dc, r: r + dr });
      }
    }
    return out;
  }

  /** The heart rebuilds its unstable shell (ring at distance 2) after losing a fragment. */
  private regrow() {
    const cc = CORE.centerCol;
    const cr = 5;
    const mine = this.h.mine;
    let k = 0;
    for (let r = cr - 2; r <= cr + 2; r++)
      for (let c = cc - 2; c <= cc + 2; c++) {
        if (Math.max(Math.abs(c - cc), Math.abs(r - cr)) !== 2 || mine.get(c, r)) continue;
        const tile = mine.make('unstable', 4, (c + r) % 4);
        mine.set(c, r, tile);
        this.emit({ t: this.now + k * 18, k: 'grow', cell: { c, r }, tile: { ...tile } });
        k++;
      }
  }

  get coreDone() {
    return this.h.core.done;
  }

  heartExposed(): boolean {
    const cc = CORE.centerCol;
    const cr = 5;
    for (let r = cr - 2; r <= cr + 2; r++)
      for (let c = cc - 2; c <= cc + 2; c++) {
        if (Math.max(Math.abs(c - cc), Math.abs(r - cr)) !== 2) continue;
        if (!this.h.mine.get(c, r)) return true;
      }
    return false;
  }

  private finale() {
    if (this.finaleAt >= 0) return;
    this.finaleAt = this.now;
    const h = this.h;
    const hc = center(CORE.centerCol, 5);
    this.emit({ t: this.now, k: 'finale', at: hc });
    // clear heart tiles
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const tl = h.mine.get(c, r);
        if (tl && tl.t === 'heart') h.mine.set(c, r, null);
      }
    const base = this.now + 1900;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (!h.mine.get(c, r)) continue;
        const d = Math.hypot(c - CORE.centerCol, r - 5);
        this.at(base + d * 26, () => this.damage(c, r, 'core', 9));
      }
    h.onCoreDone();
  }

  // ------------------------------------------------------------ bots

  botDrill(slot: number, cell: Cell): Resolution {
    const go = 360;
    this.emit({ t: 0, k: 'botGo', bot: 'drill', slot, to: center(cell.c, cell.r + 1), ms: go });
    this.drillLine(go, cell, { dx: 0, dy: -1 }, BOTS.drill.len, 1, true, () => {}, 1.2);
    this.run();
    return this.result();
  }

  botBomb(slot: number, cell: Cell): Resolution {
    const go = 380;
    const p = center(cell.c, cell.r);
    this.emit({ t: 0, k: 'botGo', bot: 'bomb', slot, to: { x: p.x, y: p.y + 14 }, ms: go });
    this.emit({ t: go, k: 'bombLaunch', from: { x: p.x, y: p.y + 14 }, to: p, level: 1, flight: 140, small: true });
    this.at(go + 140 + 90, () => this.explode(cell.c, cell.r, BOTS.bomb.radius, 1, 'bot'));
    this.run();
    return this.result();
  }

  botMagnet(slot: number, at: Pt): Resolution {
    const h = this.h;
    const go = 320;
    this.emit({ t: 0, k: 'botGo', bot: 'magnet', slot, to: at, ms: go });
    const items = [...h.loot.values()]
      .filter((l) => dist(l, at) <= BOTS.magnet.grabRadius)
      .sort((a, b) => dist(a, at) - dist(b, at))
      .slice(0, BOTS.magnet.maxItems);
    items.forEach((l, i) => {
      h.loot.delete(l.id);
      this.gain(l.value);
      this.emit({ t: go, k: 'collect', id: l.id, delay: 60 + i * 30 });
    });
    this.lastT = go + 100;
    return this.result();
  }
}

export function groupActions(syms: Sym[], fever: boolean): ActionSpec[] {
  const out: ActionSpec[] = [];
  for (const s of syms) {
    const last = out[out.length - 1];
    if (last && last.sym === s) {
      last.level++;
      last.span = (last.span ?? 1) + 1;
    } else out.push({ sym: s, level: 1, span: 1 });
  }
  if (fever) for (const a of out) a.level = Math.min(3, a.level + FEVER.levelBoost);
  return out;
}

export type { BotKind };
