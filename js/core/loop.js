/**
 * js/core/loop.js
 * Fixed-Timestep Accumulator Engine (60Hz Logic, Alpha Render Interpolation)
 * Completely decouples simulation physics from display refresh rate (60/120/144 Hz).
 */
export class GameLoop {
  constructor({ onUpdate, onRender }) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;

    this.fixedStep = 1000 / 60; // 16.666ms per update
    this.maxAccumulated = 100;  // Clamps spike lag to 100ms
    this.accumulator = 0;
    this.lastTime = 0;
    this.rafId = null;
    this.isRunning = false;
    this.isPaused = false;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;

    const tick = (now) => {
      if (!this.isRunning) return;

      if (!this.isPaused) {
        let frameDelta = now - this.lastTime;
        if (frameDelta > this.maxAccumulated) frameDelta = this.maxAccumulated;
        this.accumulator += frameDelta;
        this.lastTime = now;

        while (this.accumulator >= this.fixedStep) {
          this.onUpdate(this.fixedStep / 1000);
          this.accumulator -= this.fixedStep;
        }

        const alpha = this.accumulator / this.fixedStep;
        this.onRender(alpha);
      } else {
        this.lastTime = now;
      }

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    if (this.isPaused) {
      this.lastTime = performance.now();
      this.accumulator = 0;
      this.isPaused = false;
    }
  }

  stop() {
    this.isRunning = false;
    this.isPaused = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}