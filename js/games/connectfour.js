/**
 * js/games/connectfour.js
 * Connect 4 — Four in a Line Tactile Cabinet Board
 * Features: 7x6 matrix, physical gravity disc drop, smart bot logic, 2P local mode
 */

export default {
  id: 'connectfour',
  title: 'Connect 4',
  accent: '#ff2a5f',

  ctx: null,
  container: null,

  cols: 7,
  rows: 6,
  board: [], // 2D array [row][col]: null | 'RED' | 'YELLOW'
  currentPlayer: 'RED', // Player is RED, Bot/P2 is YELLOW
  isLocked: false,
  isGameOver: false,
  mode: 'VS_BOT', // 'VS_BOT' | '2P_LOCAL'
  seriesScore: { red: 0, yellow: 0, ties: 0 },

  mount(el, sessionCtx) {
    this.container = el;
    this.ctx = sessionCtx;

    this.container.innerHTML = `
      <div class="arena-dual-layout">
        <!-- Physical Vertical Connect 4 Stand -->
        <div class="arena-board-frame" style="flex-direction:column; align-items:stretch; width:min(calc(100vw - 24px), 440px); padding:12px; background:#142340; border:3px solid #000; border-radius:12px; box-shadow:var(--shadow-offset-lg);">
          <!-- Top Column Drop Buttons -->
          <div id="c4DropArrows" style="display:grid; grid-template-columns:repeat(7, 1fr); gap:6px; margin-bottom:8px; width:100%;">
            ${Array(7).fill(0).map((_, i) => `
              <button type="button" class="btn-nav-pill c4-drop-btn" data-col="${i}" style="height:36px; min-width:0; padding:0; justify-content:center; font-size:1.1rem; border-color:var(--status-loss);" aria-label="Drop in column ${i + 1}">▼</button>
            `).join('')}
          </div>

          <!-- 7x6 Slotted Grid Board -->
          <div id="c4GridWrapper" style="display:grid; grid-template-columns:repeat(7, 1fr); grid-template-rows:repeat(6, 1fr); gap:6px; width:100%; aspect-ratio:7 / 6; background:#1b356b; padding:8px; border-radius:8px; border:2px solid #000; box-shadow:inset 0 4px 10px rgba(0,0,0,0.5);">
            ${Array(42).fill(0).map((_, i) => {
              const r = Math.floor(i / 7);
              const c = i % 7;
              return `
                <div class="c4-slot" data-r="${r}" data-c="${c}" style="position:relative; width:100%; height:100%; min-width:0; border-radius:50%; background:#0a0d14; border:2px solid #000; overflow:hidden; box-shadow:inset 0 4px 6px rgba(0,0,0,0.7); cursor:pointer;">
                  <div class="c4-disc" style="position:absolute; inset:0; border-radius:50%; transform:translateY(-120%); transition:transform 0.22s cubic-bezier(0.3, 0, 0.2, 1);"></div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Right Side Control Deck -->
        <div class="arena-side-controls">
          <!-- Turn Status Readout -->
          <div class="telemetry-cell" style="text-align:center; padding:16px;">
            <span class="t-label">Turn</span>
            <div id="c4TurnStatus" class="t-val" style="font-size:1.3rem; margin:4px 0; color:var(--status-loss);">
              Your turn (Red)
            </div>
            <div id="c4SubStatus" style="font-size:0.75rem; color:var(--text-dim); font-weight:600;">
              Pick a column to drop
            </div>
          </div>

          <!-- Series Scoreboard Card -->
          <div class="telemetry-cell" style="padding:14px;">
            <span class="t-label" style="text-align:center; margin-bottom:8px;">Series Score</span>
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; text-align:center;">
              <div>
                <div style="font-size:0.65rem; color:var(--text-sub); font-weight:800;">RED</div>
                <div id="c4ScoreRed" class="t-val" style="font-size:1.4rem; color:var(--status-loss);">0</div>
              </div>
              <div>
                <div style="font-size:0.65rem; color:var(--text-sub); font-weight:800;">DRAWS</div>
                <div id="c4ScoreTies" class="t-val" style="font-size:1.4rem; color:var(--text-main);">0</div>
              </div>
              <div>
                <div style="font-size:0.65rem; color:var(--text-sub); font-weight:800;">YELLOW</div>
                <div id="c4ScoreYellow" class="t-val" style="font-size:1.4rem; color:var(--status-coin);">0</div>
              </div>
            </div>
          </div>

          <!-- Mode Selector -->
          <div class="telemetry-cell" style="gap:8px;">
            <span class="t-label">Opponent</span>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn-nav-pill" id="btnC4VsBot" style="flex:1; justify-content:center; border-color:var(--brand-accent);">vs Bot</button>
              <button type="button" class="btn-nav-pill" id="btnC4VsPlayer" style="flex:1; justify-content:center;">2-Player</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupListeners();
  },

  start(opts = {}) {
    this.mode = opts.mode || this.mode || 'VS_BOT';
    this.board = Array(this.rows).fill(null).map(() => Array(this.cols).fill(null));
    this.currentPlayer = 'RED';
    this.isLocked = false;
    this.isGameOver = false;

    this.resetBoardVisuals();
    this.updateStatus();
    this.setModeUI(this.mode);
  },

  setModeUI(m) {
    this.mode = m;
    const btnBot = document.getElementById('btnC4VsBot');
    const btnPlayer = document.getElementById('btnC4VsPlayer');
    if (btnBot && btnPlayer) {
      btnBot.style.borderColor = (m === 'VS_BOT') ? 'var(--brand-accent)' : 'var(--border-strong)';
      btnPlayer.style.borderColor = (m === '2P_LOCAL') ? 'var(--brand-accent)' : 'var(--border-strong)';
    }
  },

  setupListeners() {
    document.getElementById('btnC4VsBot')?.addEventListener('click', () => {
      this.setModeUI('VS_BOT');
      this.start({ mode: 'VS_BOT' });
    });
    document.getElementById('btnC4VsPlayer')?.addEventListener('click', () => {
      this.setModeUI('2P_LOCAL');
      this.start({ mode: '2P_LOCAL' });
    });

    const handleColumnClick = (col) => {
      if (this.isLocked || this.isGameOver) return;
      if (this.mode === 'VS_BOT' && this.currentPlayer !== 'RED') return;
      this.dropDisc(col);
    };

    document.getElementById('c4DropArrows')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.c4-drop-btn');
      if (btn) handleColumnClick(parseInt(btn.getAttribute('data-col'), 10));
    });

    document.getElementById('c4GridWrapper')?.addEventListener('click', (e) => {
      const slot = e.target.closest('.c4-slot');
      if (slot) handleColumnClick(parseInt(slot.getAttribute('data-c'), 10));
    });
  },

  findLowestEmptyRow(col) {
    for (let r = this.rows - 1; r >= 0; r--) {
      if (this.board[r][col] === null) return r;
    }
    return -1;
  },

  dropDisc(col) {
    const row = this.findLowestEmptyRow(col);
    if (row === -1) return; // Column full

    this.isLocked = true;
    this.board[row][col] = this.currentPlayer;
    this.renderDisc(row, col, this.currentPlayer);
    this.ctx.fx.sfx.tokenHop();

    const winLine = this.checkWin(this.board, row, col, this.currentPlayer);

    if (winLine) {
      this.handleGameEnd(this.currentPlayer, winLine);
      return;
    }

    if (this.isBoardFull()) {
      this.handleGameEnd('DRAW', null);
      return;
    }

    // Next turn
    this.currentPlayer = (this.currentPlayer === 'RED') ? 'YELLOW' : 'RED';
    this.updateStatus();

    if (this.mode === 'VS_BOT' && this.currentPlayer === 'YELLOW') {
      this.triggerBotTurn();
    } else {
      this.isLocked = false;
    }
  },

  triggerBotTurn() {
    const sub = document.getElementById('c4SubStatus');
    if (sub) sub.textContent = 'Bot is calculating drop...';

    setTimeout(() => {
      if (this.isGameOver) return;
      const col = this.computeBotMove();
      this.dropDisc(col);
    }, 450);
  },

  computeBotMove() {
    const validCols = [];
    for (let c = 0; c < this.cols; c++) {
      if (this.findLowestEmptyRow(c) !== -1) validCols.push(c);
    }

    // 1. Check if Bot can win on next move
    for (const c of validCols) {
      const r = this.findLowestEmptyRow(c);
      this.board[r][c] = 'YELLOW';
      const win = this.checkWin(this.board, r, c, 'YELLOW');
      this.board[r][c] = null;
      if (win) return c;
    }

    // 2. Block Player from winning on next move
    for (const c of validCols) {
      const r = this.findLowestEmptyRow(c);
      this.board[r][c] = 'RED';
      const win = this.checkWin(this.board, r, c, 'RED');
      this.board[r][c] = null;
      if (win) return c;
    }

    // 3. Center column preference
    if (validCols.includes(3)) return 3;

    return validCols[Math.floor(Math.random() * validCols.length)];
  },

  checkWin(b, r, c, player) {
    const directions = [
      [[0, 1], [0, -1]],  // Horizontal
      [[1, 0], [-1, 0]],  // Vertical
      [[1, 1], [-1, -1]], // Diagonal \
      [[1, -1], [-1, 1]]  // Diagonal /
    ];

    for (const [dir1, dir2] of directions) {
      const line = [{ r, c }];

      for (const [dr, dc] of [dir1, dir2]) {
        let currR = r + dr;
        let currC = c + dc;
        while (currR >= 0 && currR < this.rows && currC >= 0 && currC < this.cols && b[currR][currC] === player) {
          line.push({ r: currR, c: currC });
          currR += dr;
          currC += dc;
        }
      }

      if (line.length >= 4) return line;
    }

    return null;
  },

  isBoardFull() {
    return this.board[0].every(slot => slot !== null);
  },

  handleGameEnd(result, winLine) {
    this.isGameOver = true;
    this.isLocked = true;

    if (result === 'DRAW') {
      this.seriesScore.ties++;
      this.ctx.fx.playTone(330, 'triangle', 0.15, 0.12);
      this.ctx.recordResult('DRAW', { summary: 'Match Draw', ranked: this.mode === 'VS_BOT' });
    } else {
      if (winLine) {
        winLine.forEach(({ r, c }) => {
          const slot = document.querySelector(`.c4-slot[data-r="${r}"][data-c="${c}"]`);
          if (slot) {
            slot.style.border = '2px solid #ffffff';
            slot.style.boxShadow = '0 0 10px #ffffff';
          }
        });
      }

      if (result === 'RED') {
        this.seriesScore.red++;
        this.ctx.fx.sfx.victory();
        this.ctx.recordResult('WIN', { summary: 'Player Won Connect 4!', ranked: this.mode === 'VS_BOT' });
      } else {
        this.seriesScore.yellow++;
        this.ctx.fx.sfx.defeat();
        this.ctx.recordResult('LOSS', { summary: 'Bot Won Connect 4', ranked: this.mode === 'VS_BOT' });
      }
    }

    this.updateScoreboard();

    setTimeout(() => {
      this.start({ mode: this.mode });
    }, 2500);
  },

  renderDisc(r, c, player) {
    const slot = document.querySelector(`.c4-slot[data-r="${r}"][data-c="${c}"]`);
    if (!slot) return;

    const disc = slot.querySelector('.c4-disc');
    if (disc) {
      disc.style.background = (player === 'RED') ? '#ff2a5f' : '#ffb703';
      disc.style.border = '2px solid #000';
      disc.style.boxShadow = 'inset 0 -3px 0 rgba(0,0,0,0.4)';
      disc.style.transform = 'translateY(0%)';
    }
  },

  resetBoardVisuals() {
    document.querySelectorAll('.c4-slot').forEach(slot => {
      slot.style.border = '2px solid #000';
      slot.style.boxShadow = 'inset 0 4px 6px rgba(0,0,0,0.7)';
      const disc = slot.querySelector('.c4-disc');
      if (disc) {
        disc.style.transform = 'translateY(-120%)';
        disc.style.background = 'transparent';
      }
    });
  },

  updateStatus() {
    const label = document.getElementById('c4TurnStatus');
    const sub = document.getElementById('c4SubStatus');
    if (!label) return;

    const colorHex = (this.currentPlayer === 'RED') ? 'var(--status-loss)' : 'var(--status-coin)';
    label.style.color = colorHex;

    if (this.mode === 'VS_BOT') {
      label.textContent = (this.currentPlayer === 'RED') ? 'Your turn (Red)' : 'Bot turn (Yellow)';
      if (sub) sub.textContent = (this.currentPlayer === 'RED') ? 'Pick a column to drop' : 'Bot is calculating...';
    } else {
      label.textContent = (this.currentPlayer === 'RED') ? 'Player 1 (Red)' : 'Player 2 (Yellow)';
      if (sub) sub.textContent = 'Pass to player ' + (this.currentPlayer === 'RED' ? '1' : '2');
    }
  },

  updateScoreboard() {
    const r = document.getElementById('c4ScoreRed');
    const t = document.getElementById('c4ScoreTies');
    const y = document.getElementById('c4ScoreYellow');
    if (r) r.textContent = this.seriesScore.red;
    if (t) t.textContent = this.seriesScore.ties;
    if (y) y.textContent = this.seriesScore.yellow;
  },

  pause() { this.isLocked = true; },
  resume() { if (!this.isGameOver) this.isLocked = false; },
  restart() {
    this.seriesScore = { red: 0, yellow: 0, ties: 0 };
    this.updateScoreboard();
    this.start({ mode: this.mode });
  },
  destroy() { this.container = null; }
};