/**
 * js/core/haptics.js
 * Hardware Vibration Adapter with Settings Guard
 */
import { SettingsStore } from './store.js';

export const Haptics = {
  soft() {
    if (!SettingsStore.get('haptics') || !('vibrate' in navigator)) return;
    try { navigator.vibrate(15); } catch {}
  },
  medium() {
    if (!SettingsStore.get('haptics') || !('vibrate' in navigator)) return;
    try { navigator.vibrate(35); } catch {}
  },
  hard() {
    if (!SettingsStore.get('haptics') || !('vibrate' in navigator)) return;
    try { navigator.vibrate([40, 30, 40]); } catch {}
  }
};