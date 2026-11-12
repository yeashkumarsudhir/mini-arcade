// minesweeper.js: 9 by 9 grid with 10 mines. The first click and its neighbours are always safe.
const FLAG_SVG = '<svg viewBox="0 0 16 16" width="17" height="17" aria-label="flag"><path d="M4 2v12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4.5 2.5h8l-2.2 2.7 2.2 2.8h-8z" fill="#d8504e"/></svg>';
const MINE_SVG = '<svg viewBox="0 0 16 16" width="17" height="17" aria-label="mine"><circle cx="8" cy="8" r="4.2" fill="currentColor"/><path d="M8 1.5v13M1.5 8h13M3.4 3.4l9.2 9.2M12.6 3.4l-9.2 9.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

export default {
  id: 'minesweeper',
  title: 'Minesweeper',
  accent: '#d8504e',

  ctx: null,
  container: null,

  rows: 9,
  cols: 9,
  minesCount: 10,
  board: [],
  isFirstClick: true,
  isGameOver: false,
  flagMode: false,
  timerSec: 0,
  timerInterval: null,

  mount(el, sessionCtx) {
    this.container = el;
    this.ctx = sessionCtx;

    this.container.innerHTML = `
      <div class="arena-dual-layout">
        <div class="arena-board-frame" style="padding:12px;">
          <div id="minesGrid" style="display:grid; grid-template-columns:repeat(9, 1fr); grid-template-rows:repeat(9, 1fr); gap:3px; width:min(calc(100vw - 58px), 340px); aspect-ratio:1; background:var(--bg-base); padding:6px; border-radius:6px; border:1.5px solid var(--border-line);"></div>
        </div>

        <div class="arena-side-controls">
          <div class="stat-box">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; text-align:center;">
              <div>
                <span class="stat-label">Mines left</span>
                <div id="minesRemaining" class="stat-value" style="font-size:2rem;">10</div>
              </div>
              <div>
                <span class="stat-label">Time</span>
                <div id="minesTimer" class="stat-value" style="font-size:2rem;">0s</div>
              </div>
            </div>
          </div>

          <div class="stat-box" style="gap:8px;">
            <span class="stat-label">What a tap does</span>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn-nav-pill is-on" id="btnMineDig" style="flex:1;">Dig</button>
              <button type="button" class="btn-nav-pill" id="btnMineFlag" style="flex:1;">Flag</button>
            </div>
          </div>

          <div class="stat-label" style="text-align:center;">
            Desktop par right-click se seedha flag lag jata hai.
          </div>
        </div>
      </div>
    `;

    this.setupListeners();
  },

  start() {
    this.isFirstClick = true;
    this.isGameOver = false;
    this.flagMode = false;
    this.timerSec = 0;
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.initBoardData();
    this.renderBoard();
    this.updateStats();
    this.setFlagModeUI(false);
  },

  initBoardData() {
    this.board = [];
    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) {
        row.push({
          r, c,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          neighborMines: 0
        });
      }
      this.board.push(row);
    }
  },

  placeMines(safeR, safeC) {
    let placed = 0;
    while (placed < this.minesCount) {
      const r = Math.floor(Math.random() * this.rows);
      const c = Math.floor(Math.random() * this.cols);

      // Pehle click aur uske aas-paas mine nahi lagayenge
      const isSafeZone = Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1;
      if (!this.board[r][c].isMine && !isSafeZone) {
        this.board[r][c].isMine = true;
        placed++;
      }
    }

    // Number of surrounding mines calculate karein
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.board[r][c].isMine) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && this.board[nr][nc].isMine) {
              count++;
            }
          }
        }
        this.board[r][c].neighborMines = count;
      }
    }
  },

  setupListeners() {
    document.getElementById('btnMineDig')?.addEventListener('click', () => this.setFlagModeUI(false));
    document.getElementById('btnMineFlag')?.addEventListener('click', () => this.setFlagModeUI(true));

    const grid = document.getElementById('minesGrid');
    if (!grid) return;

    grid.addEventListener('click', (e) => {
      const cellEl = e.target.closest('.mine-cell');
      if (!cellEl || this.isGameOver) return;

      const r = parseInt(cellEl.getAttribute('data-r'), 10);
      const c = parseInt(cellEl.getAttribute('data-c'), 10);

      if (this.flagMode) {
        this.toggleFlag(r, c);
      } else {
        this.revealCell(r, c);
      }
    });

    grid.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const cellEl = e.target.closest('.mine-cell');
      if (!cellEl || this.isGameOver) return;

      const r = parseInt(cellEl.getAttribute('data-r'), 10);
      const c = parseInt(cellEl.getAttribute('data-c'), 10);
      this.toggleFlag(r, c);
    });
  },

  setFlagModeUI(active) {
    this.flagMode = active;
    const btnDig = document.getElementById('btnMineDig');
    const btnFlag = document.getElementById('btnMineFlag');

    if (btnDig && btnFlag) {
      btnDig.classList.toggle('is-on', !active);
      btnFlag.classList.toggle('is-on', active);
    }
  },

  startTimer() {
    this.timerInterval = setInterval(() => {
      this.timerSec++;
      const tEl = document.getElementById('minesTimer');
      if (tEl) tEl.textContent = `${this.timerSec}s`;
    }, 1000);
  },

  toggleFlag(r, c) {
    const cell = this.board[r][c];
    if (cell.isRevealed) return;

    cell.isFlagged = !cell.isFlagged;
    this.ctx.fx.playTone(520, 'triangle', 0.02, 0.08);
    this.renderCell(r, c);
    this.updateStats();
  },

  revealCell(r, c) {
    const cell = this.board[r][c];
    if (cell.isRevealed || cell.isFlagged) return;

    if (this.isFirstClick) {
      this.isFirstClick = false;
      this.placeMines(r, c);
      this.startTimer();
    }

    if (cell.isMine) {
      this.handleGameOver(false);
      return;
    }

    this.floodReveal(r, c);
    this.ctx.fx.playTone(400, 'triangle', 0.02, 0.06);
    this.checkWinCondition();
  },

  floodReveal(r, c) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return;
    const cell = this.board[r][c];
    if (cell.isRevealed || cell.isFlagged || cell.isMine) return;

    cell.isRevealed = true;
    this.renderCell(r, c);

    if (cell.neighborMines === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr !== 0 || dc !== 0) this.floodReveal(r + dr, c + dc);
        }
      }
    }
  },

  checkWinCondition() {
    let unrevealedSafeCells = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.board[r][c].isMine && !this.board[r][c].isRevealed) {
          unrevealedSafeCells++;
        }
      }
    }

    if (unrevealedSafeCells === 0) {
      this.handleGameOver(true);
    }
  },

  handleGameOver(won) {
    this.isGameOver = true;
    if (this.timerInterval) clearInterval(this.timerInterval);

    // Sabhi mines show karein
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.board[r][c].isMine) {
          this.board[r][c].isRevealed = true;
          this.renderCell(r, c);
        }
      }
    }

    if (won) {
      this.ctx.recordResult('WIN', {
        score: Math.max(10, 1000 - this.timerSec * 5),
        time: this.timerSec,
        summary: `All safe squares opened in ${this.timerSec}s.`
      });
    } else {
      this.ctx.recordResult('LOSS', {
        score: 0,
        summary: `You hit a mine after ${this.timerSec}s.`
      });
    }
  },

  renderBoard() {
    const grid = document.getElementById('minesGrid');
    if (!grid) return;

    grid.innerHTML = this.board.flat().map(cell => `
      <button type="button" class="mine-cell" data-r="${cell.r}" data-c="${cell.c}"></button>
    `).join('');
  },

  renderCell(r, c) {
    const cell = this.board[r][c];
    const el = document.querySelector(`.mine-cell[data-r="${r}"][data-c="${c}"]`);
    if (!el) return;

    el.classList.toggle('open', cell.isRevealed);
    el.classList.toggle('boom', cell.isRevealed && cell.isMine);

    if (cell.isRevealed) {
      if (cell.isMine) {
        el.innerHTML = MINE_SVG;
      } else if (cell.neighborMines > 0) {
        el.dataset.n = cell.neighborMines;
        el.textContent = cell.neighborMines;
      } else {
        el.textContent = '';
      }
    } else {
      el.innerHTML = cell.isFlagged ? FLAG_SVG : '';
    }
  },

  updateStats() {
    let flagsCount = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.board[r][c].isFlagged) flagsCount++;
      }
    }
    const rem = document.getElementById('minesRemaining');
    if (rem) rem.textContent = Math.max(0, this.minesCount - flagsCount);
  },

  pause() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  },

  resume() {
    if (!this.isFirstClick && !this.isGameOver) {
      this.startTimer();
    }
  },

  restart() { this.start(); },

  destroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.container = null;
  }
};