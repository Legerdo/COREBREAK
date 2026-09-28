// Quick runtime smoke test: load the game, do the two tutorial spins, screenshot.
import { chromium } from 'playwright';
import fs from 'node:fs';

const URL = process.env.URL ?? 'http://localhost:5173/?reset=1&seed=42';
const OUT = 'tools/out';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack}`));

await page.goto(URL);
await page.waitForFunction(() => window.__cb && window.__cb.state, null, { timeout: 20000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/01_start.png` });

const client = (x, y) => page.evaluate(([x, y]) => window.__cb.toClient(x, y), [x, y]);
const cell = async (c, r) => {
  const p = await page.evaluate(([c, r]) => window.__cb.cellCenter(c, r), [c, r]);
  return client(p.x, p.y);
};
const state = () => page.evaluate(() => window.__cb.state());

// tutorial step 0
let p = await cell(15, 9);
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/02_target.png` });
await page.keyboard.press('Space');
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/03_spin1_mid.png` });
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/04_spin1_after.png` });
await page.waitForTimeout(1500);
console.log('after spin1', JSON.stringify(await state()));

p = await cell(16, 9);
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(300);
await page.keyboard.press('Space');
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(260);
  await page.screenshot({ path: `${OUT}/05_spin2_${i}.png` });
}
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/06_after_tutorial.png` });
console.log('after spin2', JSON.stringify(await state()));

console.log('ERRORS:\n' + errors.join('\n'));
await browser.close();
