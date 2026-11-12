// flappy.js: flap through the gaps. Gravity and speed are in pixels per second, so it plays the same on any screen.
import { Pen } from '../core/theme.js';
import { Stats } from '../stats.js';

export default {
  id: 'flappy',
  title: 'Flappy',
  accent: '#f2b705',

  ctx: null,
  container: null,
  canvas: null,
  canvasCtx: null,

  PRESETS: {
    CHILL:  { g: 648, jump: -240, speed: 60,  gate: 145, spawn: 2.67 },
    NORMAL: { g: 792, jump: -270, speed: 84,  gate: 135, spawn: 2.33 },
    HARD:   { g: 936, jump: -300, speed: 114, gate: 120, spawn: 1.92 }
  },

  presetKey: 'NORMAL',
  droneY: 200,
  velocity: 0,
  hoverTime: 0,
  isFlying: false,
  isCrashed: false,
  score: 0,
  bestScore: 0,
  laserPipes: [],
  spawnTimer: 0,
  retryLockTimer: 0,

  mount(el, sessionCtx) {
    this.container = el;
    this.ctx = sessionCtx;

    this.container.innerHTML = `
      <div class="arena-dual-layout">
        <div class="arena-board-frame">
          <canvas id="flappyCanvas" width="400" height="520" style="cursor:pointer;"></canvas>
        </div>

        <div class="arena-side-controls">
          <div class="stat-box" style="text-align:center; padding:14px;">
            <span class="stat-label">Gates passed</span>
            <div id="flappyScoreDisplay" class="stat-value" style="font-size:2.4rem;">0</div>
            <div id="flappyBestDisplay" class="stat-label">Best: 0</div>
          </div>

          <div class="stat-box" style="gap:8px;">
            <span class="stat-label">Speed</span>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn-nav-pill" id="btnFlappyChill" style="flex:1;">Chill</button>
              <button type="button" class="btn-nav-pill is-on" id="btnFlappyNormal" style="flex:1;">Normal</button>
              <button type="button" class="btn-nav-pill" id="btnFlappyHard" style="flex:1;">Hard</button>
            </div>
          </div>

          <div class="stat-label" style="text-align:center;">Tap the board or press Space to flap</div>
        </div>
      </div>
    `;

    this.canvas = document.getElementById('flappyCanvas');
    this.canvasCtx = this.canvas.getContext('2d');

    this.setupListeners();

    this.loop = this.ctx.createLoop(
      (dt) => this.update(dt),
      (alpha) => this.render(alpha)
    );
  },

  start(opts = {}) {
    this.presetKey = opts.preset || 'NORMAL';
    this.setPaceUI(this.presetKey);

    this.droneY = 240;
    this.velocity = 0;
    this.hoverTime = 0;
    this.isFlying = false;
    this.isCrashed = false;
    this.score = 0;
    this.laserPipes = [];
    this.spawnTimer = 0;
    this.retryLockTimer = 0;

    this.loadHighScore();
    this.updateScoreDisplay();

    this.loop.start();
  },

  setPaceUI(key) {
    this.presetKey = key;
    const buttons = { CHILL: 'btnFlappyChill', NORMAL: 'btnFlappyNormal', HARD: 'btnFlappyHard' };
    for (const [name, id] of Object.entries(buttons)) {
      document.getElementById(id)?.classList.toggle('is-on', name === key);
    }
  },

  loadHighScore() {
    this.bestScore = Stats.get('flappy').best;
  },

  setupListeners() {
    document.getElementById('btnFlappyChill')?.addEventListener('click', () => this.start({ preset: 'CHILL' }));
    document.getElementById('btnFlappyNormal')?.addEventListener('click', () => this.start({ preset: 'NORMAL' }));
    document.getElementById('btnFlappyHard')?.addEventListener('click', () => this.start({ preset: 'HARD' }));

    const handleFlap = () => {
      if (this.isCrashed) {
        if (this.retryLockTimer <= 0) {
          this.start({ preset: this.presetKey });
        }
        return;
      }

      if (!this.isFlying) {
        this.isFlying = true;
      }

      const cfg = this.PRESETS[this.presetKey];
      this.velocity = cfg.jump;
      this.ctx.fx.sfx.flap();
    };

    this.canvas.addEventListener('pointerdown', handleFlap);
  },

  update(dt) {
    if (this.isCrashed) {
      if (this.retryLockTimer > 0) {
        this.retryLockTimer -= dt;
      }
      return;
    }

    if (this.ctx.input.consume('ACTION') || this.ctx.input.consume('UP')) {
      if (this.isCrashed) {
        if (this.retryLockTimer <= 0) this.start({ preset: this.presetKey });
      } else {
        if (!this.isFlying) this.isFlying = true;
        const cfg = this.PRESETS[this.presetKey];
        this.velocity = cfg.jump;
        this.ctx.fx.sfx.flap();
      }
    }

    const cfg = this.PRESETS[this.presetKey];

    if (!this.isFlying) {
      this.hoverTime += dt * 4;
      this.droneY = 240 + Math.sin(this.hoverTime) * 12;
      return;
    }

    this.velocity += cfg.g * dt;
    this.droneY += this.velocity * dt;

    if (this.droneY >= this.canvas.height - 20 || this.droneY <= 15) {
      this.handleCrash();
      return;
    }

    this.spawnTimer += dt;
    if (this.spawnTimer >= cfg.spawn) {
      this.spawnTimer = 0;
      this.spawnPipePair(cfg.gate);
    }

    const droneBox = {
      x: 75,
      y: this.droneY,
      radius: 12
    };

    for (let i = this.laserPipes.length - 1; i >= 0; i--) {
      const pipe = this.laserPipes[i];
      pipe.x -= cfg.speed * dt;

      if (!pipe.passed && pipe.x < droneBox.x) {
        pipe.passed = true;
        this.score++;
        this.ctx.fx.playTone(880, 'sine', 0.04, 0.12);
        if (this.score > this.bestScore) this.bestScore = this.score;
        this.updateScoreDisplay();
      }

      if (droneBox.x + droneBox.radius > pipe.x && droneBox.x - droneBox.radius < pipe.x + pipe.width) {
        if (droneBox.y - droneBox.radius < pipe.topH || droneBox.y + droneBox.radius > pipe.topH + pipe.gateH) {
          this.handleCrash();
          return;
        }
      }

      if (pipe.x + pipe.width < -10) {
        this.laserPipes.splice(i, 1);
      }
    }
  },

  spawnPipePair(gateHeight) {
    const minH = 60;
    const maxH = this.canvas.height - gateHeight - minH;
    const topH = Math.floor(Math.random() * (maxH - minH)) + minH;

    this.laserPipes.push({
      x: this.canvas.width + 20,
      width: 48,
      topH,
      gateH: gateHeight,
      passed: false
    });
  },

  handleCrash() {
    this.isCrashed = true;
    this.retryLockTimer = 0.4;

    this.ctx.recordResult('LOSS', {
      score: this.score,
      summary: `You got through ${this.score} ${this.score === 1 ? 'gap' : 'gaps'} (${this.presetKey.toLowerCase()}).`
    });
  },

  updateScoreDisplay() {
    const scoreEl = document.getElementById('flappyScoreDisplay');
    const bestEl = document.getElementById('flappyBestDisplay');
    if (scoreEl) scoreEl.textContent = this.score;
    if (bestEl) bestEl.textContent = `Best: ${this.bestScore}`;
  },

  render(alpha) {
    if (!this.canvasCtx) return;
    const ctx = this.canvasCtx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const P = Pen.get();

    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, w, h);

    // faint vertical lines that scroll past
    ctx.strokeStyle = P.grid;
    ctx.lineWidth = 1;
    const time = performance.now() / 1000;
    const offset = (time * 30) % 36;

    for (let x = -offset; x < w; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // pipes
    this.laserPipes.forEach(p => {
      ctx.fillStyle = P.pipe;
      ctx.fillRect(p.x, 0, p.width, p.topH);
      ctx.strokeStyle = P.ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x, 0, p.width, p.topH);

      ctx.fillStyle = P.pipeLip;
      ctx.fillRect(p.x - 3, p.topH - 12, p.width + 6, 12);
      ctx.strokeRect(p.x - 3, p.topH - 12, p.width + 6, 12);

      const bottomY = p.topH + p.gateH;
      ctx.fillStyle = P.pipe;
      ctx.fillRect(p.x, bottomY, p.width, h - bottomY);
      ctx.strokeRect(p.x, bottomY, p.width, h - bottomY);

      ctx.fillStyle = P.pipeLip;
      ctx.fillRect(p.x - 3, bottomY, p.width + 6, 12);
      ctx.strokeRect(p.x - 3, bottomY, p.width + 6, 12);
    });

    // the bird
    const droneX = 75;
    const droneY = this.droneY;
    const tilt = this.isFlying ? Math.min(Math.PI / 4, Math.max(-Math.PI / 4, this.velocity * 0.002)) : 0;

    ctx.save();
    ctx.translate(droneX, droneY);
    ctx.rotate(tilt);

    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = P.yellow;
    ctx.fill();
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(6, -3, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(7, -3, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = P.ink;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(19, 2);
    ctx.lineTo(12, 5);
    ctx.closePath();
    ctx.fillStyle = P.red;
    ctx.fill();
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // wing
    const wingY = Math.sin(time * 20) * 4;
    ctx.beginPath();
    ctx.ellipse(-4, wingY, 6, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = P.orange;
    ctx.fill();
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();

    // small result card on the canvas after a crash
    if (this.isCrashed) {
      const boxW = 260;
      const boxH = 170;
      const boxX = (w - boxW) / 2;
      const boxY = 150;

      ctx.fillStyle = P.paper;
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = P.ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.textAlign = 'center';
      ctx.font = '700 22px Kalam, sans-serif';
      ctx.fillStyle = P.red;
      ctx.fillText('Crashed', w / 2, boxY + 36);

      ctx.font = '600 13px Mukta, sans-serif';
      ctx.fillStyle = P.dim;
      ctx.fillText('Gaps passed', w / 2, boxY + 64);

      ctx.font = '700 40px Kalam, sans-serif';
      ctx.fillStyle = P.text;
      ctx.fillText(this.score, w / 2, boxY + 106);

      let comment = 'Keep going';
      if (this.score >= 15) comment = 'Great run';
      else if (this.score >= 8) comment = 'Nice one';
      else if (this.score >= 3) comment = 'Not bad';

      ctx.font = '600 13px Mukta, sans-serif';
      ctx.fillStyle = P.blue;
      ctx.fillText(comment, w / 2, boxY + 130);

      ctx.font = '400 12px Mukta, sans-serif';
      ctx.fillStyle = P.dim;
      ctx.fillText(this.retryLockTimer > 0 ? 'Wait a moment...' : 'Tap the board or press Space to retry', w / 2, boxY + 154);
    }
  },

  pause() {
    if (this.loop) this.loop.pause();
  },

  resume() {
    if (this.loop) this.loop.resume();
  },

  restart() {
    this.start({ preset: this.presetKey });
  },

  destroy() {
    if (this.loop) this.loop.stop();
    this.container = null;
    this.canvas = null;
    this.canvasCtx = null;
  }
};