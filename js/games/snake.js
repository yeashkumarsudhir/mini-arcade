export default {
  id: 'snake',
  title: 'Snake',
  accent: '#2ea043',

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
  mode: 'wrap',
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
          <div class="telemetry-cell" style="text-align:center; padding:12px;">
            <span class="t-label">Score</span>
            <div id="snakeScoreDisplay" class="t-val" style="font-size:2rem; color:var(--status-win); margin:2px 0;">
              0
            </div>
            <div id="snakeBestDisplay" style="font-size:0.75rem; color:var(--text-dim);">
              Best: 0 pts
            </div>
          </div>

          <div class="telemetry-cell" style="gap:6px;">
            <span class="t-label">Walls</span>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn-nav-pill" id="btnSnakeWrap" style="flex:1; justify-content:center; border-color:var(--brand-accent);">Wrap</button>
              <button type="button" class="btn-nav-pill" id="btnSnakeWall" style="flex:1; justify-content:center;">Border</button>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; max-width:180px; margin:6px auto 0;" id="snakeTouchControls">
            <div></div>
            <button type="button" class="btn-nav-pill" id="btnSnakeUp" style="height:40px; justify-content:center; font-size:1rem;" aria-label="Up">▲</button>
            <div></div>
            <button type="button" class="btn-nav-pill" id="btnSnakeLeft" style="height:40px; justify-content:center; font-size:1rem;" aria-label="Left">◀</button>
            <button type="button" class="btn-nav-pill" id="btnSnakeDown" style="height:40px; justify-content:center; font-size:1rem;" aria-label="Down">▼</button>
            <button type="button" class="btn-nav-pill" id="btnSnakeRight" style="height:40px; justify-content:center; font-size:1rem;" aria-label="Right">▶</button>
          </div>

          <div style="text-align:center; font-size:0.75rem; color:var(--text-dim); margin-top:2px;">
            Swipe or use arrow keys / WASD
          </div>
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
      btnWrap.style.borderColor = selectedMode === 'wrap' ? 'var(--brand-accent)' : 'var(--border-line)';
      btnWall.style.borderColor = selectedMode === 'wall' ? 'var(--brand-accent)' : 'var(--border-line)';
    }

    const scores = this.getHighScores();
    this.bestScore = selectedMode === 'wall' ? scores.wall : scores.wrap;
    this.updateScoreDisplay();
  },

  getHighScores() {
    try {
      const raw = localStorage.getItem('parlour_arcade_player_stats_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          wrap: parsed.stats?.snake?.highScoreWrap || parsed.stats?.snake?.highScore || 0,
          wall: parsed.stats?.snake?.highScoreWall || 0
        };
      }
    } catch {}
    return { wrap: 0, wall: 0 };
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
    while (this.stepTimer >= this.stepInterval) {
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
    this.ctx.fx.sfx.defeat();
    this.loop.stop();

    this.ctx.recordResult('LOSS', {
      mode: this.mode,
      score: this.score,
      summary: `Score: ${this.score} pts (${this.mode === 'wall' ? 'Border' : 'Wrap'})`,
      ranked: true
    });
  },

  updateScoreDisplay() {
    const scoreEl = document.getElementById('snakeScoreDisplay');
    const bestEl = document.getElementById('snakeBestDisplay');
    if (scoreEl) scoreEl.textContent = this.score;
    if (bestEl) bestEl.textContent = `Best: ${this.bestScore} pts`;
  },

  render(alpha) {
    if (!this.canvasCtx) return;
    const ctx = this.canvasCtx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cell = w / this.cols;

    ctx.fillStyle = '#0e1117';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
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

    if (this.mode === 'wall') {
      ctx.strokeStyle = '#f85149';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
    }

    const fx = this.food.x * cell + cell / 2;
    const fy = this.food.y * cell + cell / 2;
    const fradius = cell * 0.36;

    if (this.food.isGolden) {
      const pct = Math.max(0, this.food.timer / this.food.maxTimer);
      ctx.beginPath();
      ctx.arc(fx, fy, fradius + 3 * pct, 0, Math.PI * 2);
      ctx.strokeStyle = '#d29922';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(fx, fy, fradius, 0, Math.PI * 2);
      ctx.fillStyle = '#d29922';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(fx, fy, fradius, 0, Math.PI * 2);
      ctx.fillStyle = '#f85149';
      ctx.fill();
    }

    for (let i = this.snake.length - 1; i >= 0; i--) {
      const cur = this.snake[i];
      const prev = this.prevSnake[i] || cur;

      let ix = prev.x + (cur.x - prev.x) * alpha;
      let iy = prev.y + (cur.y - prev.y) * alpha;

      if (Math.abs(cur.x - prev.x) > 1) ix = cur.x;
      if (Math.abs(cur.y - prev.y) > 1) iy = cur.y;

      const px = ix * cell + cell / 2;
      const py = iy * cell + cell / 2;
      const radius = cell * 0.42;

      if (i === 0) {
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#2ea043';
        ctx.fill();

        const eyeOffsetX = this.direction.y * 3;
        const eyeOffsetY = this.direction.x * 3;
        const forwardX = this.direction.x * 3;
        const forwardY = this.direction.y * 3;

        [1, -1].forEach(side => {
          const ex = px + forwardX + eyeOffsetX * side;
          const ey = py + forwardY + eyeOffsetY * side;

          ctx.beginPath();
          ctx.arc(ex, ey, 2, 0, Math.PI * 2);
          ctx.fillStyle = '#000000';
          ctx.fill();
        });
      } else {
        ctx.beginPath();
        ctx.arc(px, py, radius * 0.85, 0, Math.PI * 2);
        ctx.fillStyle = '#238636';
        ctx.fill();
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