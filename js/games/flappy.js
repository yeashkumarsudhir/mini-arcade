/**
 * js/games/flappy.js
 * Flappy Pilot — Calibrated Tactile Flight Simulator
 * Features: Time-based gravity in px/s, zero auto-drop hover, 2px flat cabinet art
 */

export default {
  id: 'flappy',
  title: 'Flappy Pilot',
  accent: '#ffb703',

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
        <!-- Flight Board Frame -->
        <div class="arena-board-frame">
          <canvas id="flappyCanvas" width="400" height="520" style="display:block; max-width:100%; height:auto; border-radius:var(--radius-btn); background:#0c1017; cursor:pointer;"></canvas>
        </div>

        <!-- Right Side Control Deck -->
        <div class="arena-side-controls">
          <!-- Gate Counter -->
          <div class="telemetry-cell" style="text-align:center; padding:16px;">
            <span class="t-label">Gates Cleared</span>
            <div id="flappyScoreDisplay" class="t-val" style="font-size:2.4rem; color:var(--status-coin); margin:4px 0;">
              0
            </div>
            <div id="flappyBestDisplay" style="font-size:0.75rem; color:var(--text-dim); font-weight:700;">
              Record: 0 gates
            </div>
          </div>

          <!-- Pace / Difficulty Selector -->
          <div class="telemetry-cell" style="gap:8px;">
            <span class="t-label">Flight Pace</span>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn-nav-pill" id="btnFlappyChill" style="flex:1; justify-content:center; font-size:0.72rem; padding:0 4px;">Chill</button>
              <button type="button" class="btn-nav-pill" id="btnFlappyNormal" style="flex:1; justify-content:center; font-size:0.72rem; padding:0 4px; border-color:var(--status-coin);">Normal</button>
              <button type="button" class="btn-nav-pill" id="btnFlappyHard" style="flex:1; justify-content:center; font-size:0.72rem; padding:0 4px;">Hard</button>
            </div>
          </div>

          <!-- Control Instruction Card -->
          <div class="telemetry-cell" style="text-align:center; padding:14px;">
            <span style="font-size:0.8rem; color:var(--text-sub); line-height:1.4;">
              Tap canvas or press <strong style="color:var(--status-coin);">Space</strong> to flap
            </span>
          </div>
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
    ['btnFlappyChill', 'btnFlappyNormal', 'btnFlappyHard'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.style.borderColor = 'var(--border-strong)';
    });

    if (key === 'CHILL') document.getElementById('btnFlappyChill')?.style.setProperty('border-color', 'var(--status-coin)');
    else if (key === 'NORMAL') document.getElementById('btnFlappyNormal')?.style.setProperty('border-color', 'var(--status-coin)');
    else if (key === 'HARD') document.getElementById('btnFlappyHard')?.style.setProperty('border-color', 'var(--status-coin)');
  },

  loadHighScore() {
    try {
      const raw = localStorage.getItem('parlour_arcade_player_stats_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        this.bestScore = parsed.stats?.flappy?.highScore || 0;
      }
    } catch {}
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
    this.ctx.fx.sfx.defeat();

    this.ctx.recordResult('LOSS', {
      score: this.score,
      summary: `Cleared ${this.score} gates (${this.presetKey.toLowerCase()})`,
      ranked: true
    });
  },

  updateScoreDisplay() {
    const scoreEl = document.getElementById('flappyScoreDisplay');
    const bestEl = document.getElementById('flappyBestDisplay');
    if (scoreEl) scoreEl.textContent = this.score;
    if (bestEl) bestEl.textContent = `Record: ${this.bestScore} gates`;
  },

  render(alpha) {
    if (!this.canvasCtx) return;
    const ctx = this.canvasCtx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Solid cabinet background
    ctx.fillStyle = '#0f141f';
    ctx.fillRect(0, 0, w, h);

    // Subtle 1px vertical guides
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const time = performance.now() / 1000;
    const offset = (time * 30) % 36;

    for (let x = -offset; x < w; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Flat Physical Barriers (Pipes)
    this.laserPipes.forEach(p => {
      // Top Pipe
      ctx.fillStyle = '#1c2433';
      ctx.fillRect(p.x, 0, p.width, p.topH);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x, 0, p.width, p.topH);

      // Top Pipe Collar Lip
      ctx.fillStyle = '#29354b';
      ctx.fillRect(p.x - 3, p.topH - 12, p.width + 6, 12);
      ctx.strokeRect(p.x - 3, p.topH - 12, p.width + 6, 12);

      // Bottom Pipe
      const bottomY = p.topH + p.gateH;
      ctx.fillStyle = '#1c2433';
      ctx.fillRect(p.x, bottomY, p.width, h - bottomY);
      ctx.strokeRect(p.x, bottomY, p.width, h - bottomY);

      // Bottom Pipe Collar Lip
      ctx.fillStyle = '#29354b';
      ctx.fillRect(p.x - 3, bottomY, p.width + 6, 12);
      ctx.strokeRect(p.x - 3, bottomY, p.width + 6, 12);
    });

    // Render Pilot Bird
    const droneX = 75;
    const droneY = this.droneY;
    const tilt = this.isFlying ? Math.min(Math.PI / 4, Math.max(-Math.PI / 4, this.velocity * 0.002)) : 0;

    ctx.save();
    ctx.translate(droneX, droneY);
    ctx.rotate(tilt);

    // Bird Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 11, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffb703';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Eye
    ctx.beginPath();
    ctx.arc(6, -3, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(7, -3, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    // Beak
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(19, 2);
    ctx.lineTo(12, 5);
    ctx.closePath();
    ctx.fillStyle = '#ff2a5f';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Wing
    const wingY = Math.sin(time * 20) * 4;
    ctx.beginPath();
    ctx.ellipse(-4, wingY, 6, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffa000';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();

    // In-Canvas Flat Result Plaque on Crash
    if (this.isCrashed) {
      const boxW = 260;
      const boxH = 190;
      const boxX = (w - boxW) / 2;
      const boxY = 145;

      // Hard shadow box
      ctx.fillStyle = '#000000';
      ctx.fillRect(boxX + 4, boxY + 4, boxW, boxH);

      // Card surface
      ctx.fillStyle = '#161c28';
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.font = '900 17px "Archivo Black", sans-serif';
      ctx.fillStyle = '#ff2a5f';
      ctx.textAlign = 'center';
      ctx.fillText('ROUND OVER', w / 2, boxY + 36);

      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillStyle = '#9aa5b8';
      ctx.fillText('GATES CLEARED', w / 2, boxY + 68);

      ctx.font = '900 28px "Archivo Black", sans-serif';
      ctx.fillStyle = '#ffb703';
      ctx.fillText(this.score, w / 2, boxY + 102);

      let medal = 'Keep practicing';
      if (this.score >= 15) medal = '🥇 Gold Badge';
      else if (this.score >= 8) medal = '🥈 Silver Badge';
      else if (this.score >= 3) medal = '🥉 Bronze Badge';

      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillStyle = '#00f0ff';
      ctx.fillText(medal, w / 2, boxY + 132);

      ctx.font = '600 10px Inter, sans-serif';
      ctx.fillStyle = '#657185';
      ctx.fillText(this.retryLockTimer > 0 ? 'Wait...' : 'Tap canvas or Space to retry', w / 2, boxY + 165);
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