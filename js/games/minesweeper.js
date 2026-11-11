export default {
  id: 'minesweeper',
  title: 'Minesweeper',
  accent: '#f85149',

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
        <div class="arena-board-frame" style="padding:10px; background:var(--bg-panel); border:1px solid var(--border-line); border-radius:8px;">
          <div id="minesGrid" style="display:grid; grid-template-columns:repeat(9, 32px); grid-template-rows:repeat(9, 32px); gap:3px; background:var(--bg-base); padding:6px; border-radius:4px; border:1px solid var(--border-line);"></div>
        </div>

        <div class="arena-side-controls">
          <div class="telemetry-cell" style="padding:12px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; text-align:center;">
              <div>
                <span class="t-label">Mines Left</span>
                <div id="minesRemaining" class="t-val" style="font-size:1.6rem; color:var(--status-loss); margin-top:2px;">10</div>
              </div>
              <div>
                <span class="t-label">Time</span>
                <div id="minesTimer" class="t-val" style="font-size:1.6rem; margin-top:2px;">0s</div>
              </div>
            </div>
          </div>

          <div class="telemetry-cell" style="gap:6px;">
            <span class="t-label">Tap Action</span>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn-nav-pill" id="btnMineDig" style="flex:1; justify-content:center; border-color:var(--brand-accent);">Dig</button>
              <button type="button" class="btn-nav-pill" id="btnMineFlag" style="flex:1; justify-content:center;">Flag</button>
            </div>
          </div>

          <div class="telemetry-cell" style="padding:8px 10px; text-align:center;">
            <p style="font-size:0.75rem; color:var(--text-sub); line-height:1.35;">
              Right-click on desktop to flag squares directly.
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

      const isSafeZone = Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1;
      if (!this.board[r][c].isMine && !isSafeZone) {
        this.board[r][c].isMine = true;
        placed++;
      }
    }

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
      btnDig.style.borderColor = !active ? 'var(--brand-accent)' : 'var(--border-line)';
      btnFlag.style.borderColor = active ? 'var(--status-loss)' : 'var(--border-line)';
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
        summary: `Cleared in ${this.timerSec}s!`
      });
    } else {
      this.ctx.fx.sfx.defeat();
      this.ctx.recordResult('LOSS', {
        score: 0,
        summary: `Hit a mine after ${this.timerSec}s`
      });
    }
  },

  renderBoard() {
    const grid = document.getElementById('minesGrid');
    if (!grid) return;

    grid.innerHTML = this.board.flat().map(cell => `
      <button type="button" class="mine-cell" data-r="${cell.r}" data-c="${cell.c}" style="width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center; background:var(--bg-surface); border:1px solid var(--border-line); border-radius:3px; font-size:0.85rem; font-weight:700; cursor:pointer; user-select:none;"></button>
    `).join('');
  },

  renderCell(r, c) {
    const cell = this.board[r][c];
    const el = document.querySelector(`.mine-cell[data-r="${r}"][data-c="${c}"]`);
    if (!el) return;

    if (cell.isRevealed) {
      if (cell.isMine) {
        el.style.background = 'var(--status-loss)';
        el.style.color = '#ffffff';
        el.textContent = '*';
      } else {
        el.style.background = 'var(--bg-panel)';
        el.style.borderColor = 'var(--border-line)';
        if (cell.neighborMines > 0) {
          const colors = ['', '#2f81f7', '#2ea043', '#d29922', '#1f6feb', '#f85149', '#8250df', '#30363d', '#6e7681'];
          el.style.color = colors[cell.neighborMines] || '#ffffff';
          el.textContent = cell.neighborMines;
        } else {
          el.textContent = '';
        }
      }
    } else {
      el.style.background = 'var(--bg-surface)';
      el.style.color = 'var(--status-loss)';
      el.textContent = cell.isFlagged ? 'P' : '';
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