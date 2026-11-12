// One saved game slot per game, kept in localStorage (see storage.js for the fallback).
import { Storage } from './storage.js';

const prefix = 'mini_arcade_save_';

export const SaveGame = {
  write(gameKey, snapshot) {
    try {
      Storage.setItem(prefix + gameKey, JSON.stringify({ savedAt: Date.now(), snapshot }));
      return true;
    } catch {
      return false;
    }
  },

  read(gameKey) {
    try {
      const raw = Storage.getItem(prefix + gameKey);
      return raw ? JSON.parse(raw).snapshot : null;
    } catch {
      return null;
    }
  },

  has(gameKey) {
    return this.read(gameKey) !== null;
  },

  clear(gameKey) {
    Storage.removeItem(prefix + gameKey);
  }
};
