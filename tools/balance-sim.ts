// Headless pacing simulator. Plays the real simulation code with a simple
// "reasonable player" policy and reports when milestones happen.
//   npx tsx tools/balance-sim.ts [runs] [seed]
import { COLS, ROWS } from '../src/config';
import { CORE, LAYERS, REEL_TIMING } from '../src/data/balance';
import { Game } from '../src/sim/game';
import { Rng } from '../src/sim/rng';
import type { Cell } from '../src/sim/types';

const runs = Number(process.argv[2] ?? 3);
const seed0 = Number(process.argv[3] ?? 1234);
const DECISION_MS = Number(process.env.DECISION_MS ?? 1800);
const ADVANCE_MS = 180;

function fmt(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function chooseTarget(g: Game, rng: Rng): Cell {
  const m = g.mine;
  if (g.core.locked && !g.core.done) {
    const cands: Cell[] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const t = m.get(c, r);
        if (!t || t.t === 'heart') continue;
        const d = Math.hypot(c - CORE.centerCol, r - 5);
        if (d <= 4.8) cands.push({ c, r });
      }
    if (cands.length) {
      cands.sort((a, b) => Math.hypot(a.c - CORE.centerCol, a.r - 5) - Math.hypot(b.c - CORE.centerCol, b.r - 5));
      return cands[Math.min(cands.length - 1, rng.int(4))];
    }
    return { c: CORE.centerCol, r: 7 };
  }
  let best: Cell = { c: 15, r: 8 };
  let bestScore = -1;
  for (let i = 0; i < 14; i++) {
    const c = rng.int(COLS);
    const r = rng.int(ROWS);
    const t = m.get(c, r);
    if (!t) continue;
    let score = 1;
    for (let y = r - 3; y <= r + 3; y++)
      for (let x = c - 3; x <= c + 3; x++) {
        const n = m.get(x, y);
        if (!n) continue;
        score += n.t === 'gas' ? 3 : n.t === 'bombrock' ? 3 : n.t === 'gold' ? 1.5 : n.t === 'crystal' ? 2 : 0.3;
      }
    if (score > bestScore) {
      bestScore = score;
      best = { c, r };
    }
  }
  return best;
}

interface RunReport {
  total: number;
  milestones: [string, number][];
  upgrades: number[];
  perLayer: { layer: string; start: number; spins: number; tiles: number; maxChain: number }[];
}

function runOnce(seed: number): RunReport {
  const g = Game.create(seed);
  const rng = new Rng(seed * 7 + 1);
  let t = 0;
  const ms: [string, number][] = [];
  const upgrades: number[] = [];
  const perLayer: RunReport['perLayer'] = [{ layer: LAYERS[0].name, start: 0, spins: 0, tiles: 0, maxChain: 0 }];
  let firstMega = false;
  let firstFever = false;
  let feverUnlocked = false;
  const step = (dt: number) => {
    t += dt;
    const bots = g.tick(dt, true);
    for (const b of bots) {
      perLayer[perLayer.length - 1].tiles += b.broken;
    }
    g.arrive(g.unseen);
    for (const n of g.takeNotices()) {
      if (n.k === 'layer') {
        ms.push([`layer ${n.to + 1} ${LAYERS[n.to].name}`, t]);
        perLayer.push({ layer: LAYERS[n.to].name, start: t, spins: 0, tiles: 0, maxChain: 0 });
      }
      if (n.k === 'feverUnlocked' && !feverUnlocked) {
        feverUnlocked = true;
        ms.push(['FEVER unlocked', t]);
      }
      if (n.k === 'botUnlocked') ms.push([`bot ${n.bot}`, t]);
      if (n.k === 'coreLocked') ms.push(['CORE locked', t]);
    }
  };
  let guard = 0;
  while (!g.core.done && guard++ < 20000 && t < 3 * 3600e3) {
    // rewards & upgrades
    while (g.pendingRewards.length && !g.pendingOffer) {
      g.openReward();
      g.pick(rng.int(3));
      step(2500);
    }
    while (g.canBuy()) {
      g.buy();
      g.pick(rng.int(g.pendingOffer!.offers.length));
      upgrades.push(t);
      step(3000);
    }
    if (g.feverReady()) {
      g.startFever();
      if (!firstFever) {
        firstFever = true;
        ms.push(['first FEVER', t]);
      }
    }
    const fever = g.feverActive;
    if (g.tutorial === 0) g.setTarget(15, 9);
    else if (g.tutorial === 1) g.setTarget(16, 9);
    else if (fever || rng.chance(0.55) || !g.target || !g.mine.get(g.target.c, g.target.r)) {
      const tc = chooseTarget(g, rng);
      g.setTarget(tc.c, tc.r);
    }
    step(fever ? 150 : DECISION_MS);
    const res = g.pull();
    const r = g.resolveSpin(res);
    if (!firstMega && g.stats.megas > 0) {
      firstMega = true;
      ms.push(['first MEGA', t]);
    }
    const pl = perLayer[perLayer.length - 1];
    pl.spins++;
    pl.tiles += r.broken;
    pl.maxChain = Math.max(pl.maxChain, r.chain);
    const reel = fever ? REEL_TIMING.fever.stops[2] : REEL_TIMING.normal.stops[2];
    step(reel + r.duration);
    while (g.needsAdvance()) {
      g.advance();
      step(ADVANCE_MS);
    }
  }
  ms.push(['CORE destroyed', t]);
  return { total: t, milestones: ms, upgrades, perLayer };
}

for (let i = 0; i < runs; i++) {
  const r = runOnce(seed0 + i * 101);
  console.log(`\n=== run ${i + 1} (seed ${seed0 + i * 101}) total ${fmt(r.total)} ===`);
  for (const [name, at] of r.milestones) console.log(`  ${fmt(at).padStart(6)}  ${name}`);
  console.log(`  upgrades (${r.upgrades.length}): ${r.upgrades.map(fmt).join(' ')}`);
  for (const l of r.perLayer)
    console.log(`  ${l.layer.padEnd(14)} start ${fmt(l.start)}  spins ${l.spins}  tiles/spin ${(l.tiles / Math.max(1, l.spins)).toFixed(1)}  maxChain ${l.maxChain}`);
}
