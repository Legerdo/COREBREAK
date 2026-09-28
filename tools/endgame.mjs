// Jump straight to the end of layer 5, play the Heart Core fight with real input,
// then verify save + reload after the ending. Useful for iterating on the finale.
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = 'tools/out/end';
fs.mkdirSync(OUT, { recursive: true });
const SPEED = 2;
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => {
  const t = m.text();
  if (/willReadFrequently|GPU stall|GL Driver/.test(t)) return;
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${t}`);
});
await page.goto(`http://localhost:5173/?reset=1&seed=5&speed=${SPEED}`);
await page.waitForFunction(() => window.__cb && window.__cb.state, null, { timeout: 20000 });
await page.waitForTimeout(500);
await page.evaluate(() => {
  const s = window.__cb.scene;
  const g = s.sim;
  g.tutorial = 2;
  for (const t of g.mine.grid) if (t) t.hint = false;
  // warp near the core
  const CORE_START = 160 + 260 + 420 + 450 + 420;
  g.depthRows = CORE_START - 12 - 1;
  g.layerSeen = 4;
  g.mine.queue = [];
  g.ensureQueue();
  g.ore = 1e6;
  g.bought = 20;
  g.stacks = { drill_len: 2, bomb_size: 2, magnet_range: 2, gas_chain: 1 };
  g.target = { c: 15, r: 8 };
  s.field.build();
  s.field.setLayer(4, true);
});
const st = () => page.evaluate(() => window.__cb.state());
const client = (x, y) => page.evaluate(([x, y]) => window.__cb.toClient(x, y), [x, y]);
const wait = (ms) => page.waitForTimeout(ms / SPEED);
let n = 0;
let lockedShot = false;
for (let i = 0; i < 400; i++) {
  const s = await st();
  if (s.modal === 'cards') {
    const p = await client(126, 220);
    await page.mouse.click(p.x, p.y);
    await wait(600);
    continue;
  }
  if (s.coreLocked && !lockedShot) {
    lockedShot = true;
    await page.screenshot({ path: `${OUT}/locked.png` });
    console.log('core locked at spin', s.spins);
  }
  if (s.finale || s.coreDone) break;
  if (s.state === 'idle' && !s.advancing) {
    const t = await page.evaluate(() => window.__cb.suggestTarget());
    const c = await page.evaluate(([c, r]) => window.__cb.cellCenter(c, r), [t.c, t.r]);
    const p = await client(c.x, c.y);
    await page.mouse.click(p.x, p.y);
    await wait(200);
    await page.keyboard.press('Space');
    n++;
    if (lockedShot && n % 2 === 0) await page.screenshot({ path: `${OUT}/fight_${n}.png` });
  }
  await wait(400);
}
console.log('finale reached', JSON.stringify(await st()));
for (let k = 0; k < 8; k++) {
  await wait(1000);
  await page.screenshot({ path: `${OUT}/finale_${k}.png` });
}
for (let k = 0; k < 20; k++) {
  const s = await st();
  if (s.modal === 'results') break;
  await wait(500);
}
const before = await st();
const lsBefore = await page.evaluate(() => (localStorage.getItem('corebreak.save.v1') ?? '').length);
console.log('results modal:', before.modal, 'save bytes before reload', lsBefore);
await page.evaluate(() => window.__cb.save());
const lsAfter = await page.evaluate(() => (localStorage.getItem('corebreak.save.v1') ?? '').length);
console.log('save bytes after explicit save', lsAfter);
await page.goto(`http://localhost:5173/?speed=${SPEED}`);
await page.waitForFunction(() => window.__cb && window.__cb.state, null, { timeout: 20000 });
await page.waitForTimeout(800);
const after = await st();
console.log('reload: ore', Math.round(before.ore), '->', Math.round(after.ore), 'coreDone', after.coreDone, 'tutorial', after.tutorial, 'depthRows', before.depthRows, '->', after.depthRows);
await page.screenshot({ path: `${OUT}/after_reload.png` });
console.log('ERRORS', errors.length ? errors.join('\n') : 'none');
await browser.close();
