// The drilling machine console: reels, lever, turret, ore counter, upgrade
// button, FEVER gauge/button, bot dock, reel strip and depth shaft.
import Phaser from 'phaser';
import { FIELD_Y, NOZZLE, W } from '../config';
import { LAYERS, type Sym } from '../data/balance';
import { P } from '../data/palette';
import { MACH, REEL_CELL, makeReelStrip } from '../art/sprites';
import type { BotKind } from '../data/upgrades';
import type { Game } from '../sim/game';
import { D } from './depth';
import { fmt, panel, txt } from './ui';

type Img = Phaser.GameObjects.Image;

class ReelView {
  strip: Phaser.GameObjects.TileSprite;
  bg: Phaser.GameObjects.Graphics;
  glass: Phaser.GameObjects.Graphics;
  pos = -6;
  speed = 0;
  state: 'idle' | 'spin' | 'stop' = 'idle';
  private stopT = 0;
  private from = 0;
  private to = 0;
  flash = 0;
  glow = 0;
  glowColor: number = P.yellow;
  tease = false;

  constructor(scene: Phaser.Scene, root: Phaser.GameObjects.Container, public x: number, public y: number, key: string) {
    this.bg = scene.add.graphics();
    const w = MACH.reelW;
    const h = MACH.reelH;
    // drum shading (static; icons scroll over it)
    const bands = [P.tan, P.peach, P.sand, P.sand, P.sand, P.sand, P.peach, P.tan];
    const bh = h / bands.length;
    bands.forEach((c, i) => this.bg.fillStyle(c, 1).fillRect(x, y + Math.round(i * bh), w, Math.ceil(bh)));
    this.strip = scene.add.tileSprite(x + 2, y, 32, h, key).setOrigin(0);
    this.glass = scene.add.graphics();
    this.drawGlass();
    root.add([this.bg, this.strip, this.glass]);
  }

  drawGlass() {
    const g = this.glass;
    const { x, y } = this;
    const w = MACH.reelW;
    const h = MACH.reelH;
    g.clear();
    g.fillStyle(P.rose, 0.55).fillRect(x, y, w, 3);
    g.fillStyle(P.rose, 0.55).fillRect(x, y + h - 3, w, 3);
    g.fillStyle(P.brown, 0.5).fillRect(x, y, w, 1);
    g.fillStyle(P.brown, 0.5).fillRect(x, y + h - 1, w, 1);
    g.fillStyle(P.white, 0.35).fillRect(x + 2, y + 4, 1, h - 8);
    if (this.flash > 0) g.fillStyle(P.white, Math.min(0.7, this.flash / 120)).fillRect(x, y, w, h);
    if (this.glow > 0) {
      const a = Math.min(1, this.glow / 150);
      g.lineStyle(2, this.glowColor, a).strokeRect(x - 1, y - 1, w + 2, h + 2);
    }
    if (this.tease) {
      g.lineStyle(1, P.white, 0.8).strokeRect(x - 2.5, y - 2.5, w + 5, h + 5);
    }
  }

  startSpin(fast: boolean) {
    this.state = 'spin';
    this.speed = fast ? 2.2 : 1.7;
  }

  stopAt(face: number, faces: number, ms = 170) {
    const H = REEL_CELL * faces;
    const T = face * REEL_CELL - 6;
    const p = this.pos - 34;
    const mod = (((p - T) % H) + H) % H;
    this.to = p - mod;
    this.from = this.pos;
    this.stopT = 0;
    this.state = 'stop';
    this.speed = ms;
  }

  update(dt: number, blurKey: string, sharpKey: string) {
    if (this.state === 'spin') {
      this.pos -= this.speed * dt;
      if (this.strip.texture.key !== blurKey) this.strip.setTexture(blurKey);
    } else if (this.state === 'stop') {
      this.stopT += dt;
      const ms = this.speed;
      const u = Math.min(1, this.stopT / ms);
      // ease out with a little overshoot ("clunk")
      const over = 5;
      if (u < 0.7) {
        const k = 1 - Math.pow(1 - u / 0.7, 2);
        this.pos = this.from + (this.to - over - this.from) * k;
      } else {
        const k = (u - 0.7) / 0.3;
        this.pos = this.to - over + over * k;
      }
      if (this.strip.texture.key !== sharpKey && u > 0.25) this.strip.setTexture(sharpKey);
      if (u >= 1) {
        this.pos = this.to;
        this.state = 'idle';
      }
    }
    this.strip.tilePositionY = Math.round(this.pos);
    if (this.flash > 0) this.flash -= dt;
    if (this.glow > 0) this.glow -= dt;
    this.drawGlass();
  }
}

export interface MachineCallbacks {
  lever: () => void;
  upgrade: () => void;
  fever: () => void;
  toggleBot: (k: BotKind) => void;
}

export class MachineView {
  root: Phaser.GameObjects.Container;
  reels: ReelView[] = [];
  private stripKey = 'reelstrip_0';
  private stripVer = 0;
  private turret: Img;
  barrel: Img;
  aim = 0;
  aimTarget = 0;
  private recoil = 0;
  lever: Phaser.GameObjects.Sprite;
  private leverAnim = -1;
  leverShake = 0;
  leverReady = true;
  private lamps: Img[] = [];
  private gears: Phaser.GameObjects.Sprite[] = [];
  private wheels: Phaser.GameObjects.Sprite[] = [];
  private tread: Phaser.GameObjects.TileSprite;
  private treadPos = 0;
  treadSpeed = 0;
  private oreText: Phaser.GameObjects.Text;
  private oreShown = 0;
  private oreBounce = 0;
  private upG: Phaser.GameObjects.Graphics;
  private upText: Phaser.GameObjects.Text;
  private upCost: Phaser.GameObjects.Text;
  upHover = false;
  private feverG: Phaser.GameObjects.Graphics;
  private feverLabel: Phaser.GameObjects.Text;
  private fbG: Phaser.GameObjects.Graphics;
  private fbText: Phaser.GameObjects.Text;
  private fbPop = 0;
  fbHover = false;
  private dockIcons: Img[] = [];
  private dockCount: Phaser.GameObjects.Text[] = [];
  private dockG: Phaser.GameObjects.Graphics;
  private stripIcons: Img[] = [];
  private stripLabel: Phaser.GameObjects.Text;
  private depthG: Phaser.GameObjects.Graphics;
  private depthLabels: Phaser.GameObjects.Text[] = [];
  private t = 0;
  megaFlash = 0;
  feverShutter = 1; // 1 = closed
  feverOpening = false;
  private vib = 0;
  lampMode: 'idle' | 'charge' | 'fever' = 'idle';

  constructor(private scene: Phaser.Scene, private game: Game, private cb: MachineCallbacks) {
    const root = (this.root = scene.add.container(0, 0).setDepth(D.machine));
    root.add(scene.add.image(0, MACH.y, 'machine').setOrigin(0));
    this.tread = scene.add.tileSprite(0, 338, W, 20, 'tread').setOrigin(0);
    root.add(this.tread);
    for (let i = 0; i < 8; i++) {
      const w = scene.add.sprite(34 + i * 82, 349, 'wheel', 0);
      this.wheels.push(w);
      root.add(w);
    }
    for (const [x, y] of [
      [60, 324],
      [594, 322],
    ]) {
      const gsp = scene.add.sprite(x, y, 'gear', 0);
      this.gears.push(gsp);
      root.add(gsp);
    }
    for (let i = 0; i < 12; i++) {
      const l = scene.add.image(266 + i * 10, 231, 'lamp', 0);
      this.lamps.push(l);
      root.add(l);
    }
    // reels
    makeReelStrip(scene, game.reel, this.stripKey);
    for (let i = 0; i < 3; i++) this.reels.push(new ReelView(scene, root, MACH.reelX[i], MACH.reelY, this.stripKey));
    // turret
    this.barrel = scene.add.image(NOZZLE.x, NOZZLE.y - 2, 'barrel', 0).setOrigin(0.5, 0.92);
    this.turret = scene.add.image(NOZZLE.x, MACH.y + 2, 'turret').setOrigin(0.5, 1);
    root.add([this.barrel, this.turret]);
    // lever
    this.lever = scene.add.sprite(MACH.leverPivot.x, MACH.leverPivot.y, 'lever', 0).setOrigin(14 / 28, 52 / 96);
    root.add(this.lever);
    const lz = scene.add.zone(MACH.leverPivot.x, MACH.leverPivot.y - 10, 34, 108).setInteractive({ useHandCursor: true });
    lz.on('pointerdown', () => this.cb.lever());
    root.add(lz);
    // ore panel
    const op = MACH.orePanel;
    root.add(scene.add.image(op.x + 11, op.y + 17, 'loot_ore_icon'));
    root.add(txt(scene, op.x + 5, op.y + 2, 'ORE', { size: 8, font: 'Galmuri7', color: P.steel, shadow: null }));
    this.oreText = txt(scene, op.x + op.w - 6, op.y + 7, '0', { size: 24, bold: true, color: P.cyan, shadow: P.blue });
    this.oreText.setOrigin(1, 0);
    root.add(this.oreText);
    // upgrade button
    const ub = MACH.upBtn;
    this.upG = scene.add.graphics();
    this.upText = txt(scene, ub.x + 8, ub.y + 7, 'UPGRADE', { size: 12, bold: true, color: P.black, shadow: null });
    this.upCost = txt(scene, ub.x + ub.w - 6, ub.y + 7, '', { size: 12, color: P.black, shadow: null });
    this.upCost.setOrigin(1, 0);
    root.add([this.upG, this.upText, this.upCost]);
    const uz = scene.add.zone(ub.x + ub.w / 2, ub.y + ub.h / 2, ub.w, ub.h).setInteractive({ useHandCursor: true });
    uz.on('pointerdown', () => this.cb.upgrade());
    uz.on('pointerover', () => (this.upHover = true));
    uz.on('pointerout', () => (this.upHover = false));
    root.add(uz);
    // fever gauge
    this.feverG = scene.add.graphics();
    const fb = MACH.feverBar;
    this.feverLabel = txt(scene, fb.x - 1, fb.y - 14, 'FEVER', { size: 8, font: 'Galmuri7', color: P.pink });
    root.add([this.feverG, this.feverLabel]);
    // fever button
    this.fbG = scene.add.graphics();
    this.fbText = txt(scene, MACH.feverBtn.x, MACH.feverBtn.y - 7, 'FEVER!', { size: 12, bold: true, color: P.white, stroke: P.crimson, shadow: null });
    this.fbText.setOrigin(0.5, 0);
    root.add([this.fbG, this.fbText]);
    const fz = scene.add.zone(MACH.feverBtn.x, MACH.feverBtn.y, 60, 60).setInteractive({ useHandCursor: true });
    fz.on('pointerdown', () => this.cb.fever());
    fz.on('pointerover', () => (this.fbHover = true));
    fz.on('pointerout', () => (this.fbHover = false));
    root.add(fz);
    // bot dock
    this.dockG = scene.add.graphics();
    root.add(this.dockG);
    (['drill', 'bomb', 'magnet'] as BotKind[]).forEach((k, i) => {
      const x = MACH.botDock.x + i * 30 + 13;
      const ic = scene.add.image(x, MACH.botDock.y + 13, `bot_${k}_0`).setVisible(false);
      const ct = txt(scene, x + 11, MACH.botDock.y + 16, '', { size: 8, font: 'Galmuri7', color: P.white });
      ct.setOrigin(1, 0);
      this.dockIcons.push(ic);
      this.dockCount.push(ct);
      root.add([ic, ct]);
      const z = scene.add.zone(x, MACH.botDock.y + 26, 26, 52).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.cb.toggleBot(k));
      root.add(z);
    });
    // reel strip display (right column)
    this.stripLabel = txt(scene, 604, 30, 'REEL', { size: 8, font: 'Galmuri7', color: P.steel });
    this.stripLabel.setOrigin(0.5, 0);
    root.add(this.stripLabel);
    const n = game.reel.length;
    const step = Math.min(22, Math.floor(156 / Math.max(1, n - 1)));
    for (let i = 0; i < n; i++) {
      const ic = scene.add.image(604, 50 + i * step, 'symS_D');
      this.stripIcons.push(ic);
      root.add(ic);
    }
    // depth shaft (left column)
    this.depthG = scene.add.graphics();
    root.add(this.depthG);
    for (let i = 0; i < LAYERS.length; i++) {
      const tl = txt(scene, 14, 0, String(i + 1), { size: 8, font: 'Galmuri7', color: P.steel });
      this.depthLabels.push(tl);
      root.add(tl);
    }
    this.refreshStrip();
    this.oreShown = game.displayOre();
    this.feverShutter = game.feverUnlocked ? 0 : 1;
  }

  // ------------------------------------------------------------ reels

  refreshStrip() {
    this.game.reel.forEach((s, i) => this.stripIcons[i]?.setTexture('symS_' + s));
  }

  rebuildReelTexture() {
    const old = this.stripKey;
    this.stripVer++;
    this.stripKey = 'reelstrip_' + this.stripVer;
    makeReelStrip(this.scene, this.game.reel, this.stripKey);
    for (const r of this.reels) r.strip.setTexture(this.stripKey);
    this.scene.time.delayedCall(100, () => {
      if (this.scene.textures.exists(old)) this.scene.textures.remove(old);
      if (this.scene.textures.exists(old + '_blur')) this.scene.textures.remove(old + '_blur');
    });
  }

  animateSwap(index: number, to: Sym) {
    const ic = this.stripIcons[index];
    if (!ic) return;
    this.scene.tweens.add({
      targets: ic,
      scaleX: 0,
      duration: 120,
      yoyo: true,
      onYoyo: () => ic.setTexture('symS_' + to),
      onComplete: () => ic.setScale(1),
    });
  }

  spinStart(fast: boolean) {
    for (const r of this.reels) r.startSpin(fast);
  }

  faceFor(sym: Sym, rnd: number): number {
    const idx = this.game.reel.map((s, i) => (s === sym ? i : -1)).filter((i) => i >= 0);
    return idx[Math.floor(rnd * idx.length)] ?? 0;
  }

  stopReel(i: number, sym: Sym) {
    this.reels[i].tease = false;
    this.reels[i].stopAt(this.faceFor(sym, Math.random()), this.game.reel.length);
    this.reels[i].flash = 90;
  }

  highlight(from: number, to: number, color: number, ms = 450) {
    for (let i = from; i <= to; i++) {
      this.reels[i].glow = ms;
      this.reels[i].glowColor = color;
    }
  }

  // ------------------------------------------------------------ lever / turret

  pullLever() {
    this.leverAnim = 0;
  }
  kick(power: number) {
    this.recoil = Math.max(this.recoil, power);
  }
  flashBarrel() {
    this.barrel.setFrame(1);
    this.scene.time.delayedCall(90, () => this.barrel.setFrame(0));
  }
  aimAt(sx: number, sy: number) {
    this.aimTarget = Math.atan2(sx - NOZZLE.x, -(sy - NOZZLE.y));
  }
  barrelTip(): { x: number; y: number } {
    const len = 20;
    return { x: NOZZLE.x + Math.sin(this.aim) * len, y: NOZZLE.y - 2 - Math.cos(this.aim) * len };
  }

  oreArrived() {
    this.oreBounce = 90;
  }

  // ------------------------------------------------------------ update

  update(dt: number, opts: { canPull: boolean; spinning: boolean; fever: boolean; feverFrac: number; feverReady: boolean; feverLeftFrac: number; upgradeVisible: boolean; mega: boolean }) {
    this.t += dt;
    const t = this.t;
    for (const r of this.reels) r.update(dt, this.stripKey + '_blur', this.stripKey);

    // turret aim (smoothed) + recoil
    this.aim += (this.aimTarget - this.aim) * Math.min(1, dt / 70);
    this.barrel.setRotation(this.aim);
    this.recoil = Math.max(0, this.recoil - dt / 40);
    const rc = Math.round(this.recoil);
    this.barrel.setPosition(NOZZLE.x - Math.sin(this.aim) * rc, NOZZLE.y - 2 + Math.cos(this.aim) * rc);

    // machine vibration
    this.vib -= dt;
    let vy = 0;
    if (opts.fever) vy = Math.random() < 0.5 ? 1 : 0;
    else if (this.recoil > 1.5) vy = 1;
    else if (Math.floor(t / 420) % 7 === 0) vy = Math.floor(t / 60) % 2;
    this.root.y = vy;

    // lever
    if (this.leverAnim >= 0) {
      this.leverAnim += dt;
      const seq = [0, 1, 2, 3, 4, 4, 3, 2, 1, 0, 1, 0];
      const k = Math.floor(this.leverAnim / 28);
      if (k >= seq.length) {
        this.leverAnim = -1;
        this.lever.setFrame(0);
      } else this.lever.setFrame(seq[k]);
    } else if (this.leverShake > 0 && opts.canPull) {
      this.leverShake -= dt;
      const ph = Math.floor(t / 70) % 8;
      this.lever.setFrame(ph === 1 || ph === 3 ? 1 : 0);
    }
    this.lever.setTint(opts.canPull ? 0xffffff : 0x8a8a9a);

    // tread & wheels
    this.treadPos += this.treadSpeed * dt;
    this.treadSpeed = Math.max(0, this.treadSpeed - dt * 0.004);
    this.tread.tilePositionX = Math.round(this.treadPos);
    const wf = Math.floor(this.treadPos / 4) % 4;
    for (const w of this.wheels) w.setFrame((wf + 4) % 4);
    const gf = Math.floor(t / (opts.fever ? 40 : opts.spinning ? 70 : 260)) % 4;
    this.gears[0].setFrame(gf);
    this.gears[1].setFrame(3 - gf);

    // lamps
    this.megaFlash = Math.max(0, this.megaFlash - dt);
    this.lamps.forEach((l, i) => {
      let f = 0;
      if (this.megaFlash > 0) f = Math.floor(this.megaFlash / 60) % 2 ? 3 : 0;
      else if (opts.fever) f = 1 + ((i + Math.floor(t / 50)) % 6);
      else if (opts.feverReady) f = Math.floor(t / 120) % 2 ? 2 : 1;
      else if (opts.feverFrac >= 0.8) f = i / 12 < (opts.feverFrac - 0.8) / 0.2 ? 2 : Math.floor(t / 300 + i) % 12 === 0 ? 2 : 0;
      else if (opts.spinning) f = (i + Math.floor(t / 45)) % 4 === 0 ? 2 : 0;
      else f = (i === Math.floor(t / 400) % 12) ? 2 : 0;
      l.setFrame(f);
    });

    this.drawOre(dt);
    this.drawUpgrade(opts.upgradeVisible);
    this.drawFever(dt, opts);
    this.drawDock();
    this.drawDepth();
  }

  private drawOre(dt: number) {
    const target = this.game.displayOre();
    const diff = target - this.oreShown;
    if (Math.abs(diff) < 0.5) this.oreShown = target;
    else this.oreShown += diff * Math.min(1, dt / 110) + Math.sign(diff) * Math.min(Math.abs(diff), 0.5);
    this.oreText.setText(fmt(this.oreShown));
    this.oreBounce = Math.max(0, this.oreBounce - dt);
    this.oreText.y = MACH.orePanel.y + 7 - (this.oreBounce > 45 ? 2 : this.oreBounce > 0 ? 1 : 0);
    this.oreText.setColor(this.oreBounce > 0 ? '#ffffff' : '#2ce8f5');
  }

  private drawUpgrade(visible: boolean) {
    const g = this.upG;
    const ub = MACH.upBtn;
    g.clear();
    if (!visible) {
      this.upText.setVisible(false);
      this.upCost.setVisible(false);
      return;
    }
    this.upText.setVisible(true);
    this.upCost.setVisible(true);
    const cost = this.game.upgradeCost();
    const have = this.game.displayOre();
    const ready = this.game.canBuy();
    const frac = Math.min(1, have / cost);
    const lift = ready && this.upHover ? 1 : 0;
    if (ready) {
      const pulse = Math.floor(this.t / 160) % 2;
      panel(g, ub.x, ub.y - lift, ub.w, ub.h, pulse ? P.amber : P.yellow, P.white, P.orange);
      g.lineStyle(1, P.yellow, 0.5 + 0.5 * Math.sin(this.t / 120)).strokeRect(ub.x - 2.5, ub.y - 2.5 - lift, ub.w + 5, ub.h + 5);
      this.upText.setText('UPGRADE!').setColor('#181425');
      this.upCost.setColor('#181425');
    } else {
      panel(g, ub.x, ub.y, ub.w, ub.h, P.ink, P.navy, P.black);
      g.fillStyle(P.darkBrown, 1).fillRect(ub.x + 2, ub.y + 2, Math.round((ub.w - 4) * frac), ub.h - 4);
      g.fillStyle(P.orange, 1).fillRect(ub.x + 2, ub.y + ub.h - 4, Math.round((ub.w - 4) * frac), 2);
      this.upText.setText('UPGRADE').setColor('#8b9bb4');
      this.upCost.setColor('#8b9bb4');
    }
    this.upText.y = ub.y + 7 - lift;
    this.upCost.y = ub.y + 7 - lift;
    this.upCost.setText(fmt(cost));
  }

  private drawFever(dt: number, o: { fever: boolean; feverFrac: number; feverReady: boolean; feverLeftFrac: number }) {
    const g = this.feverG;
    const fb = MACH.feverBar;
    g.clear();
    if (this.feverOpening) {
      this.feverShutter = Math.max(0, this.feverShutter - dt / 900);
      if (this.feverShutter <= 0) this.feverOpening = false;
    }
    const frac = o.fever ? o.feverLeftFrac : o.feverFrac;
    const w = Math.round((fb.w - 2) * frac);
    const stripeOff = Math.floor(this.t / (o.fever ? 30 : 80)) % 8;
    if (w > 0) {
      const cols = o.fever ? [P.hotpink, P.orange, P.yellow, P.green, P.cyan, P.magenta] : [P.magenta, P.hotpink, P.orange, P.amber];
      for (let x = 0; x < w; x++) {
        const k = o.fever ? Math.floor((x + this.t / 8) / 10) % cols.length : Math.min(cols.length - 1, Math.floor((x / (fb.w - 2)) * cols.length));
        g.fillStyle(cols[k], 1).fillRect(fb.x + 1 + x, fb.y + 1, 1, fb.h - 2);
        if ((x + stripeOff) % 8 < 2) g.fillStyle(P.white, 0.25).fillRect(fb.x + 1 + x, fb.y + 1, 1, fb.h - 2);
      }
      g.fillStyle(P.white, 0.5).fillRect(fb.x + 1, fb.y + 2, w, 1);
    }
    if ((o.feverReady || (o.feverFrac >= 0.95 && !o.fever)) && !o.fever) {
      const a = 0.4 + 0.4 * Math.sin(this.t / 90);
      g.lineStyle(1, P.yellow, a).strokeRect(fb.x - 5.5, fb.y - 5.5, fb.w + 11, fb.h + 11);
    }
    // shutter while locked
    if (this.feverShutter > 0) {
      const sw = Math.round((fb.w + 8) * this.feverShutter);
      panel(g, fb.x - 4, fb.y - 4, Math.max(3, sw), fb.h + 8, P.slate, P.steel, P.navy);
      for (let x = fb.x + 4; x < fb.x - 4 + sw - 4; x += 12) g.fillStyle(P.black, 1).fillRect(x, fb.y + 1, 6, fb.h - 2);
    }
    this.feverLabel.setVisible(this.feverShutter < 1);
    this.feverLabel.setColor(o.fever ? (Math.floor(this.t / 80) % 2 ? '#fee761' : '#ff0044') : '#f6757a');

    // FEVER button in the right socket
    const fg = this.fbG;
    fg.clear();
    const bx = MACH.feverBtn.x;
    const by = MACH.feverBtn.y;
    const show = o.feverReady || o.fever;
    this.fbPop = show ? Math.min(1, this.fbPop + dt / 180) : Math.max(0, this.fbPop - dt / 180);
    if (this.fbPop <= 0) {
      this.fbText.setVisible(false);
      // dim icon in socket
      if (this.game.feverUnlocked) {
        const fr = Math.round(22 * o.feverFrac);
        fg.fillStyle(P.plum, 1).fillCircle(bx, by, 22);
        fg.fillStyle(P.crimson, 1).fillRect(bx - 12, by + 12 - fr, 24, 0);
        fg.lineStyle(2, P.crimson, 1).beginPath();
        fg.arc(bx, by, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * o.feverFrac, false).strokePath();
      }
      return;
    }
    const s = this.fbPop < 1 ? 0.6 + 0.4 * this.fbPop + Math.sin(this.fbPop * Math.PI) * 0.15 : 1;
    const pressed = o.fever;
    const r = Math.round(23 * s);
    const lift = !pressed && this.fbHover ? 1 : 0;
    if (!pressed) {
      const pr = r + 4 + Math.round(2 * Math.sin(this.t / 90));
      fg.lineStyle(2, P.yellow, 0.7).strokeCircle(bx, by, pr);
    }
    fg.fillStyle(P.black, 1).fillCircle(bx, by + 2, r + 1);
    fg.fillStyle(pressed ? P.plum : P.crimson, 1).fillCircle(bx, by - lift, r);
    fg.fillStyle(pressed ? P.crimson : P.red, 1).fillCircle(bx, by - 2 - lift, r - 3);
    fg.fillStyle(pressed ? P.red : P.pink, 1).fillCircle(bx - Math.round(r * 0.35), by - Math.round(r * 0.45) - lift, Math.max(1, Math.round(r * 0.22)));
    if (pressed) {
      fg.lineStyle(2, P.yellow, 1).beginPath();
      fg.arc(bx, by, r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * o.feverLeftFrac, false).strokePath();
    }
    this.fbText.setVisible(true).setScale(1);
    this.fbText.setText(pressed ? 'FEVER' : 'FEVER!');
    this.fbText.y = by - 7 - lift + (pressed ? 1 : 0);
  }

  private drawDock() {
    const g = this.dockG;
    g.clear();
    (['drill', 'bomb', 'magnet'] as BotKind[]).forEach((k, i) => {
      const b = this.game.bots[k];
      const x = MACH.botDock.x + i * 30;
      const y = MACH.botDock.y + 32;
      const owned = b.count > 0;
      this.dockIcons[i].setVisible(owned).setAlpha(b.on ? 1 : 0.4);
      this.dockCount[i].setText(owned && b.count > 1 ? 'x' + b.count : '');
      if (!owned) return;
      const on = b.on;
      g.fillStyle(on ? P.green : P.crimson, 1).fillRect(x + 4, y + 5, 18, 10);
      g.fillStyle(on ? P.forest : P.plum, 1).fillRect(x + 4, y + 13, 18, 2);
      g.fillStyle(P.white, 1).fillRect(on ? x + 14 : x + 6, y + 6, 6, 7);
    });
  }

  private drawDepth() {
    const g = this.depthG;
    g.clear();
    const x = 30;
    const top = FIELD_Y + 12;
    const segH = 32;
    const cur = this.game.layer;
    for (let i = 0; i < LAYERS.length; i++) {
      const y = top + i * (segH + 2);
      const pal = LAYERS[i].pal;
      const reached = i <= cur;
      g.fillStyle(P.black, 1).fillRect(x - 1, y - 1, 12, segH + 2);
      g.fillStyle(reached ? pal.m : P.ink, 1).fillRect(x, y, 10, segH);
      if (reached) g.fillStyle(pal.l, 1).fillRect(x, y, 2, segH);
      if (i === cur) {
        const fy = y + Math.round(this.game.layerProgress() * (segH - 1));
        g.fillStyle(pal.d, 0.6).fillRect(x, fy, 10, y + segH - fy);
        // marker
        g.fillStyle(P.black, 1).fillRect(x + 11, fy - 3, 8, 7);
        g.fillStyle(Math.floor(this.t / 250) % 2 ? P.yellow : P.white, 1).fillRect(x + 12, fy - 2, 6, 5);
        g.fillStyle(P.black, 1).fillRect(x + 11, fy, 2, 1);
      }
      this.depthLabels[i].setPosition(16, y + segH / 2 - 4).setColor(i === cur ? '#fee761' : reached ? '#c0cbdc' : '#5a6988');
    }
    // core at the bottom
    const cy = top + LAYERS.length * (segH + 2) + 2;
    g.fillStyle(this.game.core.done ? P.yellow : P.magenta, 1).fillCircle(x + 5, cy, 3);
  }
}
