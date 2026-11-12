// connectfour.js: Connect 4 on a 7 by 6 board. The bot wins if it can, blocks if it must,
// and otherwise likes the middle. You can also play a friend on the same phone.

export default {
  id: 'connectfour',
  title: 'Connect 4',
  accent: '#d8504e',
  vsOpponent: true,

  ctx: null,
  container: null,

  cols: 7,
  rows: 6,
  board: [], // 2D array [row][col]: null | 'RED' | 'YELLOW'
  currentPlayer: 'RED', // Player is RED, Bot/P2 is YELLOW
  isLocked: false,
  isGameOver: false,
  mode: 'VS_BOT', // 'VS_BOT' | '2P_LOCAL'

  mount(el, sessionCtx) {
    this.container = el;
    this.ctx = sessionCtx;

    this.container.innerHTML = `
      <div class="arena-dual-layout">
        <div class="arena-board-frame" style="flex-direction:column; align-items:stretch; width:min(calc(100vw - 24px), 440px); padding:10px;">
          <div id="c4DropArrows" style="display:grid; grid-template-columns:repeat(7, 1fr); gap:6px; margin-bottom:8px; width:100%;">
            ${Array(7).fill(0).map((_, i) => `
              <button type="button" class="btn-nav-pill c4-drop-btn" data-col="${i}" style="height:36px; min-width:0; padding:0;" aria-label="Drop in column ${i + 1}">&#9660;</button>
            `).join('')}
          </div>

          <div id="c4GridWrapper">
            ${Array(42).fill(0).map((_, i) => {
              const r = Math.floor(i / 7);
              const c = i % 7;
              return `
                <div class="c4-slot" data-r="${r}" data-c="${c}">
                  <div class="c4-disc"></div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="arena-side-controls">
          <div class="stat-box" style="text-align:center;">
            <div id="c4TurnStatus" class="stat-value">Your turn (red)</div>
            <div id="c4SubStatus" class="stat-label">Pick a column</div>
          </div>

          <div class="stat-box" style="gap:8px;">
            <span class="stat-label">Who do you play?</span>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn-nav-pill is-on" id="btnC4VsBot" style="flex:1;">The bot</button>
              <button type="button" class="btn-nav-pill" id="btnC4VsPlayer" style="flex:1;">A friend</button>
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
      btnBot.classList.toggle('is-on', m === 'VS_BOT');
      btnPlayer.classList.toggle('is-on', m === '2P_LOCAL');
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
    if (row === -1) return; // column is full

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
    if (sub) sub.textContent = 'Thinking...';

    this.ctx.scheduler.after(450, () => {
      if (this.isGameOver) return;
      const col = this.computeBotMove();
      this.dropDisc(col);
    });
  },

  computeBotMove() {
    const validCols = [];
    for (let c = 0; c < this.cols; c++) {
      if (this.findLowestEmptyRow(c) !== -1) validCols.push(c);
    }

    // can the bot win right now?
    for (const c of validCols) {
      const r = this.findLowestEmptyRow(c);
      this.board[r][c] = 'YELLOW';
      const win = this.checkWin(this.board, r, c, 'YELLOW');
      this.board[r][c] = null;
      if (win) return c;
    }

    // can the player win next move? block it
    for (const c of validCols) {
      const r = this.findLowestEmptyRow(c);
      this.board[r][c] = 'RED';
      const win = this.checkWin(this.board, r, c, 'RED');
      this.board[r][c] = null;
      if (win) return c;
    }

    // otherwise the middle column
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

    const vsBot = this.mode === 'VS_BOT';

    const label = document.getElementById('c4TurnStatus');
    const sub = document.getElementById('c4SubStatus');
    if (label) label.textContent = 'Game over';
    if (sub) sub.textContent = result === 'DRAW' ? 'The board is full' : 'Four in a row';

    if (result === 'DRAW') {
      // let the last disc land before the dialog opens
      this.ctx.scheduler.after(500, () => {
        this.ctx.recordResult('DRAW', { counts: vsBot, summary: 'The board is full. Nobody won.' });
      });
      return;
    }

    winLine?.forEach(({ r, c }) => {
      document.querySelector(`.c4-slot[data-r="${r}"][data-c="${c}"]`)?.classList.add('c4-win');
    });

    this.ctx.scheduler.after(900, () => {
      if (result === 'RED') {
        this.ctx.recordResult('WIN', { counts: vsBot, summary: vsBot ? 'You got four in a row.' : 'Red got four in a row.' });
      } else {
        this.ctx.recordResult('LOSS', { counts: vsBot, summary: vsBot ? 'The bot got four in a row.' : 'Yellow got four in a row.' });
      }
    });
  },

  renderDisc(r, c, player) {
    const slot = document.querySelector(`.c4-slot[data-r="${r}"][data-c="${c}"]`);
    if (!slot) return;

    const disc = slot.querySelector('.c4-disc');
    if (disc) {
      disc.classList.add(player === 'RED' ? 'red' : 'yellow');
      disc.style.transform = 'translateY(0%)';
    }
  },

  resetBoardVisuals() {
    document.querySelectorAll('.c4-slot').forEach(slot => {
      slot.classList.remove('c4-win');
      const disc = slot.querySelector('.c4-disc');
      if (disc) {
        disc.className = 'c4-disc';
        disc.style.transform = 'translateY(-120%)';
      }
    });
  },

  updateStatus() {
    const label = document.getElementById('c4TurnStatus');
    const sub = document.getElementById('c4SubStatus');
    if (!label) return;

    const red = this.currentPlayer === 'RED';

    if (this.mode === 'VS_BOT') {
      label.textContent = red ? 'Your turn (red)' : "Bot's turn (yellow)";
      if (sub) sub.textContent = red ? 'Pick a column' : 'Thinking...';
    } else {
      label.textContent = red ? 'Player 1 (red)' : 'Player 2 (yellow)';
      if (sub) sub.textContent = 'Pass the phone after your move';
    }
  },

  pause() { this.isLocked = true; },
  resume() { if (!this.isGameOver) this.isLocked = false; },
  restart() {
    this.start({ mode: this.mode });
  },
  destroy() { this.container = null; }
};