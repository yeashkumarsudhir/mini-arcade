/**
 * js/games/memory.js
 * Memory Matrix — 4x4 Tactile Physical Card Deck
 * Features: 8 pairs, move counter, 60s Blitz mode, anti-peeking pause shield
 */

export default {
  id: 'memory',
  title: 'Memory Matrix',
  accent: '#00f0ff',

  ctx: null,
  container: null,

  GLYPHS: [
    { id: 'flux', icon: '⚡' },
    { id: 'cyber', icon: '👾' },
    { id: 'core', icon: '💎' },
    { id: 'drone', icon: '🛸' },
    { id: 'matrix', icon: '🌌' },
    { id: 'pulse', icon: '🪐' },
    { id: 'laser', icon: '🛰' },
    { id: 'cipher', icon: '🧿' }
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
        <!-- 4x4 Card Matrix Frame -->
        <div class="arena-board-frame" id="memoryBoardWrapper" style="position:relative;">
          <div id="memoryMatrixGrid" style="display:grid; grid-template-columns:repeat(4, 72px); grid-template-rows:repeat(4, 72px); gap:10px;">
            ${Array(16).fill(0).map((_, i) => `
              <button type="button" class="btn-nav-pill memory-card-btn" data-idx="${i}" aria-label="Card ${i + 1}" style="height:100%; width:100%; padding:0; justify-content:center; border-radius:var(--radius-btn); border:2px solid var(--border-strong); box-shadow:var(--shadow-offset); font-size:1.6rem; cursor:pointer; background:var(--bg-surface);">
                <span class="card-back" style="font-size:1.1rem; color:var(--text-dim); font-weight:800;">+</span>
                <span class="card-front" style="display:none;"></span>
              </button>
            `).join('')}
          </div>
          <div id="memoryPauseShield" style="display:none; position:absolute; inset:0; background:var(--bg-panel); border-radius:var(--radius-card); align-items:center; justify-content:center; font-weight:800; color:var(--text-dim); font-size:0.9rem;">
            PAUSED
          </div>
        </div>

        <!-- Right Side Control Deck -->
        <div class="arena-side-controls">
          <!-- Move & Time Metrics -->
          <div class="telemetry-cell" style="padding:16px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; text-align:center;">
              <div>
                <span class="t-label">Moves</span>
                <div id="memoryMovesDisplay" class="t-val" style="font-size:1.8rem; margin-top:2px; color:var(--brand-accent);">0</div>
              </div>
              <div>
                <span class="t-label">Time Left</span>
                <div id="memoryTimeDisplay" class="t-val" style="font-size:1.8rem; margin-top:2px;">∞</div>
              </div>
            </div>
          </div>

          <!-- Mode Toggle -->
          <div class="telemetry-cell" style="gap:8px;">
            <span class="t-label">Game Mode</span>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn-nav-pill" id="btnMemoryStandard" style="flex:1; justify-content:center; border-color:var(--brand-accent);">Standard</button>
              <button type="button" class="btn-nav-pill" id="btnMemoryBlitz" style="flex:1; justify-content:center;">Blitz (60s)</button>
            </div>
          </div>

          <!-- Star Efficiency Target -->
          <div class="telemetry-cell" style="text-align:center; padding:12px;">
            <span class="t-label">Efficiency</span>
            <div id="memoryStarRating" style="font-size:1.3rem; letter-spacing:4px; color:var(--status-coin); margin-top:4px;">★★★</div>
            <div style="font-size:0.7rem; color:var(--text-dim); margin-top:2px;">Target: ≤12 moves for 3 stars</div>
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
      btnStandard.style.borderColor = !this.isBlitz ? 'var(--brand-accent)' : 'var(--border-strong)';
      btnBlitz.style.borderColor = this.isBlitz ? 'var(--brand-accent)' : 'var(--border-strong)';
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
    this.ctx.fx.playTone(540, 'triangle', 0.04, 0.1);

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
        this.ctx.scheduler.after(700, () => {
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
        front.textContent = this.cards[idx].icon;
        front.style.display = 'block';
      }
    } else {
      cardEl.style.background = 'var(--bg-surface)';
      cardEl.style.borderColor = 'var(--border-strong)';
      if (back) back.style.display = 'block';
      if (front) front.style.display = 'none';
    }
  },

  markCardsMatched(idx1, idx2) {
    [idx1, idx2].forEach(i => {
      const el = document.querySelector(`.memory-card-btn[data-idx="${i}"]`);
      if (el) {
        el.style.borderColor = 'var(--status-win)';
        el.style.background = 'rgba(0, 229, 117, 0.12)';
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
    const starsEl = document.getElementById('memoryStarRating');

    if (movesEl) movesEl.textContent = this.moves;
    if (timeEl) timeEl.textContent = this.isBlitz ? `${this.timeRemaining}s` : '∞';

    if (starsEl) {
      if (this.moves <= 12) starsEl.textContent = '★★★';
      else if (this.moves <= 16) starsEl.textContent = '★★☆';
      else starsEl.textContent = '★☆☆';
    }
  },

  handleVictory() {
    if (this.blitzIntervalId) this.ctx.scheduler.cancel(this.blitzIntervalId);
    this.ctx.fx.sfx.victory();

    const starCount = this.moves <= 12 ? 3 : this.moves <= 16 ? 2 : 1;

    this.ctx.recordResult('WIN', {
      moves: this.moves,
      summary: `Cleared in ${this.moves} moves (${starCount} Stars)`,
      ranked: true
    });
  },

  handleTimeoutDefeat() {
    this.isLocked = true;
    this.ctx.fx.sfx.defeat();

    this.ctx.recordResult('LOSS', {
      moves: this.moves,
      summary: 'Blitz timer expired (0s)',
      ranked: true
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