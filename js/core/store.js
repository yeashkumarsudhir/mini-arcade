// store.js: small settings store that remembers its values in localStorage.
export class Store {
  constructor(storageKey, initialState) {
    this.storageKey = storageKey;
    this.subscribers = new Set();
    this.state = this.load(initialState);
  }

  load(fallback) {
    try {
      const serialized = localStorage.getItem(this.storageKey);
      return serialized ? { ...fallback, ...JSON.parse(serialized) } : fallback;
    } catch {
      return fallback;
    }
  }

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (err) {
      console.warn('Could not save settings:', err);
    }
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    if (this.state[key] !== value) {
      this.state[key] = value;
      this.save();
      this.notify(key, value);
    }
  }

  patch(partial) {
    let changed = false;
    for (const [key, val] of Object.entries(partial)) {
      if (this.state[key] !== val) {
        this.state[key] = val;
        changed = true;
        this.notify(key, val);
      }
    }
    if (changed) this.save();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify(key, value) {
    for (const sub of this.subscribers) {
      try {
        sub(key, value, this.state);
      } catch (err) {
        console.error('Settings listener failed:', err);
      }
    }
  }
}

export const SettingsStore = new Store('mini_arcade_settings', {
  muted: false,
  volumeSfx: 0.15,
  reducedMotion: false,
  haptics: true
});