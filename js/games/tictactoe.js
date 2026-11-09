/**
 * js/games/tictactoe.js
 * Grid AI — 3x3 Tactile Cabinet Strategy Board
 * Features: Casual, Medium, and Unbeatable Minimax AI with 2P Local mode
 */

export default {
  id: 'tictactoe',
  title: 'Grid AI',
  accent: '#00f0ff',

  ctx: null,
  container: null,

  board: Array(9).fill(null),
  isPlayerTurn: true,
  isLocked: false,
  difficulty: 'Impossible', // 'Casual' | 'Medium' | 'Impossible' | '2P_LOCAL'
  starterTurn: 'X',
  seriesScore: { player: 0, ai: 0, ties: 0 },

  mount(el, sessionCtx) {
    this.container = el;
    this.ctx = sessionCtx;

    this.container.innerHTML = `
      <div class="arena-dual-layout">
        <!-- 3x3 Grid Matrix Viewport -->
        <div class="ttt-grid-box">
          <div class="ttt-cells-wrapper" id="tttGridWrapper">
            ${Array(9).fill(0).map((_, i) => `<button type="button" class="cell" data-idx="${i}" aria-label="Square ${i + 1}"></button>`).join('')}
          </div>
          <!-- Clean SVG Winning Line Strike -->
          <svg id="tttWinningRay" style="position:absolute; inset:0; width:100%; height:100%; pointer-events:none; display:none;" viewBox="0 0 310 310">
            <line id="tttRayLine" x1="0" y1="0" x2="0" y2="0" stroke="var(--status-win)" stroke-width="5" stroke-linecap="round"/>
          </svg>
        </div>

        <!-- Right Side Control Deck -->
        <div class="arena-side-controls">
          <!-- Turn Status Readout -->
          <div class="telemetry-cell" style="text-align:center; padding:16px;">
            <span class="t-label">Turn</span>
            <div id="tttTurnStatus" class="t-val" style="font-size:1.3rem; margin:4px 0; color:var(--brand-accent);">
              Your turn (X)
            </div>
            <div id="tttSubStatus" style="font-size:0.75rem; color:var(--text-dim); font-weight:600;">
              Pick an open square
            </div>
          </div>

          <!-- Series Scoreboard Card -->
          <div class="telemetry-cell" style="padding:14px;">
            <span class="t-label" style="text-align:center; margin-bottom:8px;">Series Score</span>
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; text-align:center;">
              <div>
                <div style="font-size:0.65rem; color:var(--text-sub); font-weight:800;">YOU (X)</div>
                <div id="tttScorePlayer" class="t-val" style="font-size:1.4rem; color:var(--brand-accent);">0</div>
              </div>
              <div>
                <div style="font-size:0.65rem; color:var(--text-sub); font-weight:800;">DRAWS</div>
                <div id="tttScoreTies" class="t-val" style="font-size:1.4rem; color:var(--text-main);">0</div>
              </div>
              <div>
                <div style="font-size:0.65rem; color:var(--text-sub); font-weight:800;">BOT (O)</div>
                <div id="tttScoreAI" class="t-val" style="font-size:1.4rem; color:var(--status-loss);">0</div>
              </div>
            </div>
          </div>

          <!-- Difficulty Selector -->
          <div class="telemetry-cell" style="gap:8px;">
            <span class="t-label">Difficulty</span>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn-nav-pill" id="btnTttCasual" style="flex:1; justify-content:center; font-size:0.72rem; padding:0 4px;">Casual</button>
              <button type="button" class="btn-nav-pill" id="btnTttMedium" style="flex:1; justify-content:center; font-size:0.72rem; padding:0 4px;">Medium</button>
              <button type="button" class="btn-nav-pill" id="btnTttImpossible" style="flex:1; justify-content:center; font-size:0.72rem; padding:0 4px; border-color:var(--brand-accent);">Smart</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupListeners();
  },

  start(opts = {}) {
    this.difficulty = opts.difficulty || 'Impossible';
    this.setPresetUI(this.difficulty);

    this.board = Array(9).fill(null);
    this.isLocked = false;
    this.isPlayerTurn = (this.starterTurn === 'X');

    this.resetBoardVisuals();
    this.updateStatus();

    if (!this.isPlayerTurn && this.difficulty !== '2P_LOCAL') {
      this.triggerAITurn();
    }
  },

  setPresetUI(diff) {
    this.difficulty = diff;
    ['btnTttCasual', 'btnTttMedium', 'btnTttImpossible'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.style.borderColor = 'var(--border-strong)';
    });

    if (diff === 'Casual') document.getElementById('btnTttCasual')?.style.setProperty('border-color', 'var(--brand-accent)');
    else if (diff === 'Medium') document.getElementById('btnTttMedium')?.style.setProperty('border-color', 'var(--brand-accent)');
    else if (diff === 'Impossible') document.getElementById('btnTttImpossible')?.style.setProperty('border-color', 'var(--brand-accent)');
  },

  setupListeners() {
    document.getElementById('btnTttCasual')?.addEventListener('click', () => this.start({ difficulty: 'Casual' }));
    document.getElementById('btnTttMedium')?.addEventListener('click', () => this.start({ difficulty: 'Medium' }));
    document.getElementById('btnTttImpossible')?.addEventListener('click', () => this.start({ difficulty: 'Impossible' }));

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
    if (sub) sub.textContent = 'Bot is thinking...';

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

    if (isWin) {
      const { winner, line } = result;
      this.drawWinningRay(line);

      line.forEach(idx => {
        document.querySelector(`.cell[data-idx="${idx}"]`)?.classList.add('winning-cell');
      });

      if (winner === 'X') {
        this.seriesScore.player++;
        this.ctx.fx.sfx.victory();
        this.ctx.recordResult('WIN', {
          mode: this.difficulty,
          summary: `Won on ${this.difficulty === 'Impossible' ? 'Smart' : this.difficulty}`,
          ranked: this.difficulty !== '2P_LOCAL'
        });
      } else {
        this.seriesScore.ai++;
        this.ctx.fx.sfx.defeat();
        this.ctx.recordResult('LOSS', {
          mode: this.difficulty,
          summary: `Lost to bot on ${this.difficulty === 'Impossible' ? 'Smart' : this.difficulty}`,
          ranked: this.difficulty !== '2P_LOCAL'
        });
      }
    } else {
      this.seriesScore.ties++;
      this.ctx.fx.playTone(330, 'triangle', 0.15, 0.12);
      this.ctx.recordResult('DRAW', {
        mode: this.difficulty,
        summary: `Draw on ${this.difficulty === 'Impossible' ? 'Smart' : this.difficulty}`,
        ranked: this.difficulty !== '2P_LOCAL'
      });
    }

    this.updateScoreboard();

    this.starterTurn = this.starterTurn === 'X' ? 'O' : 'X';

    this.ctx.scheduler.after(2200, () => {
      this.start({ difficulty: this.difficulty });
    });
  },

  drawWinningRay(line) {
    const svg = document.getElementById('tttWinningRay');
    const lineEl = document.getElementById('tttRayLine');
    if (!svg || !lineEl) return;

    // Center coordinates for 88px cell with 10px gap inside 310px wrapper
    const centers = [
      [54, 54],   [155, 54],  [256, 54],
      [54, 155],  [155, 155], [256, 155],
      [54, 256],  [155, 256], [256, 256]
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
      label.style.color = this.isPlayerTurn ? 'var(--brand-accent)' : 'var(--status-loss)';
      if (sub) sub.textContent = 'Pass to other player';
    } else {
      label.textContent = this.isPlayerTurn ? 'Your turn (X)' : 'Bot is thinking (O)';
      label.style.color = this.isPlayerTurn ? 'var(--brand-accent)' : 'var(--status-loss)';
      if (sub) sub.textContent = this.isPlayerTurn ? 'Pick an open square' : 'Evaluating best move...';
    }
  },

  updateScoreboard() {
    const p = document.getElementById('tttScorePlayer');
    const t = document.getElementById('tttScoreTies');
    const a = document.getElementById('tttScoreAI');
    if (p) p.textContent = this.seriesScore.player;
    if (t) t.textContent = this.seriesScore.ties;
    if (a) a.textContent = this.seriesScore.ai;
  },

  pause() {
    this.isLocked = true;
  },

  resume() {
    this.isLocked = false;
  },

  restart() {
    this.seriesScore = { player: 0, ai: 0, ties: 0 };
    this.updateScoreboard();
    this.start({ difficulty: this.difficulty });
  },

  destroy() {
    this.container = null;
  }
};