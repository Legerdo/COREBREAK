// Data-driven upgrade definitions. Upgrades change BEHAVIOUR first, numbers second.
import type { Sym } from './balance';

export type UpCat = 'drill' | 'bomb' | 'magnet' | 'reel' | 'eco' | 'fever' | 'bot';
export type BotKind = 'drill' | 'bomb' | 'magnet';

export interface UpgradeCtx {
  stacks: Record<string, number>;
  bought: number;
  layer: number;
  feverUnlocked: boolean;
  bots: Record<BotKind, number>;
  reel: Sym[];
}

export interface UpgradeDef {
  id: string;
  cat: UpCat;
  name: string;
  desc: string;
  max: number;
  weight: number;
  icon: string; // texture key of the card icon
  preview: string; // preview animation id
  req?: (c: UpgradeCtx) => boolean;
  swapTo?: Sym; // reel face swap target
  bot?: BotKind;
}

const st = (c: UpgradeCtx, id: string) => c.stacks[id] ?? 0;

export const UPGRADES: UpgradeDef[] = [
  { id: 'drill_len', cat: 'drill', name: '더 큰 드릴', desc: 'DRILL이 2칸 더 깊이 뚫어요.', max: 3, weight: 10, icon: 'sym_D', preview: 'drill_len' },
  { id: 'drill_twin', cat: 'drill', name: '두 갈래 드릴', desc: 'DRILL이 V자로 갈라져 두 줄을 뚫어요.', max: 1, weight: 9, icon: 'sym_D', preview: 'drill_twin', req: (c) => c.bought >= 2 },
  { id: 'drill_ricochet', cat: 'drill', name: '튕기는 드릴', desc: '벽 끝에 닿은 DRILL이 튕겨서 계속 가요.', max: 2, weight: 8, icon: 'sym_D', preview: 'ricochet', req: (c) => c.bought >= 3 },
  { id: 'drill_tip', cat: 'drill', name: '폭발 드릴', desc: 'DRILL이 멈춘 자리에서 펑! 작은 폭발.', max: 2, weight: 9, icon: 'sym_D', preview: 'drill_tip', req: (c) => c.bought >= 1 },

  { id: 'bomb_size', cat: 'bomb', name: '더 큰 폭탄', desc: 'BOMB 폭발이 한 칸 더 넓어져요.', max: 3, weight: 10, icon: 'sym_B', preview: 'bomb_size' },
  { id: 'bomb_cluster', cat: 'bomb', name: '새끼 폭탄', desc: '폭발 뒤에 작은 폭탄들이 튀어나가요.', max: 2, weight: 9, icon: 'sym_B', preview: 'cluster', req: (c) => c.bought >= 2 },
  { id: 'gas_chain', cat: 'bomb', name: '연쇄 폭탄', desc: 'GAS가 더 멀리, 더 빨리 연쇄 폭발해요.', max: 2, weight: 9, icon: 'tile_gas_icon', preview: 'gas_chain', req: (c) => c.bought >= 1 },
  { id: 'chain_spawn', cat: 'bomb', name: '깨우는 폭발', desc: 'GAS·폭탄돌이 터지면 작은 폭탄이 날아가요.', max: 1, weight: 8, icon: 'tile_bombrock_icon', preview: 'chain_spawn', req: (c) => c.layer >= 1 && st(c, 'gas_chain') >= 1 },

  { id: 'magnet_range', cat: 'magnet', name: '강한 자석', desc: 'MAGNET이 더 먼 보물까지 끌어와요.', max: 3, weight: 10, icon: 'sym_M', preview: 'magnet_range' },
  { id: 'magnet_crash', cat: 'magnet', name: '광석 충돌', desc: '끌려오는 광석이 길 위의 돌을 부숴요.', max: 1, weight: 8, icon: 'sym_M', preview: 'magnet_crash', req: (c) => c.bought >= 3 },
  { id: 'magnet_sweep', cat: 'magnet', name: '보물 청소기', desc: '끌려오는 광석이 지나가던 GOLD도 데려와요.', max: 1, weight: 8, icon: 'loot_gold_icon', preview: 'magnet_sweep', req: (c) => c.layer >= 1 },
  { id: 'magnet_storm', cat: 'magnet', name: '자석 폭풍', desc: 'MAGNET 두 개만 나와도 화면 전체를 끌어와요.', max: 1, weight: 7, icon: 'sym_M', preview: 'storm', req: (c) => st(c, 'magnet_range') >= 1 && c.bought >= 6 },

  { id: 'reel_B', cat: 'reel', name: '릴 개조: 폭탄', desc: '릴 그림 하나가 BOMB으로 바뀌어요.', max: 3, weight: 7, icon: 'sym_B', preview: 'reel_swap', swapTo: 'B', req: (c) => c.bought >= 1 },
  { id: 'reel_D', cat: 'reel', name: '릴 개조: 드릴', desc: '릴 그림 하나가 DRILL로 바뀌어요.', max: 3, weight: 5, icon: 'sym_D', preview: 'reel_swap', swapTo: 'D', req: (c) => c.bought >= 2 },
  { id: 'reel_M', cat: 'reel', name: '릴 개조: 자석', desc: '릴 그림 하나가 MAGNET으로 바뀌어요.', max: 3, weight: 7, icon: 'sym_M', preview: 'reel_swap', swapTo: 'M', req: (c) => c.bought >= 1 },

  { id: 'ore_bonus', cat: 'eco', name: '광석 선별기', desc: '모든 광석이 25% 더 나와요.', max: 4, weight: 4, icon: 'loot_ore_icon', preview: 'ore', req: (c) => c.bought >= 4 },

  { id: 'fever_long', cat: 'fever', name: '긴 FEVER', desc: 'FEVER가 3초 더 오래 가요.', max: 2, weight: 6, icon: 'fever_icon', preview: 'fever', req: (c) => c.feverUnlocked },
  { id: 'fever_fast', cat: 'fever', name: 'FEVER 충전기', desc: 'FEVER 게이지가 더 빨리 차요.', max: 2, weight: 6, icon: 'fever_icon', preview: 'fever', req: (c) => c.feverUnlocked },

  { id: 'bot_drill', cat: 'bot', name: '드릴 봇 +1', desc: '드릴 봇이 한 대 더 일해요.', max: 2, weight: 7, icon: 'bot_drill_0', preview: 'bot', bot: 'drill', req: (c) => c.bots.drill >= 1 },
  { id: 'bot_bomb', cat: 'bot', name: '폭탄 봇 +1', desc: '폭탄 봇이 한 대 더 일해요.', max: 2, weight: 7, icon: 'bot_bomb_0', preview: 'bot', bot: 'bomb', req: (c) => c.bots.bomb >= 1 },
  { id: 'bot_magnet', cat: 'bot', name: '자석 봇 +1', desc: '자석 봇이 한 대 더 일해요.', max: 2, weight: 7, icon: 'bot_magnet_0', preview: 'bot', bot: 'magnet', req: (c) => c.bots.magnet >= 1 },
  { id: 'bot_speed', cat: 'bot', name: '봇 과급기', desc: '모든 봇이 더 자주 일해요.', max: 3, weight: 6, icon: 'bot_drill_0', preview: 'bot', req: (c) => c.bots.drill + c.bots.bomb + c.bots.magnet >= 1 },
];

export const UPGRADE_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export interface Mods {
  drillLen: number;
  drillTwin: boolean;
  ricochet: number;
  drillTip: number;
  bombSize: number;
  cluster: number;
  gasChain: number;
  chainSpawn: boolean;
  magnetRange: number;
  magnetCrash: boolean;
  magnetSweep: boolean;
  magnetStorm: boolean;
  oreMult: number;
  feverLong: number;
  feverFast: number;
  botSpeed: number;
}

export function computeMods(stacks: Record<string, number>): Mods {
  const s = (id: string) => stacks[id] ?? 0;
  return {
    drillLen: s('drill_len') * 2,
    drillTwin: s('drill_twin') > 0,
    ricochet: s('drill_ricochet'),
    drillTip: s('drill_tip'),
    bombSize: s('bomb_size') * 0.8,
    cluster: s('bomb_cluster') === 0 ? 0 : s('bomb_cluster') === 1 ? 3 : 5,
    gasChain: s('gas_chain'),
    chainSpawn: s('chain_spawn') > 0,
    magnetRange: s('magnet_range') * 2.5,
    magnetCrash: s('magnet_crash') > 0,
    magnetSweep: s('magnet_sweep') > 0,
    magnetStorm: s('magnet_storm') > 0,
    oreMult: 1 + s('ore_bonus') * 0.25,
    feverLong: s('fever_long'),
    feverFast: s('fever_fast'),
    botSpeed: s('bot_speed'),
  };
}

/** For a reel swap card: which face gets replaced. Keeps at least one of every symbol. */
export function reelSwapFrom(reel: Sym[], to: Sym): number {
  const counts: Record<Sym, number> = { D: 0, B: 0, M: 0 };
  for (const s of reel) counts[s]++;
  let best = -1;
  let bestCount = 1;
  for (let i = 0; i < reel.length; i++) {
    const s = reel[i];
    if (s === to) continue;
    if (counts[s] > bestCount) {
      bestCount = counts[s];
      best = i;
    }
  }
  return best;
}
