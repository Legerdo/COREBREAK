import Phaser from 'phaser';
import { FIELD_W, FIELD_X, FIELD_Y, H, W } from '../config';
import { LAYERS, MEGA_NAME, SYM_NAME, type Sym, type TileType } from '../data/balance';
import { P, hex } from '../data/palette';
import { UPGRADE_BY_ID, type BotKind, type UpCat } from '../data/upgrades';
import { MACH } from '../art/sprites';
import { audio } from '../audio/audio';
import type { Offer } from '../sim/game';
import { Preview } from '../view/preview';
import { fmt, fmtTime, panel, txt } from '../view/ui';
import type { GameScene } from './GameScene';

const CAT_COLOR: Record<UpCat, number> = { drill: P.amber, bomb: P.red, magnet: P.sky, reel: P.green, eco: P.cyan, fever: P.hotpink, bot: P.green };
const CAT_LABEL: Record<UpCat, string> = { drill: 'DRILL', bomb: 'BOMB', magnet: 'MAGNET', reel: 'REEL', eco: 'ORE', fever: 'FEVER', bot: 'BOT' };
const BOT_NAME: Record<BotKind, string> = { drill: '드릴 봇', bomb: '폭탄 봇', magnet: '자석 봇' };

interface Banner {
  title: string;
  sub: string;
  color: number;
  ms: number;
  big?: boolean;
}

export class OverlayScene extends Phaser.Scene {
  gs!: GameScene;
  modal: null | 'cards' | 'settings' | 'results' | 'confirm' = null;
  private top!: Phaser.GameObjects.Graphics;
  private depthText!: Phaser.GameObjects.Text;
  private layerText!: Phaser.GameObjects.Text;
  private chainLabel!: Phaser.GameObjects.Text;
  private chainBig!: Phaser.GameObjects.Text;
  private chainN = 0;
  private chainIdle = 99999;
  private chainBounce = 0;
  private bannerQ: Banner[] = [];
  private bannerObj: Phaser.GameObjects.Container | null = null;
  private bannerT = 0;
  private bannerCur: Banner | null = null;
  private megaObj: Phaser.GameObjects.Container | null = null;
  private megaT = 0;
  private hand!: Phaser.GameObjects.Image;
  private bubble!: Phaser.GameObjects.Container;
  private bubbleText!: Phaser.GameObjects.Text;
  private bubbleG!: Phaser.GameObjects.Graphics;
  private nudge = 0;
  private t = 0;
  private tips: { c: Phaser.GameObjects.Container; life: number }[] = [];
  private modalRoot: Phaser.GameObjects.Container | null = null;
  private previews: Preview[] = [];
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private feverHintShown = false;

  constructor() {
    super('Overlay');
  }

  create() {
    this.gs = this.scene.get('Game') as GameScene;
    // top bar
    this.top = this.add.graphics();
    this.top.fillStyle(P.black, 1).fillRect(0, 0, W, FIELD_Y);
    this.top.fillStyle(P.ink, 1).fillRect(0, FIELD_Y - 2, W, 1);
    this.top.fillStyle(P.navy, 1).fillRect(0, FIELD_Y - 1, W, 1);
    this.top.setDepth(-1);
    txt(this, 8, 6, 'DEPTH', { size: 8, font: 'Galmuri7', color: P.steel });
    this.depthText = txt(this, 36, 5, '0m', { size: 12, color: P.white });
    this.layerText = txt(this, W / 2, 5, '', { size: 12, bold: true, color: P.orange, align: 'center' });
    this.layerText.setOrigin(0.5, 0);
    const gear = this.add.image(626, 12, 'ico_gear').setInteractive({ useHandCursor: true });
    gear.on('pointerdown', () => {
      this.gs.ensureAudio();
      audio.uiClick();
      if (!this.modal) this.showSettings();
    });
    // chain counter
    this.chainLabel = txt(this, FIELD_X + FIELD_W - 4, FIELD_Y + 4, 'CHAIN', { size: 8, font: 'Galmuri7', color: P.white });
    this.chainLabel.setOrigin(1, 0).setVisible(false);
    this.chainBig = txt(this, FIELD_X + FIELD_W - 4, FIELD_Y + 12, '', { size: 24, bold: true, color: P.white, stroke: P.black, shadow: null });
    this.chainBig.setOrigin(1, 0).setVisible(false);
    // tutorial pointer
    this.hand = this.add.image(0, 0, 'ico_hand').setOrigin(0.2, 0).setVisible(false).setDepth(50);
    this.bubbleG = this.add.graphics();
    this.bubbleText = txt(this, 0, 0, '', { size: 12, bold: true, color: P.black, shadow: null, align: 'center' });
    this.bubbleText.setOrigin(0.5, 0);
    this.bubble = this.add.container(0, 0, [this.bubbleG, this.bubbleText]).setVisible(false).setDepth(49);
  }

  // ------------------------------------------------------------ public API

  banner(title: string, sub: string, color: number, ms: number) {
    if (this.bannerQ.length > 3) this.bannerQ.shift();
    this.bannerQ.push({ title, sub, color, ms });
  }

  layerBanner(i: number) {
    const L = LAYERS[i];
    this.bannerQ.unshift({ title: `LAYER ${i + 1} · ${L.name}`, sub: L.toy, color: L.pal.accent, ms: 2200, big: true });
  }

  feverReady() {
    this.banner('FEVER READY', '버튼을 눌러!', P.yellow, 1100);
  }

  clearBanners() {
    this.bannerQ = [];
    this.bannerObj?.destroy();
    this.bannerObj = null;
    this.bannerCur = null;
    this.megaObj?.destroy();
    this.megaObj = null;
    for (const tp of this.tips) tp.c.destroy();
    this.tips = [];
  }

  nudgeHint() {
    this.nudge = 400;
  }

  chain(n: number) {
    this.chainN = n;
    this.chainIdle = 0;
    this.chainBounce = 110;
    if (n < 2) return;
    this.chainLabel.setVisible(true).setAlpha(1);
    this.chainBig.setVisible(true).setAlpha(1).setText('×' + n);
    const col = n >= 30 ? [P.hotpink, P.yellow, P.cyan, P.green][Math.floor(this.t / 70) % 4] : n >= 20 ? P.hotpink : n >= 10 ? P.orange : n >= 5 ? P.yellow : P.white;
    this.chainBig.setColor(hex(col));
    this.chainBig.setStroke(hex(n >= 10 ? P.crimson : P.black), 4);
  }

  mega(sym: Sym) {
    this.megaObj?.destroy();
    // shown on the machine itself: the MEGA is the machine hitting its limit
    const fever = this.gs.sim.feverActive;
    const c = this.add.container(W / 2, 230).setDepth(40);
    if (fever) {
      const t = txt(this, 0, -8, 'MEGA!', { size: 12, bold: true, color: P.yellow, stroke: P.crimson, shadow: null });
      t.setOrigin(0.5, 0);
      c.add(t);
    } else {
      const g = this.add.graphics();
      g.fillStyle(P.black, 0.8).fillRect(-150, -15, 300, 30);
      g.fillStyle(P.yellow, 1).fillRect(-150, -15, 300, 2).fillRect(-150, 13, 300, 2);
      const t = txt(this, 0, -13, MEGA_NAME[sym] + '!', { size: 24, bold: true, color: P.yellow, stroke: P.crimson, shadow: null });
      t.setOrigin(0.5, 0);
      const i1 = this.add.image(-130, 0, 'symS_' + sym);
      const i2 = this.add.image(130, 0, 'symS_' + sym).setFlipX(true);
      c.add([g, t, i1, i2]);
    }
    this.megaObj = c;
    this.megaT = fever ? 400 : 0;
  }

  get tipActive(): boolean {
    return this.tips.length > 0;
  }

  tip(x: number, y: number, text: string, tt: TileType) {
    const c = this.add.container(0, 0).setDepth(30);
    const g = this.add.graphics();
    const label = txt(this, 0, 0, text, { size: 12, bold: true, color: P.white });
    const w = Math.ceil(label.width) + 30;
    const above = y > FIELD_Y + 50;
    const bx = Math.round(Math.max(FIELD_X + 2, Math.min(FIELD_X + FIELD_W - w - 2, x - w / 2)));
    const by = Math.round(above ? y - 42 : y + 14);
    panel(g, bx, by, w, 22, P.ink, P.slate, P.black);
    g.fillStyle(P.yellow, 1);
    if (above) g.fillTriangle(x - 4, by + 22, x + 4, by + 22, x, by + 28);
    else g.fillTriangle(x - 4, by, x + 4, by, x, by - 6);
    const icon = this.add.image(bx + 12, by + 11, `tile_${tt}_icon`);
    label.setPosition(bx + 24, by + 5);
    c.add([g, icon, label]);
    this.tips.push({ c, life: 3800 });
    audio.uiHover();
  }

  // ------------------------------------------------------------ update

  update(_t: number, delta: number) {
    const dt = Math.min(50, delta);
    this.t += dt;
    const gs = this.gs;
    if (!gs || !gs.sim) return;
    const sim = gs.sim;
    this.depthText.setText(`${fmt(sim.depthMeters)}m`);
    const L = LAYERS[sim.layer];
    this.layerText.setText(sim.core.locked && !sim.endless ? 'HEART CORE' : L.name).setColor(hex(sim.core.locked ? P.pink : L.pal.accent));

    // chain counter
    this.chainIdle += dt;
    if (this.chainBounce > 0) this.chainBounce -= dt;
    const by = this.chainBounce > 60 ? -3 : this.chainBounce > 0 ? -1 : 0;
    this.chainBig.y = FIELD_Y + 12 + by;
    if (this.chainN >= 30) this.chainBig.setColor(hex([P.hotpink, P.yellow, P.cyan, P.green][Math.floor(this.t / 70) % 4]));
    if (this.chainIdle > 900) {
      const a = Math.max(0, 1 - (this.chainIdle - 900) / 300);
      this.chainBig.setAlpha(a);
      this.chainLabel.setAlpha(a);
      if (a <= 0) {
        this.chainBig.setVisible(false);
        this.chainLabel.setVisible(false);
      }
    }

    // banners (held back while a modal is open)
    if (this.modal) this.bannerObj?.setVisible(false);
    else if (!this.bannerObj && this.bannerQ.length) this.showBanner(this.bannerQ.shift()!);
    if (this.bannerObj && this.bannerCur && !this.modal) {
      this.bannerObj.setVisible(true);
      this.bannerT += dt;
      const b = this.bannerCur;
      const inT = 120;
      const x = this.bannerT < inT ? Math.round(-40 * (1 - this.bannerT / inT)) : 0;
      this.bannerObj.x = W / 2 + x;
      const a = this.bannerT > b.ms ? Math.max(0, 1 - (this.bannerT - b.ms) / 220) : Math.min(1, this.bannerT / inT);
      this.bannerObj.setAlpha(a);
      if (this.bannerT > b.ms + 220) {
        this.bannerObj.destroy();
        this.bannerObj = null;
        this.bannerCur = null;
      }
    }
    // mega banner
    if (this.megaObj) {
      this.megaT += dt;
      this.megaObj.setScale(this.megaT < 70 ? 2 : 1);
      this.megaObj.setVisible(!this.modal);
      this.megaObj.x = W / 2 + (this.megaT < 300 ? (Math.floor(this.megaT / 30) % 2 ? 2 : -2) : 0);
      if (this.megaT > 900) this.megaObj.setAlpha(Math.max(0, 1 - (this.megaT - 900) / 200));
      if (this.megaT > 1100) {
        this.megaObj.destroy();
        this.megaObj = null;
      }
    }
    // tips
    for (let i = this.tips.length - 1; i >= 0; i--) {
      const tp = this.tips[i];
      tp.life -= dt;
      tp.c.setAlpha(Math.min(1, tp.life / 300));
      if (tp.life <= 0) {
        tp.c.destroy();
        this.tips.splice(i, 1);
      }
    }
    for (const p of this.previews) p.update(dt);
    this.updateHints(dt);
  }

  private showBanner(b: Banner) {
    const c = this.add.container(W / 2, b.sub ? 50 : 44).setDepth(35);
    const g = this.add.graphics();
    const h = b.sub ? 44 : 30;
    g.fillStyle(P.black, 0.78).fillRect(-W / 2, -h / 2, W, h);
    g.fillStyle(b.color, 1).fillRect(-W / 2, -h / 2, W, 2).fillRect(-W / 2, h / 2 - 2, W, 2);
    for (let x = -W / 2; x < W / 2; x += 2) {
      g.fillStyle(P.black, 0.5).fillRect(x, -h / 2 - 2, 1, 1).fillRect(x + 1, h / 2 + 1, 1, 1);
    }
    const title = txt(this, 0, b.sub ? -18 : -12, b.title, { size: 24, bold: true, color: b.color, stroke: P.black, shadow: null });
    title.setOrigin(0.5, 0);
    c.add([g, title]);
    if (b.sub) {
      const sub = txt(this, 0, 8, b.sub, { size: 12, color: P.white });
      sub.setOrigin(0.5, 0);
      c.add(sub);
    }
    this.bannerObj = c;
    this.bannerCur = b;
    this.bannerT = 0;
  }

  private showBubble(x: number, y: number, text: string, color: number = P.yellow) {
    this.bubbleText.setText(text);
    const w = Math.ceil(this.bubbleText.width) + 12;
    const g = this.bubbleG;
    g.clear();
    panel(g, -w / 2, 0, w, 18, color, P.white, P.orange);
    this.bubbleText.setPosition(0, 3);
    this.bubble.setPosition(Math.round(x), Math.round(y)).setVisible(true);
  }

  private updateHints(dt: number) {
    const gs = this.gs;
    const sim = gs.sim;
    this.hand.setVisible(false);
    this.bubble.setVisible(false);
    if (this.modal || gs.finale) return;
    if (this.nudge > 0) this.nudge -= dt;
    const bob = Math.round(Math.abs(Math.sin(this.t / 180)) * 4) + (this.nudge > 0 ? Math.round(Math.sin(this.t / 30) * 3) : 0);
    const hint = gs.hintCell();
    if (sim.tutorial < 2 && gs.state === 'idle') {
      if (hint) {
        const x = FIELD_X + hint.c * 16 + 8;
        const y = FIELD_Y + hint.r * 16 + 10;
        this.hand.setPosition(x, y + bob).setVisible(true);
        if (sim.tutorial === 0) this.showBubble(x, y - 30, '눌러서 골라!');
      } else if (sim.target) {
        const lp = MACH.leverPivot;
        this.showBubble(lp.x, lp.y - 72 - bob, '레버를 당겨!  [SPACE]');
        this.hand.setPosition(lp.x + 6, lp.y - 48 + bob).setVisible(true);
      }
      return;
    }
    if (gs.state !== 'idle') return;
    if (sim.tutorial >= 2 && sim.bought === 0 && sim.canBuy()) {
      const ub = MACH.upBtn;
      this.hand.setPosition(ub.x + ub.w - 20, ub.y + 12 + bob).setVisible(true);
      this.showBubble(ub.x + ub.w / 2, ub.y + ub.h + 6 + bob, '업그레이드!');
      return;
    }
    if (sim.feverReady() && sim.stats.fevers === 0) {
      this.feverHintShown = true;
      const fb = MACH.feverBtn;
      this.hand.setPosition(fb.x + 8, fb.y + 6 + bob).setVisible(true);
      this.showBubble(fb.x, fb.y - 50 - bob, '눌러!');
    }
  }

  // ------------------------------------------------------------ modals

  private openModal(kind: 'cards' | 'settings' | 'results' | 'confirm') {
    this.closeModal();
    this.modal = kind;
    this.gs.paused = true;
    const root = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(W / 2, H / 2, W, H, P.black, 0.72).setInteractive();
    root.add(dim);
    this.modalRoot = root;
    return root;
  }

  closeModal() {
    this.modalRoot?.destroy();
    this.modalRoot = null;
    this.previews = [];
    this.modal = null;
    if (this.gs) this.gs.paused = false;
    if (this.keyHandler) {
      this.input.keyboard?.off('keydown', this.keyHandler);
      this.keyHandler = null;
    }
  }

  showCards(offers: Offer[], free: boolean, reward: { layer: number; bot: BotKind | null } | null, onPick: (i: number) => unknown) {
    const root = this.openModal('cards');
    const sim = this.gs.sim;
    const title = reward ? `LAYER ${reward.layer + 1} 돌파 보상!` : free ? '보상!' : 'UPGRADE';
    const tt = txt(this, W / 2, 14, title, { size: 24, bold: true, color: reward ? P.yellow : P.amber, stroke: P.black, shadow: null });
    tt.setOrigin(0.5, 0);
    root.add(tt);
    let subY = 44;
    if (reward?.bot) {
      const bi = this.add.image(W / 2 - 58, 52, `bot_${reward.bot}_0`);
      const bt = txt(this, W / 2 - 46, 45, `${BOT_NAME[reward.bot]}이 합류했어요!`, { size: 12, bold: true, color: P.green });
      root.add([bi, bt]);
      subY = 60;
    }
    const sub = txt(this, W / 2, subY, '하나를 골라요', { size: 12, color: P.silver });
    sub.setOrigin(0.5, 0);
    root.add(sub);
    const cw = 180;
    const ch = 214;
    const gap = 14;
    const x0 = Math.round((W - (cw * offers.length + gap * (offers.length - 1))) / 2);
    const y0 = reward?.bot ? 80 : 70;
    let picked = false;
    const cards: Phaser.GameObjects.Container[] = [];
    const pick = (i: number) => {
      if (picked || i >= offers.length) return;
      picked = true;
      audio.uiClick();
      cards.forEach((c, k) => {
        if (k === i) this.tweens.add({ targets: c, y: c.y - 8, duration: 120, yoyo: true });
        else this.tweens.add({ targets: c, y: c.y + 30, alpha: 0, duration: 200 });
      });
      this.time.delayedCall(360, () => {
        this.closeModal();
        const u = onPick(i) as { name?: string; swapTo?: Sym } | null;
        if (u && 'name' in u && u.name) this.banner(u.name, '', P.amber, 900);
      });
    };
    offers.forEach((o, i) => {
      const c = this.makeCard(x0 + i * (cw + gap), y0, cw, ch, o, i, sim.reel, () => pick(i));
      c.setAlpha(0);
      c.y += 24;
      this.tweens.add({ targets: c, alpha: 1, y: c.y - 24, duration: 180, delay: 60 + i * 90, ease: 'Quad.easeOut', onStart: () => audio.cardShow(i) });
      root.add(c);
      cards.push(c);
    });
    this.keyHandler = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= offers.length) pick(n - 1);
    };
    this.input.keyboard?.on('keydown', this.keyHandler);
  }

  private makeCard(x: number, y: number, w: number, h: number, o: Offer, idx: number, reel: Sym[], onPick: () => void) {
    const u = UPGRADE_BY_ID[o.id];
    const sim = this.gs.sim;
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const col = CAT_COLOR[u.cat];
    const draw = (hover: boolean) => {
      g.clear();
      panel(g, 0, 0, w, h, P.ink, P.slate, P.black);
      g.fillStyle(col, 1).fillRect(1, 1, w - 2, 16);
      g.fillStyle(P.white, 0.35).fillRect(1, 1, w - 2, 1);
      if (hover) g.lineStyle(2, P.yellow, 1).strokeRect(-1, -1, w + 2, h + 2);
    };
    draw(false);
    c.add(g);
    c.add(txt(this, 6, 4, CAT_LABEL[u.cat], { size: 8, font: 'Galmuri7', color: P.black, shadow: null }));
    const stack = sim.stacks[u.id] ?? 0;
    if (u.max > 1)
      for (let k = 0; k < u.max; k++) {
        const pip = this.add.rectangle(w - 8 - (u.max - 1 - k) * 7, 8, 4, 4, k < stack ? P.black : k === stack ? P.white : P.black, k < stack ? 0.8 : k === stack ? 1 : 0.25);
        c.add(pip);
      }
    const iconKey = u.icon;
    const icon = this.add.image(24, 40, iconKey);
    if (icon.width <= 16) icon.setScale(2);
    c.add(icon);
    const name = txt(this, 46, 26, u.name, { size: 12, bold: true, color: P.white, wrap: w - 52 });
    c.add(name);
    const pv = this.add.container(0, 0);
    c.add(pv);
    const prev = new Preview(this, pv, 10, 62, w - 20, 64, u.preview, { reel, from: o.swapFrom, to: u.swapTo });
    this.previews.push(prev);
    let desc = u.desc;
    if (u.swapTo && o.swapFrom !== undefined && o.swapFrom >= 0) desc = `${SYM_NAME[reel[o.swapFrom]]} 하나가 ${SYM_NAME[u.swapTo]}${u.swapTo === 'D' ? '로' : '으로'} 바뀌어요.`;
    c.add(txt(this, 10, 134, desc, { size: 12, color: P.silver, wrap: w - 20, lineSpacing: 3 }));
    if (u.swapTo && o.swapFrom !== undefined && o.swapFrom >= 0) {
      const from = reel[o.swapFrom];
      c.add(this.add.image(w / 2 - 22, 186, 'symS_' + from));
      c.add(txt(this, w / 2, 180, '→', { size: 12, bold: true, color: P.yellow }).setOrigin(0.5, 0));
      c.add(this.add.image(w / 2 + 22, 186, 'symS_' + u.swapTo));
    }
    c.add(txt(this, w / 2, h - 14, `[${idx + 1}]`, { size: 8, font: 'Galmuri7', color: P.steel }).setOrigin(0.5, 0));
    const zone = this.add.zone(w / 2, h / 2, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      draw(true);
      c.y -= 2;
      audio.uiHover();
    });
    zone.on('pointerout', () => {
      draw(false);
      c.y += 2;
    });
    zone.on('pointerdown', onPick);
    c.add(zone);
    c.setData('zone', zone);
    return c;
  }

  showSettings() {
    const root = this.openModal('settings');
    const gs = this.gs;
    const s = { ...gs.settings };
    const pw = 300;
    const ph = 272;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    const g = this.add.graphics();
    panel(g, px, py, pw, ph, P.ink, P.slate, P.black);
    root.add(g);
    root.add(txt(this, W / 2, py + 8, '설정', { size: 12, bold: true, color: P.amber }).setOrigin(0.5, 0));
    const three = (v: number, labels: string[], vals: number[]) => labels[vals.indexOf(vals.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a)))];
    const rows: { label: string; get: () => string; next: () => void }[] = [
      { label: '화면 흔들림', get: () => three(s.shake, ['끄기', '약하게', '보통'], [0, 0.5, 1]), next: () => (s.shake = s.shake >= 1 ? 0 : s.shake >= 0.5 ? 1 : 0.5) },
      { label: '번쩍임', get: () => three(s.flash, ['끄기', '약하게', '보통'], [0, 0.5, 1]), next: () => (s.flash = s.flash >= 1 ? 0 : s.flash >= 0.5 ? 1 : 0.5) },
      { label: '파티클', get: () => three(s.particles, ['적게', '보통', '많이'], [0.35, 0.7, 1]), next: () => (s.particles = s.particles >= 1 ? 0.35 : s.particles >= 0.7 ? 1 : 0.7) },
      { label: '움직임 줄이기', get: () => (s.reducedMotion ? 'ON' : 'OFF'), next: () => (s.reducedMotion = !s.reducedMotion) },
      { label: '빠른 릴', get: () => (s.fastReel ? 'ON' : 'OFF'), next: () => (s.fastReel = !s.fastReel) },
      { label: '전체 볼륨', get: () => `${Math.round(s.master * 100)}%`, next: () => (s.master = s.master >= 0.99 ? 0 : Math.round((s.master + 0.2) * 10) / 10) },
      { label: '음악', get: () => `${Math.round(s.music * 100)}%`, next: () => (s.music = s.music >= 0.99 ? 0 : Math.round((s.music + 0.2) * 10) / 10) },
      { label: '효과음', get: () => `${Math.round(s.sfx * 100)}%`, next: () => (s.sfx = s.sfx >= 0.99 ? 0 : Math.round((s.sfx + 0.2) * 10) / 10) },
    ];
    rows.forEach((row, i) => {
      const y = py + 30 + i * 24;
      root.add(txt(this, px + 16, y + 4, row.label, { size: 12, color: P.silver }));
      const bg = this.add.graphics();
      const val = txt(this, px + pw - 66, y + 4, row.get(), { size: 12, bold: true, color: P.white });
      val.setOrigin(0.5, 0);
      const drawBtn = (hover: boolean) => {
        bg.clear();
        panel(bg, px + pw - 112, y, 92, 20, hover ? P.slate : P.navy, P.steel, P.black);
      };
      drawBtn(false);
      const z = this.add.zone(px + pw - 66, y + 10, 92, 20).setInteractive({ useHandCursor: true });
      z.on('pointerover', () => drawBtn(true));
      z.on('pointerout', () => drawBtn(false));
      z.on('pointerdown', () => {
        row.next();
        val.setText(row.get());
        gs.updateSettings({ ...s });
        audio.uiClick();
      });
      root.add([bg, val, z]);
    });
    const by = py + ph - 34;
    root.add(this.button(px + 16, by, 120, 24, '새 게임', P.crimson, () => this.confirmReset()));
    root.add(this.button(px + pw - 136, by, 120, 24, '닫기', P.green, () => this.closeModal()));
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.closeModal();
    };
    this.input.keyboard?.on('keydown', this.keyHandler);
  }

  private confirmReset() {
    const root = this.openModal('confirm');
    const g = this.add.graphics();
    panel(g, W / 2 - 140, H / 2 - 50, 280, 100, P.ink, P.slate, P.black);
    root.add(g);
    root.add(txt(this, W / 2, H / 2 - 36, '처음부터 다시 할까요?', { size: 12, bold: true, color: P.white }).setOrigin(0.5, 0));
    root.add(txt(this, W / 2, H / 2 - 18, '진행 상황이 모두 지워져요.', { size: 12, color: P.silver }).setOrigin(0.5, 0));
    root.add(this.button(W / 2 - 124, H / 2 + 12, 112, 24, '취소', P.slate, () => this.showSettings()));
    root.add(this.button(W / 2 + 12, H / 2 + 12, 112, 24, '지우기', P.crimson, () => this.gs.newGame()));
  }

  showResults() {
    const root = this.openModal('results');
    const sim = this.gs.sim;
    const g = this.add.graphics();
    const pw = 360;
    const ph = 250;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    panel(g, px, py, pw, ph, P.ink, P.slate, P.black);
    g.fillStyle(P.magenta, 1).fillRect(px + 1, py + 1, pw - 2, 30);
    root.add(g);
    root.add(txt(this, W / 2, py + 4, 'CORE BREAK!', { size: 24, bold: true, color: P.yellow, stroke: P.crimson, shadow: null }).setOrigin(0.5, 0));
    const st = sim.stats;
    const lines: [string, string][] = [
      ['플레이 시간', fmtTime(st.coreMs || st.playMs)],
      ['도달 깊이', `${fmt(sim.depthMeters)}m`],
      ['부순 돌', fmt(st.tiles)],
      ['최대 CHAIN', `×${st.maxChain}`],
      ['MEGA', `${st.megas}번`],
      ['FEVER', `${st.fevers}번`],
      ['모은 ORE', fmt(sim.totalOre)],
      ['레버 당긴 횟수', fmt(st.spins)],
    ];
    lines.forEach(([k, v], i) => {
      const y = py + 42 + i * 18;
      root.add(txt(this, px + 30, y, k, { size: 12, color: P.silver }));
      root.add(txt(this, px + pw - 30, y, v, { size: 12, bold: true, color: P.white }).setOrigin(1, 0));
    });
    const by = py + ph - 36;
    root.add(this.button(px + 20, by, 150, 26, '계속 부수기', P.green, () => {
      this.closeModal();
      this.gs.continueEndless();
      this.banner('ENDLESS', '끝없이 부숴라!', P.green, 1600);
    }));
    root.add(this.button(px + pw - 170, by, 150, 26, '처음부터', P.crimson, () => this.confirmReset()));
  }

  private button(x: number, y: number, w: number, h: number, label: string, color: number, fn: () => void) {
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    const t = txt(this, x + w / 2, y + Math.round(h / 2) - 6, label, { size: 12, bold: true, color: P.white });
    t.setOrigin(0.5, 0);
    const draw = (hover: boolean) => {
      g.clear();
      panel(g, x, y - (hover ? 1 : 0), w, h, color, P.white, P.black);
      t.y = y + Math.round(h / 2) - 6 - (hover ? 1 : 0);
    };
    draw(false);
    const z = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    z.on('pointerover', () => draw(true));
    z.on('pointerout', () => draw(false));
    z.on('pointerdown', () => {
      audio.uiClick();
      fn();
    });
    c.add([g, t, z]);
    return c;
  }
}
