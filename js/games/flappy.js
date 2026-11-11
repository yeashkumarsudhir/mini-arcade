export default {
  id: 'flappy',
  title: 'Flappy Bird',
  accent: '#d29922',

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
          <canvas id="flappyCanvas" width="400" height="520" style="display:block; max-width:100%; height:auto; border-radius:6px; background:#0e1117; cursor:pointer;"></canvas>
        </div>

        <div class="arena-side-controls">
          <div class="telemetry-cell" style="text-align:center; padding:12px;">
            <span class="t-label">Gates</span>
            <div id="flappyScoreDisplay" class="t-val" style="font-size:2rem; color:var(--status-coin); margin:2px 0;">
              0
            </div>
            <div id="flappyBestDisplay" style="font-size:0.75rem; color:var(--text-dim);">
              Best: 0 gates
            </div>
          </div>

          <div class="telemetry-cell" style="gap:6px;">
            <span class="t-label">Speed</span>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn-nav-pill" id="btnFlappyChill" style="flex:1; justify-content:center; font-size:0.75rem;">Chill</button>
              <button type="button" class="btn-nav-pill" id="btnFlappyNormal" style="flex:1; justify-content:center; font-size:0.75rem; border-color:var(--brand-accent);">Normal</button>
              <button type="button" class="btn-nav-pill" id="btnFlappyHard" style="flex:1; justify-content:center; font-size:0.75rem;">Fast</button>
            </div>
          </div>

          <div class="telemetry-cell" style="text-align:center; padding:10px;">
            <span style="font-size:0.75rem; color:var(--text-sub);">
              Tap canvas or press Space to jump
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
      if (btn) btn.style.borderColor = 'var(--border-line)';
    });

    if (key === 'CHILL') document.getElementById('btnFlappyChill')?.style.setProperty('border-color', 'var(--brand-accent)');
    else if (key === 'NORMAL') document.getElementById('btnFlappyNormal')?.style.setProperty('border-color', 'var(--brand-accent)');
    else if (key === 'HARD') document.getElementById('btnFlappyHard')?.style.setProperty('border-color', 'var(--brand-accent)');
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
      this.droneY = 240 + Math.sin(this.hoverTime) * 10;
      return;
    }

    this.velocity += cfg.g * dt;
    this.droneY += this.velocity * dt;

    if (this.droneY >= this.canvas.height - 18 || this.droneY <= 12) {
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
      radius: 11
    };

    for (let i = this.laserPipes.length - 1; i >= 0; i--) {
      const pipe = this.laserPipes[i];
      pipe.x -= cfg.speed * dt;

      if (!pipe.passed && pipe.x < droneBox.x) {
        pipe.passed = true;
        this.score++;
        this.ctx.fx.playTone(880, 'sine', 0.04, 0.1);
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
      summary: `Cleared ${this.score} gates (${this.presetKey.toLowerCase()})`
    });
  },

  updateScoreDisplay() {
    const scoreEl = document.getElementById('flappyScoreDisplay');
    const bestEl = document.getElementById('flappyBestDisplay');
    if (scoreEl) scoreEl.textContent = this.score;
    if (bestEl) bestEl.textContent = `Best: ${this.bestScore} gates`;
  },

  render(alpha) {
    if (!this.canvasCtx) return;
    const ctx = this.canvasCtx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = '#0e1117';
    ctx.fillRect(0, 0, w, h);

    // Pipes
    this.laserPipes.forEach(p => {
      // Top Pipe
      ctx.fillStyle = '#161b22';
      ctx.fillRect(p.x, 0, p.width, p.topH);
      ctx.strokeStyle = '#30363d';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x, 0, p.width, p.topH);

      // Bottom Pipe
      const bottomY = p.topH + p.gateH;
      ctx.fillStyle = '#161b22';
      ctx.fillRect(p.x, bottomY, p.width, h - bottomY);
      ctx.strokeRect(p.x, bottomY, p.width, h - bottomY);
    });

    // Bird
    const droneX = 75;
    const droneY = this.droneY;
    const tilt = this.isFlying ? Math.min(Math.PI / 4, Math.max(-Math.PI / 4, this.velocity * 0.002)) : 0;

    ctx.save();
    ctx.translate(droneX, droneY);
    ctx.rotate(tilt);

    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#d29922';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(5, -3, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(6, -3, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(17, 2);
    ctx.lineTo(11, 4);
    ctx.closePath();
    ctx.fillStyle = '#f85149';
    ctx.fill();

    ctx.restore();

    // Plain game over plaque
    if (this.isCrashed) {
      const boxW = 240;
      const boxH = 140;
      const boxX = (w - boxW) / 2;
      const boxY = 170;

      ctx.fillStyle = '#161b22';
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = 'var(--border-line)';
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.font = '700 16px Inter, sans-serif';
      ctx.fillStyle = '#f85149';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over', w / 2, boxY + 36);

      ctx.font = '600 12px Inter, sans-serif';
      ctx.fillStyle = 'var(--text-sub)';
      ctx.fillText(`Gates cleared: ${this.score}`, w / 2, boxY + 68);

      ctx.font = '500 11px Inter, sans-serif';
      ctx.fillStyle = 'var(--text-dim)';
      ctx.fillText(this.retryLockTimer > 0 ? 'Wait...' : 'Tap or press Space to retry', w / 2, boxY + 105);
    }
  },

  pause() { if (this.loop) this.loop.pause(); },
  resume() { if (this.loop) this.loop.resume(); },
  restart() { this.start({ preset: this.presetKey }); },
  destroy() {
    if (this.loop) this.loop.stop();
    this.container = null;
    this.canvas = null;
    this.canvasCtx = null;
  }
};