// Authoritative game state. No rendering code in here: it is shared by the
// Phaser presentation and the headless balance simulator.
import { COLS, FIELD_H, ROWS, TILE } from '../config';
import {
  ADVANCE_EMPTY_FRACTION,
  BOTS,
  CORE,
  CORE_START_ROW,
  DEPTH_METERS_PER_ROW,
  FEVER,
  LAYERS,
  PITY_FIRST_MEGA,
  PITY_MEGA,
  START_REEL,
  TILE_DEF,
  layerStartRow,
  upgradeCost,
  type Sym,
  type TileType,
} from '../data/balance';
import { UPGRADES, UPGRADE_BY_ID, computeMods, reelSwapFrom, type BotKind, type Mods, type UpgradeCtx, type UpgradeDef } from '../data/upgrades';
import { Mine, genChunk, genCoreChunk, toTiles } from './mine';
import { Resolver, center, groupActions, type ResolveHost } from './resolver';
import { Rng } from './rng';
import type { AdvanceResult, Cell, Loot, Notice, Resolution, Tile } from './types';

export const SAVE_VERSION = 1;

export interface Stats {
  spins: number;
  tiles: number;
  maxChain: number;
  megas: number;
  fevers: number;
  playMs: number;
  gas: number;
  crystals: number;
  bestSpinOre: number;
  coreMs: number;
}

export interface BotState {
  count: number;
  on: boolean;
}

export interface Offer {
  id: string;
  swapFrom?: number; // reel index to replace
}

type SavedTile = [number, number, number, number]; // type index, hp, layer, variant

export interface SaveData {
  v: number;
  savedAt: number;
  seed: number;
  rng: [number, number, number];
  ore: number;
  totalOre: number;
  depthRows: number;
  stacks: Record<string, number>;
  bought: number;
  reel: Sym[];
  bots: Record<BotKind, BotState>;
  feverUnlocked: boolean;
  fever: number;
  feversDone: number;
  tutorial: number;
  spinsSinceMega: number;
  megaSeen: boolean;
  target: Cell | null;
  core: { locked: boolean; left: number; done: boolean };
  endless: boolean;
  pendingRewards: number[];
  pendingOffer: { offers: Offer[]; free: boolean } | null;
  layerSeen: number;
  seenTips: string[];
  stats: Stats;
  grid: (SavedTile | null)[];
  queue: (SavedTile | null)[][];
  nextTileId: number;
  loot: Loot[];
  nextLootId: number;
}

const TYPES: TileType[] = ['rock', 'hard', 'gold', 'gas', 'crystal', 'bombrock', 'armor', 'unstable', 'heart'];

export const TUTORIAL_T1: Cell = { c: 15, r: 9 };
export const TUTORIAL_T2: Cell = { c: 16, r: 9 };

export const LAYER_REWARD_BOT: (BotKind | null)[] = ['drill', 'magnet', 'bomb', null];

export function layerOfRow(g: number): number {
  let s = 0;
  for (let i = 0; i < LAYERS.length; i++) {
    s += LAYERS[i].rows;
    if (g < s) return i;
  }
  return LAYERS.length - 1;
}

export class Game implements ResolveHost {
  seed = 0;
  genRng = new Rng(1);
  spinRng = new Rng(2);
  rng = new Rng(3);
  mine = new Mine();
  loot = new Map<number, Loot>();
  nextLootId = 1;

  ore = 0;
  totalOre = 0;
  /** Ore that the simulation has granted but the presentation has not shown arriving yet. */
  unseen = 0;
  depthRows = 0;
  stacks: Record<string, number> = {};
  bought = 0;
  reel: Sym[] = [...START_REEL];
  bots: Record<BotKind, BotState> = { drill: { count: 0, on: true }, bomb: { count: 0, on: true }, magnet: { count: 0, on: true } };
  botTimers: Record<BotKind, number[]> = { drill: [], bomb: [], magnet: [] };
  feverUnlocked = false;
  fever = 0;
  feversDone = 0;
  feverActive = false;
  feverLeft = 0;
  feverReadyNotified = false;
  tutorial = 0;
  spinsSinceMega = 0;
  megaSeen = false;
  target: Cell | null = null;
  core = { locked: false, left: CORE.fragments, done: false };
  endless = false;
  pendingRewards: number[] = [];
  pendingOffer: { offers: Offer[]; free: boolean } | null = null;
  layerSeen = 0;
  seenTips: string[] = [];
  stats: Stats = { spins: 0, tiles: 0, maxChain: 0, megas: 0, fevers: 0, playMs: 0, gas: 0, crystals: 0, bestSpinOre: 0, coreMs: 0 };
  notices: Notice[] = [];
  mods: Mods = computeMods({});

  // ------------------------------------------------------------ creation / save

  static create(seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0): Game {
    const g = new Game();
    g.seed = seed;
    g.genRng = new Rng(seed ^ 0x9e3779b9);
    g.spinRng = new Rng(seed ^ 0x85ebca6b);
    g.rng = new Rng(seed ^ 0xc2b2ae35);
    const chunk = genChunk(0, ROWS, g.genRng);
    const tiles = toTiles(g.mine, chunk, 0, g.genRng);
    for (let i = 0; i < ROWS; i++) {
      const r = ROWS - 1 - i;
      for (let c = 0; c < COLS; c++) g.mine.set(c, r, tiles[i][c]);
    }
    g.layoutTutorial();
    g.ensureQueue();
    return g;
  }

  private layoutTutorial() {
    const m = this.mine;
    const put = (c: number, r: number, t: TileType | null) => m.set(c, r, t ? m.make(t, 0, (c * 7 + r * 3) % 4) : null);
    // open cave floor in front of the machine
    for (let r = 10; r < ROWS; r++) for (let c = 0; c < COLS; c++) put(c, r, null);
    for (const c of [0, 1, 2, 28, 29, 30]) put(c, 10, 'rock');
    for (const c of [0, 30]) put(c, 11, 'rock');
    // calm area around the tutorial targets
    for (let r = 0; r <= 9; r++)
      for (let c = 9; c <= 25; c++) {
        const t = m.get(c, r);
        if (!t || t.t !== 'rock') put(c, r, 'rock');
      }
    // gold next to the first target (MAGNET rips it on spin 1)
    put(13, 9, 'gold');
    put(14, 8, 'gold');
    put(17, 8, 'gold');
    put(15, 5, 'gold');
    // gas vein reached by the bomb on spin 2
    const gas: [number, number][] = [
      [17, 6], [17, 5], [18, 5], [18, 4], [19, 4], [19, 3], [20, 3], [21, 3], [21, 2], [22, 2], [22, 1], [23, 1], [23, 0], [24, 0],
    ];
    for (const [c, r] of gas) put(c, r, 'gas');
    for (const [c, r] of [[24, 1], [24, 2], [22, 0], [20, 2], [25, 1]] as [number, number][]) put(c, r, 'gold');
    put(12, 7, 'hard');
    put(11, 7, 'hard');
    put(10, 4, 'hard');
    const t1 = m.get(TUTORIAL_T1.c, TUTORIAL_T1.r);
    if (t1) t1.hint = true;
  }

  serialize(): SaveData {
    const st = (t: Tile | null): SavedTile | null => (t ? [TYPES.indexOf(t.t), t.hp, t.layer, t.v] : null);
    return {
      v: SAVE_VERSION,
      savedAt: Date.now(),
      seed: this.seed,
      rng: [this.genRng.s, this.spinRng.s, this.rng.s],
      ore: this.ore,
      totalOre: this.totalOre,
      depthRows: this.depthRows,
      stacks: { ...this.stacks },
      bought: this.bought,
      reel: [...this.reel],
      bots: JSON.parse(JSON.stringify(this.bots)),
      feverUnlocked: this.feverUnlocked,
      fever: this.fever,
      feversDone: this.feversDone,
      tutorial: this.tutorial,
      spinsSinceMega: this.spinsSinceMega,
      megaSeen: this.megaSeen,
      target: this.target ? { ...this.target } : null,
      core: { ...this.core },
      endless: this.endless,
      pendingRewards: [...this.pendingRewards],
      pendingOffer: this.pendingOffer ? JSON.parse(JSON.stringify(this.pendingOffer)) : null,
      layerSeen: this.layerSeen,
      seenTips: [...this.seenTips],
      stats: { ...this.stats },
      grid: this.mine.grid.map(st),
      queue: this.mine.queue.map((row) => row.map(st)),
      nextTileId: this.mine.nextId,
      loot: [...this.loot.values()].map((l) => ({ ...l })),
      nextLootId: this.nextLootId,
    };
  }

  static load(d: SaveData): Game {
    if (!d || d.v !== SAVE_VERSION) throw new Error('bad save version');
    const g = new Game();
    g.seed = d.seed;
    g.genRng = new Rng(d.rng[0]);
    g.spinRng = new Rng(d.rng[1]);
    g.rng = new Rng(d.rng[2]);
    g.ore = d.ore;
    g.totalOre = d.totalOre;
    g.depthRows = d.depthRows;
    g.stacks = { ...d.stacks };
    g.bought = d.bought;
    g.reel = [...d.reel];
    g.bots = d.bots;
    g.feverUnlocked = d.feverUnlocked;
    g.fever = d.fever;
    g.feversDone = d.feversDone;
    g.tutorial = d.tutorial;
    g.spinsSinceMega = d.spinsSinceMega;
    g.megaSeen = d.megaSeen;
    g.target = d.target;
    g.core = { ...d.core };
    g.endless = d.endless;
    g.pendingRewards = [...d.pendingRewards];
    g.pendingOffer = d.pendingOffer;
    g.layerSeen = d.layerSeen;
    g.seenTips = [...(d.seenTips ?? [])];
    g.stats = { ...g.stats, ...d.stats };
    let id = 1;
    const lt = (s: SavedTile | null): Tile | null => (s ? { id: id++, t: TYPES[s[0]], hp: s[1], layer: s[2], v: s[3] } : null);
    g.mine.grid = d.grid.map(lt);
    g.mine.queue = d.queue.map((row) => row.map(lt));
    g.mine.nextId = Math.max(id, d.nextTileId);
    for (const l of d.loot) g.loot.set(l.id, { ...l });
    g.nextLootId = d.nextLootId;
    g.mods = computeMods(g.stacks);
    if (g.tutorial === 0) {
      const t1 = g.mine.get(TUTORIAL_T1.c, TUTORIAL_T1.r);
      if (t1) t1.hint = true;
    } else if (g.tutorial === 1) {
      const t2 = g.mine.get(TUTORIAL_T2.c, TUTORIAL_T2.r);
      if (t2) t2.hint = true;
    }
    g.feverReadyNotified = g.fever >= g.feverMax();
    g.syncBotTimers();
    g.ensureQueue();
    return g;
  }

  // ------------------------------------------------------------ ResolveHost

  newLootId(): number {
    return this.nextLootId++;
  }
  tileValue(t: Tile): number {
    const L = LAYERS[Math.min(t.layer, LAYERS.length - 1)];
    return TILE_DEF[t.t].value * L.valueMult * this.mods.oreMult * (this.endless ? 1.5 : 1);
  }
  gain(v: number): void {
    this.ore += v;
    this.totalOre += v;
    this.unseen += v;
  }
  addFever(n: number): void {
    if (!this.feverUnlocked || this.feverActive) return;
    const max = this.feverMax();
    this.fever = Math.min(max, this.fever + n);
    if (this.fever >= max && !this.feverReadyNotified) {
      this.feverReadyNotified = true;
      this.notices.push({ k: 'feverReady' });
    }
  }
  onBroken(t: TileType): void {
    this.stats.tiles++;
    if (t === 'gas') this.stats.gas++;
    if (t === 'crystal') this.stats.crystals++;
  }
  onCoreDone(): void {
    this.core.done = true;
    this.stats.coreMs = this.stats.playMs;
  }

  // ------------------------------------------------------------ derived

  get layer(): number {
    if (this.core.locked) return LAYERS.length - 1;
    return layerOfRow(this.depthRows + 5);
  }
  get depthMeters(): number {
    return this.depthRows * DEPTH_METERS_PER_ROW;
  }
  /** 0..1 progress through the current layer (by the row at the middle of the screen). */
  layerProgress(): number {
    const i = this.layer;
    const s = layerStartRow(i);
    return Math.max(0, Math.min(1, (this.depthRows + 5 - s) / LAYERS[i].rows));
  }
  /** 0..1 progress through the whole campaign */
  totalProgress(): number {
    return Math.max(0, Math.min(1, (this.depthRows + 5) / (CORE_START_ROW + 5)));
  }
  displayOre(): number {
    return Math.max(0, this.ore - this.unseen);
  }
  arrive(v: number) {
    this.unseen = Math.max(0, this.unseen - v);
  }
  feverMax(): number {
    const base = FEVER.maxByLayer[Math.min(this.layer, FEVER.maxByLayer.length - 1)];
    return Math.round(base * (1 + this.feversDone * FEVER.maxGrowthPerFever) * Math.pow(FEVER.fastMult, this.mods.feverFast));
  }
  feverReady(): boolean {
    return this.feverUnlocked && !this.feverActive && this.fever >= this.feverMax();
  }
  feverDuration(): number {
    return FEVER.durationMs + this.mods.feverLong * FEVER.longBonusMs;
  }

  // ------------------------------------------------------------ targeting & spinning

  targetAllowed(c: number, r: number): boolean {
    if (!this.mine.inb(c, r)) return false;
    if (this.core.done && !this.endless) return false;
    if (this.tutorial === 0) return c === TUTORIAL_T1.c && r === TUTORIAL_T1.r;
    if (this.tutorial === 1) return c === TUTORIAL_T2.c && r === TUTORIAL_T2.r;
    return true;
  }
  setTarget(c: number, r: number): boolean {
    if (!this.targetAllowed(c, r)) return false;
    this.target = { c, r };
    return true;
  }
  canPull(): boolean {
    return !!this.target && !this.pendingOffer && !(this.core.done && !this.endless);
  }

  /** Decide the three reel results. */
  pull(): Sym[] {
    this.stats.spins++;
    let res: Sym[];
    if (this.tutorial === 0) res = ['D', 'D', 'M'];
    else if (this.tutorial === 1) res = ['D', 'B', 'M'];
    else {
      const pity = this.megaSeen ? PITY_MEGA : PITY_FIRST_MEGA;
      if (!this.feverActive && this.spinsSinceMega >= pity) {
        const s = this.megaSeen ? this.reel[this.spinRng.int(this.reel.length)] : 'D';
        res = [s, s, s];
      } else {
        res = [0, 1, 2].map(() => this.reel[this.spinRng.int(this.reel.length)]);
      }
    }
    const acts = groupActions(res, this.feverActive);
    if (acts.some((a) => a.level >= 3)) {
      this.spinsSinceMega = 0;
      this.megaSeen = true;
      this.stats.megas++;
    } else if (this.tutorial >= 2) this.spinsSinceMega++;
    return res;
  }

  resolveSpin(res: Sym[]): Resolution {
    const target = this.target ?? { c: 15, r: 6 };
    const r = new Resolver(this, this.feverActive).spin(groupActions(res, this.feverActive), target);
    this.stats.maxChain = Math.max(this.stats.maxChain, r.chain);
    this.stats.bestSpinOre = Math.max(this.stats.bestSpinOre, r.ore);
    if (this.tutorial === 0) {
      this.tutorial = 1;
      this.target = null;
      const t2 = this.mine.get(TUTORIAL_T2.c, TUTORIAL_T2.r);
      if (t2) t2.hint = true;
      this.notices.push({ k: 'tutorial', step: 1 });
    } else if (this.tutorial === 1) {
      this.tutorial = 2;
      this.notices.push({ k: 'tutorial', step: 2 });
    }
    return r;
  }

  // ------------------------------------------------------------ advancing

  needsAdvance(): boolean {
    if (this.tutorial < 2) return false;
    if (this.core.locked && !this.endless) return false;
    return this.mine.emptyCount() / (COLS * ROWS) >= ADVANCE_EMPTY_FRACTION;
  }

  ensureQueue() {
    while (this.mine.queue.length < 3) {
      const g = this.depthRows + ROWS + this.mine.queue.length;
      if (!this.endless && g === CORE_START_ROW && !this.core.locked && !this.core.done) {
        this.mine.queue.push(...toTiles(this.mine, genCoreChunk(this.genRng), LAYERS.length - 1, this.genRng));
        continue;
      }
      const li = layerOfRow(g);
      let h = 8;
      if (!this.endless && g < CORE_START_ROW) {
        const end = layerStartRow(li + 1);
        h = Math.max(1, Math.min(8, end - g));
      }
      this.mine.queue.push(...toTiles(this.mine, genChunk(li, h, this.genRng), li, this.genRng));
    }
  }

  advance(): AdvanceResult {
    const m = this.mine;
    const res: AdvanceResult = { crushed: [], pushedLoot: [], newRow: [], layerChanged: false };
    const before = this.layer;
    for (let c = 0; c < COLS; c++) {
      const t = m.get(c, ROWS - 1);
      if (!t) continue;
      const value = t.t === 'heart' ? 0 : this.tileValue(t) * 0.6;
      this.gain(value);
      this.onBroken(t.t);
      res.crushed.push({ cell: { c, r: ROWS - 1 }, id: t.id, tt: t.t, layer: t.layer, value });
    }
    for (let r = ROWS - 1; r > 0; r--) for (let c = 0; c < COLS; c++) m.set(c, r, m.get(c, r - 1));
    this.ensureQueue();
    const row = m.queue.shift()!;
    for (let c = 0; c < COLS; c++) m.set(c, 0, row[c]);
    res.newRow = row;
    for (const l of [...this.loot.values()]) {
      l.y += TILE;
      if (l.y >= FIELD_H - 2) {
        this.loot.delete(l.id);
        this.gain(l.value);
        res.pushedLoot.push({ id: l.id, value: l.value });
      }
    }
    if (this.target) this.target = { c: this.target.c, r: Math.min(ROWS - 1, this.target.r + 1) };
    this.depthRows++;
    this.ensureQueue();
    const after = this.layer;
    if (after > before && after > this.layerSeen) {
      this.layerSeen = after;
      res.layerChanged = true;
      this.pendingRewards.push(after - 1);
      this.notices.push({ k: 'layer', from: before, to: after });
    }
    if (!this.endless && !this.core.locked && this.depthRows >= CORE_START_ROW - 1) {
      this.core.locked = true;
      this.notices.push({ k: 'coreLocked' });
      // The Heart Core appearing calms the machine: the final fight is played by hand.
      if (this.feverActive) {
        this.feverActive = false;
        this.feverLeft = 0;
        this.notices.push({ k: 'feverEnd' });
      }
    }
    return res;
  }

  // ------------------------------------------------------------ fever / bots / time

  startFever(): boolean {
    if (!this.feverReady()) return false;
    this.feverActive = true;
    this.feverLeft = this.feverDuration();
    this.fever = 0;
    this.feverReadyNotified = false;
    this.feversDone++;
    this.stats.fevers++;
    return true;
  }

  syncBotTimers() {
    for (const k of ['drill', 'bomb', 'magnet'] as BotKind[]) {
      const arr = this.botTimers[k];
      while (arr.length < this.bots[k].count) arr.push(this.botCooldown(k) * (0.4 + 0.5 * arr.length));
      arr.length = this.bots[k].count;
    }
  }
  botCooldown(k: BotKind): number {
    return BOTS[k].cooldown / (1 + this.mods.botSpeed * BOTS.speedPerUpgrade * 2);
  }

  /** Advance timers. `allowBots` is false while the presentation is busy (e.g. advancing rows). */
  tick(dt: number, allowBots: boolean): Resolution[] {
    this.stats.playMs += dt;
    const out: Resolution[] = [];
    if (this.feverActive) {
      this.feverLeft -= dt;
      if (this.feverLeft <= 0) {
        this.feverActive = false;
        this.feverLeft = 0;
        this.notices.push({ k: 'feverEnd' });
      }
    }
    if (this.tutorial < 2 || (this.core.done && !this.endless)) return out;
    for (const k of ['drill', 'bomb', 'magnet'] as BotKind[]) {
      const b = this.bots[k];
      if (!b.count || !b.on) continue;
      const arr = this.botTimers[k];
      for (let i = 0; i < arr.length; i++) {
        arr[i] -= dt;
        if (arr[i] > 0 || !allowBots) continue;
        const r = this.botAct(k, i);
        arr[i] = r ? this.botCooldown(k) * (0.85 + this.rng.next() * 0.3) : 700;
        if (r) out.push(r);
      }
    }
    return out;
  }

  private botAct(k: BotKind, slot: number): Resolution | null {
    const m = this.mine;
    const rs = new Resolver(this, this.feverActive);
    if (k === 'drill') {
      const cands = m.find((t, c, r) => (t.t === 'rock' || t.t === 'gold' || t.t === 'hard') && m.exposed(c, r) && !m.get(c, r + 1));
      if (!cands.length) return null;
      cands.sort((a, b) => b.r - a.r);
      const pick = cands[Math.min(cands.length - 1, Math.floor(Math.pow(this.rng.next(), 2) * cands.length))];
      return rs.botDrill(slot, pick);
    }
    if (k === 'bomb') {
      let cands = m.find((t, c, r) => (t.t === 'gas' || t.t === 'bombrock') && m.exposed(c, r));
      if (!cands.length) cands = m.find((t, c, r) => t.t !== 'heart' && m.exposed(c, r));
      if (!cands.length) return null;
      return rs.botBomb(slot, cands[this.rng.int(cands.length)]);
    }
    const items = [...this.loot.values()];
    if (!items.length) return null;
    const l = items[this.rng.int(items.length)];
    return rs.botMagnet(slot, { x: l.x, y: l.y });
  }

  // ------------------------------------------------------------ upgrades

  upgradeCost(): number {
    return upgradeCost(this.bought);
  }
  canBuy(): boolean {
    return this.tutorial >= 2 && !this.pendingOffer && this.displayOre() >= this.upgradeCost();
  }
  private ctx(): UpgradeCtx {
    return {
      stacks: this.stacks,
      bought: this.bought,
      layer: this.layer,
      feverUnlocked: this.feverUnlocked,
      bots: { drill: this.bots.drill.count, bomb: this.bots.bomb.count, magnet: this.bots.magnet.count },
      reel: this.reel,
    };
  }
  eligible(): UpgradeDef[] {
    const c = this.ctx();
    return UPGRADES.filter((u) => {
      if ((this.stacks[u.id] ?? 0) >= u.max) return false;
      if (u.req && !u.req(c)) return false;
      if (u.swapTo && reelSwapFrom(this.reel, u.swapTo) < 0) return false;
      return true;
    });
  }
  makeOffers(): Offer[] {
    if (this.bought === 0) return [{ id: 'drill_len' }, { id: 'gas_chain' }, { id: 'magnet_range' }];
    const pool = this.eligible();
    const out: UpgradeDef[] = [];
    const cats = new Map<string, number>();
    while (out.length < 3 && pool.length) {
      const weights = pool.map((u) => u.weight * Math.pow(0.25, cats.get(u.cat) ?? 0) * (u.cat === 'reel' && out.some((o) => o.cat === 'reel') ? 0 : 1));
      const total = weights.reduce((a, b) => a + b, 0);
      if (total <= 0) break;
      let x = this.rng.next() * total;
      let idx = 0;
      for (; idx < pool.length; idx++) {
        x -= weights[idx];
        if (x <= 0) break;
      }
      idx = Math.min(idx, pool.length - 1);
      const u = pool.splice(idx, 1)[0];
      out.push(u);
      cats.set(u.cat, (cats.get(u.cat) ?? 0) + 1);
    }
    return out.map((u) => ({ id: u.id, swapFrom: u.swapTo ? reelSwapFrom(this.reel, u.swapTo) : undefined }));
  }
  /** Pay for an upgrade and get three cards. */
  buy(): Offer[] | null {
    if (!this.canBuy()) return null;
    const cost = this.upgradeCost();
    this.ore -= cost;
    const offers = this.makeOffers();
    this.pendingOffer = { offers, free: false };
    return offers;
  }
  /** Free cards (layer rewards). */
  openReward(): { layer: number; bot: BotKind | null; offers: Offer[] } | null {
    if (this.pendingOffer || !this.pendingRewards.length) return null;
    const layer = this.pendingRewards.shift()!;
    const bot = LAYER_REWARD_BOT[layer] ?? null;
    if (bot) {
      this.bots[bot].count = Math.max(1, this.bots[bot].count);
      this.bots[bot].on = true;
      this.syncBotTimers();
      this.notices.push({ k: 'botUnlocked', bot });
    } else {
      for (const k of ['drill', 'bomb', 'magnet'] as BotKind[]) if (this.bots[k].count < 3) this.bots[k].count++;
      this.syncBotTimers();
    }
    const offers = this.makeOffers();
    this.pendingOffer = { offers, free: true };
    return { layer, bot, offers };
  }
  pick(index: number): UpgradeDef | null {
    const po = this.pendingOffer;
    if (!po) return null;
    const o = po.offers[index];
    if (!o) return null;
    const u = UPGRADE_BY_ID[o.id];
    this.stacks[u.id] = (this.stacks[u.id] ?? 0) + 1;
    if (u.swapTo) {
      const from = o.swapFrom ?? reelSwapFrom(this.reel, u.swapTo);
      if (from >= 0) this.reel[from] = u.swapTo;
    }
    if (u.bot) {
      this.bots[u.bot].count++;
      this.syncBotTimers();
    }
    if (!po.free) this.bought++;
    this.pendingOffer = null;
    this.mods = computeMods(this.stacks);
    if (!this.feverUnlocked && this.bought >= FEVER.unlockAfterUpgrades) {
      this.feverUnlocked = true;
      this.notices.push({ k: 'feverUnlocked' });
    }
    this.syncBotTimers();
    return u;
  }

  startEndless() {
    this.endless = true;
    this.core.locked = false;
  }

  takeNotices(): Notice[] {
    const n = this.notices;
    this.notices = [];
    return n;
  }

  heartCenter() {
    return center(CORE.centerCol, 5);
  }
}
