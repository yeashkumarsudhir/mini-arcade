/**
 * js/games/twentyfortyeight.js
 * 2048 — Tactile Sliding Tile Puzzle
 * Features: 4x4 grid, arrow/WASD/touch swipe, smooth sliding math, merge sound
 */

export default {
  id: 'twentyfortyeight',
  title: '2048',
  accent: '#ffb703',

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
        <div class="arena-board-frame" style="padding:16px; background:var(--bg-panel); border:2px solid var(--border-strong); border-radius:var(--radius-card); box-shadow:var(--shadow-offset-lg);">
          <div id="grid2048" style="display:grid; grid-template-columns:repeat(4, 1fr); grid-template-rows:repeat(4, 1fr); gap:8px; width:min(calc(100vw - 72px), 340px); aspect-ratio:1; touch-action:none; background:var(--bg-base); padding:8px; border-radius:8px; border:2px solid var(--border-strong);"></div>
        </div>

        <div class="arena-side-controls">
          <div class="telemetry-cell" style="text-align:center; padding:16px;">
            <span class="t-label">Current Score</span>
            <div id="score2048" class="t-val" style="font-size:2.4rem; color:var(--status-coin); margin:4px 0;">0</div>
            <div id="best2048" style="font-size:0.8rem; color:var(--text-dim); font-weight:700;">Best: 0</div>
          </div>

          <div class="telemetry-cell" style="padding:14px; text-align:center;">
            <span class="t-label">Controls</span>
            <p style="font-size:0.8rem; color:var(--text-sub); margin-top:4px; line-height:1.4;">
              Use <strong>Arrow Keys</strong>, <strong>WASD</strong>, or <strong>Swipe</strong> to merge identical numbers. Reach <strong>2048</strong> to win!
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

    // Touch Swipe Support
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
    this.ctx.fx.playTone(420, 'triangle', 0.03, 0.1);
    this.spawnTile();
    this.renderBoard();
    this.updateStats();

    if (this.hasWon) {
      this.ctx.fx.sfx.victory();
      this.ctx.recordResult('WIN', { score: this.score, summary: `Reached 2048! (Score: ${this.score})`, ranked: true });
      this.hasWon = false;
    } else if (this.checkGameOver()) {
      this.isGameOver = true;
      this.ctx.fx.sfx.defeat();
      this.ctx.recordResult('LOSS', { score: this.score, summary: `No moves left (Score: ${this.score})`, ranked: true });
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
      2: { bg: '#e8ecf4', fg: '#141712' },
      4: { bg: '#dbe2ee', fg: '#141712' },
      8: { bg: '#ffb703', fg: '#000000' },
      16: { bg: '#fb8500', fg: '#000000' },
      32: { bg: '#f72585', fg: '#ffffff' },
      64: { bg: '#ff2a5f', fg: '#ffffff' },
      128: { bg: '#00e575', fg: '#000000' },
      256: { bg: '#00f0ff', fg: '#000000' },
      512: { bg: '#4361ee', fg: '#ffffff' },
      1024: { bg: '#7209b7', fg: '#ffffff' },
      2048: { bg: '#ffea00', fg: '#000000' }
    };

    el.innerHTML = this.board.flat().map(val => {
      const palette = colorMap[val] || { bg: '#3a0ca3', fg: '#ffffff' };
      const displayVal = val === 0 ? '' : val;
      const fontSize = val >= 1000 ? '1.25rem' : '1.5rem';

      return `
        <div style="background:${palette.bg}; color:${palette.fg}; display:flex; align-items:center; justify-content:center; font-family:'Archivo Black', sans-serif; font-size:${fontSize}; font-weight:900; border-radius:6px; border:2px solid var(--border-strong); box-shadow:2px 2px 0px #000; user-select:none;">
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