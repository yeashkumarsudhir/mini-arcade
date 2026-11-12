// storage.js: localStorage wrapper that keeps working (in memory) if the browser blocks storage.
export class SafeStorage {
  constructor() {
    this.memory = new Map();
    this.available = this.check();
  }

  check() {
    try {
      const test = '__cae_storage_probe__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  getItem(key) {
    if (this.available) {
      try { return localStorage.getItem(key); } catch {}
    }
    return this.memory.get(key) || null;
  }

  setItem(key, value) {
    if (this.available) {
      try {
        localStorage.setItem(key, value);
        return;
      } catch {}
    }
    this.memory.set(key, String(value));
  }

  removeItem(key) {
    if (this.available) {
      try { localStorage.removeItem(key); } catch {}
    }
    this.memory.delete(key);
  }
}

export const Storage = new SafeStorage();