// breakout.js: Brick Breaker. Paddle and ball move by time (px per second), not by frame.
import { Pen } from '../core/theme.js';

export default {
  id: 'breakout',
  title: 'Brick Breaker',
  accent: '#f2b705',

  ctx: null,
  container: null,
  canvas: null,
  canvasCtx: null,

  width: 440,
  height: 520,

  paddle: {
    w: 80,
    h: 12,
    x: 180,
    y: 490,
    speed: 360,
    isMovingLeft: false,
    isMovingRight: false
  },

  ball: {
    x: 220,
    y: 470,
    radius: 6,
    vx: 180,
    vy: -220,
    speedMultiplier: 1.0,
    isLaunched: false
  },

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
          <canvas id="breakoutCanvas" width="440" height="520" style="cursor:none;"></canvas>
        </div>

        <div class="arena-side-controls">
          <div class="stat-box" style="text-align:center; padding:14px;">
            <span class="stat-label">Score</span>
            <div id="breakoutScore" class="stat-value" style="font-size:2.4rem;">0</div>
            <div id="breakoutLives" class="stat-label">Lives: 3</div>
          </div>

          <div class="stat-label" style="text-align:center;">
            Slide your finger or mouse to move the paddle. Tap or press Space to launch the ball.
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
    const colors = ['#d8504e', '#e8893c', '#f2b705', '#3fa66a', '#3d63e0'];

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

    // pointer events cover mouse, touch and pen
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

    this.ball.x += this.ball.vx * this.ball.speedMultiplier * dt;
    this.ball.y += this.ball.vy * this.ball.speedMultiplier * dt;

    // side walls
    if (this.ball.x - this.ball.radius <= 0) {
      this.ball.x = this.ball.radius;
      this.ball.vx *= -1;
      this.ctx.fx.playTone(400, 'triangle', 0.02, 0.08);
    } else if (this.ball.x + this.ball.radius >= this.width) {
      this.ball.x = this.width - this.ball.radius;
      this.ball.vx *= -1;
      this.ctx.fx.playTone(400, 'triangle', 0.02, 0.08);
    }

    // ceiling
    if (this.ball.y - this.ball.radius <= 0) {
      this.ball.y = this.ball.radius;
      this.ball.vy *= -1;
      this.ctx.fx.playTone(480, 'triangle', 0.02, 0.08);
    }

    // paddle
    if (
      this.ball.y + this.ball.radius >= this.paddle.y &&
      this.ball.y - this.ball.radius <= this.paddle.y + this.paddle.h &&
      this.ball.x >= this.paddle.x &&
      this.ball.x <= this.paddle.x + this.paddle.w &&
      this.ball.vy > 0
    ) {
      this.ball.vy = -Math.abs(this.ball.vy);
      // where it hits the paddle decides the angle
      const hitPoint = (this.ball.x - (this.paddle.x + this.paddle.w / 2)) / (this.paddle.w / 2);
      this.ball.vx = hitPoint * 240;
      this.ctx.fx.sfx.tokenHop();
    }

    // bricks
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

    if (activeBricks === 0) {
      this.handleGameEnd('WIN');
      return;
    }

    // missed the ball
    if (this.ball.y - this.ball.radius > this.height) {
      this.lives--;
      this.updateUI();
      this.ctx.fx.playTone(200, 'triangle', 0.15, 0.14);

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

    this.ctx.recordResult(outcome, {
      score: this.score,
      summary: outcome === 'WIN'
        ? `You cleared every brick and scored ${this.score}.`
        : `You scored ${this.score}.`
    });
  },

  updateUI() {
    const sEl = document.getElementById('breakoutScore');
    const lEl = document.getElementById('breakoutLives');
    if (sEl) sEl.textContent = this.score;
    if (lEl) lEl.textContent = `Lives: ${Math.max(0, this.lives)}`;
  },

  render() {
    if (!this.canvasCtx) return;
    const ctx = this.canvasCtx;

    const P = Pen.get();

    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, this.width, this.height);

    for (const b of this.bricks) {
      if (!b.alive) continue;

      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, this.brickW, this.brickH);

      ctx.strokeStyle = P.ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, this.brickW, this.brickH);
    }

    ctx.fillStyle = P.blue;
    ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);

    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = P.paper;
    ctx.fill();
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (!this.ball.isLaunched && this.isPlaying) {
      ctx.font = '600 13px Mukta, sans-serif';
      ctx.fillStyle = P.dim;
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