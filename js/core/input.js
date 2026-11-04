/**
 * js/core/input.js
 * Unified Hardware Input Abstraction
 * Normalized action mapping across Keyboard, Pointer, 24px Swipes and Gamepads.
 */
export class InputManager {
  constructor(targetElement = window) {
    this.target = targetElement;
    this.actions = new Set();
    this.bindings = new Map();
    this.listeners = [];
    this.disposed = false;

    // Pointer gesture coordinates
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.swipeThreshold = 24;

    this.setupDefaults();
    this.bindEvents();
  }

  setupDefaults() {
    this.bind('ArrowUp', 'UP');
    this.bind('KeyW', 'UP');
    this.bind('ArrowDown', 'DOWN');
    this.bind('KeyS', 'DOWN');
    this.bind('ArrowLeft', 'LEFT');
    this.bind('KeyA', 'LEFT');
    this.bind('ArrowRight', 'RIGHT');
    this.bind('KeyD', 'RIGHT');
    this.bind('Space', 'ACTION');
    this.bind('KeyP', 'PAUSE');
    this.bind('Escape', 'BACK');
  }

  bind(code, action) {
    this.bindings.set(code, action);
  }

  bindEvents() {
    const onKeyDown = (e) => {
      if (this.disposed) return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      const action = this.bindings.get(e.code);
      if (action) {
        // Prevent window scroll on arrow keys/space
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
          e.preventDefault();
        }
        this.actions.add(action);
      }
    };

    const onKeyUp = (e) => {
      if (this.disposed) return;
      const action = this.bindings.get(e.code);
      if (action) {
        this.actions.delete(action);
      }
    };

    const onPointerDown = (e) => {
      if (this.disposed) return;
      this.touchStartX = e.clientX;
      this.touchStartY = e.clientY;
    };

    const onPointerUp = (e) => {
      if (this.disposed) return;
      const dx = e.clientX - this.touchStartX;
      const dy = e.clientY - this.touchStartY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (Math.max(absX, absY) >= this.swipeThreshold) {
        if (absX > absY) {
          this.pulseAction(dx > 0 ? 'RIGHT' : 'LEFT');
        } else {
          this.pulseAction(dy > 0 ? 'DOWN' : 'UP');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    this.target.addEventListener('pointerdown', onPointerDown);
    this.target.addEventListener('pointerup', onPointerUp);

    this.listeners.push(
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
      () => this.target.removeEventListener('pointerdown', onPointerDown),
      () => this.target.removeEventListener('pointerup', onPointerUp)
    );
  }

  pulseAction(action) {
    this.actions.add(action);
    setTimeout(() => this.actions.delete(action), 50);
  }

  isDown(action) {
    this.pollGamepad();
    return this.actions.has(action);
  }

  consume(action) {
    this.pollGamepad();
    if (this.actions.has(action)) {
      this.actions.delete(action);
      return true;
    }
    return false;
  }

  pollGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[0];
    if (!gp) return;

    if (gp.buttons[12]?.pressed || gp.axes[1] < -0.4) this.actions.add('UP');
    if (gp.buttons[13]?.pressed || gp.axes[1] > 0.4) this.actions.add('DOWN');
    if (gp.buttons[14]?.pressed || gp.axes[0] < -0.4) this.actions.add('LEFT');
    if (gp.buttons[15]?.pressed || gp.axes[0] > 0.4) this.actions.add('RIGHT');
    if (gp.buttons[0]?.pressed) this.actions.add('ACTION');
    if (gp.buttons[9]?.pressed) this.actions.add('PAUSE');
  }

  dispose() {
    this.disposed = true;
    for (const off of this.listeners) off();
    this.listeners = [];
    this.actions.clear();
  }
}