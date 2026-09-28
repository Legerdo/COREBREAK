import type { LootKind, Sym, TileType } from '../data/balance';
import type { BotKind } from '../data/upgrades';

export interface Cell {
  c: number;
  r: number;
}

export interface Pt {
  x: number;
  y: number;
}

export interface Dir {
  dx: number;
  dy: number;
}

export interface Tile {
  id: number;
  t: TileType;
  hp: number;
  layer: number;
  v: number; // art variant
  hint?: boolean;
}

export interface Loot {
  id: number;
  kind: LootKind;
  value: number;
  x: number; // field-local px
  y: number;
}

export type Cause = 'drill' | 'blast' | 'shard' | 'ore' | 'crush' | 'core';
export type ExplKind = 'bomb' | 'mega' | 'gas' | 'bombrock' | 'tip' | 'bomblet' | 'bot' | 'shock';

// Timeline events produced by the simulation, consumed by the presentation layer.
// All positions are field-local pixels or grid cells. `t` is ms from the start of the resolution.
export type GEvent =
  | { t: number; k: 'drillLaunch'; to: Cell; dir: Dir; level: number; flight: number; from: Pt }
  | { t: number; k: 'drillStep'; cell: Cell; dir: Dir; level: number; line: number; hit: boolean; lead: boolean }
  | { t: number; k: 'drillBounce'; cell: Cell; dir: Dir; line: number; wall: boolean }
  | { t: number; k: 'drillEnd'; cell: Cell; dir: Dir; line: number; level: number }
  | { t: number; k: 'hit'; cell: Cell; id: number; hp: number; maxHp: number; cause: Cause; power: number }
  | { t: number; k: 'pass'; cell: Cell; id: number }
  | { t: number; k: 'break'; cell: Cell; id: number; tt: TileType; layer: number; cause: Cause; power: number }
  | { t: number; k: 'rip'; cell: Cell; id: number; tt: TileType; layer: number; value: number; delay: number }
  | { t: number; k: 'bombLaunch'; from: Pt; to: Pt; level: number; flight: number; small: boolean }
  | { t: number; k: 'fuse'; at: Pt; level: number; ms: number }
  | { t: number; k: 'explode'; at: Pt; radius: number; kind: ExplKind; chain: number; power: number }
  | { t: number; k: 'shard'; from: Pt; to: Pt; ms: number }
  | { t: number; k: 'magnetLaunch'; to: Pt; level: number; flight: number }
  | { t: number; k: 'magnetPulse'; at: Pt; radius: number; level: number; storm: boolean }
  | { t: number; k: 'lootSpawn'; loot: Loot }
  | { t: number; k: 'oreDirect'; at: Pt; value: number; kind: LootKind; n: number }
  | { t: number; k: 'collect'; id: number; delay: number; crashAt?: Pt }
  | { t: number; k: 'chain'; n: number }
  | { t: number; k: 'mega'; sym: Sym }
  | { t: number; k: 'act'; sym: Sym; level: number; reels: [number, number] }
  | { t: number; k: 'heart'; left: number; at: Pt; delay: number; value: number }
  | { t: number; k: 'grow'; cell: Cell; tile: Tile }
  | { t: number; k: 'finale'; at: Pt }
  | { t: number; k: 'botGo'; bot: BotKind; slot: number; to: Pt; ms: number };

export interface Resolution {
  events: GEvent[];
  duration: number; // ms until the last "major" event
  chain: number;
  broken: number;
  ore: number;
}

export type Notice =
  | { k: 'layer'; from: number; to: number }
  | { k: 'feverUnlocked' }
  | { k: 'feverReady' }
  | { k: 'feverEnd' }
  | { k: 'botUnlocked'; bot: BotKind }
  | { k: 'coreLocked' }
  | { k: 'tutorial'; step: number }
  | { k: 'reward'; layer: number };

export interface AdvanceResult {
  crushed: { cell: Cell; id: number; tt: TileType; layer: number; value: number }[];
  pushedLoot: { id: number; value: number }[];
  newRow: (Tile | null)[];
  layerChanged: boolean;
}
