// wordguess.js: a Wordle-style game. Six tries, 5-letter words from a small built-in list.

export default {
  id: 'wordguess',
  title: 'Word Guess',
  accent: '#3fa66a',

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
        <div class="arena-board-frame" style="padding:12px; flex-direction:column; gap:12px;">
          <div id="wordGrid" style="display:grid; gap:6px; width:min(calc(100vw - 64px), 270px);">
            ${Array(6).fill(0).map((_, r) => `
              <div class="word-row" data-row="${r}" style="display:grid; grid-template-columns:repeat(5, 1fr); gap:6px;">
                ${Array(5).fill(0).map((_, c) => `<div class="word-tile" data-col="${c}"></div>`).join('')}
              </div>
            `).join('')}
          </div>

          <div id="wordKeypad" style="display:flex; flex-direction:column; gap:6px; max-width:360px; width:100%;"></div>
        </div>

        <div class="arena-side-controls">
          <div class="stat-box" style="text-align:center;">
            <div id="wordStatus" class="stat-value">Guess 1 of 6</div>
            <div id="wordSubStatus" class="stat-label">Type a 5-letter word</div>
          </div>

          <div class="stat-label" style="text-align:center;">
            Green: right spot. Yellow: wrong spot. Grey: not in the word.
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
      ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL']
    ];

    keypadEl.innerHTML = rows.map(r => `
      <div style="display:flex; justify-content:center; gap:4px;">
        ${r.map(k => `
          <button type="button" class="btn-nav-pill word-key" data-key="${k}" style="height:40px; min-width:${k.length > 1 ? '46px' : '28px'}; padding:0 4px; font-size:0.8rem;">
            ${k === 'ENTER' ? 'Enter' : k === 'DEL' ? 'Del' : k}
          </button>
        `).join('')}
      </div>
    `).join('');
  },

  setupListeners() {
    this.keyHandler = (e) => {
      if (this.isGameOver || document.querySelector('dialog[open]')) return;
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
      else if (k === 'DEL') this.handleBackspace();
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

    // first pass: letters in the right place
    for (let i = 0; i < 5; i++) {
      if (guessArr[i] === targetArr[i]) {
        status[i] = 'correct';
        targetArr[i] = null;
      }
    }

    // second pass: right letter, wrong place (each letter is used only once)
    for (let i = 0; i < 5; i++) {
      if (status[i] !== 'correct') {
        const foundIdx = targetArr.indexOf(guessArr[i]);
        if (foundIdx !== -1) {
          status[i] = 'present';
          targetArr[foundIdx] = null;
        }
      }
    }

    // a key keeps its best colour: correct beats present beats absent
    const rank = { absent: 1, present: 2, correct: 3 };

    tiles.forEach((tile, i) => {
      this.ctx.scheduler.after(i * 90, () => {
        const st = status[i];
        tile.classList.add(st);
        this.ctx.fx.playTone(st === 'correct' ? 660 : 440, 'triangle', 0.03, 0.08);

        const keyBtn = document.querySelector(`.word-key[data-key="${guessArr[i]}"]`);
        if (keyBtn && (rank[keyBtn.dataset.state] || 0) < rank[st]) {
          keyBtn.classList.remove('absent', 'present', 'correct');
          keyBtn.classList.add(st);
          keyBtn.dataset.state = st;
        }
      });
    });

    this.ctx.scheduler.after(550, () => {
      if (guess === this.targetWord) {
        this.isGameOver = true;
        this.ctx.recordResult('WIN', {
          score: Math.max(10, (7 - this.guesses.length) * 20),
          summary: `You got ${this.targetWord} in ${this.guesses.length} of 6.`
        });
      } else if (this.guesses.length >= this.maxGuesses) {
        this.isGameOver = true;
        this.ctx.recordResult('LOSS', {
          score: 0,
          summary: `The word was ${this.targetWord}.`
        });
      } else {
        this.updateStatus();
      }
    });
  },

  renderCurrentRow() {
    const rowIdx = this.guesses.length;
    const rowEl = document.querySelector(`.word-row[data-row="${rowIdx}"]`);
    if (!rowEl) return;

    const tiles = rowEl.querySelectorAll('.word-tile');
    tiles.forEach((tile, i) => {
      tile.textContent = this.currentGuess[i] || '';
      tile.classList.toggle('filled', !!this.currentGuess[i]);
    });
  },

  resetBoardVisuals() {
    document.querySelectorAll('.word-tile').forEach(tile => {
      tile.textContent = '';
      tile.className = 'word-tile';
    });
    document.querySelectorAll('.word-key').forEach(k => {
      k.classList.remove('absent', 'present', 'correct');
      delete k.dataset.state;
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