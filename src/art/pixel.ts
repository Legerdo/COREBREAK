// Tiny pixel-art raster helper. Everything is drawn on an integer grid with
// hard edges, then uploaded to Phaser as a canvas texture.
export const CLEAR = -1;

export class PixelCanvas {
  readonly w: number;
  readonly h: number;
  readonly d: Int32Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.d = new Int32Array(w * h).fill(CLEAR);
  }

  in(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  px(x: number, y: number, c: number) {
    x = Math.round(x);
    y = Math.round(y);
    if (this.in(x, y)) this.d[y * this.w + x] = c;
  }
  get(x: number, y: number): number {
    if (!this.in(x, y)) return CLEAR;
    return this.d[y * this.w + x];
  }
  rect(x: number, y: number, w: number, h: number, c: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  frame(x: number, y: number, w: number, h: number, c: number) {
    for (let i = 0; i < w; i++) {
      this.px(x + i, y, c);
      this.px(x + i, y + h - 1, c);
    }
    for (let j = 0; j < h; j++) {
      this.px(x, y + j, c);
      this.px(x + w - 1, y + j, c);
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  thick(x0: number, y0: number, x1: number, y1: number, r: number, c: number) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) this.disc(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, r, c);
  }
  /** Filled disc. Radius measured to pixel centers (cx, cy may be .5). */
  disc(cx: number, cy: number, r: number, c: number) {
    const r2 = r * r + r * 0.25;
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) this.px(x, y, c);
      }
  }
  ring(cx: number, cy: number, r: number, t: number, c: number) {
    const ro = r * r + r * 0.25;
    const ri = (r - t) * (r - t) + (r - t) * 0.25;
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if (d <= ro && d > ri) this.px(x, y, c);
      }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const dx = (x - cx) / (rx + 0.3);
        const dy = (y - cy) / (ry + 0.3);
        if (dx * dx + dy * dy <= 1) this.px(x, y, c);
      }
  }
  /** Scanline polygon fill (even-odd). */
  poly(pts: [number, number][], c: number) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of pts) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const yc = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.px(x, y, c);
      }
    }
  }
  /** Cel-shaded sphere: colors ordered dark -> light. */
  sphere(cx: number, cy: number, r: number, cols: number[], lx = -0.55, ly = -0.65) {
    const r2 = r * r + r * 0.25;
    const ln = Math.hypot(lx, ly, 0.6);
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const nz = Math.sqrt(Math.max(0, 1 - d2 / (r * r + 0.01)));
        const dot = (dx / r) * (lx / ln) + (dy / r) * (ly / ln) + nz * (0.6 / ln);
        const k = Math.max(0, Math.min(cols.length - 1, Math.floor(((dot + 0.2) / 1.2) * cols.length)));
        this.px(x, y, cols[k]);
      }
  }
  /** Add a 1px outline around all opaque pixels. */
  outline(c: number, diagonal = false) {
    const src = this.d.slice();
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? CLEAR : src[y * this.w + x]);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x] !== CLEAR) continue;
        let n = at(x + 1, y) !== CLEAR || at(x - 1, y) !== CLEAR || at(x, y + 1) !== CLEAR || at(x, y - 1) !== CLEAR;
        if (!n && diagonal) n = at(x + 1, y + 1) !== CLEAR || at(x - 1, y - 1) !== CLEAR || at(x + 1, y - 1) !== CLEAR || at(x - 1, y + 1) !== CLEAR;
        if (n) this.d[y * this.w + x] = c;
      }
  }
  /** Darken the bottom/right inner edge and lighten the top/left edge of the opaque shape. */
  bevel(light: number, dark: number, only?: number) {
    const src = this.d.slice();
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? CLEAR : src[y * this.w + x]);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const v = src[y * this.w + x];
        if (v === CLEAR || (only !== undefined && v !== only)) continue;
        if (at(x, y - 1) === CLEAR || at(x - 1, y) === CLEAR) this.d[y * this.w + x] = light;
        else if (at(x, y + 1) === CLEAR || at(x + 1, y) === CLEAR) this.d[y * this.w + x] = dark;
      }
  }
  replace(from: number, to: number) {
    for (let i = 0; i < this.d.length; i++) if (this.d[i] === from) this.d[i] = to;
  }
  /** Checkerboard dither of color c over existing opaque pixels inside a rect. */
  dither(x: number, y: number, w: number, h: number, c: number, parity = 0, onlyOpaque = true) {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        if ((x + i + y + j + parity) % 2) continue;
        if (onlyOpaque && this.get(x + i, y + j) === CLEAR) continue;
        this.px(x + i, y + j, c);
      }
  }
  blit(src: PixelCanvas, dx: number, dy: number, flipX = false, flipY = false) {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const sx = flipX ? src.w - 1 - x : x;
        const sy = flipY ? src.h - 1 - y : y;
        const v = src.d[sy * src.w + sx];
        if (v !== CLEAR) this.px(dx + x, dy + y, v);
      }
  }
  /** Rotate 90 degrees clockwise. */
  rot90(): PixelCanvas {
    const o = new PixelCanvas(this.h, this.w);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) o.d[x * o.w + (this.h - 1 - y)] = this.d[y * this.w + x];
    return o;
  }
  clone(): PixelCanvas {
    const o = new PixelCanvas(this.w, this.h);
    o.d.set(this.d);
    return o;
  }
  /** Map every opaque pixel through fn */
  map(fn: (c: number, x: number, y: number) => number) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const v = this.d[y * this.w + x];
        if (v !== CLEAR) this.d[y * this.w + x] = fn(v, x, y);
      }
  }
  toCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    this.paint(cv, 0, 0);
    return cv;
  }
  paint(cv: HTMLCanvasElement, ox: number, oy: number) {
    const ctx = cv.getContext('2d')!;
    const img = new ImageData(this.w, this.h);
    for (let i = 0; i < this.d.length; i++) {
      const v = this.d[i];
      const o = i * 4;
      if (v === CLEAR) {
        img.data[o + 3] = 0;
        continue;
      }
      img.data[o] = (v >> 16) & 255;
      img.data[o + 1] = (v >> 8) & 255;
      img.data[o + 2] = v & 255;
      img.data[o + 3] = 255;
    }
    ctx.putImageData(img, ox, oy);
  }
}

/** Simple deterministic hash noise for stable art variation. */
export function hash2(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Packs many PixelCanvas frames into one atlas canvas. */
export class Atlas {
  frames: { name: string; x: number; y: number; w: number; h: number; pc: PixelCanvas }[] = [];
  private x = 0;
  private y = 0;
  private rowH = 0;
  constructor(public width = 1024) {}
  add(name: string, pc: PixelCanvas) {
    if (this.x + pc.w + 1 > this.width) {
      this.x = 0;
      this.y += this.rowH + 1;
      this.rowH = 0;
    }
    this.frames.push({ name, x: this.x, y: this.y, w: pc.w, h: pc.h, pc });
    this.x += pc.w + 1;
    this.rowH = Math.max(this.rowH, pc.h);
  }
  build(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.width;
    cv.height = this.y + this.rowH + 1;
    for (const f of this.frames) f.pc.paint(cv, f.x, f.y);
    return cv;
  }
}
