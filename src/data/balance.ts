// All gameplay numbers live here so balance can be tuned without touching logic.
import { P } from './palette';

export type Sym = 'D' | 'B' | 'M';
export const SYMS: Sym[] = ['D', 'B', 'M'];
export const SYM_NAME: Record<Sym, string> = { D: 'DRILL', B: 'BOMB', M: 'MAGNET' };
export const MEGA_NAME: Record<Sym, string> = { D: 'MEGA DRILL', B: 'MEGA BOMB', M: 'MAGNET STORM' };

export type TileType = 'rock' | 'hard' | 'gold' | 'gas' | 'crystal' | 'bombrock' | 'armor' | 'unstable' | 'heart';
export type LootKind = 'ore' | 'gold' | 'shard' | 'core';

export interface TileDef {
  hp: number;
  value: number; // ore value before multipliers
  loot: number; // number of loose loot pieces
  lootKind: LootKind;
  fever: number; // fever gauge gain when broken
}

export const TILE_DEF: Record<TileType, TileDef> = {
  rock: { hp: 1, value: 1, loot: 1, lootKind: 'ore', fever: 1 },
  hard: { hp: 3, value: 3, loot: 2, lootKind: 'ore', fever: 1 },
  gold: { hp: 1, value: 7, loot: 3, lootKind: 'gold', fever: 1 },
  gas: { hp: 1, value: 1, loot: 1, lootKind: 'ore', fever: 2 },
  crystal: { hp: 2, value: 12, loot: 3, lootKind: 'shard', fever: 2 },
  bombrock: { hp: 1, value: 2, loot: 1, lootKind: 'ore', fever: 2 },
  armor: { hp: 4, value: 8, loot: 2, lootKind: 'ore', fever: 1 },
  unstable: { hp: 3, value: 14, loot: 2, lootKind: 'shard', fever: 2 },
  heart: { hp: 9999, value: 0, loot: 0, lootKind: 'core', fever: 0 },
};

export const LOOT_VALUE_SHARE_DIRECT = 0.4; // part of a broken tile's value that flows straight into the machine
export const LOOT_CAP = 170; // max loose items on the field
export const MAGNET_RIP_MULT = 1.6; // gold pulled straight out of the wall is worth more

// --- Symbols by level (index = level, 1..3). Level 3 = MEGA / STORM.
export const DRILL = {
  len: [0, 3, 6, 60],
  width: [0, 1, 1, 3],
  stepMs: [0, 44, 36, 24],
  flightMs: 120,
  megaTipRadius: 2.2,
};

export const BOMB = {
  radius: [0, 1.2, 2.1, 4.0],
  power: [0, 1, 2, 3],
  insideBonus: 0.6,
  flightMs: 250,
  fuseMs: 170,
  megaShockExtra: 2.6,
};

export const MAGNET = {
  radiusTiles: [0, 7, 10, 999],
  goldRadiusTiles: [0, 2.6, 4.2, 999],
  flightMs: 190,
};

export const EXPLOSION = {
  gasRadius: 1.5,
  gasRadiusPerUpgrade: 0.8,
  gasDelayBase: 88,
  gasDelayMin: 26,
  gasDelayDecay: 3.2,
  bombRockRadius: 2.0,
  bombletRadius: 1.25,
  waveMsPerTile: 11,
  maxChainExplosions: 420,
};

export const CHAIN_ORE_BONUS = 0.04; // +4% ore per chain step
export const CHAIN_ORE_BONUS_CAP = 1.2;

// --- Reel
export const START_REEL: Sym[] = ['D', 'D', 'D', 'B', 'B', 'B', 'M', 'M'];
export const REEL_TIMING = {
  normal: { stops: [380, 580, 780], tease: 420 },
  fast: { stops: [200, 300, 400], tease: 220 },
  fever: { stops: [150, 230, 310], tease: 90 },
};
export const PITY_FIRST_MEGA = 6; // spins after tutorial before a guaranteed MEGA
export const PITY_MEGA = 22;

// --- Progression
export const ADVANCE_EMPTY_FRACTION = 0.4;
export const DEPTH_METERS_PER_ROW = 5;

export const UPGRADE_COST = { early: [25, 90, 220, 400, 650, 950, 1300], growth: 1.38 };
export function upgradeCost(n: number): number {
  const e = UPGRADE_COST.early;
  const c = n < e.length ? e[n] : e[e.length - 1] * Math.pow(UPGRADE_COST.growth, n - e.length + 1);
  // round to readable numbers
  if (c < 100) return Math.round(c);
  const mag = Math.pow(10, Math.floor(Math.log10(c)) - 1);
  return Math.round(c / mag) * mag;
}

export const FEVER = {
  unlockAfterUpgrades: 4,
  maxByLayer: [650, 1050, 1550, 2100, 2700],
  maxGrowthPerFever: 0.06,
  durationMs: 10000,
  longBonusMs: 3000,
  fastMult: 0.8, // gauge max multiplier per fever_fast stack
  oreMult: 2,
  levelBoost: 1,
};

export const BOTS = {
  drill: { cooldown: 3600, len: 2 },
  bomb: { cooldown: 6800, radius: 1.35 },
  magnet: { cooldown: 2200, grabRadius: 44, maxItems: 10 },
  speedPerUpgrade: 0.18,
};

// --- Layers
export interface LayerGen {
  hardClumps: number;
  caves: number;
  goldVeins: number;
  goldVeinLen: [number, number];
  gasVeins: number;
  gasVeinLen: [number, number];
  bombRocks: number;
  crystals: number;
  hardSprinkle: number;
  goldSprinkle: number;
}

export interface LayerPalette {
  k: number; // outline
  d: number;
  m: number;
  l: number;
  h: number;
  bg0: number; // deep background
  bg1: number;
  bg2: number;
  accent: number;
}

export interface LayerDef {
  id: string;
  name: string;
  toy: string; // what is new in this layer (Korean, short)
  rows: number; // rows of depth in this layer
  valueMult: number;
  pal: LayerPalette;
  gen: LayerGen;
  music: { root: number; bpm: number };
}

export const LAYERS: LayerDef[] = [
  {
    id: 'rust',
    name: 'RUST CRUST',
    toy: '드릴 · 폭탄 · 자석',
    rows: 160,
    valueMult: 1,
    pal: { k: P.plum, d: P.darkBrown, m: P.rust, l: P.clay, h: P.tan, bg0: 0x1d1119, bg1: P.plum, bg2: 0x52302f, accent: P.orange },
    gen: { hardClumps: 2.2, caves: 1.1, goldVeins: 1.3, goldVeinLen: [2, 4], gasVeins: 0.45, gasVeinLen: [4, 8], bombRocks: 0, crystals: 0, hardSprinkle: 0.02, goldSprinkle: 0.01 },
    music: { root: 45, bpm: 108 },
  },
  {
    id: 'gold',
    name: 'GOLD CAVERN',
    toy: 'GOLD가 가득! 자석으로 끌어와',
    rows: 260,
    valueMult: 2.4,
    pal: { k: 0x1f1520, d: P.plum, m: P.darkBrown, l: P.brown, h: P.rose, bg0: 0x140e16, bg1: 0x2a1c24, bg2: P.plum, accent: P.amber },
    gen: { hardClumps: 2.4, caves: 1.5, goldVeins: 5.5, goldVeinLen: [3, 7], gasVeins: 0.7, gasVeinLen: [4, 8], bombRocks: 0.4, crystals: 0, hardSprinkle: 0.02, goldSprinkle: 0.04 },
    music: { root: 47, bpm: 112 },
  },
  {
    id: 'gas',
    name: 'GAS DEPTHS',
    toy: 'GAS는 폭탄에 연쇄 폭발!',
    rows: 420,
    valueMult: 5.5,
    pal: { k: 0x0e1c1c, d: P.deepTeal, m: P.pine, l: P.forest, h: 0x5aa25a, bg0: 0x0a1414, bg1: 0x12272a, bg2: P.deepTeal, accent: P.yellow },
    gen: { hardClumps: 2.0, caves: 1.2, goldVeins: 1.6, goldVeinLen: [2, 5], gasVeins: 3.6, gasVeinLen: [5, 13], bombRocks: 2.6, crystals: 0, hardSprinkle: 0.02, goldSprinkle: 0.01 },
    music: { root: 43, bpm: 116 },
  },
  {
    id: 'crystal',
    name: 'CRYSTAL RUINS',
    toy: 'CRYSTAL은 드릴을 튕겨내!',
    rows: 450,
    valueMult: 12,
    pal: { k: P.black, d: P.ink, m: P.navy, l: P.slate, h: P.steel, bg0: 0x0c0b16, bg1: 0x171a2c, bg2: P.ink, accent: P.pink },
    gen: { hardClumps: 2.6, caves: 1.3, goldVeins: 1.6, goldVeinLen: [2, 5], gasVeins: 1.7, gasVeinLen: [4, 9], bombRocks: 1.6, crystals: 4.6, hardSprinkle: 0.02, goldSprinkle: 0.01 },
    music: { root: 48, bpm: 120 },
  },
  {
    id: 'core',
    name: 'CORE',
    toy: '심장을 부숴라',
    rows: 420,
    valueMult: 26,
    pal: { k: 0x1a0c14, d: P.plum, m: P.purple, l: P.crimson, h: P.red, bg0: 0x12070d, bg1: 0x2b0f1a, bg2: 0x4a1424, accent: P.orange },
    gen: { hardClumps: 3.0, caves: 1.0, goldVeins: 2.2, goldVeinLen: [3, 6], gasVeins: 2.6, gasVeinLen: [4, 10], bombRocks: 2.6, crystals: 2.6, hardSprinkle: 0.03, goldSprinkle: 0.02 },
    music: { root: 41, bpm: 124 },
  },
];

export const CORE = {
  fragments: 3,
  fragmentValue: 180, // x unstable tile value
  regrowMs: 650, // the heart re-grows its unstable shell after each pull
  centerCol: 15,
  heartR: 1.5,
  unstableR: 3.2,
  armorR: 4.6,
  chunkRows: 11,
};

export function layerStartRow(i: number): number {
  let s = 0;
  for (let k = 0; k < i; k++) s += LAYERS[k].rows;
  return s;
}
export const CORE_START_ROW = layerStartRow(LAYERS.length);
