// Procedural pixel art. Every texture in the game is generated here at boot
// from a limited palette with hard edges and deliberate pixel clusters.
import Phaser from 'phaser';
import { FIELD_H, FIELD_W, W } from '../config';
import { LAYERS, type LayerPalette, type Sym } from '../data/balance';
import { P } from '../data/palette';
import { Atlas, CLEAR, PixelCanvas, hash2 } from './pixel';

type Scene = Phaser.Scene;

function addCanvas(scene: Scene, key: string, pc: PixelCanvas) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, pc.toCanvas());
}

function addStrip(scene: Scene, key: string, frames: PixelCanvas[]) {
  const fw = frames[0].w;
  const fh = frames[0].h;
  const cv = document.createElement('canvas');
  cv.width = fw * frames.length;
  cv.height = fh;
  frames.forEach((f, i) => f.paint(cv, i * fw, 0));
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, cv)!;
  frames.forEach((_, i) => tex.add(i, 0, i * fw, 0, fw, fh));
}

function addAtlas(scene: Scene, key: string, atlas: Atlas) {
  const cv = atlas.build();
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, cv)!;
  for (const f of atlas.frames) tex.add(f.name, 0, f.x, f.y, f.w, f.h);
}

// ------------------------------------------------------------------ drill cone

interface ConePal {
  hi: number;
  lt: number;
  md: number;
  dk: number;
  gr: number;
}
const STEEL: ConePal = { hi: P.white, lt: P.silver, md: P.steel, dk: P.slate, gr: P.navy };

function cone(pc: PixelCanvas, tipX: number, tipY: number, dx: number, dy: number, len: number, halfW: number, phase: number, pal = STEEL) {
  const l = Math.hypot(dx, dy);
  dx /= l;
  dy /= l;
  const nx = -dy;
  const ny = dx;
  const side = Math.sign(nx * -0.6 + ny * -0.8) || 1;
  for (let y = 0; y < pc.h; y++)
    for (let x = 0; x < pc.w; x++) {
      const rx = x + 0.5 - tipX;
      const ry = y + 0.5 - tipY;
      const u = rx * dx + ry * dy;
      const v = rx * nx + ry * ny;
      if (u < 0 || u > len) continue;
      const hw = halfW * (u / len) + 0.6;
      if (Math.abs(v) > hw) continue;
      const t = (v / hw) * side;
      let c = t > 0.45 ? pal.hi : t > -0.1 ? pal.lt : t > -0.6 ? pal.md : pal.dk;
      if (t > 0.45 && u < len * 0.25) c = pal.lt;
      const g = (((u * 0.85 - v * 0.9 + phase) % 4) + 4) % 4;
      if (g < 1 && u > 2) c = t > 0.2 ? pal.md : pal.gr;
      pc.px(x, y, c);
    }
}

// ------------------------------------------------------------------ symbols (32x32)

function symDrill(size: 32 | 16, phase = 0): PixelCanvas {
  const s = size / 32;
  const pc = new PixelCanvas(size, size);
  // motor housing
  const hx = Math.round(8 * s);
  const hy = Math.round(20 * s);
  const hw = Math.round(16 * s);
  const hh = Math.round(10 * s);
  pc.rect(hx, hy, hw, hh, P.amber);
  pc.rect(hx, hy + hh - Math.max(1, Math.round(3 * s)), hw, Math.max(1, Math.round(3 * s)), P.orange);
  pc.rect(hx, hy, hw, 1, P.yellow);
  pc.rect(hx, hy, 1, hh, P.yellow);
  pc.rect(hx + hw - 1, hy + 1, 1, hh - 1, P.rust);
  if (size === 32) {
    for (let i = 0; i < hw; i++) if ((i + 0) % 4 < 2) pc.px(hx + i, hy + 5, P.black);
    for (let i = 0; i < hw; i++) if ((i + 1) % 4 < 2) pc.px(hx + i, hy + 6, P.black);
    pc.px(hx + 2, hy + 2, P.darkBrown);
    pc.px(hx + hw - 3, hy + 2, P.darkBrown);
  } else {
    pc.rect(hx + 1, hy + 2, hw - 2, 1, P.black);
  }
  // collar
  pc.rect(Math.round(10 * s), Math.round(17 * s), Math.round(12 * s), Math.max(2, Math.round(3 * s)), P.slate);
  pc.rect(Math.round(10 * s), Math.round(17 * s), Math.round(12 * s), 1, P.steel);
  // bit
  cone(pc, 16 * s, 1.5 * s, 0, 1, 16 * s, 8 * s, phase);
  pc.outline(P.black);
  return pc;
}

function symBomb(size: 32 | 16, spark = 0): PixelCanvas {
  const s = size / 32;
  const pc = new PixelCanvas(size, size);
  const cx = 15 * s + (size === 16 ? 0.5 : 0);
  const cy = 19 * s;
  const r = 10.5 * s;
  pc.sphere(cx, cy, r, [P.black, P.ink, P.navy, P.slate]);
  // shine
  pc.disc(cx - 4.5 * s, cy - 4.5 * s, Math.max(0.6, 2 * s), P.steel);
  pc.px(cx - 5 * s, cy - 5.5 * s, P.white);
  if (size === 32) pc.px(cx - 6, cy - 4, P.silver);
  // fuse cap
  const capW = Math.max(3, Math.round(7 * s));
  const capX = Math.round(cx - capW / 2 + 1 * s);
  const capY = Math.round(6 * s);
  pc.rect(capX, capY, capW, Math.max(2, Math.round(4 * s)), P.slate);
  pc.rect(capX, capY, capW, 1, P.silver);
  // fuse cord
  if (size === 32) {
    pc.line(17, 6, 18, 4, P.tan);
    pc.line(18, 4, 21, 3, P.tan);
    pc.px(19, 4, P.brown);
  } else {
    pc.px(9, 3, P.tan);
    pc.px(10, 2, P.tan);
  }
  pc.outline(P.black);
  // spark (drawn after outline so it glows)
  const sx = size === 32 ? 23 : 11;
  const sy = size === 32 ? 2 : 1;
  const star = (x: number, y: number, big: boolean) => {
    pc.px(x, y, P.white);
    pc.px(x + 1, y, P.yellow);
    pc.px(x - 1, y, P.yellow);
    pc.px(x, y + 1, P.yellow);
    pc.px(x, y - 1, P.yellow);
    if (big) {
      pc.px(x + 2, y, P.orange);
      pc.px(x - 2, y, P.orange);
      pc.px(x, y + 2, P.orange);
      pc.px(x + 1, y + 1, P.orange);
      pc.px(x - 1, y - 1, P.orange);
    }
  };
  star(sx, sy + 1, size === 32 && spark === 0);
  if (spark === 1 && size === 32) {
    pc.px(sx + 2, sy - 1, P.yellow);
    pc.px(sx - 2, sy + 3, P.orange);
  }
  return pc;
}

function symMagnet(size: 32 | 16): PixelCanvas {
  const s = size / 32;
  const pc = new PixelCanvas(size, size);
  const cx = 15.5 * s;
  const cy = 13 * s;
  const ro = 12 * s;
  const ri = 5.5 * s;
  const legBottom = 28 * s;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let inside = false;
      let t = 0; // 0..1 across the band (0 = outer)
      if (py <= cy) {
        const d = Math.hypot(px - cx, py - cy);
        if (d <= ro && d >= ri) {
          inside = true;
          t = (ro - d) / (ro - ri);
        }
      } else if (py <= legBottom) {
        const dxl = cx - px;
        const dxr = px - cx;
        if (dxl >= ri && dxl <= ro) {
          inside = true;
          t = (ro - dxl) / (ro - ri);
        } else if (dxr >= ri && dxr <= ro) {
          inside = true;
          t = (ro - dxr) / (ro - ri);
        }
      }
      if (!inside) continue;
      const tipZone = py > legBottom - 6 * s;
      const leftSide = px < cx;
      if (tipZone) {
        pc.px(x, y, t < 0.3 ? P.white : t < 0.7 ? P.silver : P.steel);
      } else {
        const lit = (leftSide ? 1 - t : t) * 0.5 + (py < cy - ro * 0.4 ? 0.3 : 0);
        pc.px(x, y, t < 0.28 && leftSide ? P.pink : lit > 0.62 ? P.pink : t > 0.72 ? P.crimson : P.red);
      }
    }
  // band separating red and silver
  const by = Math.round(legBottom - 6 * s);
  for (let x = 0; x < size; x++) if (pc.get(x, by) !== CLEAR) pc.px(x, by, P.crimson);
  pc.outline(P.black);
  if (size === 32) {
    // little field sparks under the tips
    pc.px(6, 30, P.cyan);
    pc.px(8, 31, P.sky);
    pc.px(25, 30, P.cyan);
    pc.px(23, 31, P.sky);
  }
  return pc;
}

export const SYM_ART: Record<Sym, () => PixelCanvas> = {
  D: () => symDrill(32),
  B: () => symBomb(32),
  M: () => symMagnet(32),
};

function blurVertical(src: PixelCanvas, len: number): PixelCanvas {
  const o = new PixelCanvas(src.w, src.h);
  for (let x = 0; x < src.w; x++)
    for (let y = 0; y < src.h; y++) {
      for (let k = 0; k < len; k++) {
        const v = src.get(x, y - k);
        if (v !== CLEAR) {
          o.px(x, y, k === 0 ? v : k < len / 2 ? v : (x + y) % 2 ? v : CLEAR);
          break;
        }
      }
    }
  return o;
}

export const REEL_CELL = 40;

/** Build (or rebuild) the vertical reel strip textures for the given reel faces. */
export function makeReelStrip(scene: Scene, reel: Sym[], key = 'reelstrip') {
  const h = REEL_CELL * reel.length;
  const strip = new PixelCanvas(32, h);
  const blur = new PixelCanvas(32, h);
  reel.forEach((s, i) => {
    const art = SYM_ART[s]();
    strip.blit(art, 0, i * REEL_CELL + 4);
    blur.blit(blurVertical(art, 7), 0, i * REEL_CELL + 4);
  });
  addCanvas(scene, key, strip);
  addCanvas(scene, key + '_blur', blur);
}

// ------------------------------------------------------------------ tiles

function rockBase(pal: LayerPalette, v: number, seed = 0): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  pc.rect(0, 0, 16, 16, pal.m);
  // seams on right/bottom, highlights top/left
  for (let i = 0; i < 16; i++) {
    pc.px(i, 15, pal.k);
    pc.px(15, i, pal.k);
    pc.px(i, 14, pal.d);
    pc.px(14, i, pal.d);
    pc.px(i, 0, pal.l);
    pc.px(0, i, pal.l);
  }
  pc.px(15, 15, pal.k);
  pc.px(0, 0, pal.h);
  pc.px(1, 0, pal.h);
  pc.px(0, 1, pal.h);
  pc.px(14, 0, pal.m);
  pc.px(0, 14, pal.m);
  // pebble clusters
  const n = 2 + (v % 2);
  for (let i = 0; i < n; i++) {
    const x = 2 + Math.floor(hash2(v, i, seed + 1) * 10);
    const y = 2 + Math.floor(hash2(i, v, seed + 2) * 10);
    const w = 2 + Math.floor(hash2(v + i, 3, seed) * 2);
    pc.rect(x, y, w, 2, pal.d);
    pc.px(x, y, pal.l);
    if (w > 2) pc.px(x + w - 1, y + 1, pal.k);
  }
  if (v === 2) {
    const y = 6 + Math.floor(hash2(v, 9, seed) * 5);
    for (let x = 1; x < 13; x++) if (hash2(x, y, seed) > 0.25) pc.px(x, y, pal.d);
  }
  if (v === 3) {
    pc.px(9, 4, pal.h);
    pc.px(4, 10, pal.h);
  }
  return pc;
}

function hardTile(pal: LayerPalette, v: number): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  // chunky octagon boulder
  pc.poly(
    [
      [1, 4],
      [4, 1],
      [12, 1],
      [15, 4],
      [15, 12],
      [12, 15],
      [4, 15],
      [1, 12],
    ],
    pal.d,
  );
  pc.bevel(pal.m, pal.k);
  // facets
  if (v === 0) {
    pc.line(4, 5, 11, 4, pal.k);
    pc.line(11, 4, 12, 11, pal.k);
    pc.line(4, 5, 5, 12, pal.k);
    pc.line(5, 3, 10, 3, pal.m);
    pc.px(3, 6, pal.l);
    pc.px(6, 6, pal.m);
    pc.px(7, 6, pal.m);
  } else {
    pc.line(3, 9, 9, 3, pal.k);
    pc.line(9, 3, 13, 8, pal.k);
    pc.line(6, 13, 13, 8, pal.k);
    pc.line(4, 7, 7, 4, pal.m);
    pc.px(5, 5, pal.l);
  }
  pc.px(12, 12, pal.k);
  pc.outline(pal.k);
  // background seam look
  const out = new PixelCanvas(16, 16);
  out.rect(0, 0, 16, 16, pal.k);
  out.blit(pc, 0, 0);
  out.px(3, 2, pal.l);
  out.px(2, 3, pal.l);
  return out;
}

function goldTile(pal: LayerPalette, v: number, f: number): PixelCanvas {
  const pc = rockBase(pal, v + 1, 7);
  const nug = (x: number, y: number, r: number) => {
    const t = new PixelCanvas(16, 16);
    t.sphere(x, y, r, [P.orange, P.amber, P.yellow]);
    t.outline(P.darkBrown);
    pc.blit(t, 0, 0);
    pc.px(Math.round(x - r * 0.5), Math.round(y - r * 0.5), P.white);
  };
  if (v === 0) {
    nug(5, 5, 2.4);
    nug(10.5, 9.5, 2.8);
    nug(4.5, 11, 1.5);
  } else {
    nug(9, 4.5, 2.2);
    nug(5, 9.5, 2.8);
    nug(11, 11, 1.6);
  }
  if (f === 1) {
    const sx = v === 0 ? 11 : 5;
    const sy = v === 0 ? 8 : 8;
    pc.px(sx, sy - 1, P.white);
    pc.px(sx, sy + 1, P.white);
    pc.px(sx - 1, sy, P.white);
    pc.px(sx + 1, sy, P.white);
    pc.px(sx, sy, P.yellow);
  }
  return pc;
}

function cavity(pal: LayerPalette): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  pc.rect(0, 0, 16, 16, pal.d);
  pc.rect(2, 2, 12, 12, pal.k);
  pc.px(2, 2, pal.d);
  pc.px(13, 2, pal.d);
  pc.px(2, 13, pal.d);
  pc.px(13, 13, pal.d);
  for (let i = 0; i < 16; i++) {
    pc.px(i, 0, pal.m);
    pc.px(0, i, pal.m);
    pc.px(i, 15, pal.k);
    pc.px(15, i, pal.k);
  }
  return pc;
}

function gasTile(pal: LayerPalette, f: number): PixelCanvas {
  const pc = cavity(pal);
  // toxic haze inside the pocket
  for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) if ((x + y + f) % 2 === 0) pc.px(x, y, P.pine);
  for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) if ((x + y + f) % 4 === 0) pc.px(x, y, P.forest);
  const bubbles: [number, number, number][][] = [
    [
      [6, 9, 3.4],
      [10.5, 6, 2.6],
      [10.5, 11, 2],
      [5, 4.5, 1.4],
    ],
    [
      [6, 8.5, 3.6],
      [10.5, 6.5, 2.4],
      [11, 11, 2.2],
      [5.5, 3.5, 1.3],
    ],
    [
      [6.5, 9, 3.2],
      [10, 5.5, 2.8],
      [10, 11.5, 1.8],
      [4.5, 4, 1.6],
    ],
  ];
  const layer = new PixelCanvas(16, 16);
  for (const [x, y, r] of bubbles[f]) layer.sphere(x, y, r, [P.forest, P.green, P.yellow, P.yellow]);
  layer.outline(P.deepTeal);
  pc.blit(layer, 0, 0);
  for (const [x, y, r] of bubbles[f]) if (r > 1.8) pc.px(Math.round(x - r * 0.45), Math.round(y - r * 0.5), P.white);
  // hazard glow corner ticks
  pc.px(1, 1, P.green);
  pc.px(14, 14, P.green);
  return pc;
}

function crystalTile(pal: LayerPalette, v: number, f: number): PixelCanvas {
  const pc = cavity(pal);
  const layer = new PixelCanvas(16, 16);
  const prism = (x: number, y: number, w: number, h: number, lean: number) => {
    const pts: [number, number][] = [
      [x + lean, y],
      [x + w / 2 + lean, y - 2],
      [x + w + lean, y],
      [x + w, y + h],
      [x, y + h],
    ];
    layer.poly(pts, P.pink);
    // dark right half
    for (let yy = y - 2; yy <= y + h; yy++)
      for (let xx = Math.round(x + w / 2 + lean * 0.5); xx <= x + w + lean; xx++) if (layer.get(xx, yy) === P.pink) layer.px(xx, yy, P.magenta);
    layer.line(x + lean + 1, y, x + 1, y + h - 1, P.peach);
  };
  if (v === 0) {
    prism(3, 5, 5, 8, 1);
    prism(8, 3, 5, 10, -1);
  } else {
    prism(2, 7, 4, 6, 1);
    prism(6, 3, 5, 10, 0);
    prism(10, 6, 4, 7, -1);
  }
  layer.outline(P.purple);
  pc.blit(layer, 0, 0);
  const gx = f === 0 ? (v === 0 ? 5 : 8) : v === 0 ? 10 : 4;
  const gy = f === 0 ? 5 : 8;
  pc.px(gx, gy, P.white);
  if (f === 1) {
    pc.px(gx + 1, gy, P.white);
    pc.px(gx, gy + 1, P.peach);
  }
  return pc;
}

function bombRockTile(pal: LayerPalette, f: number): PixelCanvas {
  const pc = rockBase(pal, 1, 11);
  pc.rect(3, 3, 10, 10, pal.d);
  const glow = f === 0 ? [P.crimson, P.red, P.red] : [P.red, P.orange, P.yellow];
  // cracks
  pc.line(8, 8, 3, 3, glow[0]);
  pc.line(8, 8, 13, 4, glow[0]);
  pc.line(8, 8, 4, 13, glow[0]);
  pc.line(8, 8, 12, 12, glow[0]);
  pc.disc(7.5, 7.5, 2.4, glow[1]);
  pc.rect(7, 7, 2, 2, glow[2]);
  if (f === 1) {
    pc.px(8, 7, P.white);
    pc.px(2, 2, P.red);
    pc.px(13, 13, P.red);
  }
  // warning dots
  pc.px(1, 7, glow[1]);
  pc.px(14, 8, glow[1]);
  return pc;
}

function armorTile(v: number): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  pc.rect(0, 0, 16, 16, P.purple);
  for (let i = 0; i < 16; i++) {
    pc.px(i, 0, P.magenta);
    pc.px(0, i, P.magenta);
    pc.px(i, 15, P.black);
    pc.px(15, i, P.black);
    pc.px(i, 14, P.plum);
    pc.px(14, i, P.plum);
  }
  // plates
  pc.line(2, 8, 8, 2, P.plum);
  pc.line(8, 13, 13, 8, P.plum);
  pc.line(3, 8, 8, 3, P.magenta);
  pc.px(4, 12, P.pink);
  pc.px(11, 4, P.pink);
  pc.rect(6, 6, 4, 4, P.plum);
  pc.rect(7, 7, 2, 2, v === 0 ? P.hotpink : P.magenta);
  pc.px(7, 7, P.pink);
  return pc;
}

function unstableTile(f: number): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  pc.rect(0, 0, 16, 16, P.crimson);
  for (let i = 0; i < 16; i++) {
    pc.px(i, 15, P.plum);
    pc.px(15, i, P.plum);
    pc.px(i, 0, P.red);
    pc.px(0, i, P.red);
  }
  const hot = f === 0 ? P.orange : P.amber;
  const core = f === 0 ? P.amber : P.yellow;
  pc.line(2, 4, 7, 7, hot);
  pc.line(7, 7, 13, 5, hot);
  pc.line(7, 7, 6, 13, hot);
  pc.line(6, 13, 12, 12, hot);
  pc.px(7, 7, core);
  pc.px(6, 8, core);
  pc.px(12, 12, core);
  pc.px(3, 11, P.plum);
  pc.px(11, 2, P.plum);
  if (f === 1) {
    pc.px(7, 6, P.white);
    pc.px(13, 5, core);
  }
  return pc;
}

function crackOverlay(stage: number): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  pc.line(3, 2, 7, 7, P.black);
  pc.line(7, 7, 6, 11, P.black);
  pc.line(7, 7, 11, 8, P.black);
  if (stage >= 2) {
    pc.line(11, 8, 13, 12, P.black);
    pc.line(6, 11, 3, 13, P.black);
    pc.line(11, 8, 12, 3, P.black);
    pc.px(8, 6, P.black);
  }
  return pc;
}

export function tileFrame(layer: number, type: string, v: number, f: number): string {
  return `L${layer}_${type}_${v}_${f}`;
}

function buildTiles(scene: Scene) {
  const atlas = new Atlas(1024);
  LAYERS.forEach((L, li) => {
    const pal = L.pal;
    for (let v = 0; v < 4; v++) atlas.add(tileFrame(li, 'rock', v, 0), rockBase(pal, v, li));
    for (let v = 0; v < 2; v++) atlas.add(tileFrame(li, 'hard', v, 0), hardTile(pal, v));
    for (let v = 0; v < 2; v++) for (let f = 0; f < 2; f++) atlas.add(tileFrame(li, 'gold', v, f), goldTile(pal, v, f));
    for (let f = 0; f < 3; f++) atlas.add(tileFrame(li, 'gas', 0, f), gasTile(pal, f));
    for (let v = 0; v < 2; v++) for (let f = 0; f < 2; f++) atlas.add(tileFrame(li, 'crystal', v, f), crystalTile(pal, v, f));
    for (let f = 0; f < 2; f++) atlas.add(tileFrame(li, 'bombrock', 0, f), bombRockTile(pal, f));
    for (let v = 0; v < 2; v++) atlas.add(tileFrame(li, 'armor', v, 0), armorTile(v));
    for (let f = 0; f < 2; f++) atlas.add(tileFrame(li, 'unstable', 0, f), unstableTile(f));
  });
  atlas.add('crack1', crackOverlay(1));
  atlas.add('crack2', crackOverlay(2));
  addAtlas(scene, 'tiles', atlas);
  // standalone icons for cards
  addCanvas(scene, 'tile_gas_icon', gasTile(LAYERS[2].pal, 0));
  addCanvas(scene, 'tile_bombrock_icon', bombRockTile(LAYERS[2].pal, 1));
  addCanvas(scene, 'tile_crystal_icon', crystalTile(LAYERS[3].pal, 0, 1));
  addCanvas(scene, 'tile_gold_icon', goldTile(LAYERS[1].pal, 0, 1));
  addCanvas(scene, 'tile_rock_icon', rockBase(LAYERS[0].pal, 0, 0));
  addCanvas(scene, 'tile_hard_icon', hardTile(LAYERS[0].pal, 0));
}

// ------------------------------------------------------------------ heart core

function heartFrame(stage: number, glow: number): PixelCanvas {
  const pc = new PixelCanvas(52, 52);
  const cx = 25.5;
  const cy = 25.5;
  // aura ring
  pc.ring(cx, cy, 25, 2, glow ? P.orange : P.crimson);
  pc.sphere(cx, cy, 21, [P.plum, P.purple, P.magenta, P.pink]);
  // hot core
  pc.sphere(cx, cy, 13, [P.orange, P.amber, P.yellow, P.white]);
  pc.disc(cx - 4, cy - 4, 3, P.white);
  // facets
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    pc.line(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13, cx + Math.cos(a) * 20, cy + Math.sin(a) * 20, P.plum);
  }
  // cracks per stage
  if (stage >= 1) {
    pc.line(cx - 2, cy - 18, cx + 3, cy - 6, P.white);
    pc.line(cx + 3, cy - 6, cx - 1, cy + 2, P.white);
  }
  if (stage >= 2) {
    pc.line(cx - 17, cy + 6, cx - 5, cy + 2, P.white);
    pc.line(cx + 16, cy + 9, cx + 4, cy + 3, P.white);
  }
  if (stage >= 3) {
    pc.line(cx - 8, cy - 14, cx - 12, cy - 4, P.white);
    pc.line(cx + 6, cy + 16, cx + 2, cy + 6, P.white);
  }
  pc.outline(P.black);
  if (glow) {
    pc.px(cx - 24, cy, P.yellow);
    pc.px(cx + 24, cy, P.yellow);
    pc.px(cx, cy - 24, P.yellow);
    pc.px(cx, cy + 24, P.yellow);
  }
  return pc;
}

// ------------------------------------------------------------------ loot & projectiles

function oreGem(v: number, size = 6): PixelCanvas {
  const pc = new PixelCanvas(size + 2, size + 2);
  const m = (size + 2) / 2 - 0.5;
  const r = size / 2;
  pc.poly(
    [
      [m + 0.5, m - r + 0.5],
      [m + r + 0.5, m + 0.5],
      [m + 0.5, m + r + 1],
      [m - r + 0.5, m + 0.5],
    ],
    P.sky,
  );
  pc.map((c, x, y) => (x + y < m * 2 - 0.5 ? (x < m && y < m ? P.cyan : P.sky) : c));
  pc.map((c, x, y) => (x + y > m * 2 + 1 ? P.blue : c));
  pc.outline(P.ink);
  pc.px(Math.round(m - (v ? 0 : 1)), Math.round(m - 1), P.white);
  return pc;
}

function goldNugget(v: number): PixelCanvas {
  const pc = new PixelCanvas(9, 8);
  pc.sphere(4, 4, v ? 3 : 2.6, [P.orange, P.amber, P.yellow]);
  if (v) pc.disc(6, 5, 1.4, P.amber);
  pc.outline(P.darkBrown);
  pc.px(3, 3, P.white);
  return pc;
}

function shard(): PixelCanvas {
  const pc = new PixelCanvas(7, 9);
  pc.poly(
    [
      [3.5, 0.5],
      [6, 4],
      [3.5, 8.5],
      [1, 4],
    ],
    P.pink,
  );
  pc.map((c, x) => (x >= 4 ? P.magenta : c));
  pc.outline(P.purple);
  pc.px(3, 2, P.white);
  pc.px(3, 3, P.peach);
  return pc;
}

function coreFrag(): PixelCanvas {
  const pc = new PixelCanvas(13, 13);
  pc.sphere(6, 6, 5, [P.orange, P.amber, P.yellow, P.white]);
  pc.outline(P.magenta);
  pc.px(4, 4, P.white);
  return pc;
}

function drillBit(dir: 'N' | 'NE', phase: number, big = false): PixelCanvas {
  if (dir === 'N') {
    const w = big ? 30 : 12;
    const h = big ? 44 : 18;
    const pc = new PixelCanvas(w, h);
    const len = big ? 30 : 12;
    cone(pc, w / 2, 0.5, 0, 1, len, big ? 13 : 5, phase);
    const cy = Math.round(len);
    pc.rect(big ? 5 : 2, cy, big ? 20 : 8, big ? 5 : 2, P.slate);
    pc.rect(big ? 5 : 2, cy, big ? 20 : 8, 1, P.steel);
    if (big) {
      pc.rect(7, cy + 5, 16, 8, P.amber);
      pc.rect(7, cy + 5, 16, 1, P.yellow);
      pc.rect(7, cy + 11, 16, 2, P.orange);
      for (let i = 0; i < 16; i++) if (i % 4 < 2) pc.px(7 + i, cy + 8, P.black);
    } else {
      pc.rect(3, cy + 2, 6, 3, P.amber);
      pc.rect(3, cy + 4, 6, 1, P.orange);
    }
    pc.outline(P.black);
    return pc;
  }
  const s = big ? 40 : 16;
  const pc = new PixelCanvas(s, s);
  const len = big ? 30 : 12;
  const d = 1 / Math.SQRT2;
  cone(pc, s - 1.5, 1.5, -d, d, len, big ? 12 : 4.6, phase);
  const bx = s - 1.5 - len * d;
  const by = 1.5 + len * d;
  pc.thick(bx, by, bx - (big ? 5 : 2), by + (big ? 5 : 2), big ? 4 : 1.6, P.amber);
  pc.thick(bx + 0.5, by - 0.5, bx - 0.5, by + 0.5, big ? 3.2 : 1.2, P.slate);
  pc.outline(P.black);
  return pc;
}

function bombProj(spark: number, small = false): PixelCanvas {
  const pc = new PixelCanvas(small ? 8 : 12, small ? 9 : 13);
  const cx = small ? 3.5 : 5.5;
  const cy = small ? 5 : 7.5;
  pc.sphere(cx, cy, small ? 2.6 : 4.4, small ? [P.plum, P.crimson, P.red] : [P.black, P.ink, P.navy, P.slate]);
  pc.px(Math.round(cx - 1.5), Math.round(cy - 1.5), P.white);
  pc.rect(Math.round(cx) - 1, small ? 1 : 2, small ? 2 : 3, 2, P.slate);
  pc.outline(P.black);
  const sx = small ? 5 : 8;
  pc.px(sx, 1, spark ? P.white : P.yellow);
  pc.px(sx + 1, 1, P.orange);
  pc.px(sx, 0, spark ? P.yellow : P.orange);
  if (spark) pc.px(sx - 1, 0, P.yellow);
  return pc;
}

function magnetHead(): PixelCanvas {
  const pc = symMagnet(16);
  return pc;
}

// ------------------------------------------------------------------ fx

interface FxScheme {
  c: number[]; // hottest -> coolest
  smoke: number[];
}
const FX_FIRE: FxScheme = { c: [P.white, P.yellow, P.amber, P.orange, P.red, P.crimson], smoke: [P.slate, P.navy, P.ink] };
const FX_GAS: FxScheme = { c: [P.white, P.yellow, P.yellow, P.green, P.forest, P.pine], smoke: [P.forest, P.pine, P.deepTeal] };
const FX_RED: FxScheme = { c: [P.white, P.pink, P.red, P.hotpink, P.crimson, P.plum], smoke: [P.rose, P.purple, P.plum] };
const FX_CORE: FxScheme = { c: [P.white, P.yellow, P.pink, P.magenta, P.purple, P.plum], smoke: [P.magenta, P.purple, P.plum] };

function explosionFrames(r: number, sch: FxScheme): PixelCanvas[] {
  const S = Math.ceil(r * 2 + 4);
  const c = S / 2;
  const frames: PixelCanvas[] = [];
  const N = 8;
  const edge = (x: number, y: number, rad: number, k: number) => {
    const a = Math.atan2(y - c, x - c);
    const n = hash2(Math.floor((a + Math.PI) * 5), k, Math.round(r)) * 0.28 + hash2(Math.floor((a + Math.PI) * 11), k + 3, 7) * 0.12;
    return rad * (0.82 + n);
  };
  for (let f = 0; f < N; f++) {
    const pc = new PixelCanvas(S, S);
    const t = f / (N - 1);
    const outer = r * (0.55 + 0.45 * Math.min(1, t * 2.2));
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
        const e = edge(x, y, outer, f);
        if (d > e) continue;
        const q = d / e; // 0 center .. 1 edge
        let col: number = CLEAR;
        if (f === 0) col = q < 0.7 ? sch.c[0] : sch.c[1];
        else if (f === 1) col = q < 0.45 ? sch.c[0] : q < 0.75 ? sch.c[1] : sch.c[2];
        else if (f === 2) col = q < 0.3 ? sch.c[1] : q < 0.65 ? sch.c[2] : q < 0.88 ? sch.c[3] : sch.c[4];
        else if (f === 3) col = q < 0.25 ? sch.c[2] : q < 0.6 ? sch.c[3] : q < 0.85 ? sch.c[4] : sch.c[5];
        else {
          // breaking up into smoke clusters
          const holes = hash2(Math.floor(x / 3), Math.floor(y / 3), f * 13 + Math.round(r));
          const thr = (f - 3) * 0.2;
          if (holes < thr + q * 0.35) continue;
          if (f === 4) col = q < 0.35 ? sch.c[4] : q < 0.7 ? sch.c[5] : sch.smoke[0];
          else if (f === 5) col = q < 0.5 ? sch.smoke[0] : sch.smoke[1];
          else col = (x + y) % 2 === 0 ? sch.smoke[1] : f === 7 ? CLEAR : sch.smoke[2];
        }
        if (col !== CLEAR) pc.px(x, y, col);
      }
    // sparks flying out on early frames
    if (f >= 1 && f <= 4) {
      for (let i = 0; i < 10; i++) {
        const a = hash2(i, 5, Math.round(r)) * Math.PI * 2;
        const rr = r * (0.5 + t * 0.6) * (0.8 + hash2(i, 9, 3) * 0.4);
        pc.px(c + Math.cos(a) * rr, c + Math.sin(a) * rr, f < 3 ? sch.c[1] : sch.c[3]);
      }
    }
    frames.push(pc);
  }
  return frames;
}

export const EXPL_SIZES = {
  fire: [10, 16, 24, 34, 50, 72],
  gas: [12, 20, 30],
  red: [16, 24, 34],
  core: [72],
};

function smokeFrames(cols: number[]): PixelCanvas[] {
  const out: PixelCanvas[] = [];
  for (let f = 0; f < 5; f++) {
    const pc = new PixelCanvas(9, 9);
    const r = 3.8 - f * 0.55;
    pc.disc(4, 4, r, cols[Math.min(cols.length - 1, Math.floor(f / 2))]);
    if (f >= 2) pc.dither(0, 0, 9, 9, CLEAR, f, true);
    if (f < 2) pc.disc(3, 3, r * 0.45, cols[0] === P.silver ? P.white : cols[0]);
    out.push(pc);
  }
  return out;
}

function sparkFrames(): PixelCanvas[] {
  const a = new PixelCanvas(5, 5);
  a.px(2, 2, P.white);
  a.px(1, 2, P.yellow);
  a.px(3, 2, P.yellow);
  a.px(2, 1, P.yellow);
  a.px(2, 3, P.yellow);
  a.px(0, 2, P.orange);
  a.px(4, 2, P.orange);
  a.px(2, 0, P.orange);
  a.px(2, 4, P.orange);
  const b = new PixelCanvas(5, 5);
  b.px(2, 2, P.white);
  b.px(1, 1, P.yellow);
  b.px(3, 3, P.yellow);
  b.px(1, 3, P.yellow);
  b.px(3, 1, P.yellow);
  const c = new PixelCanvas(5, 5);
  c.px(2, 2, P.yellow);
  return [a, b, c];
}

function debris(pal: LayerPalette, v: number): PixelCanvas {
  const pc = new PixelCanvas(5, 5);
  if (v === 0) {
    pc.rect(1, 1, 3, 3, pal.m);
    pc.px(1, 1, pal.l);
    pc.px(3, 3, pal.d);
  } else if (v === 1) {
    pc.rect(1, 1, 3, 2, pal.m);
    pc.px(1, 1, pal.h);
    pc.px(3, 2, pal.d);
  } else {
    pc.rect(1, 1, 2, 2, pal.l);
    pc.px(2, 2, pal.d);
  }
  pc.outline(pal.k);
  return pc;
}

function coloredChunk(cols: number[], out: number, v: number): PixelCanvas {
  const pc = new PixelCanvas(5, 5);
  if (v === 0) {
    pc.rect(1, 1, 3, 3, cols[1]);
    pc.px(1, 1, cols[2]);
    pc.px(3, 3, cols[0]);
  } else {
    pc.rect(1, 1, 2, 2, cols[1]);
    pc.px(1, 1, cols[2]);
  }
  pc.outline(out);
  return pc;
}

// ------------------------------------------------------------------ machine

function rivet(pc: PixelCanvas, x: number, y: number) {
  pc.px(x, y, P.steel);
  pc.px(x + 1, y, P.slate);
  pc.px(x, y + 1, P.slate);
  pc.px(x + 1, y + 1, P.black);
}

function bevelBox(pc: PixelCanvas, x: number, y: number, w: number, h: number, fill: number, light: number, dark: number, outline = P.black) {
  pc.rect(x, y, w, h, outline);
  pc.rect(x + 1, y + 1, w - 2, h - 2, fill);
  pc.rect(x + 1, y + 1, w - 2, 1, light);
  pc.rect(x + 1, y + 1, 1, h - 2, light);
  pc.rect(x + 1, y + h - 2, w - 2, 1, dark);
  pc.rect(x + w - 2, y + 1, 1, h - 2, dark);
}

function insetBox(pc: PixelCanvas, x: number, y: number, w: number, h: number, fill: number) {
  pc.rect(x, y, w, h, P.black);
  pc.rect(x + 1, y + 1, w - 2, h - 2, fill);
  pc.rect(x + 1, y + h - 2, w - 2, 1, P.navy);
  pc.rect(x + w - 2, y + 1, 1, h - 2, P.navy);
  pc.rect(x, y + h, w, 1, P.slate);
}

export const MACH = {
  y: 216,
  reelX: [262, 302, 342] as number[], // window left x (screen), each 36 wide
  reelY: 248, // screen y of window top
  reelW: 36,
  reelH: 52,
  orePanel: { x: 116, y: 244, w: 124, h: 34 },
  upBtn: { x: 116, y: 283, w: 124, h: 26 },
  feverBar: { x: 196, y: 322, w: 248, h: 12 },
  feverBtn: { x: 530, y: 280 },
  botDock: { x: 14, y: 246 },
  leverPivot: { x: 408, y: 282 },
};

function machineBody(): PixelCanvas {
  const pc = new PixelCanvas(W, 144);
  const oy = MACH.y;
  // body
  pc.rect(0, 0, W, 144, P.ink);
  // panel lines
  for (const x of [108, 248, 392, 452]) {
    pc.rect(x, 8, 1, 110, P.black);
    pc.rect(x + 1, 8, 1, 110, P.navy);
  }
  pc.rect(0, 118, W, 1, P.black);
  pc.rect(0, 119, W, 1, P.navy);
  // subtle panel texture
  for (let y = 10; y < 116; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < W; x += 4) if (hash2(x, y, 3) > 0.92) pc.px(x, y, P.navy);
  // rivets
  for (let x = 6; x < W; x += 24) {
    rivet(pc, x, 10);
    rivet(pc, x, 112);
  }
  // top deck beam with hazard stripes
  pc.rect(0, 0, W, 8, P.slate);
  pc.rect(0, 0, W, 1, P.silver);
  pc.rect(0, 1, W, 1, P.steel);
  pc.rect(0, 7, W, 1, P.black);
  for (let x = 0; x < W; x++) {
    if (x > 272 && x < 368) continue;
    for (let y = 2; y < 6; y++) pc.px(x, y, ((x + y) >> 2) % 2 ? P.amber : P.black);
  }
  // reel housing
  const hx = 254;
  const hy = 24;
  bevelBox(pc, hx, hy, 132, 68, P.slate, P.steel, P.navy);
  pc.rect(hx + 4, hy + 4, 124, 60, P.black);
  pc.rect(hx + 5, hy + 5, 122, 58, P.navy);
  // lamp strip above housing
  insetBox(pc, hx + 6, hy - 14, 120, 10, P.black);
  // reel window bezels
  for (const rx of MACH.reelX) {
    const x = rx;
    const y = MACH.reelY - oy;
    pc.rect(x - 2, y - 2, MACH.reelW + 4, MACH.reelH + 4, P.black);
    pc.rect(x - 1, y - 1, MACH.reelW + 2, MACH.reelH + 2, P.steel);
    pc.rect(x - 1, y + MACH.reelH, MACH.reelW + 2, 1, P.slate);
    pc.rect(x, y, MACH.reelW, MACH.reelH, P.black);
  }
  // payline arrows
  const py = MACH.reelY - oy + MACH.reelH / 2;
  for (let i = 0; i < 3; i++) {
    pc.px(hx + 6, py - 1 + i, P.red);
    pc.px(hx + 7, py, P.red);
    pc.px(hx + 125, py - 1 + i, P.red);
    pc.px(hx + 124, py, P.red);
  }
  // ore panel
  const op = MACH.orePanel;
  bevelBox(pc, op.x - 4, op.y - oy - 4, op.w + 8, op.h + 8, P.slate, P.steel, P.navy);
  insetBox(pc, op.x, op.y - oy, op.w, op.h, 0x10131f);
  // upgrade socket
  const ub = MACH.upBtn;
  insetBox(pc, ub.x - 2, ub.y - oy - 2, ub.w + 4, ub.h + 4, P.black);
  // fever tube
  const fb = MACH.feverBar;
  bevelBox(pc, fb.x - 4, fb.y - oy - 4, fb.w + 8, fb.h + 8, P.slate, P.steel, P.navy);
  insetBox(pc, fb.x, fb.y - oy, fb.w, fb.h, 0x120a14);
  // fever socket (right panel)
  const fs = MACH.feverBtn;
  pc.disc(fs.x, fs.y - oy, 30, P.black);
  pc.disc(fs.x, fs.y - oy, 28, P.navy);
  pc.disc(fs.x, fs.y - oy, 25, 0x151827);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    pc.px(fs.x + Math.cos(a) * 29, fs.y - oy + Math.sin(a) * 29, P.slate);
  }
  // bot dock
  const bd = MACH.botDock;
  bevelBox(pc, bd.x - 4, bd.y - oy - 4, 96, 64, P.slate, P.steel, P.navy);
  for (let i = 0; i < 3; i++) insetBox(pc, bd.x + i * 30, bd.y - oy, 26, 26, 0x10131f);
  for (let i = 0; i < 3; i++) insetBox(pc, bd.x + i * 30, bd.y - oy + 32, 26, 20, 0x10131f);
  // lever housing
  const lp = MACH.leverPivot;
  bevelBox(pc, lp.x - 12, lp.y - oy - 10, 24, 30, P.slate, P.steel, P.navy);
  pc.rect(lp.x - 3, lp.y - oy - 6, 6, 22, P.black);
  // pipes
  const pipe = (x0: number, y0: number, x1: number, y1: number) => {
    pc.thick(x0, y0, x1, y1, 2, P.black);
    pc.thick(x0, y0, x1, y1, 1.2, P.slate);
    pc.line(x0, y0 - 1, x1, y1 - 1, P.steel);
  };
  pipe(444, 30, 444, 108);
  pipe(456, 108, 620, 108);
  pipe(20, 110, 104, 110);
  // vents
  for (const vx of [466, 590]) {
    for (let i = 0; i < 4; i++) pc.rect(vx, 14 + i * 4, 18, 2, P.black);
  }
  // tread band
  pc.rect(0, 122, W, 22, P.black);
  return pc;
}

function treadPattern(): PixelCanvas {
  const pc = new PixelCanvas(16, 20);
  pc.rect(0, 0, 16, 20, P.black);
  pc.rect(1, 2, 13, 5, P.navy);
  pc.rect(1, 2, 13, 1, P.slate);
  pc.rect(1, 13, 13, 5, P.navy);
  pc.rect(1, 17, 13, 1, P.ink);
  pc.rect(0, 9, 16, 2, P.ink);
  pc.px(7, 9, P.slate);
  return pc;
}

function wheel(f: number): PixelCanvas {
  const pc = new PixelCanvas(18, 18);
  pc.disc(8.5, 8.5, 8, P.black);
  pc.disc(8.5, 8.5, 7, P.slate);
  pc.disc(8.5, 8.5, 3, P.navy);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI + (f * Math.PI) / 8;
    pc.line(8.5 + Math.cos(a) * 3, 8.5 + Math.sin(a) * 3, 8.5 + Math.cos(a) * 6.5, 8.5 + Math.sin(a) * 6.5, P.steel);
    pc.line(8.5 - Math.cos(a) * 3, 8.5 - Math.sin(a) * 3, 8.5 - Math.cos(a) * 6.5, 8.5 - Math.sin(a) * 6.5, P.steel);
  }
  pc.px(8, 8, P.silver);
  return pc;
}

function gear(f: number, r = 9): PixelCanvas {
  const S = r * 2 + 4;
  const pc = new PixelCanvas(S, S);
  const c = S / 2 - 0.5;
  const teeth = 8;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = x - c;
      const dy = y - c;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx) + (f * Math.PI) / teeth / 2;
      const tooth = ((a / (Math.PI * 2)) * teeth * 2 + 64) % 2 < 1;
      const rr = tooth ? r : r - 2;
      if (d <= rr) pc.px(x, y, d < r * 0.35 ? P.navy : d > rr - 1.2 ? P.slate : P.steel);
    }
  pc.disc(c, c, 1.2, P.black);
  pc.outline(P.black);
  return pc;
}

function leverFrames(): PixelCanvas[] {
  // pivot at (14, 52); ball travels from top to bottom through foreshortening
  const ys = [8, 22, 40, 60, 78];
  const rs = [7, 7.5, 8, 7.5, 7];
  return ys.map((by, i) => {
    const pc = new PixelCanvas(28, 96);
    const px = 14;
    const py = 52;
    pc.thick(px, py, px, by, 1.6, P.black);
    pc.thick(px, py, px, by, 1, P.silver);
    pc.line(px - 1, py, px - 1, by, P.white);
    pc.sphere(px - 0.5, by, rs[i], [P.crimson, P.red, P.pink]);
    pc.disc(px - 3, by - 3, 1.5, P.white);
    pc.outline(P.black);
    // pivot cap
    pc.disc(px - 0.5, py, 3.5, P.black);
    pc.disc(px - 0.5, py, 2.5, P.steel);
    pc.px(px - 1, py - 1, P.white);
    return pc;
  });
}

function turretBase(): PixelCanvas {
  const pc = new PixelCanvas(52, 22);
  pc.ellipse(25.5, 21, 24, 18, P.slate);
  pc.rect(0, 20, 52, 2, CLEAR);
  pc.bevel(P.steel, P.navy);
  pc.ellipse(25.5, 21, 12, 9, P.navy);
  pc.ellipse(25.5, 21, 9, 6, P.black);
  for (let x = 4; x < 48; x++) if ((x >> 2) % 2 === 0) pc.px(x, 16, pc.get(x, 16) === CLEAR ? CLEAR : P.amber);
  pc.outline(P.black);
  return pc;
}

function barrel(glow: boolean): PixelCanvas {
  const pc = new PixelCanvas(12, 24);
  pc.rect(3, 2, 6, 20, P.slate);
  pc.rect(3, 2, 2, 20, P.steel);
  pc.rect(8, 2, 1, 20, P.navy);
  pc.rect(2, 0, 8, 4, glow ? P.orange : P.steel);
  pc.rect(2, 0, 8, 1, glow ? P.yellow : P.silver);
  pc.rect(4, 0, 4, 2, glow ? P.white : P.black);
  pc.rect(2, 10, 8, 2, P.navy);
  pc.outline(P.black);
  return pc;
}

function lamp(on: number, color: number): PixelCanvas {
  const pc = new PixelCanvas(8, 8);
  pc.disc(3.5, 3.5, 3, on ? color : P.navy);
  if (on) {
    pc.px(2, 2, P.white);
    pc.px(3, 2, P.white);
  } else pc.px(2, 2, P.slate);
  pc.outline(P.black);
  return pc;
}

// ------------------------------------------------------------------ bots

function botFrame(kind: 'drill' | 'bomb' | 'magnet', f: number): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  const body = kind === 'drill' ? [P.orange, P.amber, P.yellow] : kind === 'bomb' ? [P.ink, P.navy, P.slate] : [P.crimson, P.red, P.pink];
  pc.sphere(7.5, 8.5, 4.6, body);
  // eyes
  pc.rect(5, 8, 2, 2, P.white);
  pc.rect(9, 8, 2, 2, P.white);
  pc.px(6, 9, P.black);
  pc.px(10, 9, P.black);
  // head gear
  if (kind === 'drill') {
    cone(pc, 7.5, 0.5, 0, 1, 4, 2.2, f * 2);
  } else if (kind === 'bomb') {
    pc.rect(6, 2, 3, 2, P.slate);
    pc.px(8, 1, f === 2 ? P.white : P.yellow);
    pc.px(9, 0, P.orange);
    pc.px(4, 6, P.red);
  } else {
    pc.rect(5, 2, 1, 3, P.red);
    pc.rect(10, 2, 1, 3, P.red);
    pc.rect(5, 1, 6, 1, P.red);
    pc.px(5, 4, P.silver);
    pc.px(10, 4, P.silver);
  }
  // legs / jet
  if (f === 2) {
    pc.px(6, 14, P.yellow);
    pc.px(9, 14, P.yellow);
    pc.px(6, 15, P.orange);
    pc.px(9, 15, P.orange);
  } else {
    pc.rect(f === 0 ? 5 : 4, 13, 2, 2, P.slate);
    pc.rect(f === 0 ? 9 : 10, 13, 2, 2, P.slate);
  }
  pc.outline(P.black);
  return pc;
}

// ------------------------------------------------------------------ backgrounds

function background(li: number): PixelCanvas {
  const L = LAYERS[li];
  const pal = L.pal;
  const pc = new PixelCanvas(FIELD_W, FIELD_H);
  pc.rect(0, 0, FIELD_W, FIELD_H, pal.bg0);
  // strata bands
  for (let y = 0; y < FIELD_H; y++) {
    const band = Math.sin(y * 0.09 + li) * 0.5 + 0.5;
    for (let x = 0; x < FIELD_W; x++) {
      const wav = Math.sin(x * 0.03 + y * 0.02 + li * 2) * 6;
      const b = Math.sin((y + wav) * 0.11) * 0.5 + 0.5;
      if (b > 0.78 && (x + y) % 2 === 0) pc.px(x, y, pal.bg1);
      else if (b > 0.9) pc.px(x, y, pal.bg1);
      if (band > 0.97 && hash2(x, y, li) > 0.7) pc.px(x, y, pal.bg2);
    }
  }
  // distant rock pillars
  for (let i = 0; i < 7; i++) {
    const x0 = Math.floor(hash2(i, li, 1) * FIELD_W);
    const w = 10 + Math.floor(hash2(i, li, 2) * 18);
    for (let y = 0; y < FIELD_H; y++) {
      const wob = Math.round(Math.sin(y * 0.07 + i) * 3);
      for (let x = x0 + wob; x < x0 + wob + w; x++) if (hash2(x, y, i) > 0.35) pc.px(x, y, pal.bg1);
      pc.px(x0 + wob, y, pal.bg2);
    }
  }
  // scaffolding silhouettes with tiny lamps
  for (let i = 0; i < 3; i++) {
    const x0 = 40 + i * 170 + Math.floor(hash2(i, li, 5) * 40);
    const top = 40 + Math.floor(hash2(i, li, 6) * 60);
    for (let y = top; y < FIELD_H; y++) {
      pc.px(x0, y, pal.bg2);
      pc.px(x0 + 14, y, pal.bg2);
      if ((y - top) % 12 === 0) for (let x = x0; x <= x0 + 14; x++) pc.px(x, y, pal.bg2);
      if ((y - top) % 12 < 12) pc.px(x0 + ((y - top) % 12), y, pal.bg2);
    }
    pc.rect(x0 - 2, top - 2, 19, 2, pal.bg2);
  }
  return pc;
}

// ------------------------------------------------------------------ UI icons

function gearIcon(): PixelCanvas {
  const pc = gear(0, 5);
  pc.map((c) => (c === P.steel ? P.silver : c === P.slate ? P.steel : c));
  return pc;
}

function handIcon(): PixelCanvas {
  const rows = [
    '....kk.....',
    '...kwwk....',
    '...kwwk....',
    '...kwwkkk..',
    '...kwwkwwkk',
    '.kkkwwkwwkwk',
    'kwwkwwwwwwwk',
    'kwwwwwwwwwwk',
    '.kwwwwwwwwwk',
    '..kwwwwwwwk.',
    '...kwwwwwwk.',
    '....kkkkkk..',
  ];
  const pc = new PixelCanvas(12, 12);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === 'k') pc.px(x, y, P.black);
      if (ch === 'w') pc.px(x, y, x + y < 9 ? P.white : P.silver);
    }
  });
  return pc;
}

function arrowDown(): PixelCanvas {
  const pc = new PixelCanvas(11, 9);
  pc.poly(
    [
      [0.5, 0.5],
      [10.5, 0.5],
      [5.5, 8.5],
    ],
    P.yellow,
  );
  pc.map((c, x, y) => (y < 2 ? P.white : c));
  pc.outline(P.black);
  return pc;
}

function feverIcon(): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  pc.poly(
    [
      [9, 0.5],
      [3, 9],
      [7.5, 9],
      [6, 15.5],
      [13, 6],
      [8.5, 6],
    ],
    P.amber,
  );
  pc.map((c, x) => (x < 7 ? P.yellow : c));
  pc.outline(P.crimson);
  pc.px(8, 3, P.white);
  return pc;
}

function soundIcon(on: boolean): PixelCanvas {
  const pc = new PixelCanvas(12, 11);
  pc.rect(1, 3, 3, 5, P.silver);
  pc.poly(
    [
      [3, 3],
      [7, 0.5],
      [7, 10.5],
      [3, 8],
    ],
    P.silver,
  );
  if (on) {
    pc.line(9, 3, 9, 7, P.silver);
    pc.line(11, 1, 11, 9, P.steel);
  } else {
    pc.line(8, 3, 11, 7, P.red);
    pc.line(11, 3, 8, 7, P.red);
  }
  pc.outline(P.black);
  return pc;
}

// ------------------------------------------------------------------ entry

export function buildTextures(scene: Scene) {
  // 1x1 white pixel for particles & UI rects
  const px = new PixelCanvas(1, 1);
  px.px(0, 0, P.white);
  addCanvas(scene, 'px', px);

  for (const s of ['D', 'B', 'M'] as Sym[]) addCanvas(scene, 'sym_' + s, SYM_ART[s]());
  addCanvas(scene, 'symS_D', symDrill(16));
  addCanvas(scene, 'symS_B', symBomb(16));
  addCanvas(scene, 'symS_M', symMagnet(16));
  addStrip(scene, 'sym_B_anim', [symBomb(32, 0), symBomb(32, 1)]);

  buildTiles(scene);

  addStrip(scene, 'heart', [0, 1, 2, 3].flatMap((s) => [heartFrame(s, 0), heartFrame(s, 1)]));

  addStrip(scene, 'loot_ore', [oreGem(0), oreGem(1)]);
  addStrip(scene, 'loot_gold', [goldNugget(0), goldNugget(1)]);
  addCanvas(scene, 'loot_shard', shard());
  addCanvas(scene, 'loot_core', coreFrag());
  addCanvas(scene, 'loot_ore_icon', oreGem(0, 10));
  addCanvas(scene, 'loot_gold_icon', goldNugget(1));

  addStrip(scene, 'drill_N', [0, 1, 2, 3].map((p) => drillBit('N', p)));
  addStrip(scene, 'drill_NE', [0, 1, 2, 3].map((p) => drillBit('NE', p)));
  addStrip(scene, 'mdrill_N', [0, 1, 2, 3].map((p) => drillBit('N', p, true)));
  addStrip(scene, 'mdrill_NE', [0, 1, 2, 3].map((p) => drillBit('NE', p, true)));
  addStrip(scene, 'bomb', [bombProj(0), bombProj(1)]);
  addStrip(scene, 'bomblet', [bombProj(0, true), bombProj(1, true)]);
  addCanvas(scene, 'magnet_head', magnetHead());

  for (const r of EXPL_SIZES.fire) addStrip(scene, `ex_fire_${r}`, explosionFrames(r, FX_FIRE));
  for (const r of EXPL_SIZES.gas) addStrip(scene, `ex_gas_${r}`, explosionFrames(r, FX_GAS));
  for (const r of EXPL_SIZES.red) addStrip(scene, `ex_red_${r}`, explosionFrames(r, FX_RED));
  for (const r of EXPL_SIZES.core) addStrip(scene, `ex_core_${r}`, explosionFrames(r, FX_CORE));
  addStrip(scene, 'smoke', smokeFrames([P.silver, P.steel, P.slate]));
  addStrip(scene, 'dust', smokeFrames([P.tan, P.brown, P.darkBrown]));
  addStrip(scene, 'steam', smokeFrames([P.white, P.silver, P.steel]));
  addStrip(scene, 'gaspuff', smokeFrames([P.yellow, P.amber, P.green]));
  addStrip(scene, 'spark', sparkFrames());

  LAYERS.forEach((L, li) => {
    for (let v = 0; v < 3; v++) addCanvas(scene, `deb_${li}_${v}`, debris(L.pal, v));
    addCanvas(scene, `bg_${li}`, background(li));
  });
  addCanvas(scene, 'deb_gold_0', coloredChunk([P.orange, P.amber, P.yellow], P.darkBrown, 0));
  addCanvas(scene, 'deb_gold_1', coloredChunk([P.orange, P.amber, P.yellow], P.darkBrown, 1));
  addCanvas(scene, 'deb_crys_0', coloredChunk([P.magenta, P.pink, P.white], P.purple, 0));
  addCanvas(scene, 'deb_crys_1', coloredChunk([P.magenta, P.pink, P.white], P.purple, 1));
  addCanvas(scene, 'deb_red_0', coloredChunk([P.crimson, P.red, P.orange], P.plum, 0));
  addCanvas(scene, 'deb_red_1', coloredChunk([P.crimson, P.red, P.orange], P.plum, 1));
  addCanvas(scene, 'deb_core_0', coloredChunk([P.purple, P.magenta, P.pink], P.black, 0));
  addCanvas(scene, 'deb_core_1', coloredChunk([P.crimson, P.orange, P.yellow], P.plum, 1));

  addCanvas(scene, 'machine', machineBody());
  addCanvas(scene, 'tread', treadPattern());
  addStrip(scene, 'wheel', [0, 1, 2, 3].map((f) => wheel(f)));
  addStrip(scene, 'gear', [0, 1, 2, 3].map((f) => gear(f)));
  addStrip(scene, 'lever', leverFrames());
  addCanvas(scene, 'turret', turretBase());
  addStrip(scene, 'barrel', [barrel(false), barrel(true)]);
  const lampCols = [P.red, P.amber, P.yellow, P.green, P.cyan, P.pink];
  addStrip(scene, 'lamp', [lamp(0, 0), ...lampCols.map((c) => lamp(1, c))]);

  for (const k of ['drill', 'bomb', 'magnet'] as const) {
    const frames = [0, 1, 2].map((f) => botFrame(k, f));
    addStrip(scene, `bot_${k}`, frames);
    addCanvas(scene, `bot_${k}_0`, frames[0]);
  }

  addCanvas(scene, 'ico_gear', gearIcon());
  addCanvas(scene, 'ico_hand', handIcon());
  addCanvas(scene, 'ico_arrow', arrowDown());
  addCanvas(scene, 'fever_icon', feverIcon());
  addCanvas(scene, 'ico_sound_on', soundIcon(true));
  addCanvas(scene, 'ico_sound_off', soundIcon(false));
}

/** Pick the pre-rendered explosion size closest to a desired radius (px). */
export function explosionKey(kind: 'fire' | 'gas' | 'red' | 'core', radiusPx: number): { key: string; r: number } {
  const sizes = EXPL_SIZES[kind];
  let best = sizes[0];
  for (const s of sizes) if (Math.abs(s - radiusPx) < Math.abs(best - radiusPx)) best = s;
  return { key: `ex_${kind}_${best}`, r: best };
}
