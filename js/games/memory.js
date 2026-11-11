export default {
  id: 'memory',
  title: 'Memory Match',
  accent: '#2f81f7',

  ctx: null,
  container: null,

  GLYPHS: [
    { id: 'alpha', label: 'A' },
    { id: 'beta', label: 'B' },
    { id: 'gamma', label: 'C' },
    { id: 'delta', label: 'D' },
    { id: 'epsilon', label: 'E' },
    { id: 'zeta', label: 'F' },
    { id: 'eta', label: 'G' },
    { id: 'theta', label: 'H' }
  ],

  cards: [],
  flippedIndices: [],
  moves: 0,
  matches: 0,
  isLocked: false,
  isBlitz: false,
  timeRemaining: 60,
  blitzIntervalId: null,

  mount(el, sessionCtx) {
    this.container = el;
    this.ctx = sessionCtx;

    this.container.innerHTML = `
      <div class="arena-dual-layout">
        <div class="arena-board-frame" id="memoryBoardWrapper" style="position:relative;">
          <div id="memoryMatrixGrid" style="display:grid; grid-template-columns:repeat(4, 68px); grid-template-rows:repeat(4, 68px); gap:8px;">
            ${Array(16).fill(0).map((_, i) => `
              <button type="button" class="btn-nav-pill memory-card-btn" data-idx="${i}" aria-label="Card ${i + 1}" style="height:100%; width:100%; padding:0; justify-content:center; border-radius:6px; border:1px solid var(--border-line); font-size:1.3rem; font-weight:700; cursor:pointer; background:var(--bg-surface);">
                <span class="card-back" style="font-size:0.9rem; color:var(--text-dim);">?</span>
                <span class="card-front" style="display:none;"></span>
              </button>
            `).join('')}
          </div>
          <div id="memoryPauseShield" style="display:none; position:absolute; inset:0; background:var(--bg-panel); border-radius:8px; align-items:center; justify-content:center; font-weight:700; color:var(--text-dim); font-size:0.9rem;">
            PAUSED
          </div>
        </div>

        <div class="arena-side-controls">
          <div class="telemetry-cell" style="padding:12px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; text-align:center;">
              <div>
                <span class="t-label">Moves</span>
                <div id="memoryMovesDisplay" class="t-val" style="font-size:1.6rem; margin-top:2px; color:var(--brand-accent);">0</div>
              </div>
              <div>
                <span class="t-label">Time Left</span>
                <div id="memoryTimeDisplay" class="t-val" style="font-size:1.6rem; margin-top:2px;">--</div>
              </div>
            </div>
          </div>

          <div class="telemetry-cell" style="gap:6px;">
            <span class="t-label">Mode</span>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn-nav-pill" id="btnMemoryStandard" style="flex:1; justify-content:center; border-color:var(--brand-accent);">Standard</button>
              <button type="button" class="btn-nav-pill" id="btnMemoryBlitz" style="flex:1; justify-content:center;">60s Timer</button>
            </div>
          </div>

          <div class="telemetry-cell" style="text-align:center; padding:10px;">
            <p style="font-size:0.75rem; color:var(--text-sub); line-height:1.35;">
              Clear all 8 matching pairs in as few moves as possible.
            </p>
          </div>
        </div>
      </div>
    `;

    this.setupListeners();
  },

  start(opts = {}) {
    this.isBlitz = !!opts.blitz;
    this.moves = 0;
    this.matches = 0;
    this.isLocked = false;
    this.flippedIndices = [];
    this.timeRemaining = 60;

    const btnStandard = document.getElementById('btnMemoryStandard');
    const btnBlitz = document.getElementById('btnMemoryBlitz');
    if (btnStandard && btnBlitz) {
      btnStandard.style.borderColor = !this.isBlitz ? 'var(--brand-accent)' : 'var(--border-line)';
      btnBlitz.style.borderColor = this.isBlitz ? 'var(--brand-accent)' : 'var(--border-line)';
    }

    const deck = [...this.GLYPHS, ...this.GLYPHS]
      .sort(() => Math.random() - 0.5)
      .map(item => ({ ...item, isFlipped: false, isMatched: false }));

    this.cards = deck;

    this.renderInitialGrid();
    this.updateStatsUI();

    if (this.blitzIntervalId) this.ctx.scheduler.cancel(this.blitzIntervalId);
    if (this.isBlitz) {
      this.startBlitzTimer();
    }
  },

  setupListeners() {
    document.getElementById('btnMemoryStandard')?.addEventListener('click', () => {
      this.start({ blitz: false });
    });
    document.getElementById('btnMemoryBlitz')?.addEventListener('click', () => {
      this.start({ blitz: true });
    });

    document.getElementById('memoryMatrixGrid')?.addEventListener('click', (e) => {
      const cardEl = e.target.closest('.memory-card-btn');
      if (!cardEl || this.isLocked) return;

      const idx = parseInt(cardEl.getAttribute('data-idx'), 10);
      this.handleCardClick(idx);
    });
  },

  handleCardClick(idx) {
    const card = this.cards[idx];
    if (card.isFlipped || card.isMatched) return;

    card.isFlipped = true;
    this.flippedIndices.push(idx);
    this.updateCardDOM(idx, true);
    this.ctx.fx.playTone(540, 'triangle', 0.03, 0.08);

    if (this.flippedIndices.length === 2) {
      this.moves++;
      this.isLocked = true;
      this.updateStatsUI();

      const [firstIdx, secondIdx] = this.flippedIndices;
      const first = this.cards[firstIdx];
      const second = this.cards[secondIdx];

      if (first.id === second.id) {
        first.isMatched = true;
        second.isMatched = true;
        this.matches++;
        this.flippedIndices = [];
        this.isLocked = false;

        this.ctx.fx.sfx.tokenHop();
        this.markCardsMatched(firstIdx, secondIdx);

        if (this.matches === 8) {
          this.handleVictory();
        }
      } else {
        this.ctx.scheduler.after(650, () => {
          first.isFlipped = false;
          second.isFlipped = false;
          this.updateCardDOM(firstIdx, false);
          this.updateCardDOM(secondIdx, false);
          this.flippedIndices = [];
          this.isLocked = false;
        });
      }
    }
  },

  updateCardDOM(idx, isFlipped) {
    const cardEl = document.querySelector(`.memory-card-btn[data-idx="${idx}"]`);
    if (!cardEl) return;

    const back = cardEl.querySelector('.card-back');
    const front = cardEl.querySelector('.card-front');

    if (isFlipped) {
      cardEl.style.background = 'var(--bg-panel)';
      cardEl.style.borderColor = 'var(--brand-accent)';
      if (back) back.style.display = 'none';
      if (front) {
        front.textContent = this.cards[idx].label;
        front.style.display = 'block';
      }
    } else {
      cardEl.style.background = 'var(--bg-surface)';
      cardEl.style.borderColor = 'var(--border-line)';
      if (back) back.style.display = 'block';
      if (front) front.style.display = 'none';
    }
  },

  markCardsMatched(idx1, idx2) {
    [idx1, idx2].forEach(i => {
      const el = document.querySelector(`.memory-card-btn[data-idx="${i}"]`);
      if (el) {
        el.style.borderColor = 'var(--status-win)';
        el.style.background = 'rgba(46, 160, 67, 0.15)';
      }
    });
  },

  renderInitialGrid() {
    for (let i = 0; i < 16; i++) {
      this.updateCardDOM(i, false);
    }
  },

  startBlitzTimer() {
    this.blitzIntervalId = this.ctx.scheduler.every(1000, () => {
      this.timeRemaining--;
      this.updateStatsUI();

      if (this.timeRemaining <= 0) {
        this.ctx.scheduler.cancel(this.blitzIntervalId);
        this.handleTimeoutDefeat();
      }
    });
  },

  updateStatsUI() {
    const movesEl = document.getElementById('memoryMovesDisplay');
    const timeEl = document.getElementById('memoryTimeDisplay');

    if (movesEl) movesEl.textContent = this.moves;
    if (timeEl) timeEl.textContent = this.isBlitz ? `${this.timeRemaining}s` : '--';
  },

  handleVictory() {
    if (this.blitzIntervalId) this.ctx.scheduler.cancel(this.blitzIntervalId);
    this.ctx.fx.sfx.victory();

    this.ctx.recordResult('WIN', {
      moves: this.moves,
      summary: `Cleared in ${this.moves} moves!`
    });
  },

  handleTimeoutDefeat() {
    this.isLocked = true;
    this.ctx.fx.sfx.defeat();

    this.ctx.recordResult('LOSS', {
      moves: this.moves,
      summary: 'Time ran out!'
    });
  },

  pause() {
    this.isLocked = true;
    const shield = document.getElementById('memoryPauseShield');
    if (shield) shield.style.display = 'flex';
  },

  resume() {
    this.isLocked = false;
    const shield = document.getElementById('memoryPauseShield');
    if (shield) shield.style.display = 'none';
  },

  restart() {
    if (this.blitzIntervalId) this.ctx.scheduler.cancel(this.blitzIntervalId);
    this.start({ blitz: this.isBlitz });
  },

  destroy() {
    if (this.blitzIntervalId) this.ctx.scheduler.cancel(this.blitzIntervalId);
    this.container = null;
  }
};