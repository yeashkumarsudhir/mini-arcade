// tictactoe.js: Tic Tac Toe against a bot (Casual, Medium or Smart) or a friend on the same phone.
// Smart uses minimax, so it never loses.
import { Stats } from '../stats.js';

export default {
  id: 'tictactoe',
  title: 'Tic Tac Toe',
  accent: '#3d63e0',
  vsOpponent: true,

  ctx: null,
  container: null,

  board: Array(9).fill(null),
  isPlayerTurn: true,
  isLocked: false,
  difficulty: 'Medium', // 'Casual' | 'Medium' | 'Impossible' | '2P_LOCAL'
  starterTurn: 'X',

  mount(el, sessionCtx) {
    this.container = el;
    this.ctx = sessionCtx;

    this.container.innerHTML = `
      <div class="arena-dual-layout">
        <div class="ttt-grid-box">
          <div class="ttt-cells-wrapper" id="tttGridWrapper">
            ${Array(9).fill(0).map((_, i) => `<button type="button" class="cell" data-idx="${i}" aria-label="Square ${i + 1}"></button>`).join('')}
          </div>
          <svg id="tttWinningRay" style="position:absolute; inset:0; width:100%; height:100%; pointer-events:none; display:none;" viewBox="0 0 310 310">
            <line id="tttRayLine" x1="0" y1="0" x2="0" y2="0" stroke="var(--status-win)" stroke-width="5" stroke-linecap="round"/>
          </svg>
        </div>

        <div class="arena-side-controls">
          <div class="stat-box" style="text-align:center;">
            <div id="tttTurnStatus" class="stat-value">Your turn (X)</div>
            <div id="tttSubStatus" class="stat-label">Tap an empty square</div>
          </div>

          <div class="stat-box" style="gap:8px;">
            <span class="stat-label">Who do you play?</span>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px;">
              <button type="button" class="btn-nav-pill" id="btnTttCasual">Casual bot</button>
              <button type="button" class="btn-nav-pill is-on" id="btnTttMedium">Medium bot</button>
              <button type="button" class="btn-nav-pill" id="btnTttImpossible">Smart bot</button>
              <button type="button" class="btn-nav-pill" id="btnTttTwoPlayer">A friend</button>
            </div>
          </div>

          <div class="stat-label" id="tttRecord" style="text-align:center;"></div>
        </div>
      </div>
    `;

    this.setupListeners();
  },

  start(opts = {}) {
    this.difficulty = opts.difficulty || this.difficulty;
    this.setPresetUI(this.difficulty);

    this.board = Array(9).fill(null);
    this.isLocked = false;
    this.isPlayerTurn = (this.starterTurn === 'X');

    this.resetBoardVisuals();
    this.updateStatus();
    this.updateRecord();

    if (!this.isPlayerTurn && this.difficulty !== '2P_LOCAL') {
      this.triggerAITurn();
    }
  },

  setPresetUI(diff) {
    this.difficulty = diff;
    const buttons = {
      Casual: 'btnTttCasual',
      Medium: 'btnTttMedium',
      Impossible: 'btnTttImpossible',
      '2P_LOCAL': 'btnTttTwoPlayer'
    };
    for (const [name, id] of Object.entries(buttons)) {
      document.getElementById(id)?.classList.toggle('is-on', name === diff);
    }
  },

  setupListeners() {
    document.getElementById('btnTttCasual')?.addEventListener('click', () => this.start({ difficulty: 'Casual' }));
    document.getElementById('btnTttMedium')?.addEventListener('click', () => this.start({ difficulty: 'Medium' }));
    document.getElementById('btnTttImpossible')?.addEventListener('click', () => this.start({ difficulty: 'Impossible' }));
    document.getElementById('btnTttTwoPlayer')?.addEventListener('click', () => this.start({ difficulty: '2P_LOCAL' }));

    document.getElementById('tttGridWrapper')?.addEventListener('click', (e) => {
      const cell = e.target.closest('.cell');
      if (!cell || this.isLocked) return;

      const idx = parseInt(cell.getAttribute('data-idx'), 10);
      if (this.board[idx] !== null) return;

      if (this.difficulty === '2P_LOCAL') {
        const symbol = this.isPlayerTurn ? 'X' : 'O';
        this.makeMove(idx, symbol);
        const winInfo = this.checkWin(this.board);
        if (winInfo) this.handleResolution(winInfo);
        else if (this.isBoardFull(this.board)) this.handleResolution('DRAW');
        else {
          this.isPlayerTurn = !this.isPlayerTurn;
          this.updateStatus();
        }
      } else if (this.isPlayerTurn) {
        this.makeMove(idx, 'X');
        const winInfo = this.checkWin(this.board);
        if (winInfo) this.handleResolution(winInfo);
        else if (this.isBoardFull(this.board)) this.handleResolution('DRAW');
        else {
          this.isPlayerTurn = false;
          this.updateStatus();
          this.triggerAITurn();
        }
      }
    });
  },

  makeMove(idx, symbol) {
    this.board[idx] = symbol;
    const cell = document.querySelector(`.cell[data-idx="${idx}"]`);
    if (cell) {
      cell.textContent = symbol;
      cell.classList.add(symbol.toLowerCase());
      this.ctx.fx.playTone(symbol === 'X' ? 620 : 420, 'triangle', 0.04, 0.12);
    }
  },

  triggerAITurn() {
    this.isLocked = true;
    const sub = document.getElementById('tttSubStatus');
    if (sub) sub.textContent = 'Thinking...';

    this.ctx.scheduler.after(350, () => {
      const move = this.computeAIMove();
      this.makeMove(move, 'O');

      const winInfo = this.checkWin(this.board);
      if (winInfo) {
        this.handleResolution(winInfo);
      } else if (this.isBoardFull(this.board)) {
        this.handleResolution('DRAW');
      } else {
        this.isPlayerTurn = true;
        this.isLocked = false;
        this.updateStatus();
      }
    });
  },

  computeAIMove() {
    const available = [];
    for (let i = 0; i < 9; i++) {
      if (this.board[i] === null) available.push(i);
    }

    if (this.difficulty === 'Casual') {
      if (Math.random() < 0.45) {
        return available[Math.floor(Math.random() * available.length)];
      }
    } else if (this.difficulty === 'Medium') {
      if (Math.random() < 0.3) {
        return available[Math.floor(Math.random() * available.length)];
      }
    }

    return this.minimaxBestMove();
  },

  minimaxBestMove() {
    let bestScore = -Infinity;
    let bestMove = -1;

    for (let i = 0; i < 9; i++) {
      if (this.board[i] === null) {
        this.board[i] = 'O';
        const score = this.minimax(this.board, 0, false);
        this.board[i] = null;
        if (score > bestScore) {
          bestScore = score;
          bestMove = i;
        }
      }
    }
    return bestMove;
  },

  minimax(board, depth, isMaximizing) {
    const winInfo = this.checkWin(board);
    if (winInfo) {
      return winInfo.winner === 'O' ? 10 - depth : depth - 10;
    }
    if (this.isBoardFull(board)) return 0;

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
          board[i] = 'O';
          const ev = this.minimax(board, depth + 1, false);
          board[i] = null;
          maxEval = Math.max(maxEval, ev);
        }
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
          board[i] = 'X';
          const ev = this.minimax(board, depth + 1, true);
          board[i] = null;
          minEval = Math.min(minEval, ev);
        }
      }
      return minEval;
    }
  },

  checkWin(board) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];

    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], line: [a, b, c] };
      }
    }
    return null;
  },

  isBoardFull(board) {
    return board.every(c => c !== null);
  },

  handleResolution(result) {
    this.isLocked = true;
    const isWin = typeof result === 'object';

    const label = document.getElementById('tttTurnStatus');
    const sub = document.getElementById('tttSubStatus');
    if (label) label.textContent = 'Game over';
    if (sub) sub.textContent = isWin ? `${result.winner} got three in a row` : 'It is a draw';

    if (isWin) {
      const { winner, line } = result;
      this.drawWinningRay(line);

      line.forEach(idx => {
        document.querySelector(`.cell[data-idx="${idx}"]`)?.classList.add('winning-cell');
      });

      // the result dialog opens a little later so the winning line can be seen
      const level = { Casual: 'casual', Medium: 'medium', Impossible: 'smart' }[this.difficulty];
      this.ctx.scheduler.after(900, () => {
        if (this.difficulty === '2P_LOCAL') {
          this.ctx.recordResult(winner === 'X' ? 'WIN' : 'LOSS', { counts: false, summary: `Player ${winner === 'X' ? 1 : 2} (${winner}) won.` });
        } else if (winner === 'X') {
          this.ctx.recordResult('WIN', { mode: this.difficulty, summary: `You beat the ${level} bot.` });
        } else {
          this.ctx.recordResult('LOSS', { mode: this.difficulty, summary: `The ${level} bot won this one.` });
        }
      });
    } else {
      this.ctx.scheduler.after(500, () => {
        this.ctx.recordResult('DRAW', { mode: this.difficulty, counts: this.difficulty !== '2P_LOCAL', summary: 'Nobody got three in a row.' });
      });
    }

    // whoever did not start goes first next time
    this.starterTurn = this.starterTurn === 'X' ? 'O' : 'X';
  },

  drawWinningRay(line) {
    const svg = document.getElementById('tttWinningRay');
    const lineEl = document.getElementById('tttRayLine');
    if (!svg || !lineEl) return;

    // cell centres in the 310 by 310 viewBox
    const centers = [
      [55, 55],   [155, 55],  [255, 55],
      [55, 155],  [155, 155], [255, 155],
      [55, 255],  [155, 255], [255, 255]
    ];

    const [startIdx, , endIdx] = line;
    const [x1, y1] = centers[startIdx];
    const [x2, y2] = centers[endIdx];

    lineEl.setAttribute('x1', x1);
    lineEl.setAttribute('y1', y1);
    lineEl.setAttribute('x2', x2);
    lineEl.setAttribute('y2', y2);

    svg.style.display = 'block';
  },

  resetBoardVisuals() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(c => {
      c.textContent = '';
      c.className = 'cell';
    });
    const svg = document.getElementById('tttWinningRay');
    if (svg) svg.style.display = 'none';
  },

  updateStatus() {
    const label = document.getElementById('tttTurnStatus');
    const sub = document.getElementById('tttSubStatus');
    if (!label) return;

    if (this.difficulty === '2P_LOCAL') {
      label.textContent = this.isPlayerTurn ? 'Player 1 (X)' : 'Player 2 (O)';
      if (sub) sub.textContent = 'Pass the phone after your move';
    } else {
      label.textContent = this.isPlayerTurn ? 'Your turn (X)' : "Bot's turn (O)";
      if (sub) sub.textContent = this.isPlayerTurn ? 'Tap an empty square' : 'Thinking...';
    }
  },

  // your running record against the bots, from the saved stats
  updateRecord() {
    const el = document.getElementById('tttRecord');
    if (!el) return;
    const g = Stats.get('tictactoe');
    el.textContent = g.plays ? `Your record: ${g.wins} won, ${g.draws} drawn, ${g.losses} lost` : '';
  },

  pause() {
    this.isLocked = true;
  },

  resume() {
    this.isLocked = false;
  },

  restart() {
    this.start({ difficulty: this.difficulty });
  },

  destroy() {
    this.container = null;
  }
};