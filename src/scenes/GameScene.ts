import Phaser from 'phaser';
import { COLS, FIELD_BOTTOM, FIELD_H, FIELD_W, FIELD_X, FIELD_Y, H, NOZZLE, ROWS, TILE, W } from '../config';
import { REEL_TIMING, type Sym, type TileType } from '../data/balance';
import { P } from '../data/palette';
import { UPGRADE_BY_ID, type BotKind, type UpgradeDef } from '../data/upgrades';
import { explosionKey } from '../art/sprites';
import { audio } from '../audio/audio';
import { clearSave, loadGame, loadSettings, saveGame, saveSettings, type Settings } from '../save';
import { Game, TUTORIAL_T1, TUTORIAL_T2 } from '../sim/game';
import { groupActions } from '../sim/resolver';
import type { Cell, Dir, GEvent, Notice, Pt, Resolution } from '../sim/types';
import { BotsView } from '../view/bots';
import { D } from '../view/depth';
import { FieldView, cellCX, cellCY, type TileSpr } from '../view/field';
import { CameraFx, Flash, Rings } from '../view/fx';
import { LootView } from '../view/loot';
import { MachineView } from '../view/machine';
import { Particles } from '../view/particles';
import { Timeline } from '../view/timeline';
import type { OverlayScene } from './OverlayScene';

interface DrillObj {
  spr: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
  mega: boolean;
  fade: number;
}

interface BombObj {
  spr: Phaser.GameObjects.Sprite;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  t: number;
  dur: number;
  peak: number;
  small: boolean;
  level: number;
  fuse: number;
  done: boolean;
}

interface MagObj {
  spr: Phaser.GameObjects.Image;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  t: number;
  dur: number;
  state: 'fly' | 'hover' | 'back';
  hold: number;
}

const SYM_COLOR: Record<Sym, number> = { D: P.amber, B: P.red, M: P.sky };
const TIP_TEXT: Partial<Record<TileType, string>> = {
  gas: 'GAS · 폭탄에 연쇄 폭발!',
  bombrock: '폭탄돌 · 깨지면 펑!',
  crystal: 'CRYSTAL · 드릴이 튕겨!',
  hard: '단단한 돌 · 드릴에 약해',
};

export class GameScene extends Phaser.Scene {
  sim!: Game;
  settings!: Settings;
  field!: FieldView;
  loot!: LootView;
  machine!: MachineView;
  bots!: BotsView;
  parts!: Particles;
  rings!: Rings;
  flash!: Flash;
  camfx!: CameraFx;
  tl = new Timeline();
  ov!: OverlayScene;
  wt = 0;
  hitstop = 0;
  paused = false;
  speed = 1;
  state: 'idle' | 'spin' | 'resolve' = 'idle';
  private resolveEnd = 0;
  private pendingResolve: Sym[] | null = null;
  advancing = false;
  private drills = new Map<number, DrillObj>();
  private pendingLead: DrillObj | null = null;
  private bombs: BombObj[] = [];
  private mags: MagObj[] = [];
  private lastBlast = { x: 0, y: 0, t: -9999 };
  private feverFx!: Phaser.GameObjects.Graphics;
  private feverIntro = 0;
  private lastSave = 0;
  private tipTimer = 0;
  finale = false;
  private finaleT = -1;
  private finaleG!: Phaser.GameObjects.Graphics;
  private rain = 0;
  firstMegaSeen = false;
  private spinCount = 0;
  private darkOverlay!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('Game');
  }

  create() {
    const params = new URLSearchParams(location.search);
    if (params.get('reset') === '1') clearSave();
    this.speed = Math.max(0.1, Math.min(16, Number(params.get('speed') ?? 1) || 1));
    const seed = params.get('seed');
    this.sim = loadGame() ?? Game.create(seed ? Number(seed) : undefined);
    this.settings = loadSettings();

    this.field = new FieldView(this, this.sim);
    this.field.setLayer(this.sim.layer, true);
    this.field.build();
    this.parts = new Particles(this, D.debris);
    this.loot = new LootView(this, this.field, this.sim, this.parts);
    this.loot.rebuild();
    this.loot.onArrive = (v, kind, big) => this.onArrive(v, kind, big);
    this.loot.onCrash = (p) => this.smallImpact(p.x, p.y);
    this.machine = new MachineView(this, this.sim, {
      lever: () => this.pull(false),
      upgrade: () => this.openUpgrade(),
      fever: () => this.startFever(),
      toggleBot: (k) => this.toggleBot(k),
    });
    this.bots = new BotsView(this, this.sim, this.parts);
    this.bots.sync(false);
    this.rings = new Rings(this, D.rings);
    // side columns frame the mine (debris and blasts stay inside the wall)
    const side = this.add.graphics().setDepth(D.machine - 2);
    side.fillStyle(P.black, 1).fillRect(-20, FIELD_Y, FIELD_X + 20, FIELD_H).fillRect(FIELD_X + FIELD_W, FIELD_Y, W - FIELD_X - FIELD_W + 20, FIELD_H);
    side.fillStyle(0x10131f, 1).fillRect(4, FIELD_Y + 4, FIELD_X - 10, FIELD_H - 8).fillRect(FIELD_X + FIELD_W + 6, FIELD_Y + 4, W - FIELD_X - FIELD_W - 10, FIELD_H - 8);
    side.fillStyle(P.ink, 1).fillRect(FIELD_X - 2, FIELD_Y, 1, FIELD_H).fillRect(FIELD_X + FIELD_W + 1, FIELD_Y, 1, FIELD_H);
    side.fillStyle(P.navy, 1).fillRect(FIELD_X - 1, FIELD_Y, 1, FIELD_H).fillRect(FIELD_X + FIELD_W, FIELD_Y, 1, FIELD_H);
    side.fillStyle(P.black, 1).fillRect(-20, -20, W + 40, FIELD_Y + 20);
    this.feverFx = this.add.graphics().setDepth(D.fxTop - 1);
    this.finaleG = this.add.graphics().setDepth(D.fxTop);
    this.darkOverlay = this.add.rectangle(W / 2, H / 2, W + 40, H + 40, 0x000000, 0).setDepth(D.flash - 1);
    this.flash = new Flash(this, D.flash);
    this.camfx = new CameraFx(this.cameras.main);
    this.applySettings();
    if (this.sim.target) this.machine.aimAt(cellCX(this.sim.target.c), cellCY(this.sim.target.r));

    // input
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const cell = this.field.cellAt(p.worldX, p.worldY);
      this.field.hover = cell && this.sim.targetAllowed(cell.c, cell.r) ? cell : null;
    });
    this.input.keyboard?.on('keydown-SPACE', (e: KeyboardEvent) => {
      e.preventDefault();
      if (!e.repeat) this.pull(false);
    });
    this.input.keyboard?.addCapture('SPACE');

    const saveNow = () => this.save();
    window.addEventListener('beforeunload', saveNow);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) saveNow();
    });
    this.events.once('shutdown', () => window.removeEventListener('beforeunload', saveNow));

    this.ov = this.scene.get('Overlay') as OverlayScene;
    this.time.delayedCall(50, () => {
      if (this.sim.pendingOffer) this.ov.showCards(this.sim.pendingOffer.offers, this.sim.pendingOffer.free, null, (i) => this.pickCard(i));
      else if (this.sim.pendingRewards.length) this.openReward();
    });

    // test / debug hooks
    (window as unknown as { __cb: unknown }).__cb = {
      scene: this,
      sim: () => this.sim,
      toClient: (x: number, y: number) => {
        const r = this.game.canvas.getBoundingClientRect();
        return { x: r.left + (x * r.width) / W, y: r.top + (y * r.height) / H };
      },
      cellCenter: (c: number, r: number) => ({ x: cellCX(c), y: cellCY(r) }),
      state: () => ({
        state: this.state,
        advancing: this.advancing,
        paused: this.paused,
        tutorial: this.sim.tutorial,
        ore: this.sim.ore,
        displayOre: this.sim.displayOre(),
        layer: this.sim.layer,
        depth: this.sim.depthMeters,
        depthRows: this.sim.depthRows,
        bought: this.sim.bought,
        fever: this.sim.fever,
        feverMax: this.sim.feverMax(),
        feverActive: this.sim.feverActive,
        feverReady: this.sim.feverReady(),
        feverUnlocked: this.sim.feverUnlocked,
        canBuy: this.sim.canBuy(),
        cost: this.sim.upgradeCost(),
        bots: this.sim.bots,
        megas: this.sim.stats.megas,
        spins: this.sim.stats.spins,
        maxChain: this.sim.stats.maxChain,
        tiles: this.sim.stats.tiles,
        coreLocked: this.sim.core.locked,
        coreLeft: this.sim.core.left,
        coreDone: this.sim.core.done,
        finale: this.finale,
        modal: this.ov?.modal ?? null,
        playMs: this.sim.stats.playMs,
        loot: this.sim.loot.size,
        particles: this.parts.count,
        fps: this.game.loop.actualFps,
        reel: this.sim.reel.join(''),
        stacks: this.sim.stacks,
        target: this.sim.target,
      }),
      setSpeed: (s: number) => (this.speed = s),
      save: () => this.save(),
      // A "reasonable player" target pick used by the automated playtest.
      suggestTarget: (): Cell => {
        const m = this.sim.mine;
        if (this.sim.core.locked && !this.sim.core.done) {
          const cands = m.find((t, c, r) => t.t !== 'heart' && Math.hypot(c - 15, r - 5) <= 4.8);
          cands.sort((a, b) => Math.hypot(a.c - 15, a.r - 5) - Math.hypot(b.c - 15, b.r - 5));
          return cands[Math.min(cands.length - 1, Math.floor(Math.random() * 4))] ?? { c: 15, r: 7 };
        }
        let best: Cell = { c: 15, r: 8 };
        let bestScore = -1;
        for (let i = 0; i < 14; i++) {
          const c = Math.floor(Math.random() * COLS);
          const r = Math.floor(Math.random() * ROWS);
          if (!m.get(c, r)) continue;
          let score = 1;
          for (let y = r - 3; y <= r + 3; y++)
            for (let x = c - 3; x <= c + 3; x++) {
              const n = m.get(x, y);
              if (!n) continue;
              score += n.t === 'gas' || n.t === 'bombrock' ? 3 : n.t === 'gold' ? 1.5 : n.t === 'crystal' ? 2 : 0.3;
            }
          if (score > bestScore) {
            bestScore = score;
            best = { c, r };
          }
        }
        return best;
      },
    };
  }

  // ------------------------------------------------------------ settings

  applySettings() {
    const s = this.settings;
    this.camfx.mult = s.reducedMotion ? 0 : s.shake;
    this.flash.mult = s.flash * (s.reducedMotion ? 0.35 : 1);
    this.parts.mult = s.particles * (s.reducedMotion ? 0.6 : 1);
    audio.setVolumes(s.master, s.music, s.sfx);
  }
  updateSettings(s: Settings) {
    this.settings = s;
    saveSettings(s);
    this.applySettings();
  }

  private noSave = false;

  /** Start the audio context (needs a user gesture) and sync the music to the game state. */
  ensureAudio() {
    audio.unlock();
    const m = audio.music;
    if (!m) return;
    m.setLayer(this.sim.layer);
    m.core = this.sim.core.locked && !this.sim.endless;
    m.start();
  }

  save() {
    if (this.noSave) return;
    if (this.finale && !this.sim.core.done) return;
    saveGame(this.sim);
    this.lastSave = this.wt;
  }

  // ------------------------------------------------------------ input

  private onPointer(p: Phaser.Input.Pointer) {
    this.ensureAudio();
    if (this.paused || this.feverIntro > 0) return;
    const cell = this.field.cellAt(p.worldX, p.worldY);
    if (!cell) return;
    if (!this.sim.setTarget(cell.c, cell.r)) {
      if (this.sim.tutorial < 2) {
        audio.denied();
        this.ov.nudgeHint();
      }
      return;
    }
    audio.targetSelect();
    this.machine.aimAt(cellCX(cell.c), cellCY(cell.r));
    this.machine.leverShake = 2400;
    const x = cellCX(cell.c);
    const y = cellCY(cell.r);
    this.rings.add(x, y, 14, 7, 160, P.white, 1, 0.9);
    this.parts.burst(4, (i) => ({ key: 'spark', frames: 3, x: x + (i % 2 ? 8 : -8), y: y + (i < 2 ? 8 : -8), life: 180 }));
  }

  private toggleBot(k: BotKind) {
    audio.unlock();
    if (this.paused) return;
    const b = this.sim.bots[k];
    if (!b.count) return;
    b.on = !b.on;
    audio.uiClick();
  }

  // ------------------------------------------------------------ spinning

  hintCell(): Cell | null {
    if (this.sim.tutorial === 0) return this.sim.target ? null : TUTORIAL_T1;
    if (this.sim.tutorial === 1 && !this.sim.target && this.state === 'idle') return TUTORIAL_T2;
    return null;
  }

  canPullNow(): boolean {
    return this.state === 'idle' && !this.paused && !this.finale && this.sim.canPull() && this.feverIntro <= 0;
  }

  pull(auto: boolean) {
    this.ensureAudio();
    if (this.paused || this.finale || this.feverIntro > 0) return;
    if (this.sim.feverActive && !auto) return; // the machine runs itself during FEVER
    if (this.state !== 'idle') return;
    if (!this.sim.canPull()) {
      audio.denied();
      this.ov.nudgeHint();
      return;
    }
    this.state = 'spin';
    this.spinCount++;
    const syms = this.sim.pull();
    const fever = this.sim.feverActive;
    const timing = fever ? REEL_TIMING.fever : this.settings.fastReel ? REEL_TIMING.fast : REEL_TIMING.normal;
    this.machine.pullLever();
    this.machine.leverShake = 0;
    audio.leverPull();
    this.machine.spinStart(fever || this.settings.fastReel);
    this.camfx.impulse(0, 0.6);
    const tease = syms[0] === syms[1] && !fever;
    const stops = [...timing.stops];
    if (tease) stops[2] += timing.tease;
    audio.reelSpin(stops[2], fever);
    stops.forEach((ms, i) => {
      this.tl.after(ms, () => {
        this.machine.stopReel(i, syms[i]);
        const special = i > 0 && syms[i] === syms[i - 1];
        audio.reelStop(i, special);
        this.camfx.impulse(0, 0.35);
        if (i === 1 && tease) {
          this.machine.reels[2].tease = true;
          audio.tease();
        }
        if (i === 2 && syms[0] === syms[1] && syms[1] === syms[2]) {
          this.machine.megaFlash = 500;
          this.machine.highlight(0, 2, P.yellow, 700);
        }
      });
    });
    this.tl.after(stops[2] + 90, () => {
      if (this.advancing) this.pendingResolve = syms;
      else this.resolve(syms);
    });
  }

  private resolve(syms: Sym[]) {
    this.pendingResolve = null;
    const res = this.sim.resolveSpin(syms);
    this.schedule(res);
    this.state = 'resolve';
    this.resolveEnd = this.wt + res.duration + (this.sim.feverActive ? 20 : 60);
    const acts = groupActions(syms, false);
    if (acts.some((a) => a.level >= 3)) this.firstMegaSeen = true;
  }

  schedule(res: Resolution) {
    const base = this.wt;
    for (const e of res.events) this.tl.add(base + e.t, () => this.play(e), true);
  }

  // ------------------------------------------------------------ upgrades & rewards

  openUpgrade() {
    audio.unlock();
    if (this.paused || this.finale) return;
    if (!this.sim.canBuy()) {
      audio.denied();
      return;
    }
    const offers = this.sim.buy();
    if (!offers) return;
    audio.upgrade();
    this.ov.showCards(offers, false, null, (i) => this.pickCard(i));
  }

  openReward() {
    const r = this.sim.openReward();
    if (!r) return;
    if (r.bot) this.bots.sync(true);
    this.ov.showCards(r.offers, true, { layer: r.layer, bot: r.bot }, (i) => this.pickCard(i));
  }

  pickCard(i: number): UpgradeDef | null {
    const po = this.sim.pendingOffer;
    const offer = po?.offers[i];
    const u = this.sim.pick(i);
    if (!u) return null;
    audio.upgrade();
    if (u.swapTo && offer && offer.swapFrom !== undefined && offer.swapFrom >= 0) {
      this.machine.rebuildReelTexture();
      this.machine.animateSwap(offer.swapFrom, u.swapTo);
      audio.reelSwap();
    }
    if (u.bot) this.bots.sync(true);
    this.save();
    // chain more rewards if queued
    this.time.delayedCall(400, () => {
      if (!this.sim.pendingOffer && this.sim.pendingRewards.length && !this.paused) this.openReward();
    });
    return u;
  }

  startFever() {
    audio.unlock();
    if (this.paused || this.finale || !this.sim.feverReady()) return;
    if (this.state !== 'idle' && this.state !== 'resolve') return;
    this.sim.startFever();
    this.feverIntro = 380;
    this.hitstop = 0;
    audio.music?.duck(360);
    this.darkOverlay.setFillStyle(0x000000, 0.35);
    this.camfx.impulse(0, 2);
    this.tl.after(0, () => {}, false);
  }

  private feverGo() {
    this.darkOverlay.setFillStyle(0x000000, 0);
    this.flash.flash(0.5, P.pink);
    this.camfx.shake(3, 200);
    audio.feverStart();
    if (audio.music) audio.music.fever = true;
    this.ov.banner('FEVER!!', '기계 폭주!', P.hotpink, 1200);
    this.machine.megaFlash = 400;
  }

  // ------------------------------------------------------------ main loop

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50) * this.speed;
    let dtw = dt;
    if (this.paused) dtw = 0;
    else if (this.feverIntro > 0) {
      this.feverIntro -= dt;
      dtw = 0;
      if (this.feverIntro <= 0) this.feverGo();
    } else if (this.hitstop > 0) {
      this.hitstop -= dt;
      dtw = 0;
    }
    const ts = dtw > 0 ? this.speed : 0;
    this.tweens.timeScale = ts;
    this.time.timeScale = ts;
    this.wt += dtw;
    this.tl.update(this.wt);

    if (!this.paused) {
      const allowBots = !this.advancing && !this.finale && !this.sim.needsAdvance();
      const botRes = this.sim.tick(dtw, allowBots);
      for (const r of botRes) this.schedule(r);
      for (const n of this.sim.takeNotices()) this.onNotice(n);
    }

    if (this.state === 'resolve' && this.wt >= this.resolveEnd) {
      this.state = 'idle';
      if (this.wt - this.lastSave > 8000) this.save();
    }
    if (this.pendingResolve && !this.advancing) this.resolve(this.pendingResolve);

    if (!this.advancing && !this.paused && !this.finale && this.state !== 'resolve' && !this.tl.busy() && this.sim.needsAdvance()) this.doAdvance();

    if (this.sim.feverActive && this.state === 'idle' && !this.advancing && !this.paused && this.feverIntro <= 0 && !this.finale) this.pull(true);

    // reconcile the displayed ore counter when nothing is in flight
    if (this.loot.flying === 0 && !this.tl.busy() && this.state === 'idle') this.sim.unseen = 0;

    // FEVER compresses effects near its end
    const feverEnding = this.sim.feverActive && this.sim.feverLeft < 1500;
    this.parts.mult = this.settings.particles * (this.settings.reducedMotion ? 0.6 : 1) * (feverEnding ? 0.6 : 1);

    this.field.update(dtw, this.sim.target, this.hintCell(), !this.paused && this.sim.tutorial >= 2);
    this.loot.update(dtw);
    this.parts.update(dtw);
    this.rings.update(dtw);
    this.flash.update(dt);
    this.camfx.update(dtw > 0 ? dtw : 0);
    this.updateProjectiles(dtw);
    this.bots.update(dtw);
    const fm = this.sim.feverMax();
    this.machine.update(dtw, {
      canPull: this.canPullNow() && !this.sim.feverActive,
      spinning: this.state !== 'idle',
      fever: this.sim.feverActive,
      feverFrac: this.sim.feverUnlocked ? Math.min(1, this.sim.fever / fm) : 0,
      feverReady: this.sim.feverReady(),
      feverLeftFrac: this.sim.feverActive ? this.sim.feverLeft / this.sim.feverDuration() : 0,
      upgradeVisible: this.sim.tutorial >= 2,
      mega: false,
    });
    this.drawFeverFx();
    if (this.finaleT >= 0) this.updateFinale(dtw);

    this.tipTimer -= dtw;
    if (this.tipTimer <= 0) {
      this.tipTimer = 500;
      this.checkTips();
    }
    // music intensity follows fever charge
    if (audio.music && this.sim.feverUnlocked && !this.sim.feverActive && this.sim.fever / fm > 0.9) audio.music.bump(0.01);
    if (this.wt - this.lastSave > 15000 && this.state === 'idle') this.save();
  }

  private doAdvance() {
    this.advancing = true;
    const res = this.sim.advance();
    const more = this.sim.needsAdvance();
    const ms = more ? 80 : 130;
    this.field.advance(res, ms, (s) => this.crushFx(s));
    for (const cr of res.crushed) if (cr.value > 0) this.loot.direct({ x: cr.cell.c * TILE + 8, y: FIELD_H - 4 }, cr.value, 'ore', 1);
    this.loot.shift(res.pushedLoot);
    this.machine.treadSpeed = 0.18;
    audio.advance();
    this.camfx.impulse(0, 0.5);
    this.tl.after(ms + 12, () => {
      this.advancing = false;
    });
  }

  private crushFx(s: TileSpr) {
    const x = cellCX(s.c);
    const y = FIELD_BOTTOM - 4;
    this.parts.burst(2, () => ({ key: 'dust', frames: 5, x: x + (Math.random() - 0.5) * 12, y, vx: (Math.random() - 0.5) * 30, vy: -20, life: 400, depth: D.debris }));
  }

  // ------------------------------------------------------------ notices

  private onNotice(n: Notice) {
    switch (n.k) {
      case 'tutorial':
        if (n.step === 2) {
          this.save();
          this.time.delayedCall(2600, () => this.ov.banner('더 깊이!', '부술수록 기계가 내려가요', P.amber, 1800));
        }
        break;
      case 'feverUnlocked':
        this.machine.feverOpening = true;
        this.ov.banner('FEVER 게이지', '돌을 부수면 차올라요', P.pink, 1800);
        audio.upgrade();
        break;
      case 'feverReady':
        audio.feverReady();
        this.ov.feverReady();
        break;
      case 'feverEnd':
        audio.feverEnd();
        if (audio.music) audio.music.fever = false;
        this.flash.flash(0.2, P.magenta);
        break;
      case 'botUnlocked': {
        const names: Record<BotKind, string> = { drill: '드릴 봇', bomb: '폭탄 봇', magnet: '자석 봇' };
        const desc: Record<BotKind, string> = { drill: '약한 돌을 알아서 뚫어요', bomb: 'GAS와 폭탄돌을 노려요', magnet: '떨어진 광석을 주워와요' };
        this.ov.banner(`${names[n.bot]} 합류!`, desc[n.bot], P.green, 2000);
        break;
      }
      case 'layer': {
        audio.layerClear();
        this.field.setLayer(n.to);
        audio.music?.setLayer(n.to);
        this.flash.flash(0.35, P.white);
        this.camfx.shake(3, 250);
        this.ov.layerBanner(n.to);
        this.save();
        this.time.delayedCall(2700, () => {
          if (!this.sim.pendingOffer && !this.paused) this.openReward();
        });
        break;
      }
      case 'coreLocked':
        this.field.syncHeart();
        if (audio.music) audio.music.core = true;
        this.ov.banner('HEART CORE', '드릴로 깨고 · 폭탄으로 터뜨리고 · 자석으로 뽑아!', P.magenta, 3000);
        this.camfx.shake(4, 400);
        break;
    }
  }

  private checkTips() {
    if (this.sim.tutorial < 1 || this.paused || this.state !== 'idle' || this.tl.busy() || this.ov.tipActive) return;
    for (const tt of Object.keys(TIP_TEXT) as TileType[]) {
      if (this.sim.seenTips.includes(tt)) continue;
      if (tt === 'hard' && this.sim.tutorial < 2) continue;
      const cells = this.sim.mine.find((t, c, r) => t.t === tt && r >= 2 && r <= ROWS - 2 && c > 1 && c < COLS - 2);
      if (!cells.length) continue;
      const cell = tt === 'gas' && this.sim.tutorial === 1 ? { c: 19, r: 4 } : cells[Math.floor(cells.length / 2)];
      this.sim.seenTips.push(tt);
      this.ov.tip(cellCX(cell.c), cellCY(cell.r), TIP_TEXT[tt]!, tt);
      return;
    }
  }

  // ------------------------------------------------------------ arrival

  private onArrive(v: number, kind: string, big: boolean) {
    this.sim.arrive(v);
    this.machine.oreArrived();
    audio.pickup(kind);
    if (Math.random() < 0.5 || big) this.parts.spawn({ key: 'spark', frames: 3, x: NOZZLE.x + (Math.random() - 0.5) * 8, y: NOZZLE.y - 4, vy: -30, life: 160, depth: D.lootFly });
    if (big) {
      this.rings.add(NOZZLE.x, NOZZLE.y - 4, 3, 14, 200, kind === 'core' ? P.pink : P.yellow, 1, 0.9);
      this.camfx.impulse(0, 0.5);
    }
  }

  // ------------------------------------------------------------ event playback

  private play(e: GEvent) {
    switch (e.k) {
      case 'act':
        this.machine.highlight(e.reels[0], e.reels[1], SYM_COLOR[e.sym], e.level >= 3 ? 900 : 500);
        break;
      case 'mega':
        this.megaFx(e.sym);
        break;
      case 'drillLaunch':
        this.onDrillLaunch(e);
        break;
      case 'drillStep':
        this.onDrillStep(e);
        break;
      case 'drillBounce': {
        const x = e.wall ? cellCX(e.cell.c) + (e.dir.dx !== 0 ? -e.dir.dx * 8 : 0) : cellCX(e.cell.c);
        const y = e.wall ? cellCY(e.cell.r) + (e.dir.dy > 0 ? -8 : 0) : cellCY(e.cell.r);
        this.rings.add(x, y, 2, 12, 180, e.wall ? P.white : P.pink, 1, 1);
        this.parts.burst(6, () => ({ key: 'spark', frames: 3, x, y, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, drag: 0.08, life: 240 }));
        audio.bounce();
        const d = this.drills.get(e.line);
        if (d) this.orientDrill(d, e.dir);
        break;
      }
      case 'drillEnd': {
        const d = this.drills.get(e.line);
        if (d) {
          d.fade = 160;
          this.drills.delete(e.line);
          this.fadingDrills.push(d);
          this.parts.burst(4, () => ({ key: 'spark', frames: 3, x: d.x, y: d.y, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 120, g: 300, life: 260 }));
        }
        break;
      }
      case 'hit':
        this.field.hit(e.id, e.hp, e.maxHp);
        this.debris(e.cell, e.id, 2, e.cause === 'drill' ? 1 : 0.6);
        audio.crack();
        break;
      case 'pass': {
        this.field.pass(e.id);
        const x = cellCX(e.cell.c);
        const y = cellCY(e.cell.r);
        this.parts.burst(2, () => ({ key: 'gaspuff', frames: 5, x: x + (Math.random() - 0.5) * 10, y, vy: -25, life: 420 }));
        break;
      }
      case 'break':
        this.onBreak(e);
        break;
      case 'rip': {
        this.field.remove(e.id);
        this.loot.rip({ x: e.cell.c * TILE + 8, y: e.cell.r * TILE + 8 }, e.layer, e.tt, e.value, e.delay);
        const x = cellCX(e.cell.c);
        const y = cellCY(e.cell.r);
        this.parts.burst(3, () => ({ key: 'deb_gold_0', x, y, vx: (Math.random() - 0.5) * 80, vy: -40 - Math.random() * 60, g: 400, life: 400, fade: true }));
        break;
      }
      case 'bombLaunch':
        this.onBombLaunch(e);
        break;
      case 'fuse': {
        const b = this.findBomb(e.at);
        if (b) b.fuse = e.ms;
        audio.fuse(e.ms);
        if (e.level >= 3) {
          audio.music?.duck(e.ms + 120);
          this.darkOverlay.setFillStyle(0x000000, 0.25 * this.flash.mult + 0.05);
          this.tl.after(e.ms, () => this.darkOverlay.setFillStyle(0x000000, 0), false);
        }
        break;
      }
      case 'explode':
        this.onExplode(e);
        break;
      case 'shard': {
        const fx = FIELD_X + e.from.x;
        const fy = FIELD_Y + e.from.y;
        const tx = FIELD_X + e.to.x;
        const ty = FIELD_Y + e.to.y;
        const s = e.ms / 1000;
        this.parts.spawn({ key: 'loot_shard', x: fx, y: fy, vx: (tx - fx) / s, vy: (ty - fy) / s, life: e.ms, depth: D.fx });
        for (let i = 1; i <= 3; i++) this.parts.spawn({ key: 'spark', frames: 3, x: fx + ((tx - fx) * i) / 4, y: fy + ((ty - fy) * i) / 4, life: 160, delay: (e.ms * i) / 4 });
        audio.shardZing();
        break;
      }
      case 'magnetLaunch':
        this.onMagnetLaunch(e);
        break;
      case 'magnetPulse': {
        const x = FIELD_X + e.at.x;
        const y = FIELD_Y + e.at.y;
        const R = e.storm ? 420 : e.radius;
        for (let i = 0; i < (e.storm ? 5 : 3); i++) this.rings.add(x, y, R, 6, 420, i % 2 ? P.red : P.sky, e.storm ? 2 : 1, 0.9, i * 110);
        if (e.storm) {
          this.flash.flash(0.25, P.sky);
          this.camfx.shake(3, 500);
          this.loot.storm = true;
          this.tl.after(1200, () => (this.loot.storm = false), false);
        }
        this.parts.burst(8, (i) => {
          const a = (i / 8) * Math.PI * 2;
          return { key: 'spark', frames: 3, x: x + Math.cos(a) * R * 0.6, y: y + Math.sin(a) * R * 0.4, vx: -Math.cos(a) * R * 1.4, vy: -Math.sin(a) * R, life: 400 };
        });
        break;
      }
      case 'lootSpawn':
        this.loot.spawn(e.loot);
        break;
      case 'oreDirect':
        this.loot.direct(e.at, e.value, e.kind, e.n);
        break;
      case 'collect':
        this.loot.collect(e.id, e.delay, e.crashAt);
        break;
      case 'chain':
        this.ov.chain(e.n);
        audio.chainTick(e.n);
        audio.music?.bump(0.06);
        break;
      case 'grow': {
        this.field.addTile(e.tile, e.cell.c, e.cell.r);
        const x = cellCX(e.cell.c);
        const y = cellCY(e.cell.r);
        this.parts.burst(2, () => ({ key: 'spark', frames: 3, x, y, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80, life: 220 }));
        audio.tone({ type: 'square', f0: 180 + Math.random() * 60, f1: 90, dur: 0.06, vol: 0.05 });
        break;
      }
      case 'heart': {
        this.field.setHeartStage(3 - e.left);
        this.loot.heart(e.at, e.delay, e.value);
        if (e.left > 0)
          this.tl.after(
            600,
            () => {
              if (!this.finale) this.ov.banner('다시 굳는다!', '폭탄으로 한 번 더 터뜨려!', P.magenta, 1300);
            },
            false,
          );
        this.hitstop = Math.max(this.hitstop, 45);
        this.flash.flash(0.35, P.pink);
        this.camfx.shake(4, 300);
        audio.heartPull(e.left);
        const x = FIELD_X + e.at.x;
        const y = FIELD_Y + e.at.y;
        this.rings.add(x, y, 10, 60, 400, P.pink, 2, 1);
        this.ov.banner(e.left > 0 ? `CORE ${3 - e.left}/3` : 'CORE 3/3', e.left > 0 ? '한 번 더!' : '', P.pink, 900);
        break;
      }
      case 'finale':
        this.startFinale(e.at);
        break;
      case 'botGo':
        this.bots.go(e.bot, e.slot, e.to, e.ms);
        audio.botBeep(e.bot);
        break;
    }
  }

  // ------------------------------------------------------------ drill

  private fadingDrills: DrillObj[] = [];

  private drillSprite(mega: boolean, x: number, y: number): DrillObj {
    const spr = this.add.sprite(Math.round(x), Math.round(y), mega ? 'mdrill_N' : 'drill_N', 0).setDepth(D.proj);
    return { spr, x, y, fx: x, fy: y, tx: x, ty: y, t: 0, dur: 0, mega, fade: 0 };
  }

  private orientDrill(d: DrillObj, dir: Dir) {
    const diag = dir.dx !== 0 && dir.dy !== 0;
    const base = d.mega ? 'mdrill_' : 'drill_';
    d.spr.setTexture(base + (diag ? 'NE' : 'N'), d.spr.frame.name as unknown as number);
    d.spr.setAngle(0).setFlip(false, false);
    if (diag) d.spr.setFlip(dir.dx < 0, dir.dy > 0);
    else if (dir.dy > 0) d.spr.setFlip(false, true);
    else if (dir.dx > 0) d.spr.setAngle(90);
    else if (dir.dx < 0) d.spr.setAngle(-90);
  }

  private onDrillLaunch(e: Extract<GEvent, { k: 'drillLaunch' }>) {
    const tx = cellCX(e.to.c);
    const ty = cellCY(e.to.r);
    this.machine.aimAt(tx, ty);
    this.machine.kick(e.level >= 3 ? 5 : 3);
    this.machine.flashBarrel();
    audio.drillSpin(e.level);
    this.camfx.impulse(0, e.level >= 3 ? 2 : 0.8);
    const tip = this.machine.barrelTip();
    const d = this.drillSprite(e.level >= 3, tip.x, tip.y);
    d.fx = tip.x;
    d.fy = tip.y;
    d.tx = tx;
    d.ty = ty;
    d.dur = e.flight;
    d.t = 0;
    this.orientDrill(d, e.dir);
    this.pendingLead = d;
    this.parts.burst(4, () => ({ key: 'smoke', frames: 5, x: tip.x, y: tip.y, vx: (Math.random() - 0.5) * 40, vy: -20, life: 300 }));
  }

  private onDrillStep(e: Extract<GEvent, { k: 'drillStep' }>) {
    const x = cellCX(e.cell.c);
    const y = cellCY(e.cell.r);
    let d = this.drills.get(e.line);
    if (!d) {
      if (e.lead && this.pendingLead) {
        d = this.pendingLead;
        this.pendingLead = null;
      } else {
        d = this.drillSprite(e.level >= 3, x - e.dir.dx * 10, y - e.dir.dy * 10);
        this.orientDrill(d, e.dir);
      }
      this.drills.set(e.line, d);
      d.dur = 0;
    }
    d.dur = 0;
    d.tx = x;
    d.ty = y;
    if (!e.hit) return;
    const mega = e.level >= 3;
    // contact flash + directional debris + dust
    this.parts.spawn({ key: 'px', x, y, scale: 14, life: 45, alpha: 0.75, depth: D.fx });
    const n = mega ? 5 : 3;
    this.parts.burst(n, () => ({
      key: 'spark',
      frames: 3,
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: -e.dir.dx * 120 + (Math.random() - 0.5) * 160,
      vy: -e.dir.dy * 120 + (Math.random() - 0.5) * 160,
      drag: 0.06,
      life: 200,
    }));
    this.camfx.impulse(e.dir.dx * (mega ? 0.9 : 0.35), e.dir.dy * (mega ? 0.9 : 0.35));
    audio.drillHit(e.level, 0.9 + Math.random() * 0.25);
    this.machine.kick(1);
    if (mega && !this.megaDrillHit) {
      this.megaDrillHit = true;
      this.hitstop = Math.max(this.hitstop, 55);
      this.flash.flash(0.3, P.white);
      this.camfx.shake(4, 200);
      this.tl.after(1200, () => (this.megaDrillHit = false), false);
    }
  }
  private megaDrillHit = false;

  // ------------------------------------------------------------ bombs

  private onBombLaunch(e: Extract<GEvent, { k: 'bombLaunch' }>) {
    let sx = FIELD_X + e.from.x;
    let sy = FIELD_Y + e.from.y;
    const ex = FIELD_X + e.to.x;
    const ey = FIELD_Y + e.to.y;
    if (!e.small) {
      this.machine.aimAt(ex, ey);
      this.machine.kick(e.level >= 3 ? 5 : 3);
      this.machine.flashBarrel();
      const tip = this.machine.barrelTip();
      sx = tip.x;
      sy = tip.y;
      audio.tone({ type: 'sine', f0: 220, f1: 80, dur: 0.14, vol: 0.35 });
      this.parts.burst(3, () => ({ key: 'smoke', frames: 5, x: sx, y: sy, vx: (Math.random() - 0.5) * 40, vy: -20, life: 300 }));
    } else audio.tone({ type: 'square', f0: 600, f1: 300, dur: 0.06, vol: 0.05 });
    const big = e.level >= 3;
    const spr = this.add.sprite(Math.round(sx), Math.round(sy), e.small ? 'bomblet' : 'bomb', 0).setDepth(D.proj);
    if (big) spr.setScale(2);
    const dist = Math.hypot(ex - sx, ey - sy);
    this.bombs.push({ spr, sx, sy, ex, ey, t: 0, dur: e.flight, peak: e.small ? 14 : Math.min(60, 20 + dist * 0.25), small: e.small, level: e.level, fuse: 0, done: false });
  }

  private findBomb(at: Pt): BombObj | undefined {
    const x = FIELD_X + at.x;
    const y = FIELD_Y + at.y;
    return this.bombs.find((b) => !b.done && Math.abs(b.ex - x) < 3 && Math.abs(b.ey - y) < 3);
  }

  private onExplode(e: Extract<GEvent, { k: 'explode' }>) {
    const x = FIELD_X + e.at.x;
    const y = FIELD_Y + e.at.y;
    const b = this.findBomb(e.at);
    if (b) {
      b.done = true;
      b.spr.destroy();
    }
    const rpx = e.radius * TILE;
    if (e.kind === 'shock') {
      this.rings.add(x, y, rpx * 0.6, rpx * 1.1, 320, P.white, 2, 0.9);
      this.rings.add(x, y, rpx * 0.5, rpx, 380, P.amber, 1, 0.7, 40);
      this.parts.burst(14, (i) => {
        const a = (i / 14) * Math.PI * 2;
        return { key: 'dust', frames: 5, x: x + Math.cos(a) * rpx * 0.7, y: y + Math.sin(a) * rpx * 0.7, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 10, life: 500 };
      });
      return;
    }
    this.lastBlast = { x, y, t: this.wt };
    const scheme = e.kind === 'gas' ? 'gas' : e.kind === 'bombrock' ? 'red' : 'fire';
    const ek = explosionKey(scheme, rpx * 0.85);
    const mega = e.kind === 'mega';
    const life = mega ? 620 : e.kind === 'bomb' ? 420 : 340;
    this.parts.spawn({ key: ek.key, frames: 8, x, y, life, depth: D.fx, scale: mega && ek.r < rpx * 0.7 ? 2 : 1 });
    if (mega) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.5;
        const k2 = explosionKey('fire', rpx * 0.45);
        this.parts.spawn({ key: k2.key, frames: 8, x: x + Math.cos(a) * rpx * 0.5, y: y + Math.sin(a) * rpx * 0.5, life: 480, depth: D.fx, delay: 60 + i * 50 });
      }
    }
    // shockwave (chain explosions get a lighter ring so long chains stay readable)
    if (e.kind === 'gas' || e.kind === 'bomblet') this.rings.add(x, y, 4, rpx * 1.2, 180, P.yellow, 1, 0.45);
    else this.rings.add(x, y, 4, rpx * 1.35, mega ? 360 : 220, P.white, mega ? 3 : 1, 0.95);
    if (mega || e.kind === 'bomb') this.rings.add(x, y, 2, rpx * 1.1, mega ? 420 : 260, P.amber, 1, 0.8, 50);
    // smoke
    this.parts.burst(mega ? 10 : 3, () => ({ key: 'smoke', frames: 5, x: x + (Math.random() - 0.5) * rpx, y: y + (Math.random() - 0.5) * rpx, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 20, life: 500 + Math.random() * 300, delay: 120 }));
    this.loot.impulse(x, y, rpx * 1.8, mega ? 420 : 220);
    const chainK = Math.min(1, e.chain / 30);
    switch (e.kind) {
      case 'mega':
        this.hitstop = Math.max(this.hitstop, 70);
        this.flash.flash(0.6, P.white);
        this.camfx.shake(7, 320);
        audio.explosion(4, 'bomb');
        audio.music?.bump(0.5);
        break;
      case 'bomb':
        this.flash.flash(0.15 + e.power * 0.05, P.white);
        this.camfx.shake(2 + e.power, 150);
        audio.explosion(e.power + 1, 'bomb');
        audio.music?.bump(0.15);
        break;
      case 'gas':
        this.flash.flash(0.06 + chainK * 0.1, P.yellow);
        this.camfx.shake(1.2 + chainK * 2, 90);
        audio.gasChain(e.chain);
        break;
      case 'bombrock':
        this.flash.flash(0.12, P.red);
        this.camfx.shake(2.5, 130);
        audio.explosion(2, 'red');
        break;
      case 'tip':
      case 'bomblet':
      case 'bot':
        this.flash.flash(0.05, P.white);
        this.camfx.shake(1.2, 80);
        audio.explosion(1, 'small');
        break;
    }
  }

  // ------------------------------------------------------------ magnet

  private onMagnetLaunch(e: Extract<GEvent, { k: 'magnetLaunch' }>) {
    const ex = FIELD_X + e.to.x;
    const ey = FIELD_Y + e.to.y;
    this.machine.aimAt(ex, ey);
    this.machine.kick(2);
    this.machine.flashBarrel();
    const tip = this.machine.barrelTip();
    const spr = this.add.image(Math.round(tip.x), Math.round(tip.y), 'magnet_head').setDepth(D.proj);
    if (e.level >= 3) spr.setScale(2);
    this.mags.push({ spr, sx: tip.x, sy: tip.y, ex, ey: ey - 4, t: 0, dur: e.flight, state: 'fly', hold: e.level >= 3 ? 1000 : 700 });
    audio.magnetHum(e.flight + 800, e.level >= 3);
  }

  // ------------------------------------------------------------ breaking

  private debris(cell: Cell, _id: number, n: number, speed: number) {
    const x = cellCX(cell.c);
    const y = cellCY(cell.r);
    const li = this.sim.layer;
    this.parts.burst(n, () => ({
      key: `deb_${li}_${Math.floor(Math.random() * 3)}`,
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 120 * speed,
      vy: (-40 - Math.random() * 100) * speed,
      g: 520,
      life: 450,
      floor: FIELD_BOTTOM - 2,
      fade: true,
    }));
  }

  private onBreak(e: Extract<GEvent, { k: 'break' }>) {
    const s = this.field.remove(e.id);
    const x = cellCX(e.cell.c);
    const y = cellCY(e.cell.r);
    const li = s ? s.layer : Math.min(4, e.layer);
    let dx = 0;
    let dy = -1;
    let sp = 120;
    if (e.cause === 'blast' && this.wt - this.lastBlast.t < 300) {
      const vx = x - this.lastBlast.x;
      const vy = y - this.lastBlast.y;
      const d = Math.hypot(vx, vy) || 1;
      dx = vx / d;
      dy = vy / d;
      sp = 170;
    }
    const keyFor = (): string => {
      const v = Math.floor(Math.random() * 2);
      switch (e.tt) {
        case 'gold':
          return Math.random() < 0.6 ? `deb_gold_${v}` : `deb_${li}_${v}`;
        case 'crystal':
          return `deb_crys_${v}`;
        case 'bombrock':
          return Math.random() < 0.5 ? `deb_red_${v}` : `deb_${li}_${v}`;
        case 'armor':
          return `deb_core_0`;
        case 'unstable':
          return `deb_core_1`;
        default:
          return `deb_${li}_${Math.floor(Math.random() * 3)}`;
      }
    };
    if (e.tt === 'gas') {
      this.parts.burst(3, () => ({ key: 'gaspuff', frames: 5, x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10, vx: (Math.random() - 0.5) * 40, vy: -30, life: 380 }));
    } else if (e.cause !== 'crush') {
      const n = e.tt === 'hard' || e.tt === 'armor' ? 6 : e.cause === 'core' ? 2 : 4;
      this.parts.burst(n, () => ({
        key: keyFor(),
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: dx * sp * (0.5 + Math.random()) + (Math.random() - 0.5) * 110,
        vy: dy * sp * (0.5 + Math.random()) - 60 - Math.random() * 80,
        g: 560,
        life: 520 + Math.random() * 300,
        floor: FIELD_BOTTOM - 2,
        bounce: 0.35,
        fade: true,
      }));
      this.parts.spawn({ key: 'dust', frames: 5, x, y, vx: 0, vy: -12, life: 360 });
      if (e.tt === 'crystal') this.parts.burst(4, () => ({ key: 'spark', frames: 3, x, y, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, drag: 0.05, life: 300 }));
    }
    this.parts.spawn({ key: 'px', x, y, scale: 12, life: 40, alpha: 0.5, depth: D.fx });
    audio.rockBreak(e.tt, 0.85 + Math.random() * 0.35);
    if (e.cause === 'drill') this.camfx.impulse(0, -0.15);
  }

  private smallImpact(x: number, y: number) {
    this.parts.burst(3, () => ({ key: 'spark', frames: 3, x, y, vx: (Math.random() - 0.5) * 140, vy: (Math.random() - 0.5) * 140, life: 200 }));
  }

  // ------------------------------------------------------------ projectiles

  private updateProjectiles(dt: number) {
    const t = this.wt;
    for (const d of this.drills.values()) this.moveDrill(d, dt, t);
    if (this.pendingLead) this.moveDrill(this.pendingLead, dt, t);
    for (let i = this.fadingDrills.length - 1; i >= 0; i--) {
      const d = this.fadingDrills[i];
      d.fade -= dt;
      this.moveDrill(d, dt, t);
      d.spr.setAlpha(Math.max(0, d.fade / 160));
      if (d.fade <= 0) {
        d.spr.destroy();
        this.fadingDrills.splice(i, 1);
      }
    }
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      if (b.done) {
        this.bombs.splice(i, 1);
        continue;
      }
      b.t += dt;
      const u = Math.min(1, b.t / b.dur);
      const x = b.sx + (b.ex - b.sx) * u;
      const y = b.sy + (b.ey - b.sy) * u - Math.sin(u * Math.PI) * b.peak;
      b.spr.setPosition(Math.round(x), Math.round(y));
      b.spr.setFrame(Math.floor(t / 60) % 2);
      if (u >= 1 && b.fuse > 0) {
        b.fuse -= dt;
        const blink = Math.floor(b.fuse / 45) % 2 === 0;
        if (blink) b.spr.setTintFill(P.white);
        else b.spr.clearTint();
        const sh = b.level >= 3 ? (Math.floor(t / 30) % 2 ? 1 : -1) : 0;
        b.spr.x += sh;
        if (Math.random() < 0.3) this.parts.spawn({ key: 'spark', frames: 3, x: x + 3, y: y - 5, vx: (Math.random() - 0.5) * 60, vy: -40, life: 160 });
      }
      if (b.t > b.dur + 3000) {
        b.spr.destroy();
        this.bombs.splice(i, 1);
      }
    }
    for (let i = this.mags.length - 1; i >= 0; i--) {
      const m = this.mags[i];
      m.t += dt;
      if (m.state === 'fly') {
        const u = Math.min(1, m.t / m.dur);
        const e = 1 - (1 - u) * (1 - u);
        m.spr.setPosition(Math.round(m.sx + (m.ex - m.sx) * e), Math.round(m.sy + (m.ey - m.sy) * e));
        if (u >= 1) {
          m.state = 'hover';
          m.t = 0;
        }
      } else if (m.state === 'hover') {
        m.spr.setPosition(Math.round(m.ex + (Math.floor(t / 40) % 2 ? 1 : 0)), Math.round(m.ey + Math.sin(t / 80)));
        if (Math.random() < 0.25) this.parts.spawn({ key: 'spark', frames: 3, x: m.ex + (Math.random() - 0.5) * 12, y: m.ey + 8, vy: 20, life: 150 });
        if (m.t > m.hold) {
          m.state = 'back';
          m.t = 0;
        }
      } else {
        const u = Math.min(1, m.t / 260);
        const tip = this.machine.barrelTip();
        m.spr.setPosition(Math.round(m.ex + (tip.x - m.ex) * u * u), Math.round(m.ey + (tip.y - m.ey) * u * u));
        if (u >= 1) {
          m.spr.destroy();
          this.mags.splice(i, 1);
        }
      }
    }
  }

  private moveDrill(d: DrillObj, dt: number, t: number) {
    if (d.dur > 0) {
      d.t += dt;
      const u = Math.min(1, d.t / d.dur);
      const e = u * u;
      d.x = d.fx + (d.tx - d.fx) * e;
      d.y = d.fy + (d.ty - d.fy) * e;
      if (Math.random() < 0.5) this.parts.spawn({ key: 'spark', frames: 3, x: d.x, y: d.y, life: 120 });
    } else {
      const k = Math.min(1, dt / 22);
      d.x += (d.tx - d.x) * k;
      d.y += (d.ty - d.y) * k;
    }
    d.spr.setFrame(Math.floor(t / 28) % 4);
    d.spr.setPosition(Math.round(d.x), Math.round(d.y));
  }

  // ------------------------------------------------------------ MEGA / FEVER visuals

  private megaFx(sym: Sym) {
    this.machine.megaFlash = 700;
    this.machine.highlight(0, 2, P.yellow, 900);
    this.flash.flash(0.35, P.yellow);
    this.camfx.shake(3, 180);
    audio.mega(sym);
    audio.music?.bump(0.5);
    this.ov.mega(sym);
  }

  private drawFeverFx() {
    const g = this.feverFx;
    g.clear();
    if (!this.sim.feverActive) return;
    const t = this.wt;
    const cols = [P.hotpink, P.orange, P.yellow, P.magenta];
    const beat = Math.floor(t / (60000 / 124 / 2)) % 2;
    for (let i = 0; i < 4; i++) {
      const c = cols[(i + Math.floor(t / 90)) % cols.length];
      const a = (0.5 - i * 0.11) * (beat ? 1 : 0.75);
      g.lineStyle(1, c, a).strokeRect(FIELD_X + i + 0.5, FIELD_Y + i + 0.5, FIELD_W - i * 2 - 1, FIELD_H - i * 2 - 1);
    }
    g.fillStyle(P.magenta, beat ? 0.06 : 0.03).fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
    if (Math.random() < 0.3) {
      const x = FIELD_X + Math.random() * FIELD_W;
      this.parts.spawn({ key: 'spark', frames: 3, x, y: FIELD_Y + 2, vy: 60 + Math.random() * 60, life: 500, depth: D.fx });
    }
  }

  // ------------------------------------------------------------ finale

  private startFinale(at: Pt) {
    this.finale = true;
    this.finaleT = 0;
    this.finaleAt = { x: FIELD_X + at.x, y: FIELD_Y + at.y };
    this.ov.clearBanners();
    audio.music?.duck(1900);
    this.machine.lampMode = 'idle';
    this.save();
  }
  private finaleAt = { x: 0, y: 0 };
  private finaleStage = 0;

  private updateFinale(dt: number) {
    this.finaleT += dt;
    const t = this.finaleT;
    const { x, y } = this.finaleAt;
    const g = this.finaleG;
    g.clear();
    // cracks & light rays leaking out
    if (t < 1900) {
      const k = Math.min(1, t / 1700);
      const rays = 10;
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2 + t / 2000;
        const len = 20 + k * 260 * (0.6 + 0.4 * Math.sin(i * 7));
        g.lineStyle(i % 2 ? 1 : 2, i % 3 ? P.yellow : P.white, 0.25 + k * 0.6);
        g.lineBetween(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
      }
      if (this.field.heart) this.field.heart.x = x + (Math.floor(t / 30) % 2 ? 1 : -1) * Math.ceil(k * 2);
      const stages = [300, 800, 1300];
      while (this.finaleStage < stages.length && t >= stages[this.finaleStage]) {
        audio.coreCrack(this.finaleStage);
        this.flash.flash(0.2 + this.finaleStage * 0.1, P.white);
        this.camfx.shake(2 + this.finaleStage, 200);
        this.field.setHeartStage(3);
        this.finaleStage++;
      }
    } else if (this.finaleStage < 4) {
      this.finaleStage = 4;
      this.hitstop = 140;
      this.flash.flash(0.85, P.white);
      this.camfx.shake(10, 900);
      audio.coreBreak();
      if (this.field.heart) this.field.heart.setVisible(false);
      for (let i = 0; i < 3; i++) this.rings.add(x, y, 6, 480, 900 + i * 200, i === 1 ? P.pink : P.white, 3, 1, i * 120);
      this.parts.spawn({ key: 'ex_core_72', frames: 8, x, y, life: 900, scale: 2, depth: D.fx });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.parts.spawn({ key: 'ex_fire_50', frames: 8, x: x + Math.cos(a) * 90, y: y + Math.sin(a) * 60, life: 600, depth: D.fx, delay: 100 + i * 60 });
      }
      this.bots.party();
      if (audio.music) {
        audio.music.climax = true;
        audio.music.core = true;
      }
      this.rain = 4200;
    }
    if (this.rain > 0) {
      this.rain -= dt;
      const kinds = ['loot_ore', 'loot_gold', 'loot_shard', 'loot_core'];
      this.parts.burst(2, () => ({
        key: kinds[Math.floor(Math.random() * kinds.length)],
        frame: 0,
        x: FIELD_X + Math.random() * FIELD_W,
        y: FIELD_Y - 4,
        vx: (Math.random() - 0.5) * 40,
        vy: 40 + Math.random() * 120,
        g: 300,
        life: 1400,
        floor: FIELD_BOTTOM - 3,
        bounce: 0.4,
        depth: D.lootFly,
      }));
    }
    if (t > 7200 && this.finaleStage === 4) {
      this.finaleStage = 5;
      this.finaleG.clear();
      this.save();
      this.ov.showResults();
    }
  }

  continueEndless() {
    this.sim.startEndless();
    this.finale = false;
    this.finaleT = -1;
    this.finaleStage = 0;
    this.bots.calm();
    if (audio.music) {
      audio.music.climax = false;
      audio.music.core = false;
    }
    this.field.syncHeart();
    this.save();
  }

  newGame() {
    this.noSave = true;
    clearSave();
    const p = new URLSearchParams(location.search);
    p.delete('reset');
    p.delete('seed');
    const q = p.toString();
    location.href = location.pathname + (q ? '?' + q : '');
  }
}
