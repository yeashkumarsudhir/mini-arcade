/**
 * js/games/wordguess.js
 * Word Guess — 5-Letter Tactile Wordle-Style Cabinet Game
 * Features: 6 attempts, virtual typewriter keypad, physical color flip, zero API dependencies
 */

export default {
  id: 'wordguess',
  title: 'Word Guess',
  accent: '#00e575',

  ctx: null,
  container: null,

  WORD_LIST: [
    'APPLE', 'BRAIN', 'CHAIR', 'DREAM', 'EAGLE', 'FLAME', 'GHOST', 'HOUSE',
    'LIGHT', 'MUSIC', 'NIGHT', 'OCEAN', 'PLANT', 'QUEEN', 'RIVER', 'SPACE',
    'TIGER', 'WATER', 'YOUTH', 'ZEBRA', 'MAGIC', 'SHARK', 'STONE', 'CLOCK',
    'CLOUD', 'BREAD', 'TRAIN', 'SMILE', 'STORM', 'PIZZA', 'POWER', 'RADIO'
  ],

  targetWord: '',
  guesses: [],
  currentGuess: '',
  maxGuesses: 6,
  isGameOver: false,

  mount(el, sessionCtx) {
    this.container = el;
    this.ctx = sessionCtx;

    this.container.innerHTML = `
      <div class="arena-dual-layout">
        <!-- 6x5 Letter Tiles Board -->
        <div class="arena-board-frame" style="padding:14px; background:var(--bg-panel); border:2px solid var(--border-strong); border-radius:var(--radius-card); box-shadow:var(--shadow-offset-lg); display:flex; flex-direction:column; align-items:center; gap:12px;">
          <div id="wordGrid" style="display:grid; grid-template-rows:repeat(6, 48px); gap:6px;">
            ${Array(6).fill(0).map((_, r) => `
              <div class="word-row" data-row="${r}" style="display:grid; grid-template-columns:repeat(5, 48px); gap:6px;">
                ${Array(5).fill(0).map((_, c) => `
                  <div class="word-tile" data-col="${c}" style="width:48px; height:48px; border:2px solid var(--border-strong); border-radius:4px; display:flex; align-items:center; justify-content:center; font-family:'Archivo Black',sans-serif; font-size:1.3rem; font-weight:900; background:var(--bg-surface); color:var(--text-main); box-shadow:2px 2px 0 #000; text-transform:uppercase;"></div>
                `).join('')}
              </div>
            `).join('')}
          </div>

          <!-- Typewriter Keypad -->
          <div id="wordKeypad" style="display:flex; flex-direction:column; gap:6px; max-width:360px; width:100%;"></div>
        </div>

        <!-- Right Side Control Deck -->
        <div class="arena-side-controls">
          <div class="telemetry-cell" style="text-align:center; padding:16px;">
            <span class="t-label">Status</span>
            <div id="wordStatus" class="t-val" style="font-size:1.2rem; color:var(--brand-accent); margin:4px 0;">
              Guess 1 of 6
            </div>
            <div id="wordSubStatus" style="font-size:0.75rem; color:var(--text-dim); font-weight:600;">
              Type a 5-letter word
            </div>
          </div>

          <div class="telemetry-cell" style="padding:14px;">
            <span class="t-label" style="text-align:center; margin-bottom:8px;">Legend</span>
            <div style="display:flex; flex-direction:column; gap:6px; font-size:0.75rem;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="display:inline-block; width:16px; height:16px; background:var(--status-win); border:1px solid #000; border-radius:3px;"></span>
                <span>Correct spot</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="display:inline-block; width:16px; height:16px; background:var(--status-coin); border:1px solid #000; border-radius:3px;"></span>
                <span>Wrong spot</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="display:inline-block; width:16px; height:16px; background:#2b3447; border:1px solid #000; border-radius:3px;"></span>
                <span>Not in word</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.renderKeypad();
    this.setupListeners();
  },

  start() {
    this.targetWord = this.WORD_LIST[Math.floor(Math.random() * this.WORD_LIST.length)];
    this.guesses = [];
    this.currentGuess = '';
    this.isGameOver = false;

    this.resetBoardVisuals();
    this.updateStatus();
  },

  renderKeypad() {
    const keypadEl = document.getElementById('wordKeypad');
    if (!keypadEl) return;

    const rows = [
      ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
      ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
      ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫']
    ];

    keypadEl.innerHTML = rows.map(r => `
      <div style="display:flex; justify-content:center; gap:4px;">
        ${r.map(k => `
          <button type="button" class="btn-nav-pill word-key" data-key="${k}" style="height:38px; min-width:${k.length > 1 ? '44px' : '28px'}; padding:0 4px; justify-content:center; font-size:0.75rem; font-weight:800; border-color:var(--border-strong);">
            ${k}
          </button>
        `).join('')}
      </div>
    `).join('');
  },

  setupListeners() {
    this.keyHandler = (e) => {
      if (this.isGameOver) return;
      const k = e.key.toUpperCase();

      if (k === 'ENTER') this.handleEnter();
      else if (k === 'BACKSPACE') this.handleBackspace();
      else if (/^[A-Z]$/.test(k)) this.handleLetter(k);
    };
    window.addEventListener('keydown', this.keyHandler);

    document.getElementById('wordKeypad')?.addEventListener('click', (e) => {
      if (this.isGameOver) return;
      const btn = e.target.closest('.word-key');
      if (!btn) return;

      const k = btn.getAttribute('data-key');
      if (k === 'ENTER') this.handleEnter();
      else if (k === '⌫') this.handleBackspace();
      else this.handleLetter(k);
    });
  },

  handleLetter(letter) {
    if (this.currentGuess.length < 5) {
      this.currentGuess += letter;
      this.ctx.fx.playTone(580, 'triangle', 0.02, 0.08);
      this.renderCurrentRow();
    }
  },

  handleBackspace() {
    if (this.currentGuess.length > 0) {
      this.currentGuess = this.currentGuess.slice(0, -1);
      this.ctx.fx.playTone(380, 'triangle', 0.02, 0.06);
      this.renderCurrentRow();
    }
  },

  handleEnter() {
    if (this.currentGuess.length !== 5) {
      this.ctx.fx.shake('soft');
      const sub = document.getElementById('wordSubStatus');
      if (sub) sub.textContent = 'Word must be 5 letters';
      return;
    }

    const rowIdx = this.guesses.length;
    const guess = this.currentGuess;
    this.guesses.push(guess);
    this.currentGuess = '';

    this.evaluateRow(rowIdx, guess);
  },

  evaluateRow(rowIdx, guess) {
    const rowEl = document.querySelector(`.word-row[data-row="${rowIdx}"]`);
    if (!rowEl) return;

    const tiles = rowEl.querySelectorAll('.word-tile');
    const targetArr = this.targetWord.split('');
    const guessArr = guess.split('');
    const status = Array(5).fill('absent');

    // First pass: exact matches (Green)
    for (let i = 0; i < 5; i++) {
      if (guessArr[i] === targetArr[i]) {
        status[i] = 'correct';
        targetArr[i] = null;
      }
    }

    // Second pass: misplaced matches (Yellow)
    for (let i = 0; i < 5; i++) {
      if (status[i] !== 'correct') {
        const foundIdx = targetArr.indexOf(guessArr[i]);
        if (foundIdx !== -1) {
          status[i] = 'present';
          targetArr[foundIdx] = null;
        }
      }
    }

    // Color tiles and keypad keys
    tiles.forEach((tile, i) => {
      setTimeout(() => {
        const st = status[i];
        let bg = '#2b3447';
        if (st === 'correct') bg = 'var(--status-win)';
        else if (st === 'present') bg = 'var(--status-coin)';

        tile.style.background = bg;
        tile.style.borderColor = '#000000';
        if (st === 'present') tile.style.color = '#000000';

        this.ctx.fx.playTone(st === 'correct' ? 660 : 440, 'triangle', 0.03, 0.08);

        // Update keyboard button color
        const keyBtn = document.querySelector(`.word-key[data-key="${guessArr[i]}"]`);
        if (keyBtn && !keyBtn.classList.contains('key-correct')) {
          if (st === 'correct') {
            keyBtn.classList.add('key-correct');
            keyBtn.style.background = 'var(--status-win)';
            keyBtn.style.color = '#ffffff';
          } else if (st === 'present') {
            keyBtn.style.background = 'var(--status-coin)';
            keyBtn.style.color = '#000000';
          } else {
            keyBtn.style.background = '#2b3447';
            keyBtn.style.color = 'var(--text-dim)';
          }
        }
      }, i * 90);
    });

    setTimeout(() => {
      if (guess === this.targetWord) {
        this.isGameOver = true;
        this.ctx.fx.sfx.victory();
        this.ctx.recordResult('WIN', {
          score: Math.max(10, (7 - this.guesses.length) * 20),
          summary: `Guessed ${this.targetWord} in ${this.guesses.length}/6!`,
          ranked: true
        });
      } else if (this.guesses.length >= this.maxGuesses) {
        this.isGameOver = true;
        this.ctx.fx.sfx.defeat();
        this.ctx.recordResult('LOSS', {
          score: 0,
          summary: `Word was: ${this.targetWord}`,
          ranked: true
        });
      } else {
        this.updateStatus();
      }
    }, 550);
  },

  renderCurrentRow() {
    const rowIdx = this.guesses.length;
    const rowEl = document.querySelector(`.word-row[data-row="${rowIdx}"]`);
    if (!rowEl) return;

    const tiles = rowEl.querySelectorAll('.word-tile');
    tiles.forEach((tile, i) => {
      tile.textContent = this.currentGuess[i] || '';
      tile.style.borderColor = this.currentGuess[i] ? 'var(--brand-accent)' : 'var(--border-strong)';
    });
  },

  resetBoardVisuals() {
    document.querySelectorAll('.word-tile').forEach(tile => {
      tile.textContent = '';
      tile.style.background = 'var(--bg-surface)';
      tile.style.borderColor = 'var(--border-strong)';
      tile.style.color = 'var(--text-main)';
    });
    document.querySelectorAll('.word-key').forEach(k => {
      k.style.background = '';
      k.style.color = '';
      k.classList.remove('key-correct');
    });
  },

  updateStatus() {
    const status = document.getElementById('wordStatus');
    const sub = document.getElementById('wordSubStatus');
    if (status) status.textContent = `Guess ${this.guesses.length + 1} of 6`;
    if (sub) sub.textContent = 'Type a 5-letter word';
  },

  pause() {},
  resume() {},
  restart() { this.start(); },
  destroy() {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.container = null;
  }
};