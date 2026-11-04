/**
 * js/fx.js
 * Parlour Audio & Tactile Effects Engine
 * Mechanical clicks, physical dice rattles, tactile pawn thuds & paper confetti
 */
import { SettingsStore } from './core/store.js';

export const FXEngine = {
  audioCtx: null,
  musicBus: null,
  sfxBus: null,
  compressor: null,

  droneNodes: null,
  isDronePlaying: false,

  canvas: null,
  ctx: null,
  particles: [],
  animFrame: null,

  init() {
    this.canvas = document.getElementById('fxCanvas');
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }

    const unlock = () => {
      this.ensureAudioContext();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  },

  ensureAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtxClass();

      // Master Compressor for clean speaker levels
      this.compressor = this.audioCtx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-20, this.audioCtx.currentTime);
      this.compressor.knee.setValueAtTime(24, this.audioCtx.currentTime);
      this.compressor.ratio.setValueAtTime(8, this.audioCtx.currentTime);
      this.compressor.attack.setValueAtTime(0.005, this.audioCtx.currentTime);
      this.compressor.release.setValueAtTime(0.2, this.audioCtx.currentTime);
      this.compressor.connect(this.audioCtx.destination);

      // Dedicated Music & SFX Gain Busses
      this.musicBus = this.audioCtx.createGain();
      const musicVol = SettingsStore.get('volumeMusic') ?? 0.3;
      this.musicBus.gain.setValueAtTime(musicVol, this.audioCtx.currentTime);
      this.musicBus.connect(this.compressor);

      this.sfxBus = this.audioCtx.createGain();
      const sfxVol = SettingsStore.get('volumeSfx') ?? 0.8;
      this.sfxBus.gain.setValueAtTime(sfxVol, this.audioCtx.currentTime);
      this.sfxBus.connect(this.compressor);
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  },

  startAmbientDrone() {
    // Kept for manual toggle, default disabled
    if (this.isDronePlaying || SettingsStore.get('muted')) return;
    this.ensureAudioContext();
    const ctx = this.audioCtx;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(60, ctx.currentTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(120, ctx.currentTime);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.015, ctx.currentTime + 1.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);

    osc.start();
    this.droneNodes = { osc, gain };
    this.isDronePlaying = true;
  },

  stopAmbientDrone() {
    if (!this.isDronePlaying || !this.droneNodes) return;
    const { osc, gain } = this.droneNodes;
    const ctx = this.audioCtx;

    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.3);

    setTimeout(() => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
      this.droneNodes = null;
      this.isDronePlaying = false;
    }, 320);
  },

  playTone(freq, type = 'triangle', duration = 0.08, vol = 0.12) {
    if (SettingsStore.get('muted')) return;
    this.ensureAudioContext();
    const ctx = this.audioCtx;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.sfxBus);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  },

  diceRoll() {
    if (SettingsStore.get('muted')) return;
    this.ensureAudioContext();
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const rattles = 7;
    const totalDuration = 0.6;

    for (let i = 0; i < rattles; i++) {
      const timeOffset = now + (i * (totalDuration / rattles)) + (Math.random() * 0.02);
      const bufferSize = Math.floor(ctx.sampleRate * 0.035);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);

      for (let j = 0; j < bufferSize; j++) {
        output[j] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1300 + Math.random() * 350, timeOffset);
      filter.Q.setValueAtTime(2.8, timeOffset);

      const gain = ctx.createGain();
      const vol = 0.12 + Math.random() * 0.05;
      gain.gain.setValueAtTime(vol, timeOffset);
      gain.gain.exponentialRampToValueAtTime(0.0001, timeOffset + 0.032);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxBus);

      whiteNoise.start(timeOffset);
      whiteNoise.stop(timeOffset + 0.035);
    }
  },

  diceLand() {
    if (SettingsStore.get('muted')) return;
    this.ensureAudioContext();
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.11);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxBus);

    osc.start(now);
    osc.stop(now + 0.13);
  },

  tokenHop() {
    if (SettingsStore.get('muted')) return;
    this.ensureAudioContext();
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.055);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

    osc.connect(gain);
    gain.connect(this.sfxBus);

    osc.start(now);
    osc.stop(now + 0.07);
  },

  cutOpponent() {
    this.shake('hard');
    if (SettingsStore.get('muted')) return;
    this.ensureAudioContext();
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.28);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxBus);

    osc.start(now);
    osc.stop(now + 0.32);
  },

  shake(intensity = 'soft') {
    if (SettingsStore.get('reducedMotion')) return;
    const target = document.getElementById('viewArena') || document.body;
    const cls = intensity === 'hard' ? 'shake-hard' : 'shake-soft';

    target.classList.remove('shake-soft', 'shake-hard');
    void target.offsetWidth;
    target.classList.add(cls);

    setTimeout(() => target.classList.remove(cls), intensity === 'hard' ? 240 : 150);
  },

  resize() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
  },

  confetti(count = 50) {
    if (SettingsStore.get('reducedMotion') || !this.ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Flat physical token colors
    const colors = ['#E53935', '#43A047', '#FDD835', '#1E88E5', '#00f0ff', '#ffffff'];
    const originX = (window.innerWidth / 2) * dpr;
    const originY = (window.innerHeight * 0.35) * dpr;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 7 + 3) * dpr;
      this.particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (2 * dpr),
        width: (Math.random() * 8 + 4) * dpr,
        height: (Math.random() * 5 + 3) * dpr,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 8,
        opacity: 1
      });
    }

    if (!this.animFrame) this.loopParticles();
  },

  loopParticles() {
    if (this.particles.length === 0) {
      if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.animFrame = null;
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22;
      p.rotation += p.rotSpeed;
      p.opacity *= 0.985;

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.globalAlpha = Math.max(0, p.opacity);

      // Flat rectangular paper ticket with 1px border
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(-p.width / 2, -p.height / 2, p.width, p.height);

      this.ctx.restore();

      if (p.opacity < 0.04 || p.y > this.canvas.height) {
        this.particles.splice(i, 1);
      }
    }

    this.animFrame = requestAnimationFrame(() => this.loopParticles());
  },

  sfx: {
    click() { FXEngine.playTone(840, 'triangle', 0.02, 0.05); },
    tokenHop() { FXEngine.tokenHop(); },
    capture() { FXEngine.cutOpponent(); },
    cutOpponent() { FXEngine.cutOpponent(); },
    diceRoll() { FXEngine.diceRoll(); },
    diceLand() { FXEngine.diceLand(); },
    eat() {
      FXEngine.shake('soft');
      FXEngine.playTone(660, 'triangle', 0.03, 0.12);
    },
    flap() { FXEngine.playTone(520, 'triangle', 0.03, 0.08); },
    victory() {
      FXEngine.confetti(60);
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        setTimeout(() => FXEngine.playTone(f, 'triangle', 0.1, 0.15), i * 80);
      });
    },
    defeat() {
      FXEngine.shake('hard');
      [320, 250, 180, 130].forEach((f, i) => {
        setTimeout(() => FXEngine.playTone(f, 'triangle', 0.1, 0.14), i * 80);
      });
    },
    achievement() {
      FXEngine.confetti(40);
      FXEngine.playTone(784, 'triangle', 0.07, 0.18);
      setTimeout(() => FXEngine.playTone(1046.5, 'triangle', 0.14, 0.2), 80);
    }
  }
};