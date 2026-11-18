// Save data in localStorage: story progress, money, reputation, best
// money, and settings. Everything is guarded: private windows and blocked
// storage simply mean the save lasts this visit only.
import { SAVE_KEY, BEST_KEY } from './config.js';

export function defaultSave() {
  return {
    mission: 0,
    money: 250,
    rep: 0,
    day: 1,
    best: 0,
    radio: 0,
    camera: 'chase',
    muted: false,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    return { ...defaultSave(), ...parsed };
  } catch {
    return defaultSave();
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable: the game still plays, it just does not persist.
  }
}

export function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function writeBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Ignore: best money is a nicety, not the save.
  }
}
