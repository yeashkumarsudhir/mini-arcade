export default {
  id: 'twentyfortyeight',
  title: '2048',
  accent: '#d29922',

  ctx: null,
  container: null,

  size: 4,
  board: [],
  score: 0,
  bestScore: 0,
  isGameOver: false,
  hasWon: false,

  mount(el, sessionCtx) {
    this.container = el;
    this.ctx = sessionCtx;

    this.container.innerHTML = `
      <div class="arena-dual-layout">
        <div class="arena-board-frame" style="padding:10px; background:var(--bg-panel); border:1px solid var(--border-line); border-radius:8px;">
          <div id="grid2048" style="display:grid; grid-template-columns:repeat(4, 1fr); grid-template-rows:repeat(4, 1fr); gap:6px; width:min(calc(100vw - 48px), 320px); aspect-ratio:1; touch-action:none; background:var(--bg-base); padding:6px; border-radius:6px; border:1px solid var(--border-line);"></div>
        </div>

        <div class="arena-side-controls">
          <div class="telemetry-cell" style="text-align:center; padding:12px;">
            <span class="t-label">Score</span>
            <div id="score2048" class="t-val" style="font-size:2rem; color:var(--status-coin); margin:2px 0;">0</div>
            <div id="best2048" style="font-size:0.75rem; color:var(--text-dim);">Best: 0</div>
          </div>

          <div class="telemetry-cell" style="padding:10px; text-align:center;">
            <span class="t-label">How to play</span>
            <p style="font-size:0.75rem; color:var(--text-sub); margin-top:4px; line-height:1.4;">
              Swipe or use Arrow keys / WASD to slide matching numbers together. Combine them until you reach 2048.
            </p>
          </div>
        </div>
      </div>
    `;

    this.setupListeners();
  },

  start() {
    this.board = Array(this.size).fill(null).map(() => Array(this.size).fill(0));
    this.score = 0;
    this.isGameOver = false;
    this.hasWon = false;
    this.loadBestScore();

    this.spawnTile();
    this.spawnTile();
    this.renderBoard();
    this.updateStats();
  },

  loadBestScore() {
    try {
      const saved = localStorage.getItem('parlour_2048_best');
      this.bestScore = saved ? parseInt(saved, 10) : 0;
    } catch {}
  },

  spawnTile() {
    const emptyCells = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.board[r][c] === 0) emptyCells.push({ r, c });
      }
    }
    if (emptyCells.length === 0) return;

    const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    this.board[cell.r][cell.c] = Math.random() < 0.9 ? 2 : 4;
  },

  setupListeners() {
    this.keyHandler = (e) => {
      if (this.isGameOver) return;
      let moved = false;

      if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); moved = this.move('UP'); }
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); moved = this.move('DOWN'); }
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); moved = this.move('LEFT'); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); moved = this.move('RIGHT'); }

      if (moved) this.handlePostMove();
    };
    window.addEventListener('keydown', this.keyHandler);

    let startX = 0, startY = 0;
    const boardEl = document.getElementById('grid2048');

    boardEl.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    boardEl.addEventListener('touchend', (e) => {
      if (this.isGameOver) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (Math.max(absX, absY) > 24) {
        let moved = false;
        if (absX > absY) {
          moved = dx > 0 ? this.move('RIGHT') : this.move('LEFT');
        } else {
          moved = dy > 0 ? this.move('DOWN') : this.move('UP');
        }
        if (moved) this.handlePostMove();
      }
    }, { passive: true });
  },

  slideArray(row) {
    let arr = row.filter(val => val !== 0);
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i] *= 2;
        this.score += arr[i];
        if (arr[i] === 2048 && !this.hasWon) this.hasWon = true;
        arr.splice(i + 1, 1);
      }
    }
    while (arr.length < this.size) arr.push(0);
    return arr;
  },

  move(direction) {
    let oldBoard = JSON.stringify(this.board);

    if (direction === 'LEFT') {
      for (let r = 0; r < this.size; r++) this.board[r] = this.slideArray(this.board[r]);
    } else if (direction === 'RIGHT') {
      for (let r = 0; r < this.size; r++) this.board[r] = this.slideArray(this.board[r].reverse()).reverse();
    } else if (direction === 'UP') {
      for (let c = 0; c < this.size; c++) {
        let col = [this.board[0][c], this.board[1][c], this.board[2][c], this.board[3][c]];
        col = this.slideArray(col);
        for (let r = 0; r < this.size; r++) this.board[r][c] = col[r];
      }
    } else if (direction === 'DOWN') {
      for (let c = 0; c < this.size; c++) {
        let col = [this.board[3][c], this.board[2][c], this.board[1][c], this.board[0][c]];
        col = this.slideArray(col);
        col.reverse();
        for (let r = 0; r < this.size; r++) this.board[r][c] = col[r];
      }
    }

    return oldBoard !== JSON.stringify(this.board);
  },

  handlePostMove() {
    this.ctx.fx.playTone(420, 'triangle', 0.03, 0.08);
    this.spawnTile();
    this.renderBoard();
    this.updateStats();

    if (this.hasWon) {
      this.ctx.fx.sfx.victory();
      this.ctx.recordResult('WIN', { score: this.score, summary: `Reached 2048! (Score: ${this.score})` });
      this.hasWon = false;
    } else if (this.checkGameOver()) {
      this.isGameOver = true;
      this.ctx.fx.sfx.defeat();
      this.ctx.recordResult('LOSS', { score: this.score, summary: `No moves left (Score: ${this.score})` });
    }
  },

  checkGameOver() {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.board[r][c] === 0) return false;
        if (c < this.size - 1 && this.board[r][c] === this.board[r][c + 1]) return false;
        if (r < this.size - 1 && this.board[r][c] === this.board[r + 1][c]) return false;
      }
    }
    return true;
  },

  renderBoard() {
    const el = document.getElementById('grid2048');
    if (!el) return;

    const colorMap = {
      0: { bg: 'var(--bg-surface)', fg: 'transparent' },
      2: { bg: '#21262d', fg: 'var(--text-main)' },
      4: { bg: '#30363d', fg: 'var(--text-main)' },
      8: { bg: '#8c5b00', fg: '#ffffff' },
      16: { bg: '#a35200', fg: '#ffffff' },
      32: { bg: '#b3261e', fg: '#ffffff' },
      64: { bg: '#cf222e', fg: '#ffffff' },
      128: { bg: '#1a7f37', fg: '#ffffff' },
      256: { bg: '#0969da', fg: '#ffffff' },
      512: { bg: '#2f81f7', fg: '#ffffff' },
      1024: { bg: '#8250df', fg: '#ffffff' },
      2048: { bg: '#d29922', fg: '#000000' }
    };

    el.innerHTML = this.board.flat().map(val => {
      const palette = colorMap[val] || { bg: '#8250df', fg: '#ffffff' };
      const displayVal = val === 0 ? '' : val;
      const fontSize = val >= 1000 ? '1.1rem' : '1.3rem';

      return `
        <div style="background:${palette.bg}; color:${palette.fg}; display:flex; align-items:center; justify-content:center; font-size:${fontSize}; font-weight:700; border-radius:4px; border:1px solid var(--border-line); user-select:none;">
          ${displayVal}
        </div>
      `;
    }).join('');
  },

  updateStats() {
    const sEl = document.getElementById('score2048');
    const bEl = document.getElementById('best2048');
    if (sEl) sEl.textContent = this.score;

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem('parlour_2048_best', this.bestScore);
    }
    if (bEl) bEl.textContent = `Best: ${this.bestScore}`;
  },

  pause() {},
  resume() {},
  restart() { this.start(); },
  destroy() {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.container = null;
  }
};