/**
 * js/games/minesweeper.js
 * Minesweeper — Tactile Physical Grid Edition
 * 9x9 grid, 10 mines, safe first click, flagging, flood fill reveal
 */

export default {
  id: 'minesweeper',
  title: 'Minesweeper',
  accent: '#ff2a5f',

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
        <div class="arena-board-frame" style="padding:14px; background:var(--bg-panel); border:2px solid var(--border-strong); border-radius:var(--radius-card); box-shadow:var(--shadow-offset-lg);">
          <div id="minesGrid" style="display:grid; grid-template-columns:repeat(9, 34px); grid-template-rows:repeat(9, 34px); gap:4px; background:var(--bg-base); padding:8px; border-radius:6px; border:2px solid var(--border-strong);"></div>
        </div>

        <div class="arena-side-controls">
          <div class="telemetry-cell" style="padding:16px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; text-align:center;">
              <div>
                <span class="t-label">Mines Left</span>
                <div id="minesRemaining" class="t-val" style="font-size:2rem; color:var(--status-loss); margin-top:2px;">10</div>
              </div>
              <div>
                <span class="t-label">Time</span>
                <div id="minesTimer" class="t-val" style="font-size:2rem; margin-top:2px;">0s</div>
              </div>
            </div>
          </div>

          <div class="telemetry-cell" style="gap:8px;">
            <span class="t-label">Action Mode</span>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn-nav-pill" id="btnMineDig" style="flex:1; justify-content:center; border-color:var(--brand-accent);">⛏ Dig</button>
              <button type="button" class="btn-nav-pill" id="btnMineFlag" style="flex:1; justify-content:center;">🚩 Flag</button>
            </div>
          </div>

          <div class="telemetry-cell" style="padding:12px; text-align:center;">
            <span class="t-label">Tip</span>
            <p style="font-size:0.75rem; color:var(--text-sub); margin-top:4px; line-height:1.4;">
              Desktop par <strong>Right-click</strong> karke seedhe flag laga sakte hain.
            </p>
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
      btnDig.style.borderColor = !active ? 'var(--brand-accent)' : 'var(--border-strong)';
      btnFlag.style.borderColor = active ? 'var(--status-loss)' : 'var(--border-strong)';
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
      this.ctx.fx.sfx.victory();
      this.ctx.recordResult('WIN', {
        score: Math.max(10, 1000 - this.timerSec * 5),
        summary: `Mines Cleared in ${this.timerSec}s!`,
        ranked: true
      });
    } else {
      this.ctx.fx.sfx.defeat();
      this.ctx.recordResult('LOSS', {
        score: 0,
        summary: `Stepped on a mine after ${this.timerSec}s`,
        ranked: true
      });
    }
  },

  renderBoard() {
    const grid = document.getElementById('minesGrid');
    if (!grid) return;

    grid.innerHTML = this.board.flat().map(cell => `
      <button type="button" class="mine-cell" data-r="${cell.r}" data-c="${cell.c}" style="width:34px; height:34px; padding:0; display:flex; align-items:center; justify-content:center; background:var(--bg-surface); border:1.5px solid var(--border-strong); border-radius:4px; font-family:'Archivo Black', sans-serif; font-size:0.85rem; font-weight:900; cursor:pointer; box-shadow:1.5px 1.5px 0px #000; user-select:none;"></button>
    `).join('');
  },

  renderCell(r, c) {
    const cell = this.board[r][c];
    const el = document.querySelector(`.mine-cell[data-r="${r}"][data-c="${c}"]`);
    if (!el) return;

    if (cell.isRevealed) {
      el.style.boxShadow = 'none';
      el.style.transform = 'translate(1px, 1px)';

      if (cell.isMine) {
        el.style.background = 'var(--status-loss)';
        el.textContent = '💣';
      } else {
        el.style.background = 'var(--bg-panel)';
        el.style.borderColor = 'var(--border-line)';
        if (cell.neighborMines > 0) {
          const colors = ['', '#00f0ff', '#00e575', '#ffb703', '#1E88E5', '#ff2a5f', '#7209b7', '#000000', '#657185'];
          el.style.color = colors[cell.neighborMines] || '#ffffff';
          el.textContent = cell.neighborMines;
        } else {
          el.textContent = '';
        }
      }
    } else {
      el.style.background = 'var(--bg-surface)';
      el.style.boxShadow = '1.5px 1.5px 0px #000';
      el.style.transform = 'none';
      el.textContent = cell.isFlagged ? '🚩' : '';
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