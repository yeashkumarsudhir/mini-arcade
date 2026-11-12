// twentyfortyeight.js: 2048 on a 4 by 4 board. Arrow keys, WASD or swipe.
import { Stats } from '../stats.js';

export default {
  id: 'twentyfortyeight',
  title: '2048',
  accent: '#f2b705',

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
        <div class="arena-board-frame" style="padding:12px;">
          <div id="grid2048" style="display:grid; grid-template-columns:repeat(4, 1fr); grid-template-rows:repeat(4, 1fr); gap:8px; width:min(calc(100vw - 64px), 340px); aspect-ratio:1; touch-action:none; background:var(--bg-base); padding:8px; border-radius:6px; border:1.5px solid var(--border-line);"></div>
        </div>

        <div class="arena-side-controls">
          <div class="stat-box" style="text-align:center; padding:14px;">
            <span class="stat-label">Score</span>
            <div id="score2048" class="stat-value" style="font-size:2.4rem;">0</div>
            <div id="best2048" class="stat-label">Best: 0</div>
          </div>

          <div class="stat-label" style="text-align:center;">
            Swipe, or use the arrow keys or WASD. Make a 2048 tile to win.
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
    this.bestScore = Stats.get('twentyfortyeight').best;
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
      this.ctx.recordResult('WIN', { score: this.score, summary: `You made 2048 with a score of ${this.score}.` });
      this.hasWon = false;
    } else if (this.checkGameOver()) {
      this.isGameOver = true;
      this.ctx.recordResult('LOSS', { score: this.score, summary: `No moves left. You scored ${this.score}.` });
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
      2: { bg: '#eef2f9', fg: '#16233b' },
      4: { bg: '#dde6f5', fg: '#16233b' },
      8: { bg: '#f7c948', fg: '#16233b' },
      16: { bg: '#f0a04b', fg: '#16233b' },
      32: { bg: '#e8714f', fg: '#ffffff' },
      64: { bg: '#d8504e', fg: '#ffffff' },
      128: { bg: '#8fc79e', fg: '#16233b' },
      256: { bg: '#3fa66a', fg: '#ffffff' },
      512: { bg: '#5b83e8', fg: '#ffffff' },
      1024: { bg: '#3d63e0', fg: '#ffffff' },
      2048: { bg: '#f2b705', fg: '#16233b' }
    };

    el.innerHTML = this.board.flat().map(val => {
      const palette = colorMap[val] || { bg: '#22304a', fg: '#ffffff' };
      const displayVal = val === 0 ? '' : val;
      const fontSize = val >= 1000 ? '1.25rem' : '1.5rem';

      return `
        <div style="background:${palette.bg}; color:${palette.fg}; display:flex; align-items:center; justify-content:center; font-family:var(--font-hand); font-size:${fontSize}; font-weight:700; border-radius:6px; border:1.5px solid var(--border-strong); user-select:none;">
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
      Stats.noteBest('twentyfortyeight', this.bestScore);
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