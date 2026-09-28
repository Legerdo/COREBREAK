// Visual QA: forces specific situations through the debug hook and captures
// frame sequences (card previews, crystal bounce, MEGA effects, FEVER).
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.URL ?? 'http://localhost:5173/';
const OUT = 'tools/out/qa';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.goto(`${BASE}?reset=1&seed=3`);
await page.waitForFunction(() => window.__cb && window.__cb.state, null, { timeout: 30000 });
await page.waitForTimeout(600);
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const client = (x, y) => page.evaluate(([x, y]) => window.__cb.toClient(x, y), [x, y]);

// skip tutorial quickly
await page.evaluate(() => {
  const s = window.__cb.scene;
  const g = s.sim;
  g.tutorial = 2;
  for (const t of g.mine.grid) if (t) t.hint = false;
  g.target = { c: 15, r: 6 };
  g.ore = g.totalOre = 5000;
  s.field.build();
});

// 1. every upgrade card preview
const ids = await page.evaluate(() => {
  const s = window.__cb.scene;
  return Object.keys(s.sim.stacks).length >= 0 ? null : null;
});
const allIds = [
  'drill_len', 'drill_twin', 'drill_ricochet', 'drill_tip', 'bomb_size', 'bomb_cluster', 'gas_chain', 'chain_spawn',
  'magnet_range', 'magnet_crash', 'magnet_sweep', 'magnet_storm', 'reel_B', 'reel_D', 'reel_M', 'ore_bonus', 'fever_long', 'fever_fast', 'bot_drill', 'bot_speed',
];
for (let i = 0; i < allIds.length; i += 3) {
  const group = allIds.slice(i, i + 3);
  await page.evaluate((group) => {
    const s = window.__cb.scene;
    const offers = group.map((id) => ({ id, swapFrom: id.startsWith('reel_') ? 6 : undefined }));
    s.ov.showCards(offers, false, null, () => null);
  }, group);
  await page.waitForTimeout(1100);
  await shot(`cards_${i / 3}`);
  await page.evaluate(() => window.__cb.scene.ov.closeModal());
}

// helper: stamp tiles & force the next reel result
const setup = async (fn, result, target) => {
  await page.evaluate(
    ([fnSrc, result, target]) => {
      const s = window.__cb.scene;
      const g = s.sim;
      const put = (c, r, t) => g.mine.set(c, r, t ? g.mine.make(t, g.layer, (c + r) % 4) : null);
      new Function('g', 'put', fnSrc)(g, put);
      s.field.build();
      g.target = target;
      s.machine.aimAt(s.field.marker ? 0 : 0, 0);
      const orig = g.pull.bind(g);
      g.pull = () => {
        g.pull = orig;
        orig();
        return result;
      };
    },
    [fn.toString().replace(/^[^{]*{/, '').replace(/}$/, ''), result, target],
  );
};
const pull = async () => page.keyboard.press('Space');
const seq = async (name, n, gap) => {
  for (let i = 0; i < n; i++) {
    await page.waitForTimeout(gap);
    await shot(`${name}_${i}`);
  }
};

// 2. crystal bounce with drill
await setup(
  (g, put) => {
    for (let r = 0; r < 12; r++) for (let c = 8; c < 24; c++) put(c, r, r > 9 ? null : 'rock');
    put(15, 5, 'crystal');
    put(19, 1, 'crystal');
    put(20, 3, 'bombrock');
    put(21, 3, 'gas');
    put(22, 3, 'gas');
    put(22, 4, 'gas');
  },
  ['D', 'D', 'M'],
  { c: 15, r: 9 },
);
await pull();
await seq('crystal', 8, 160);
await page.waitForTimeout(2500);

// 3. MEGA BOMB in a gas field
await setup(
  (g, put) => {
    for (let r = 0; r < 12; r++) for (let c = 0; c < 31; c++) put(c, r, r > 9 ? null : (c + r * 3) % 7 === 0 ? 'gas' : (c * 5 + r) % 11 === 0 ? 'bombrock' : (c + r) % 9 === 0 ? 'hard' : 'rock');
    for (let c = 4; c < 27; c++) put(c, 2, 'gas');
  },
  ['B', 'B', 'B'],
  { c: 15, r: 6 },
);
await pull();
await seq('megabomb', 22, 110);
await page.waitForTimeout(3500);

// 4. MEGA DRILL
await setup(
  (g, put) => {
    for (let r = 0; r < 12; r++) for (let c = 0; c < 31; c++) put(c, r, r > 9 ? null : (c + r) % 6 === 0 ? 'hard' : 'rock');
  },
  ['D', 'D', 'D'],
  { c: 12, r: 9 },
);
await pull();
await seq('megadrill', 20, 110);
await page.waitForTimeout(3000);

// 5. MAGNET STORM after scattering loot with bombs
await setup(
  (g, put) => {
    for (let r = 0; r < 12; r++) for (let c = 0; c < 31; c++) put(c, r, r > 9 ? null : c % 5 === 0 ? 'gold' : 'rock');
  },
  ['B', 'D', 'B'],
  { c: 8, r: 8 },
);
await pull();
await page.waitForTimeout(3000);
await setup(() => {}, ['M', 'M', 'M'], { c: 20, r: 7 });
await pull();
await seq('storm', 10, 140);
await page.waitForTimeout(2500);

// 6. FEVER
await page.evaluate(() => {
  const g = window.__cb.scene.sim;
  g.feverUnlocked = true;
  g.fever = g.feverMax();
  g.addFever(1);
});
await page.waitForTimeout(600);
await shot('fever_ready');
const fb = await client(530, 280);
await page.mouse.click(fb.x, fb.y);
await seq('fever', 10, 400);

console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
