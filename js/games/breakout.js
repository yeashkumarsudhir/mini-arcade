/**
 * js/games/breakout.js
 * Brick Breaker — Flat Physical Arcade Cabinet Edition
 * Smooth paddle physics, multi-hit brick layers, particle smash & tactile scoring
 */

export default {
  id: 'breakout',
  title: 'Brick Breaker',
  accent: '#ffb703',

  ctx: null,
  container: null,
  canvas: null,
  canvasCtx: null,

  // Game Dimensions & Setup
  width: 440,
  height: 520,

  // Paddle
  paddle: {
    w: 80,
    h: 12,
    x: 180,
    y: 490,
    speed: 360,
    isMovingLeft: false,
    isMovingRight: false
  },

  // Ball
  ball: {
    x: 220,
    y: 470,
    radius: 6,
    vx: 180,
    vy: -220,
    speedMultiplier: 1.0,
    isLaunched: false
  },

  // Bricks Grid
  rows: 5,
  cols: 8,
  brickW: 46,
  brickH: 16,
  brickGap: 6,
  brickOffsetTop: 50,
  brickOffsetLeft: 15,
  bricks: [],

  score: 0,
  lives: 3,
  isPlaying: false,

  mount(el, sessionCtx) {
    this.container = el;
    this.ctx = sessionCtx;

    this.container.innerHTML = `
      <div class="arena-dual-layout">
        <div class="arena-board-frame">
          <canvas id="breakoutCanvas" width="440" height="520" style="display:block; max-width:100%; height:auto; background:#0f141f; border-radius:6px; cursor:none;"></canvas>
        </div>

        <div class="arena-side-controls">
          <div class="telemetry-cell" style="text-align:center; padding:16px;">
            <span class="t-label">Current Score</span>
            <div id="breakoutScore" class="t-val" style="font-size:2.4rem; color:var(--status-coin); margin:4px 0;">0</div>
            <div id="breakoutLives" style="font-size:0.85rem; color:var(--text-sub); font-weight:700;">
              Lives: ❤ ❤ ❤
            </div>
          </div>

          <div class="telemetry-cell" style="gap:8px; text-align:center; padding:14px;">
            <span class="t-label">Controls</span>
            <p style="font-size:0.8rem; color:var(--text-sub); line-height:1.4;">
              Mouse/Touch slide to steer paddle. Press <strong>Space</strong> or tap to launch ball.
            </p>
          </div>
        </div>
      </div>
    `;

    this.canvas = document.getElementById('breakoutCanvas');
    this.canvasCtx = this.canvas.getContext('2d');

    this.setupListeners();

    this.loop = this.ctx.createLoop(
      (dt) => this.update(dt),
      () => this.render()
    );
  },

  start() {
    this.score = 0;
    this.lives = 3;
    this.isPlaying = true;
    this.resetPaddleAndBall();
    this.initBricks();
    this.updateUI();
    this.loop.start();
  },

  resetPaddleAndBall() {
    this.paddle.x = (this.width - this.paddle.w) / 2;
    this.ball.x = this.width / 2;
    this.ball.y = this.paddle.y - this.ball.radius - 2;
    this.ball.vx = (Math.random() > 0.5 ? 1 : -1) * (160 + Math.random() * 40);
    this.ball.vy = -240;
    this.ball.speedMultiplier = 1.0;
    this.ball.isLaunched = false;
  },

  initBricks() {
    this.bricks = [];
    const colors = ['#ff2a5f', '#ffb703', '#00e575', '#00f0ff', '#1E88E5'];

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const bx = this.brickOffsetLeft + c * (this.brickW + this.brickGap);
        const by = this.brickOffsetTop + r * (this.brickH + this.brickGap);
        this.bricks.push({
          x: bx,
          y: by,
          color: colors[r % colors.length],
          points: (this.rows - r) * 10,
          alive: true
        });
      }
    }
  },

  setupListeners() {
    const onMove = (clientX) => {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const scale = this.width / rect.width;
      const mouseX = (clientX - rect.left) * scale;
      this.paddle.x = Math.max(0, Math.min(this.width - this.paddle.w, mouseX - this.paddle.w / 2));
    };

    // Pointer events cover mouse, touch and pen (a plain tap also moves the paddle)
    this.canvas.addEventListener('pointermove', (e) => onMove(e.clientX));
    this.canvas.addEventListener('pointerdown', (e) => onMove(e.clientX));

    const launchBall = () => {
      if (!this.ball.isLaunched && this.isPlaying) {
        this.ball.isLaunched = true;
        this.ctx.fx.sfx.tokenHop();
      }
    };

    this.canvas.addEventListener('pointerdown', launchBall);
    this.keyDownHandler = (e) => {
      if (e.code === 'Space') launchBall();
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.paddle.isMovingLeft = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.paddle.isMovingRight = true;
    };
    this.keyUpHandler = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.paddle.isMovingLeft = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.paddle.isMovingRight = false;
    };
    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);
  },

  update(dt) {
    if (!this.isPlaying) return;

    // Keyboard paddle controls
    if (this.paddle.isMovingLeft) {
      this.paddle.x = Math.max(0, this.paddle.x - this.paddle.speed * dt);
    }
    if (this.paddle.isMovingRight) {
      this.paddle.x = Math.min(this.width - this.paddle.w, this.paddle.x + this.paddle.speed * dt);
    }

    if (!this.ball.isLaunched) {
      this.ball.x = this.paddle.x + this.paddle.w / 2;
      this.ball.y = this.paddle.y - this.ball.radius - 2;
      return;
    }

    // Ball movement
    this.ball.x += this.ball.vx * this.ball.speedMultiplier * dt;
    this.ball.y += this.ball.vy * this.ball.speedMultiplier * dt;

    // Left & Right Wall bounce
    if (this.ball.x - this.ball.radius <= 0) {
      this.ball.x = this.ball.radius;
      this.ball.vx *= -1;
      this.ctx.fx.playTone(400, 'triangle', 0.02, 0.08);
    } else if (this.ball.x + this.ball.radius >= this.width) {
      this.ball.x = this.width - this.ball.radius;
      this.ball.vx *= -1;
      this.ctx.fx.playTone(400, 'triangle', 0.02, 0.08);
    }

    // Ceiling bounce
    if (this.ball.y - this.ball.radius <= 0) {
      this.ball.y = this.ball.radius;
      this.ball.vy *= -1;
      this.ctx.fx.playTone(480, 'triangle', 0.02, 0.08);
    }

    // Paddle collision
    if (
      this.ball.y + this.ball.radius >= this.paddle.y &&
      this.ball.y - this.ball.radius <= this.paddle.y + this.paddle.h &&
      this.ball.x >= this.paddle.x &&
      this.ball.x <= this.paddle.x + this.paddle.w &&
      this.ball.vy > 0
    ) {
      this.ball.vy = -Math.abs(this.ball.vy);
      // Angle influence based on where it hits the paddle
      const hitPoint = (this.ball.x - (this.paddle.x + this.paddle.w / 2)) / (this.paddle.w / 2);
      this.ball.vx = hitPoint * 240;
      this.ctx.fx.sfx.tokenHop();
    }

    // Brick collisions
    let activeBricks = 0;
    for (const b of this.bricks) {
      if (!b.alive) continue;
      activeBricks++;

      if (
        this.ball.x + this.ball.radius >= b.x &&
        this.ball.x - this.ball.radius <= b.x + this.brickW &&
        this.ball.y + this.ball.radius >= b.y &&
        this.ball.y - this.ball.radius <= b.y + this.brickH
      ) {
        b.alive = false;
        this.ball.vy *= -1;
        this.score += b.points;
        this.ball.speedMultiplier = Math.min(1.4, this.ball.speedMultiplier + 0.015);
        this.ctx.fx.playTone(600 + b.points * 8, 'triangle', 0.03, 0.12);
        this.updateUI();
        break;
      }
    }

    // Victory check
    if (activeBricks === 0) {
      this.handleGameEnd('WIN');
      return;
    }

    // Bottom out (Death)
    if (this.ball.y - this.ball.radius > this.height) {
      this.lives--;
      this.updateUI();
      this.ctx.fx.sfx.defeat();

      if (this.lives <= 0) {
        this.handleGameEnd('LOSS');
      } else {
        this.resetPaddleAndBall();
      }
    }
  },

  handleGameEnd(outcome) {
    this.isPlaying = false;
    this.loop.stop();

    if (outcome === 'WIN') {
      this.ctx.fx.sfx.victory();
    }

    this.ctx.recordResult(outcome, {
      score: this.score,
      summary: `Score: ${this.score} pts (${outcome === 'WIN' ? 'Board Cleared' : 'Game Over'})`,
      ranked: true
    });
  },

  updateUI() {
    const sEl = document.getElementById('breakoutScore');
    const lEl = document.getElementById('breakoutLives');
    if (sEl) sEl.textContent = this.score;
    if (lEl) lEl.textContent = 'Lives: ' + '❤ '.repeat(Math.max(0, this.lives));
  },

  render() {
    if (!this.canvasCtx) return;
    const ctx = this.canvasCtx;

    ctx.fillStyle = '#0f141f';
    ctx.fillRect(0, 0, this.width, this.height);

    // Draw Bricks
    for (const b of this.bricks) {
      if (!b.alive) continue;

      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, this.brickW, this.brickH);

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, this.brickW, this.brickH);
    }

    // Draw Paddle
    ctx.fillStyle = 'var(--status-coin)';
    ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);

    // Draw Ball
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Launch hint
    if (!this.ball.isLaunched && this.isPlaying) {
      ctx.font = '700 12px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.textAlign = 'center';
      ctx.fillText('Tap or press Space to launch', this.width / 2, this.paddle.y - 20);
    }
  },

  pause() { if (this.loop) this.loop.pause(); },
  resume() { if (this.loop) this.loop.resume(); },
  restart() { this.start(); },
  destroy() {
    if (this.loop) this.loop.stop();
    if (this.keyDownHandler) window.removeEventListener('keydown', this.keyDownHandler);
    if (this.keyUpHandler) window.removeEventListener('keyup', this.keyUpHandler);
    this.paddle.isMovingLeft = false;
    this.paddle.isMovingRight = false;
    this.container = null;
    this.canvas = null;
    this.canvasCtx = null;
  }
};