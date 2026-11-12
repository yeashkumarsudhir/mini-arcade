// memory.js: 16 cards, 8 pairs. Standard mode or a 60 second Blitz.
// The card pictures are small inline SVGs so they look the same on every phone.
const shape = (inner) => `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">${inner}</svg>`;

export default {
  id: 'memory',
  title: 'Memory',
  accent: '#f2b705',

  ctx: null,
  container: null,

  GLYPHS: [
    { id: 'circle', icon: shape('<circle cx="12" cy="12" r="8" fill="#3d63e0" stroke="currentColor" stroke-width="1.6"/>') },
    { id: 'square', icon: shape('<rect x="4.5" y="4.5" width="15" height="15" rx="3" fill="#d8504e" stroke="currentColor" stroke-width="1.6"/>') },
    { id: 'triangle', icon: shape('<path d="M12 4l9 16H3z" fill="#3fa66a" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>') },
    { id: 'star', icon: shape('<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" fill="#f2b705" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>') },
    { id: 'diamond', icon: shape('<path d="M12 3l8 9-8 9-8-9z" fill="#e8893c" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>') },
    { id: 'ring', icon: shape('<circle cx="12" cy="12" r="7" fill="none" stroke="#8b6fe0" stroke-width="4.5"/>') },
    { id: 'cross', icon: shape('<path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5z" fill="#2fb0b0" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>') },
    { id: 'drop', icon: shape('<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" fill="#d8508e" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>') }
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
        <div class="arena-board-frame" id="memoryBoardWrapper" style="position:relative; padding:10px;">
          <div id="memoryMatrixGrid" style="display:grid; grid-template-columns:repeat(4, 1fr); grid-template-rows:repeat(4, 1fr); gap:8px; width:min(calc(100vw - 54px), 330px); aspect-ratio:1;">
            ${Array(16).fill(0).map((_, i) => `
              <button type="button" class="memory-card-btn" data-idx="${i}" aria-label="Card ${i + 1}">
                <span class="card-back">?</span>
                <span class="card-front"></span>
              </button>
            `).join('')}
          </div>
          <div id="memoryPauseShield" style="display:none; position:absolute; inset:0; background:var(--bg-panel); border-radius:var(--radius-card); align-items:center; justify-content:center; font-family:var(--font-hand); font-weight:700; font-size:1.2rem; color:var(--text-dim);">
            Paused
          </div>
        </div>

        <div class="arena-side-controls">
          <div class="stat-box">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; text-align:center;">
              <div>
                <span class="stat-label">Moves</span>
                <div id="memoryMovesDisplay" class="stat-value" style="font-size:1.8rem;">0</div>
              </div>
              <div>
                <span class="stat-label">Time left</span>
                <div id="memoryTimeDisplay" class="stat-value" style="font-size:1.8rem;">No limit</div>
              </div>
            </div>
          </div>

          <div class="stat-box" style="gap:8px;">
            <span class="stat-label">Mode</span>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn-nav-pill is-on" id="btnMemoryStandard" style="flex:1;">Standard</button>
              <button type="button" class="btn-nav-pill" id="btnMemoryBlitz" style="flex:1;">Blitz (60s)</button>
            </div>
          </div>

          <div class="stat-box" style="text-align:center;">
            <span class="stat-label">Rating</span>
            <div id="memoryStarRating" class="stat-value">3 stars</div>
            <div class="stat-label">12 moves or fewer gets 3 stars</div>
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
      btnStandard.classList.toggle('is-on', !this.isBlitz);
      btnBlitz.classList.toggle('is-on', this.isBlitz);
    }

    // Fisher-Yates shuffle (sort with random() gives an uneven shuffle)
    const deck = [...this.GLYPHS, ...this.GLYPHS].map(item => ({ ...item, isFlipped: false, isMatched: false }));
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

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

    cardEl.classList.toggle('flipped', isFlipped);
    if (!isFlipped) cardEl.classList.remove('matched');

    if (back) back.style.display = isFlipped ? 'none' : 'block';
    if (front) {
      front.innerHTML = isFlipped ? this.cards[idx].icon : '';
      front.style.display = isFlipped ? 'block' : 'none';
    }
  },

  markCardsMatched(idx1, idx2) {
    [idx1, idx2].forEach(i => {
      document.querySelector(`.memory-card-btn[data-idx="${i}"]`)?.classList.add('matched');
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
    if (timeEl) timeEl.textContent = this.isBlitz ? `${this.timeRemaining}s` : 'No limit';

    if (starsEl) {
      const stars = this.moves <= 12 ? 3 : this.moves <= 16 ? 2 : 1;
      starsEl.textContent = stars === 1 ? '1 star' : `${stars} stars`;
    }
  },

  handleVictory() {
    if (this.blitzIntervalId) this.ctx.scheduler.cancel(this.blitzIntervalId);

    const starCount = this.moves <= 12 ? 3 : this.moves <= 16 ? 2 : 1;

    this.ctx.recordResult('WIN', {
      moves: this.moves,
      summary: `All pairs found in ${this.moves} moves (${starCount} ${starCount === 1 ? 'star' : 'stars'}).`
    });
  },

  handleTimeoutDefeat() {
    this.isLocked = true;

    this.ctx.recordResult('LOSS', {
      moves: this.moves,
      summary: `Time ran out after ${this.moves} moves.`
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