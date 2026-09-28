import Phaser from 'phaser';
import { FONT, FONT_SMALL } from '../config';
import { P, hex } from '../data/palette';

export interface TxtOpts {
  size?: number;
  color?: number;
  font?: string;
  bold?: boolean;
  shadow?: number | null;
  stroke?: number | null;
  align?: 'left' | 'center' | 'right';
  wrap?: number;
  lineSpacing?: number;
}

/** Pixel-font text. Positions are rounded so glyphs stay on the pixel grid. */
export function txt(scene: Phaser.Scene, x: number, y: number, s: string, o: TxtOpts = {}): Phaser.GameObjects.Text {
  const size = o.size ?? 12;
  const font = o.font ?? (size <= 10 ? FONT_SMALL : FONT);
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: font,
    fontSize: `${size}px`,
    fontStyle: o.bold ? 'bold' : 'normal',
    color: hex(o.color ?? P.white),
    align: o.align ?? 'left',
    lineSpacing: o.lineSpacing ?? 2,
  };
  if (o.wrap) style.wordWrap = { width: o.wrap, useAdvancedWrap: true };
  if (o.stroke !== undefined && o.stroke !== null) {
    style.stroke = hex(o.stroke);
    style.strokeThickness = size >= 20 ? 4 : 2;
  }
  const t = scene.add.text(Math.round(x), Math.round(y), s, style);
  if (o.shadow !== null) t.setShadow(1, 1, hex(o.shadow ?? P.black), 0, o.stroke !== undefined && o.stroke !== null, true);
  t.setResolution(1);
  return t;
}

export function fmt(n: number): string {
  n = Math.floor(n);
  if (n < 10000) return n.toLocaleString('en-US');
  const units = ['K', 'M', 'B', 'T', 'Q'];
  let u = -1;
  let v = n;
  while (v >= 1000 && u < units.length - 1) {
    v /= 1000;
    u++;
  }
  return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + units[u];
}

export function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
}

/** Draw a bevelled pixel panel into a Graphics object. */
export function panel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill: number, light: number, dark: number, outline: number = P.black) {
  x = Math.round(x);
  y = Math.round(y);
  g.fillStyle(outline, 1).fillRect(x, y, w, h);
  g.fillStyle(fill, 1).fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle(light, 1).fillRect(x + 1, y + 1, w - 2, 1).fillRect(x + 1, y + 1, 1, h - 2);
  g.fillStyle(dark, 1).fillRect(x + 1, y + h - 2, w - 2, 1).fillRect(x + w - 2, y + 1, 1, h - 2);
}

/** Pixel circle outline with integer radius (midpoint algorithm) for crisp rings. */
export function pixelRing(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, color: number, alpha = 1, thick = 1) {
  cx = Math.round(cx);
  cy = Math.round(cy);
  g.fillStyle(color, alpha);
  for (let k = 0; k < thick; k++) {
    const rr = Math.round(r) - k;
    if (rr <= 0) break;
    let x = rr;
    let y = 0;
    let err = 1 - rr;
    while (x >= y) {
      const pts = [
        [x, y],
        [y, x],
        [-y, x],
        [-x, y],
        [-x, -y],
        [-y, -x],
        [y, -x],
        [x, -y],
      ];
      for (const [px, py] of pts) g.fillRect(cx + px, cy + py, 1, 1);
      y++;
      if (err < 0) err += 2 * y + 1;
      else {
        x--;
        err += 2 * (y - x) + 1;
      }
    }
  }
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeInQuad = (t: number) => t * t;
export const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
export const easeInCubic = (t: number) => t * t * t;
