import { Game, SAVE_VERSION, type SaveData } from './sim/game';

const SAVE_KEY = 'corebreak.save.v1';
const SETTINGS_KEY = 'corebreak.settings.v1';

export interface Settings {
  v: number;
  shake: number; // 0..1
  flash: number; // 0..1
  particles: number; // 0.25..1
  reducedMotion: boolean;
  master: number;
  music: number;
  sfx: number;
  fastReel: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  v: 1,
  shake: 1,
  flash: 1,
  particles: 1,
  reducedMotion: false,
  master: 0.8,
  music: 0.6,
  sfx: 0.8,
  fastReel: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      return { ...DEFAULT_SETTINGS, reducedMotion: reduce };
    }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage full or disabled */
  }
}

const BACKUP_KEY = SAVE_KEY + '.bak';

function tryLoad(key: string): Game | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const d = JSON.parse(raw) as SaveData;
  if (d.v !== SAVE_VERSION) {
    console.warn(`[COREBREAK] save "${key}" has version ${d.v}, expected ${SAVE_VERSION}`);
    return null;
  }
  return Game.load(d);
}

/** Load the main save, falling back to the previous good save if the main one is missing or broken. */
export function loadGame(): Game | null {
  for (const key of [SAVE_KEY, BACKUP_KEY]) {
    try {
      const g = tryLoad(key);
      if (g) {
        console.info(`[COREBREAK] loaded save (${key}) depth ${g.depthMeters}m`);
        return g;
      }
    } catch (e) {
      console.warn(`[COREBREAK] save "${key}" failed to load`, e);
    }
  }
  console.info('[COREBREAK] no save found, starting a new game');
  return null;
}

export function saveGame(g: Game): boolean {
  try {
    const prev = localStorage.getItem(SAVE_KEY);
    localStorage.setItem(SAVE_KEY, JSON.stringify(g.serialize()));
    if (prev) localStorage.setItem(BACKUP_KEY, prev);
    return true;
  } catch (e) {
    console.warn('[COREBREAK] save failed', e);
    return false;
  }
}

export function clearSave() {
  try {
    console.info('[COREBREAK] save cleared');
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(BACKUP_KEY);
  } catch {
    /* ignore */
  }
}
