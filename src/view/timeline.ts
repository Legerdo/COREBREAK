// World-time scheduler. World time freezes during hit-stop and modal pauses,
// so every scheduled sim event stays in sync with the visuals.
interface Item {
  t: number;
  s: number;
  fn: () => void;
  major: boolean;
}

export class Timeline {
  private items: Item[] = [];
  private seq = 0;
  now = 0;

  add(at: number, fn: () => void, major = true) {
    const it = { t: at, s: this.seq++, fn, major };
    // insert sorted (items are mostly appended in order)
    let i = this.items.length;
    while (i > 0 && (this.items[i - 1].t > at || (this.items[i - 1].t === at && this.items[i - 1].s > it.s))) i--;
    this.items.splice(i, 0, it);
  }
  after(ms: number, fn: () => void, major = false) {
    this.add(this.now + ms, fn, major);
  }
  update(now: number) {
    this.now = now;
    let guard = 0;
    while (this.items.length && this.items[0].t <= now && guard++ < 4000) {
      const it = this.items.shift()!;
      it.fn();
    }
  }
  /** True while grid-affecting events are still pending. */
  busy(): boolean {
    return this.items.some((i) => i.major);
  }
  clear() {
    this.items = [];
  }
}
