export default {
  id: 'tictactoe',
  title: 'Tic Tac Toe',
  accent: '#2f81f7',

  ctx: null,
  container: null,

  board: Array(9).fill(null),
  isPlayerTurn: true,
  isLocked: false,
  difficulty: 'Impossible', // 'Casual' | 'Medium' | 'Impossible'
  starterTurn: 'X',
  seriesScore: { player: 0, ai: 0, ties: 0 },

  mount(el, sessionCtx) {
    this.container = el;
    this.ctx = sessionCtx;

    this.container.innerHTML = `
      <div class="arena-dual-layout">
        <div class="ttt-grid-box" style="position:relative;">
          <div class="ttt-cells-wrapper" id="tttGridWrapper">
            ${Array(9).fill(0).map((_, i) => `<button type="button" class="cell" data-idx="${i}" aria-label="Square ${i + 1}"></button>`).join('')}
          </div>
          <svg id="tttWinningRay" style="position:absolute; inset:0; width:100%; height:100%; pointer-events:none; display:none;" viewBox="0 0 310 310">
            <line id="tttRayLine" x1="0" y1="0" x2="0" y2="0" stroke="var(--status-win)" stroke-width="4" stroke-linecap="round"/>
          </svg>
        </div>

        <div class="arena-side-controls">
          <div class="telemetry-cell" style="text-align:center; padding:12px;">
            <span class="t-label">Turn</span>
            <div id="tttTurnStatus" class="t-val" style="font-size:1.15rem; margin:2px 0; color:var(--brand-accent);">
              Your turn (X)
            </div>
            <div id="tttSubStatus" style="font-size:0.75rem; color:var(--text-dim);">
              Pick an open square
            </div>
          </div>

          <div class="telemetry-cell" style="padding:10px;">
            <span class="t-label" style="text-align:center; margin-bottom:6px;">Score</span>
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; text-align:center;">
              <div>
                <div style="font-size:0.7rem; color:var(--text-sub); font-weight:600;">YOU</div>
                <div id="tttScorePlayer" class="t-val" style="font-size:1.2rem; color:var(--brand-accent);">0</div>
              </div>
              <div>
                <div style="font-size:0.7rem; color:var(--text-sub); font-weight:600;">DRAW</div>
                <div id="tttScoreTies" class="t-val" style="font-size:1.2rem; color:var(--text-main);">0</div>
              </div>
              <div>
                <div style="font-size:0.7rem; color:var(--text-sub); font-weight:600;">BOT</div>
                <div id="tttScoreAI" class="t-val" style="font-size:1.2rem; color:var(--status-loss);">0</div>
              </div>
            </div>
          </div>

          <div class="telemetry-cell" style="gap:6px;">
            <span class="t-label">Difficulty</span>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn-nav-pill" id="btnTttCasual" style="flex:1; justify-content:center; font-size:0.75rem;">Easy</button>
              <button type="button" class="btn-nav-pill" id="btnTttMedium" style="flex:1; justify-content:center; font-size:0.75rem;">Medium</button>
              <button type="button" class="btn-nav-pill" id="btnTttImpossible" style="flex:1; justify-content:center; font-size:0.75rem; border-color:var(--brand-accent);">Hard</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.setupListeners();
  },

  start(opts = {}) {
    this.difficulty = opts.difficulty || this.difficulty || 'Impossible';
    this.setPresetUI(this.difficulty);

    this.board = Array(9).fill(null);
    this.isLocked = false;
    this.isPlayerTurn = (this.starterTurn === 'X');

    this.resetBoardVisuals();
    this.updateStatus();

    if (!this.isPlayerTurn) {
      this.triggerAITurn();
    }
  },

  setPresetUI(diff) {
    this.difficulty = diff;
    ['btnTttCasual', 'btnTttMedium', 'btnTttImpossible'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.style.borderColor = 'var(--border-line)';
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
      if (!cell || this.isLocked || !this.isPlayerTurn) return;

      const idx = parseInt(cell.getAttribute('data-idx'), 10);
      if (this.board[idx] !== null) return;

      this.makeMove(idx, 'X');
      const winInfo = this.checkWin(this.board);
      if (winInfo) {
        this.handleResolution(winInfo);
      } else if (this.isBoardFull(this.board)) {
        this.handleResolution('DRAW');
      } else {
        this.isPlayerTurn = false;
        this.updateStatus();
        this.triggerAITurn();
      }
    });
  },

  makeMove(idx, symbol) {
    this.board[idx] = symbol;
    const cell = document.querySelector(`.cell[data-idx="${idx}"]`);
    if (cell) {
      cell.textContent = symbol;
      cell.classList.add(symbol.toLowerCase());
      this.ctx.fx.playTone(symbol === 'X' ? 620 : 420, 'triangle', 0.04, 0.1);
    }
  },

  triggerAITurn() {
    this.isLocked = true;
    const sub = document.getElementById('tttSubStatus');
    if (sub) sub.textContent = 'Bot is thinking...';

    this.ctx.scheduler.after(300, () => {
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
      if (Math.random() < 0.5) {
        return available[Math.floor(Math.random() * available.length)];
      }
    } else if (this.difficulty === 'Medium') {
      if (Math.random() < 0.25) {
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

      if (winner === 'X') {
        this.seriesScore.player++;
        this.ctx.fx.sfx.victory();
        this.ctx.recordResult('WIN', {
          mode: this.difficulty,
          summary: `Won (${this.difficulty === 'Impossible' ? 'Hard' : this.difficulty})`
        });
      } else {
        this.seriesScore.ai++;
        this.ctx.fx.sfx.defeat();
        this.ctx.recordResult('LOSS', {
          mode: this.difficulty,
          summary: `Lost (${this.difficulty === 'Impossible' ? 'Hard' : this.difficulty})`
        });
      }
    } else {
      this.seriesScore.ties++;
      this.ctx.fx.playTone(330, 'triangle', 0.12, 0.1);
      this.ctx.recordResult('DRAW', {
        mode: this.difficulty,
        summary: `Draw (${this.difficulty === 'Impossible' ? 'Hard' : this.difficulty})`
      });
    }

    this.updateScoreboard();
    this.starterTurn = this.starterTurn === 'X' ? 'O' : 'X';

    this.ctx.scheduler.after(2000, () => {
      this.start({ difficulty: this.difficulty });
    });
  },

  drawWinningRay(line) {
    const svg = document.getElementById('tttWinningRay');
    const lineEl = document.getElementById('tttRayLine');
    if (!svg || !lineEl) return;

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

    label.textContent = this.isPlayerTurn ? 'Your turn (X)' : 'Bot turn (O)';
    label.style.color = this.isPlayerTurn ? 'var(--brand-accent)' : 'var(--status-loss)';
    if (sub) sub.textContent = this.isPlayerTurn ? 'Pick an open square' : 'Bot is thinking...';
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