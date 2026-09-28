import { COLS, ROWS } from '../config';
import { CORE, LAYERS, TILE_DEF, type TileType } from '../data/balance';
import { Rng } from './rng';
import type { Cell, Tile } from './types';

export type GenCell = TileType | null;

/** The visible rock wall. Row 0 is the top (deepest), row ROWS-1 is next to the machine. */
export class Mine {
  grid: (Tile | null)[] = new Array(COLS * ROWS).fill(null);
  /** Rows waiting to enter at the top of the field. queue[0] enters next. */
  queue: (Tile | null)[][] = [];
  nextId = 1;

  inb(c: number, r: number): boolean {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS;
  }
  get(c: number, r: number): Tile | null {
    if (!this.inb(c, r)) return null;
    return this.grid[r * COLS + c];
  }
  set(c: number, r: number, t: Tile | null): void {
    if (!this.inb(c, r)) return;
    this.grid[r * COLS + c] = t;
  }
  make(t: TileType, layer: number, v: number): Tile {
    return { id: this.nextId++, t, hp: TILE_DEF[t].hp, layer, v };
  }
  emptyCount(): number {
    let n = 0;
    for (const t of this.grid) if (!t) n++;
    return n;
  }
  find(pred: (t: Tile, c: number, r: number) => boolean): Cell[] {
    const out: Cell[] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const t = this.grid[r * COLS + c];
        if (t && pred(t, c, r)) out.push({ c, r });
      }
    return out;
  }
  /** True if the tile has at least one empty 4-neighbour (visible face). */
  exposed(c: number, r: number): boolean {
    const n = [
      [c + 1, r],
      [c - 1, r],
      [c, r + 1],
      [c, r - 1],
    ];
    for (const [x, y] of n) {
      if (!this.inb(x, y)) {
        if (y >= ROWS) return true;
        continue;
      }
      if (!this.get(x, y)) return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------- generation

function inChunk(h: number, c: number, r: number): boolean {
  return c >= 0 && c < COLS && r >= 0 && r < h;
}

/** Generate `h` rows for a layer. Result[0] is the first row to enter the field. */
export function genChunk(layerIdx: number, h: number, rng: Rng): GenCell[][] {
  const L = LAYERS[layerIdx];
  const g = L.gen;
  const rows: GenCell[][] = [];
  for (let r = 0; r < h; r++) rows.push(new Array(COLS).fill('rock'));
  const scale = h / 8;
  const set = (c: number, r: number, t: GenCell) => {
    if (inChunk(h, c, r)) rows[r][c] = t;
  };
  const get = (c: number, r: number): GenCell | undefined => (inChunk(h, c, r) ? rows[r][c] : undefined);

  // Hard boulders: small clumps.
  for (let i = rng.count(g.hardClumps * scale); i > 0; i--) {
    let c = rng.int(COLS);
    let r = rng.int(h);
    const n = rng.irange(2, 5);
    for (let k = 0; k < n; k++) {
      set(c, r, 'hard');
      if (rng.chance(0.5)) c += rng.chance(0.5) ? 1 : -1;
      else r += rng.chance(0.5) ? 1 : -1;
    }
  }
  // Caves: open pockets that make the wall readable and let loot tumble.
  for (let i = rng.count(g.caves * scale); i > 0; i--) {
    const cx = rng.int(COLS);
    const cy = rng.int(h);
    const rad = rng.range(1.0, 2.3);
    for (let r = Math.floor(cy - rad); r <= cy + rad; r++)
      for (let c = Math.floor(cx - rad * 1.4); c <= cx + rad * 1.4; c++) {
        const dx = (c - cx) / 1.4;
        const dy = r - cy;
        if (dx * dx + dy * dy <= rad * rad) set(c, r, null);
      }
  }
  // Gold veins: diagonal streaks.
  for (let i = rng.count(g.goldVeins * scale); i > 0; i--) {
    let c = rng.int(COLS);
    let r = rng.int(h);
    const dc = rng.chance(0.5) ? 1 : -1;
    const n = rng.irange(g.goldVeinLen[0], g.goldVeinLen[1]);
    for (let k = 0; k < n; k++) {
      set(c, r, 'gold');
      if (rng.chance(0.6)) c += dc;
      if (rng.chance(0.6)) r += 1;
      if (rng.chance(0.15)) set(c + dc, r, 'gold');
    }
  }
  // Gas veins: snaking pockets.
  for (let i = rng.count(g.gasVeins * scale); i > 0; i--) {
    let c = rng.irange(1, COLS - 2);
    let r = rng.int(h);
    const n = rng.irange(g.gasVeinLen[0], g.gasVeinLen[1]);
    let dir = rng.int(4);
    for (let k = 0; k < n; k++) {
      set(c, r, 'gas');
      if (rng.chance(0.35)) dir = rng.int(4);
      const d = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ][dir];
      c = Math.max(0, Math.min(COLS - 1, c + d[0]));
      r = Math.max(0, Math.min(h - 1, r + d[1]));
      if (rng.chance(0.12)) set(c + 1, r, 'gas');
    }
  }
  // Bomb rocks, usually next to gas so the player can "see" the chain before it happens.
  for (let i = rng.count(g.bombRocks * scale); i > 0; i--) {
    let placed = false;
    for (let tries = 0; tries < 12 && !placed; tries++) {
      const c = rng.int(COLS);
      const r = rng.int(h);
      if (get(c, r) !== 'rock' && get(c, r) !== 'hard') continue;
      const nearGas = [get(c + 1, r), get(c - 1, r), get(c, r + 1), get(c, r - 1)].includes('gas');
      if (nearGas || tries > 8) {
        set(c, r, 'bombrock');
        placed = true;
      }
    }
  }
  // Crystal clusters.
  for (let i = rng.count(g.crystals * scale); i > 0; i--) {
    let c = rng.int(COLS);
    let r = rng.int(h);
    const n = rng.irange(1, 3);
    for (let k = 0; k < n; k++) {
      set(c, r, 'crystal');
      if (rng.chance(0.5)) c += rng.chance(0.5) ? 1 : -1;
      else r += 1;
    }
  }
  // Sprinkles.
  for (let r = 0; r < h; r++)
    for (let c = 0; c < COLS; c++) {
      if (rows[r][c] !== 'rock') continue;
      if (rng.chance(g.hardSprinkle)) rows[r][c] = 'hard';
      else if (rng.chance(g.goldSprinkle)) rows[r][c] = 'gold';
    }
  return rows;
}

/** 11 rows: normal core-layer rock with the Heart Core stamped in the middle. */
export function genCoreChunk(rng: Rng): GenCell[][] {
  const rows = genChunk(LAYERS.length - 1, CORE.chunkRows, rng);
  for (let i = 1; i <= 9; i++) {
    const fieldRow = 10 - i; // where this chunk row ends up once the core locks in
    const dy = fieldRow - 5;
    for (let c = 0; c < COLS; c++) {
      const dx = c - CORE.centerCol;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= CORE.heartR) rows[i][c] = 'heart';
      else if (d <= CORE.unstableR) rows[i][c] = 'unstable';
      else if (d <= CORE.armorR) rows[i][c] = 'armor';
      else if (d <= CORE.armorR + 1.2 && rows[i][c] === null) rows[i][c] = 'rock';
    }
  }
  return rows;
}

export function toTiles(mine: Mine, chunk: GenCell[][], layer: number, rng: Rng): (Tile | null)[][] {
  return chunk.map((row) => row.map((t) => (t ? mine.make(t, layer, rng.int(4)) : null)));
}
