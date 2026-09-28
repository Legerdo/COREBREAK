import Phaser from 'phaser';
import { H, W } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { OverlayScene } from './scenes/OverlayScene';

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#0d0a14',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  disableContextMenu: true,
  scale: { mode: Phaser.Scale.NONE, zoom: 1 },
  fps: { target: 60, smoothStep: true },
  audio: { noAudio: true },
  scene: [BootScene, GameScene, OverlayScene],
});

// Integer upscaling keeps every art pixel the same size on screen.
function fit() {
  const z = Math.max(1, Math.floor(Math.min(window.innerWidth / W, window.innerHeight / H)));
  game.scale.setZoom(z);
}
window.addEventListener('resize', fit);
fit();

(window as unknown as { __phaser: Phaser.Game }).__phaser = game;
