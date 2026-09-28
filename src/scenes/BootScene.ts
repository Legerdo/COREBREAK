import Phaser from 'phaser';
import g11 from 'galmuri/dist/Galmuri11.woff2?url';
import g11b from 'galmuri/dist/Galmuri11-Bold.woff2?url';
import g9 from 'galmuri/dist/Galmuri9.woff2?url';
import g7 from 'galmuri/dist/Galmuri7.woff2?url';
import { buildTextures } from '../art/sprites';

async function loadFonts() {
  const faces = [
    new FontFace('Galmuri11', `url(${g11})`, { weight: '400' }),
    new FontFace('Galmuri11', `url(${g11b})`, { weight: '700' }),
    new FontFace('Galmuri9', `url(${g9})`),
    new FontFace('Galmuri7', `url(${g7})`),
  ];
  await Promise.all(
    faces.map(async (f) => {
      try {
        await f.load();
        document.fonts.add(f);
      } catch (e) {
        console.warn('[COREBREAK] font failed', e);
      }
    }),
  );
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }
  create() {
    buildTextures(this);
    void loadFonts().then(() => {
      document.getElementById('boot')?.remove();
      this.scene.start('Game');
      this.scene.launch('Overlay');
    });
  }
}
