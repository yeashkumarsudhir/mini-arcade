// snake.js: Snake on a 20 by 20 grid. Turns are buffered so quick taps are not lost.
import { Pen } from '../core/theme.js';
import { Stats } from '../stats.js';

export default {
  id: 'snake',
  title: 'Snake',
  accent: '#3fa66a',

  ctx: null,
  container: null,
  canvas: null,
  canvasCtx: null,

  cols: 20,
  rows: 20,
  cellSize: 24,

  snake: [],
  prevSnake: [],
  direction: { x: 1, y: 0 },
  inputBuffer: [],
  score: 0,
  bestScore: 0,
  mode: 'wrap', // 'wrap' | 'wall'
  isAlive: false,

  stepInterval: 140,
  stepTimer: 0,

  food: { x: 5, y: 5, isGolden: false, timer: 0, maxTimer: 5000 },

  mount(el, sessionCtx) {
    this.container = el;
    this.ctx = sessionCtx;

    this.container.innerHTML = `
      <div class="arena-dual-layout">
        <div class="arena-board-frame">
          <canvas id="snakeCanvas" width="480" height="480"></canvas>
        </div>

        <div class="arena-side-controls">
          <div class="stat-box" style="text-align:center; padding:14px;">
            <span class="stat-label">Score</span>
            <div id="snakeScoreDisplay" class="stat-value" style="font-size:2.4rem;">0</div>
            <div id="snakeBestDisplay" class="stat-label">Best: 0</div>
          </div>

          <div class="stat-box" style="gap:8px;">
            <span class="stat-label">Edges of the board</span>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn-nav-pill is-on" id="btnSnakeWrap" style="flex:1;">Wrap around</button>
              <button type="button" class="btn-nav-pill" id="btnSnakeWall" style="flex:1;">Walls</button>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; max-width:200px; margin:8px auto 0;" id="snakeTouchControls">
            <div></div>
            <button type="button" class="btn-nav-pill" id="btnSnakeUp" style="height:44px; justify-content:center; font-size:1.1rem;" aria-label="Up">▲</button>
            <div></div>
            <button type="button" class="btn-nav-pill" id="btnSnakeLeft" style="height:44px; justify-content:center; font-size:1.1rem;" aria-label="Left">◀</button>
            <button type="button" class="btn-nav-pill" id="btnSnakeDown" style="height:44px; justify-content:center; font-size:1.1rem;" aria-label="Down">▼</button>
            <button type="button" class="btn-nav-pill" id="btnSnakeRight" style="height:44px; justify-content:center; font-size:1.1rem;" aria-label="Right">▶</button>
          </div>

          <div class="stat-label" style="text-align:center;">Arrow keys or WASD to steer</div>
        </div>
      </div>
    `;

    this.canvas = document.getElementById('snakeCanvas');
    this.canvasCtx = this.canvas.getContext('2d');

    this.setupListeners();

    this.loop = this.ctx.createLoop(
      (dt) => this.update(dt),
      (alpha) => this.render(alpha)
    );
  },

  start(opts = {}) {
    this.mode = opts.mode || 'wrap';
    this.setMode(this.mode);

    this.snake = [
      { x: 5, y: 10 },
      { x: 4, y: 10 },
      { x: 3, y: 10 }
    ];
    this.prevSnake = JSON.parse(JSON.stringify(this.snake));
    this.direction = { x: 1, y: 0 };
    this.inputBuffer = [];
    this.score = 0;
    this.stepInterval = 140;
    this.stepTimer = 0;
    this.isAlive = true;

    this.spawnFood();
    this.updateScoreDisplay();

    this.loop.start();
  },

  setMode(selectedMode) {
    this.mode = selectedMode;
    const btnWrap = document.getElementById('btnSnakeWrap');
    const btnWall = document.getElementById('btnSnakeWall');
    if (btnWrap && btnWall) {
      btnWrap.classList.toggle('is-on', selectedMode === 'wrap');
      btnWall.classList.toggle('is-on', selectedMode === 'wall');
    }

    this.bestScore = Stats.get('snake').byMode[selectedMode] || 0;
    this.updateScoreDisplay();
  },

  setupListeners() {
    document.getElementById('btnSnakeWrap')?.addEventListener('click', () => {
      this.setMode('wrap');
      this.start({ mode: 'wrap' });
    });
    document.getElementById('btnSnakeWall')?.addEventListener('click', () => {
      this.setMode('wall');
      this.start({ mode: 'wall' });
    });

    const queueDir = (dx, dy) => {
      if (this.inputBuffer.length >= 2) return;
      const last = this.inputBuffer.length > 0 ? this.inputBuffer[this.inputBuffer.length - 1] : this.direction;
      if (last.x + dx === 0 && last.y + dy === 0) return;
      this.inputBuffer.push({ x: dx, y: dy });
    };

    document.getElementById('btnSnakeUp')?.addEventListener('click', () => queueDir(0, -1));
    document.getElementById('btnSnakeDown')?.addEventListener('click', () => queueDir(0, 1));
    document.getElementById('btnSnakeLeft')?.addEventListener('click', () => queueDir(-1, 0));
    document.getElementById('btnSnakeRight')?.addEventListener('click', () => queueDir(1, 0));
  },

  handleInput() {
    if (!this.ctx?.input) return;
    if (this.ctx.input.consume('UP')) this.queueDirection(0, -1);
    if (this.ctx.input.consume('DOWN')) this.queueDirection(0, 1);
    if (this.ctx.input.consume('LEFT')) this.queueDirection(-1, 0);
    if (this.ctx.input.consume('RIGHT')) this.queueDirection(1, 0);
  },

  queueDirection(dx, dy) {
    if (this.inputBuffer.length >= 2) return;
    const last = this.inputBuffer.length > 0 ? this.inputBuffer[this.inputBuffer.length - 1] : this.direction;
    if (last.x + dx === 0 && last.y + dy === 0) return;
    this.inputBuffer.push({ x: dx, y: dy });
  },

  update(dt) {
    if (!this.isAlive) return;

    this.handleInput();

    if (this.food.isGolden) {
      this.food.timer -= dt * 1000;
      if (this.food.timer <= 0) {
        this.spawnFood(false);
      }
    }

    this.stepTimer += dt * 1000;
    while (this.isAlive && this.stepTimer >= this.stepInterval) {
      this.stepTimer -= this.stepInterval;
      this.simulationTick();
    }
  },

  simulationTick() {
    if (this.inputBuffer.length > 0) {
      this.direction = this.inputBuffer.shift();
    }

    this.prevSnake = JSON.parse(JSON.stringify(this.snake));

    const head = { ...this.snake[0] };
    head.x += this.direction.x;
    head.y += this.direction.y;

    if (this.mode === 'wrap') {
      head.x = (head.x + this.cols) % this.cols;
      head.y = (head.y + this.rows) % this.rows;
    } else {
      if (head.x < 0 || head.x >= this.cols || head.y < 0 || head.y >= this.rows) {
        this.handleCrash();
        return;
      }
    }

    for (let i = 0; i < this.snake.length - 1; i++) {
      if (this.snake[i].x === head.x && this.snake[i].y === head.y) {
        this.handleCrash();
        return;
      }
    }

    this.snake.unshift(head);

    if (head.x === this.food.x && head.y === this.food.y) {
      const points = this.food.isGolden ? 3 : 1;
      this.score += points;
      this.ctx.fx.sfx.eat();

      this.stepInterval = Math.max(65, 140 - Math.floor(this.score / 2) * 4);

      if (this.score > this.bestScore) {
        this.bestScore = this.score;
      }

      this.updateScoreDisplay();
      this.spawnFood();
    } else {
      this.snake.pop();
    }
  },

  spawnFood(allowGolden = true) {
    const isGolden = allowGolden && Math.random() < 0.2;
    let placed = false;

    while (!placed) {
      const rx = Math.floor(Math.random() * this.cols);
      const ry = Math.floor(Math.random() * this.rows);

      const hit = this.snake.some(segment => segment.x === rx && segment.y === ry);
      if (!hit) {
        this.food = {
          x: rx,
          y: ry,
          isGolden,
          timer: 5000,
          maxTimer: 5000
        };
        placed = true;
      }
    }
  },

  handleCrash() {
    this.isAlive = false;
    this.loop.stop();

    this.ctx.recordResult('LOSS', {
      mode: this.mode,
      score: this.score,
      summary: `You scored ${this.score} (${this.mode === 'wall' ? 'walls' : 'wrap around'}).`
    });
  },

  updateScoreDisplay() {
    const scoreEl = document.getElementById('snakeScoreDisplay');
    const bestEl = document.getElementById('snakeBestDisplay');
    if (scoreEl) scoreEl.textContent = this.score;
    if (bestEl) bestEl.textContent = `Best: ${this.bestScore}`;
  },

  render(alpha) {
    if (!this.canvasCtx) return;
    const ctx = this.canvasCtx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cell = w / this.cols;

    const P = Pen.get();

    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, w, h);

    // faint grid lines
    ctx.strokeStyle = P.grid;
    ctx.lineWidth = 1;
    for (let c = 0; c <= this.cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cell, 0);
      ctx.lineTo(c * cell, h);
      ctx.stroke();
    }
    for (let r = 0; r <= this.rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cell);
      ctx.lineTo(w, r * cell);
      ctx.stroke();
    }

    // red border in walls mode
    if (this.mode === 'wall') {
      ctx.strokeStyle = P.red;
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
    }

    const fx = this.food.x * cell + cell / 2;
    const fy = this.food.y * cell + cell / 2;
    const fradius = cell * 0.38;

    if (this.food.isGolden) {
      // gold food shrinks a ring as its time runs out
      const pct = Math.max(0, this.food.timer / this.food.maxTimer);
      ctx.beginPath();
      ctx.arc(fx, fy, fradius + 4 * pct, 0, Math.PI * 2);
      ctx.strokeStyle = P.yellow;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(fx, fy, fradius, 0, Math.PI * 2);
      ctx.fillStyle = P.yellow;
      ctx.fill();
      ctx.strokeStyle = P.ink;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(fx, fy, fradius, 0, Math.PI * 2);
      ctx.fillStyle = P.red;
      ctx.fill();
      ctx.strokeStyle = P.ink;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // snake, drawn tail first so the head ends up on top
    for (let i = this.snake.length - 1; i >= 0; i--) {
      const cur = this.snake[i];
      const prev = this.prevSnake[i] || cur;

      let ix = prev.x + (cur.x - prev.x) * alpha;
      let iy = prev.y + (cur.y - prev.y) * alpha;

      if (Math.abs(cur.x - prev.x) > 1) ix = cur.x;
      if (Math.abs(cur.y - prev.y) > 1) iy = cur.y;

      const px = ix * cell + cell / 2;
      const py = iy * cell + cell / 2;
      const radius = cell * 0.44;

      if (i === 0) {
        // head
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = P.green;
        ctx.fill();
        ctx.strokeStyle = P.ink;
        ctx.lineWidth = 2;
        ctx.stroke();

        // eyes
        const eyeOffsetX = this.direction.y * 3.5;
        const eyeOffsetY = this.direction.x * 3.5;
        const forwardX = this.direction.x * 3.5;
        const forwardY = this.direction.y * 3.5;

        [1, -1].forEach(side => {
          const ex = px + forwardX + eyeOffsetX * side;
          const ey = py + forwardY + eyeOffsetY * side;

          ctx.beginPath();
          ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = P.ink;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(ex + this.direction.x, ey + this.direction.y, 1, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        });
      } else {
        // body
        ctx.beginPath();
        ctx.arc(px, py, radius * 0.88, 0, Math.PI * 2);
        ctx.fillStyle = P.greenDark;
        ctx.fill();
        ctx.strokeStyle = P.ink;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  },

  pause() {
    if (this.loop) this.loop.pause();
  },

  resume() {
    if (this.loop) this.loop.resume();
  },

  restart() {
    this.start({ mode: this.mode });
  },

  destroy() {
    if (this.loop) this.loop.stop();
    this.container = null;
    this.canvas = null;
    this.canvasCtx = null;
  }
};