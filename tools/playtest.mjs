// Automated full playthrough in a real browser. Uses real mouse clicks and key
// presses on the canvas; reads state through window.__cb for decisions/logging.
//   node tools/playtest.mjs            (expects a server on :5173)
// env: URL, SPEED (default 4), SEED, MAX_MIN (real minutes cap), THINK_MS (game-time think delay)
import { chromium } from 'playwright';
import fs from 'node:fs';

const SPEED = Number(process.env.SPEED ?? 4);
const SEED = Number(process.env.SEED ?? 7);
// Only origin + path: query parameters (e.g. reset=1) must never leak into the reload check.
const BASE = (() => {
  const u = new URL(process.env.URL ?? 'http://localhost:5173/');
  return u.origin + u.pathname;
})();
const MAX_REAL_MS = Number(process.env.MAX_MIN ?? 25) * 60000;
const THINK_MS = Number(process.env.THINK_MS ?? 1200);
const OUT = 'tools/out/play';
fs.mkdirSync(OUT, { recursive: true });

const log = [];
const note = (s) => {
  console.log(s);
  log.push(s);
};
const fmt = (ms) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => {
  const t = m.text();
  if (/willReadFrequently|GPU stall|GL Driver/.test(t)) return;
  if (t.includes('[COREBREAK]')) note(`   (page) ${t}`);
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${t}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack}`));
page.on('framenavigated', (f) => {
  if (f === page.mainFrame()) note(`   (nav) ${f.url()}`);
});

await page.goto(`${BASE}?reset=1&seed=${SEED}&speed=${SPEED}`);
await page.waitForFunction(() => window.__cb && window.__cb.state, null, { timeout: 30000 });
await page.waitForTimeout(500);

const st = () => page.evaluate(() => window.__cb.state());
const client = (x, y) => page.evaluate(([x, y]) => window.__cb.toClient(x, y), [x, y]);
const clickAt = async (x, y) => {
  const p = await client(x, y);
  await page.mouse.click(p.x, p.y);
};
const clickCell = async (c, r) => {
  const p = await page.evaluate(([c, r]) => window.__cb.cellCenter(c, r), [c, r]);
  await clickAt(p.x, p.y);
};
const shot = async (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const gameWait = (ms) => page.waitForTimeout(Math.max(30, ms / SPEED));

const seen = new Set();
const once = async (key, label, s) => {
  if (seen.has(key)) return false;
  seen.add(key);
  note(`${fmt(s.playMs).padStart(6)}  ${label}`);
  await shot(key);
  return true;
};

const t0 = Date.now();
let lastPeriodic = 0;
let prevLayer = 0;
let prevBots = 0;
let prevMegas = 0;
let prevFevers = false;
let spinsAtFeverStart = 0;
let maxParticles = 0;
let minFps = 999;
let fpsSamples = [];
let coreLockedAt = 0;

const waitIdle = async () => {
  for (let i = 0; i < 100; i++) {
    const q = await st();
    if (q.state === 'idle') return q;
    await gameWait(150);
  }
};
// tutorial
await clickCell(15, 9);
await gameWait(600);
await page.keyboard.press('Space');
await gameWait(1000);
await waitIdle();
await gameWait(600);
await clickCell(16, 9);
await gameWait(500);
await page.keyboard.press('Space');
await gameWait(600);
for (let i = 0; i < 6; i++) {
  await gameWait(220);
  await shot(`tut_spin2_${i}`);
}
await gameWait(3000);
let s = await st();
note(`${fmt(s.playMs).padStart(6)}  tutorial done: ore=${Math.round(s.ore)} maxChain=${s.maxChain} tiles=${s.tiles}`);

while (Date.now() - t0 < MAX_REAL_MS) {
  s = await st();
  fpsSamples.push(s.fps);
  minFps = Math.min(minFps, s.fps);
  maxParticles = Math.max(maxParticles, s.particles);
  if (s.playMs - lastPeriodic > 180000) {
    lastPeriodic = s.playMs;
    await shot(`t_${String(Math.round(s.playMs / 60000)).padStart(2, '0')}min`);
    note(`${fmt(s.playMs).padStart(6)}  [status] layer=${s.layer + 1} depth=${s.depth}m ore=${Math.round(s.ore)} bought=${s.bought} megas=${s.megas} maxChain=${s.maxChain} loot=${s.loot} fps=${s.fps.toFixed(0)} particles=${s.particles}`);
  }
  if (s.layer !== prevLayer) {
    prevLayer = s.layer;
    await gameWait(900);
    await once(`layer_${s.layer + 1}`, `LAYER ${s.layer + 1} reached (depth ${s.depth}m)`, s);
  }
  const botCount = s.bots.drill.count + s.bots.bomb.count + s.bots.magnet.count;
  if (botCount > prevBots) {
    prevBots = botCount;
    await once(`bots_${botCount}`, `bots now ${JSON.stringify({ d: s.bots.drill.count, b: s.bots.bomb.count, m: s.bots.magnet.count })}`, s);
  }
  if (s.megas > prevMegas) {
    prevMegas = s.megas;
    if (s.megas === 1) {
      await gameWait(150);
      await once('first_mega', 'first MEGA', await st());
    }
  }
  if (s.coreDone || s.finale) {
    await gameWait(1500);
    await once('finale_1', 'CORE finale started', await st());
    await gameWait(1500);
    await shot('finale_2');
    await gameWait(2500);
    await shot('finale_3');
    // wait for results
    for (let i = 0; i < 60; i++) {
      s = await st();
      if (s.modal === 'results') break;
      await gameWait(500);
    }
    await once('results', `RESULTS shown (spins=${s.spins} tiles=${s.tiles} maxChain=${s.maxChain} megas=${s.megas}; core fight ${fmt(s.playMs - coreLockedAt)})`, s);
    break;
  }
  if (s.modal === 'cards') {
    await gameWait(500);
    if (s.bought === 0) await once('first_upgrade_cards', 'first upgrade cards', s);
    else if (!seen.has('reward_cards') && prevBots > 0) await once('reward_cards', 'layer reward cards', s);
    const i = Math.floor(Math.random() * 3);
    const cw = 180;
    const gap = 14;
    const x0 = Math.round((640 - (cw * 3 + gap * 2)) / 2);
    const y0 = s.bots.drill.count + s.bots.bomb.count + s.bots.magnet.count > 0 && !seen.has('picked_after_reward_' + prevLayer) ? 80 : 70;
    await clickAt(x0 + i * (cw + gap) + cw / 2, y0 + 150);
    await gameWait(700);
    const s2 = await st();
    if (s2.modal === 'cards') {
      // layout guess failed (reward layout); try the other y
      await clickAt(x0 + i * (cw + gap) + cw / 2, 170);
      await gameWait(700);
    }
    continue;
  }
  if (s.modal) {
    await gameWait(300);
    continue;
  }
  if (s.canBuy && s.state === 'idle') {
    await clickAt(178, 296);
    await gameWait(400);
    continue;
  }
  if (s.feverReady && (s.state === 'idle' || s.state === 'resolve')) {
    await once('fever_ready', 'FEVER ready', s);
    await clickAt(530, 280);
    await gameWait(1400);
    const f = await st();
    if (f.feverActive) {
      spinsAtFeverStart = f.spins;
      await once('first_fever', 'first FEVER active', f);
      await gameWait(3000);
      await once('fever_mid', 'FEVER mid', await st());
    }
    continue;
  }
  if (s.feverActive) {
    // retarget during fever from time to time
    const t = await page.evaluate(() => window.__cb.suggestTarget());
    await clickCell(t.c, t.r);
    await gameWait(900);
    prevFevers = true;
    continue;
  }
  if (prevFevers) {
    prevFevers = false;
    const f = await st();
    note(`${fmt(f.playMs).padStart(6)}  FEVER ended: spins during fever ${f.spins - spinsAtFeverStart}`);
  }
  if (s.coreLocked) {
    if (await once('core_locked', `CORE locked (depth ${s.depth}m, fragments left ${s.coreLeft})`, s)) coreLockedAt = s.playMs;
    if (s.coreLeft < 3 && !seen.has('core_pull_' + s.coreLeft)) await once('core_pull_' + s.coreLeft, `core fragment pulled, left ${s.coreLeft}`, s);
  }
  if (!seen.has('settings') && s.playMs > 120000 && s.state === 'idle') {
    seen.add('settings');
    await clickAt(626, 12);
    await gameWait(400);
    await shot('settings');
    await clickAt(320 + 150 - 66, 180 - 136 + 30 + 3 * 24 + 10); // toggle reduced motion on
    await gameWait(200);
    const rm = await page.evaluate(() => window.__cb.scene.settings.reducedMotion);
    await clickAt(320 + 150 - 66, 180 - 136 + 30 + 3 * 24 + 10); // and off again
    await gameWait(200);
    const rm2 = await page.evaluate(() => window.__cb.scene.settings.reducedMotion);
    note(`${fmt(s.playMs).padStart(6)}  settings: reducedMotion toggled ${rm} -> ${rm2}`);
    await page.keyboard.press('Escape');
    await gameWait(300);
    const m1 = (await st()).modal;
    if (m1) await clickAt(394, 294); // "닫기"
    await gameWait(300);
    note(`${fmt(s.playMs).padStart(6)}  settings closed: escape=${m1 === null} final modal=${(await st()).modal}`);
    continue;
  }
  if (s.state === 'idle' && !s.advancing) {
    const t = s.tutorial === 0 ? { c: 15, r: 9 } : s.tutorial === 1 ? { c: 16, r: 9 } : await page.evaluate(() => window.__cb.suggestTarget());
    await clickCell(t.c, t.r);
    await gameWait(250);
    await page.keyboard.press('Space');
    // wait until the resolution is over
    for (let i = 0; i < 80; i++) {
      await gameWait(150);
      const q = await st();
      if (q.state === 'idle' || q.modal) break;
    }
    await gameWait(THINK_MS);
  } else await gameWait(120);
}

s = await st();
note(`${fmt(s.playMs).padStart(6)}  END: layer=${s.layer + 1} depth=${s.depth}m bought=${s.bought} spins=${s.spins} megas=${s.megas} maxChain=${s.maxChain} tiles=${s.tiles} coreDone=${s.coreDone}`);
note(`fps avg ${(fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length).toFixed(1)} min ${minFps.toFixed(1)}  maxParticles ${maxParticles}`);
note(`real time ${((Date.now() - t0) / 60000).toFixed(1)} min`);

// ---- save / reload check
const before = await st();
await page.evaluate(() => window.__cb.save());
note(`save bytes before reload: ${await page.evaluate(() => (localStorage.getItem('corebreak.save.v1') ?? '').length)}`);
await page.goto(`${BASE}?speed=${SPEED}`);
await page.waitForFunction(() => window.__cb && window.__cb.state, null, { timeout: 30000 });
await page.waitForTimeout(1200);
const after = await st();
const keys = ['tutorial', 'layer', 'depthRows', 'bought', 'reel', 'megas', 'spins', 'coreDone', 'feverUnlocked'];
const diffs = keys.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
note(`RELOAD: ore ${Math.round(before.ore)} -> ${Math.round(after.ore)}; bots ${JSON.stringify(after.bots)}; mismatched keys: ${diffs.length ? diffs.join(',') : 'none'}`);
await shot('after_reload');

note('ERRORS (' + errors.length + '):\n' + errors.slice(0, 30).join('\n'));
fs.writeFileSync(`${OUT}/log.txt`, log.join('\n'));
await browser.close();
