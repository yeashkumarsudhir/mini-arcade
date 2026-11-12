// ludo.js: turn flow, setup and save/continue for Ludo.
// The rules are in ludo-rules.js, the bots in ludo-ai.js and the drawing in ludo-render.js.
import { LudoRules, LUDO_COLORS, LUDO_PALETTE } from './ludo-rules.js';
import { LudoAI } from './ludo-ai.js';
import { LudoRenderer } from './ludo-render.js';
import { SaveGame } from '../core/savegame.js';
import { FXEngine } from '../fx.js';

const DICE_FACES = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 0, y: 180 }
};

const titleCase = (word) => word.charAt(0) + word.slice(1).toLowerCase();

function freshTokens() {
  return {
    RED: [-1, -1, -1, -1],
    GREEN: [-1, -1, -1, -1],
    YELLOW: [-1, -1, -1, -1],
    BLUE: [-1, -1, -1, -1]
  };
}

export const LudoGame = {
  id: 'ludo',
  title: 'Ludo',
  accent: '#d8504e',
  vsOpponent: true,

  ctx: null,
  container: null,
  canvas: null,
  renderer: null,
  resizeObserver: null,
  destroyed: false,

  // fsm is one of: WAIT_ROLL, ROLLING, RESOLVE, WAIT_PICK, MOVING, GAME_OVER
  fsm: 'WAIT_ROLL',
  activeColor: 'RED',
  difficulty: 'Normal',
  hopMs: 150,

  autoMoveSingle: true,
  colorBlindAssist: false,

  diceValue: 1,
  consecutiveSixes: 0,
  isRolling: false,
  flashText: '',

  // who sits where, used by the Setup dialog
  lobbyConfig: {
    playerCount: 2,
    seats: [
      { color: 'RED', active: true, isBot: false },
      { color: 'GREEN', active: false, isBot: true },
      { color: 'YELLOW', active: true, isBot: true },
      { color: 'BLUE', active: false, isBot: true }
    ]
  },

  state: { tokens: freshTokens(), finishRank: [] },

  players: [],
  legalMoves: [],
  selectedTokenIdx: null,
  hoverCell: null,
  effects: [],
  animatingHop: null,
  rAFId: null,
  lastStable: null,
  matchEndedCalled: false,

  mount(el, ctx) {
    this.container = el;
    this.ctx = ctx;
    this.destroyed = false;
    this.matchEndedCalled = false;

    this.container.innerHTML = `
      <div class="ludo-tabletop-container">
        <div class="ludo-board-frame" id="ludoBoardFrame">
          <canvas id="ludoCanvas" width="540" height="540"></canvas>
        </div>

        <div class="ludo-deck-controls">
          <div class="ludo-players-grid" id="ludoPlayerSlots"></div>

          <div class="stat-box ludo-status">
            <div class="ludo-status-line">
              <span class="ludo-turn-dot" id="ludoTurnDot"></span>
              <span class="stat-value" id="ludoStatusLine" aria-live="polite">Starting...</span>
            </div>
            <div class="ludo-sub-notice" id="ludoSubNotice"></div>
          </div>

          <div class="ludo-dice-tray" id="ludoDiceTray">
            <div class="ludo-roll-again-badge" id="ludoRollAgainBadge">Roll again!</div>

            <div class="ludo-dice-viewport" id="ludoDiceViewport" role="button" tabindex="0" aria-label="Roll the dice">
              <div class="ludo-dice-shadow" id="ludoDiceShadow"></div>
              <div class="ludo-dice-cube" id="ludoDiceCube">
                <div class="ludo-dice-face face-1"><span class="ludo-pip red-pip"></span></div>
                <div class="ludo-dice-face face-2"><span class="ludo-pip"></span><span class="ludo-pip"></span></div>
                <div class="ludo-dice-face face-3"><span class="ludo-pip"></span><span class="ludo-pip"></span><span class="ludo-pip"></span></div>
                <div class="ludo-dice-face face-4"><span class="ludo-pip"></span><span class="ludo-pip"></span><span class="ludo-pip"></span><span class="ludo-pip"></span></div>
                <div class="ludo-dice-face face-5"><span class="ludo-pip"></span><span class="ludo-pip"></span><span class="ludo-pip"></span><span class="ludo-pip"></span><span class="ludo-pip"></span></div>
                <div class="ludo-dice-face face-6"><span class="ludo-pip"></span><span class="ludo-pip"></span><span class="ludo-pip"></span><span class="ludo-pip"></span><span class="ludo-pip"></span><span class="ludo-pip"></span></div>
              </div>
            </div>

            <div class="ludo-tray-buttons">
              <button type="button" class="btn-cta-primary" id="btnRollDiceDirect">Roll dice</button>
              <button type="button" class="btn-cta-secondary" id="btnOpenLobbyModal">Setup</button>
            </div>
          </div>

          <div class="stat-box ludo-switches">
            <label class="ludo-check"><input type="checkbox" id="chkAutoMove" checked> Auto-move when there is one choice</label>
            <label class="ludo-check"><input type="checkbox" id="chkColorBlind"> Show numbers on pawns</label>
          </div>
        </div>

        <dialog id="ludoSetupDialog" class="sheet">
          <div class="dialog-card">
            <h2>Match setup</h2>

            <div class="opt-group">
              <span class="opt-label">Players</span>
              <div class="seg" id="ludoPlayerCountPills">
                <button type="button" class="seg-btn" data-count="2">2</button>
                <button type="button" class="seg-btn" data-count="3">3</button>
                <button type="button" class="seg-btn" data-count="4">4</button>
              </div>
            </div>

            <div class="opt-group">
              <span class="opt-label">Who plays each colour</span>
              <div class="ludo-seat-config-grid" id="ludoSeatsContainer"></div>
            </div>

            <div class="opt-group">
              <span class="opt-label">Bot level</span>
              <div class="seg" id="ludoLevelPills">
                <button type="button" class="seg-btn" data-level="Easy">Easy</button>
                <button type="button" class="seg-btn" data-level="Normal">Normal</button>
                <button type="button" class="seg-btn" data-level="Hard">Hard</button>
              </div>
            </div>

            <div class="dialog-actions-row">
              <button type="button" class="btn-dialog-secondary" id="btnCloseLobbyModal">Cancel</button>
              <button type="button" class="btn-dialog-primary" id="btnStartLobbyGame">Start new match</button>
            </div>
          </div>
        </dialog>
      </div>
    `;

    this.canvas = document.getElementById('ludoCanvas');
    this.renderer = new LudoRenderer(this.canvas);

    this.bindEvents();
    this.setupResizeObserver();
    this.startRenderLoop();
  },

  /* ---------- starting, setup and loading ---------- */

  // options can be: resume, playerCount, mode ('vs_bot' or 'pass_play'), difficulty, seats
  start(opts = {}) {
    this.matchEndedCalled = false;
    this.consecutiveSixes = 0;
    this.animatingHop = null;
    this.legalMoves = [];
    this.selectedTokenIdx = null;
    this.isRolling = false;
    this.flashText = '';

    if (opts.resume) {
      const snap = SaveGame.read('ludo');
      if (LudoRules.isValidSnapshot(snap)) {
        this.restoreFromSnapshot(snap);
        return;
      }
      this.ctx.toast('The saved game could not be loaded. Starting a new one.');
    }

    this.applySetup(opts);
    this.players = this.lobbyConfig.seats
      .filter(seat => seat.active)
      .map(seat => ({ color: seat.color, isBot: seat.isBot }));

    this.activeColor = this.players[0].color;
    this.state = { tokens: freshTokens(), finishRank: [] };
    this.fsm = 'WAIT_ROLL';
    this.diceValue = 1;

    this.renderPlayerSlots();
    this.syncUI();
    this.setDiceFace(1);
    this.captureStable();

    if (this.getCurrentPlayer().isBot) {
      this.ctx.scheduler.after(500, () => this.triggerBotCycle());
    }
  },

  applySetup(opts) {
    if (opts.difficulty) this.difficulty = opts.difficulty;

    if (Array.isArray(opts.seats)) {
      this.lobbyConfig.seats = opts.seats.map(seat => ({ ...seat }));
      this.lobbyConfig.playerCount = opts.seats.filter(seat => seat.active).length;
      return;
    }

    if (opts.playerCount) {
      this.setPlayerCount(opts.playerCount);
      const seats = this.lobbyConfig.seats;
      if (opts.mode === 'pass_play') {
        seats.forEach(seat => { seat.isBot = false; });
      } else {
        // first seat is you, the others are bots
        seats.forEach((seat, i) => { seat.isBot = i > 0; });
      }
    }
  },

  setPlayerCount(count) {
    const active = {
      2: ['RED', 'YELLOW'],
      3: ['RED', 'GREEN', 'YELLOW'],
      4: LUDO_COLORS
    }[count] || LUDO_COLORS;

    this.lobbyConfig.playerCount = active.length;
    this.lobbyConfig.seats = LUDO_COLORS.map((color, i) => ({
      color,
      active: active.includes(color),
      isBot: i > 0
    }));
  },

  restoreFromSnapshot(snap) {
    this.difficulty = snap.difficulty || 'Normal';
    this.players = snap.players.map(p => ({ color: p.color, isBot: p.isBot }));
    this.activeColor = snap.activeColor;
    this.state = {
      tokens: {
        RED: [...snap.tokens.RED],
        GREEN: [...snap.tokens.GREEN],
        YELLOW: [...snap.tokens.YELLOW],
        BLUE: [...snap.tokens.BLUE]
      },
      finishRank: [...snap.finishRank]
    };
    this.consecutiveSixes = snap.consecutiveSixes || 0;
    this.diceValue = snap.diceValue;

    // keep the Setup dialog in line with the game we loaded
    const colors = this.players.map(p => p.color);
    this.lobbyConfig.playerCount = colors.length;
    this.lobbyConfig.seats = LUDO_COLORS.map(color => {
      const player = this.players.find(p => p.color === color);
      return { color, active: colors.includes(color), isBot: player ? player.isBot : true };
    });

    this.fsm = 'WAIT_ROLL';
    if (snap.phase === 'WAIT_PICK') {
      this.legalMoves = LudoRules.getLegalMoves(this.state, this.activeColor, this.diceValue);
      if (this.legalMoves.length > 0) {
        this.fsm = 'WAIT_PICK';
        this.selectedTokenIdx = this.legalMoves[0];
      }
    }

    this.renderPlayerSlots();
    this.syncUI();
    this.setDiceFace(this.diceValue);
    this.captureStable();

    if (this.fsm === 'WAIT_ROLL' && this.getCurrentPlayer().isBot) {
      this.ctx.scheduler.after(600, () => this.triggerBotCycle());
    }
  },

  // The game is saved from the last moment where it was waiting for a roll or a pick.
  // That way a save never lands in the middle of a pawn animation.
  captureStable() {
    this.lastStable = {
      version: 1,
      players: this.players.map(p => ({ color: p.color, isBot: p.isBot })),
      activeColor: this.activeColor,
      tokens: {
        RED: [...this.state.tokens.RED],
        GREEN: [...this.state.tokens.GREEN],
        YELLOW: [...this.state.tokens.YELLOW],
        BLUE: [...this.state.tokens.BLUE]
      },
      finishRank: [...this.state.finishRank],
      diceValue: this.diceValue,
      phase: this.fsm === 'WAIT_PICK' ? 'WAIT_PICK' : 'WAIT_ROLL',
      consecutiveSixes: this.consecutiveSixes,
      difficulty: this.difficulty
    };
  },

  saveState() {
    if (this.fsm === 'GAME_OVER' || !this.lastStable) return null;
    return JSON.parse(JSON.stringify(this.lastStable));
  },

  getCurrentPlayer() {
    return this.players.find(p => p.color === this.activeColor) || this.players[0];
  },

  humanCount() {
    return this.players.filter(p => !p.isBot).length;
  },

  // "You" when there is one human, otherwise the colour name
  displayName(player) {
    const label = titleCase(player.color);
    if (player.isBot) return `${label} bot`;
    return this.humanCount() === 1 ? 'You' : label;
  },

  /* ---------- setup dialog ---------- */

  openSetup() {
    const dialog = document.getElementById('ludoSetupDialog');
    if (!dialog || dialog.open) return;
    this.ctx.scheduler.pause();
    this.renderSetup();
    this.ctx.ui.open(dialog);
  },

  closeSetup() {
    this.ctx.ui.close(document.getElementById('ludoSetupDialog'));
  },

  renderSetup() {
    document.querySelectorAll('#ludoPlayerCountPills .seg-btn').forEach(btn => {
      btn.classList.toggle('is-on', Number(btn.dataset.count) === this.lobbyConfig.playerCount);
    });
    document.querySelectorAll('#ludoLevelPills .seg-btn').forEach(btn => {
      btn.classList.toggle('is-on', btn.dataset.level === this.difficulty);
    });

    const box = document.getElementById('ludoSeatsContainer');
    box.innerHTML = this.lobbyConfig.seats.map(seat => `
      <div class="ludo-seat-card${seat.active ? '' : ' disabled'}" style="--seat-color:${LUDO_PALETTE[seat.color]}">
        <span class="ludo-seat-name">${titleCase(seat.color)}</span>
        <button type="button" class="btn-nav-pill btn-seat-toggle" data-color="${seat.color}" ${seat.active ? '' : 'disabled'}>
          ${seat.isBot ? 'Bot' : 'Human'}
        </button>
      </div>
    `).join('');
  },

  /* ---------- events ---------- */

  bindEvents() {
    const rollIfPossible = () => {
      if (this.fsm === 'WAIT_ROLL' && !this.getCurrentPlayer().isBot && !this.isRolling) {
        this.executeRoll();
      }
    };

    const dice = document.getElementById('ludoDiceViewport');
    dice.addEventListener('click', rollIfPossible);
    dice.addEventListener('keydown', (e) => {
      if (e.code === 'Enter') {
        e.preventDefault();
        rollIfPossible();
      }
    });
    document.getElementById('btnRollDiceDirect').addEventListener('click', rollIfPossible);

    document.getElementById('btnOpenLobbyModal').addEventListener('click', () => this.openSetup());
    document.getElementById('btnCloseLobbyModal').addEventListener('click', () => this.closeSetup());
    document.getElementById('ludoSetupDialog').addEventListener('close', () => {
      if (!this.destroyed && !this.ctx.ui.hasOpenDialogs()) this.ctx.scheduler.resume();
    });

    document.getElementById('ludoPlayerCountPills').addEventListener('click', (e) => {
      const btn = e.target.closest('.seg-btn');
      if (!btn) return;
      this.setPlayerCount(Number(btn.dataset.count));
      this.renderSetup();
    });

    document.getElementById('ludoLevelPills').addEventListener('click', (e) => {
      const btn = e.target.closest('.seg-btn');
      if (!btn) return;
      this.difficulty = btn.dataset.level;
      this.renderSetup();
    });

    document.getElementById('ludoSeatsContainer').addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-seat-toggle');
      if (!btn) return;
      const seat = this.lobbyConfig.seats.find(s => s.color === btn.dataset.color);
      if (seat) {
        seat.isBot = !seat.isBot;
        this.renderSetup();
      }
    });

    document.getElementById('btnStartLobbyGame').addEventListener('click', () => {
      this.closeSetup();
      this.ctx.restartWith({
        seats: this.lobbyConfig.seats.map(seat => ({ ...seat })),
        difficulty: this.difficulty
      });
    });

    document.getElementById('chkAutoMove').addEventListener('change', (e) => {
      this.autoMoveSingle = e.target.checked;
    });

    document.getElementById('chkColorBlind').addEventListener('change', (e) => {
      this.colorBlindAssist = e.target.checked;
      this.renderer.setColorBlind(this.colorBlindAssist);
    });

    // tap a pawn on the board
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.fsm !== 'WAIT_PICK' || this.getCurrentPlayer().isBot) return;

      const [x, y] = this.pointOnBoard(e);
      const cell = this.renderer.cellSize;

      for (const tokenIdx of this.legalMoves) {
        const progress = this.state.tokens[this.activeColor][tokenIdx];
        const [gx, gy] = LudoRules.getGridCoordinates(this.activeColor, tokenIdx, progress);
        const dist = Math.hypot(x - (gx * cell + cell / 2), y - (gy * cell + cell / 2));

        if (dist <= cell * 0.75) {
          this.commitMove(tokenIdx);
          break;
        }
      }
    });

    // show where a pawn would land when the mouse is over it
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.fsm !== 'WAIT_PICK' || this.getCurrentPlayer().isBot) {
        this.hoverCell = null;
        return;
      }

      const [x, y] = this.pointOnBoard(e);
      const cell = this.renderer.cellSize;

      let found = null;
      for (const tokenIdx of this.legalMoves) {
        const progress = this.state.tokens[this.activeColor][tokenIdx];
        const [gx, gy] = LudoRules.getGridCoordinates(this.activeColor, tokenIdx, progress);
        const dist = Math.hypot(x - (gx * cell + cell / 2), y - (gy * cell + cell / 2));

        if (dist <= cell * 0.65) {
          const target = progress === -1 ? 0 : progress + this.diceValue;
          found = LudoRules.getGridCoordinates(this.activeColor, tokenIdx, target);
          break;
        }
      }
      this.hoverCell = found;
    });

    this.keyHandler = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (document.querySelector('dialog[open]')) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) rollIfPossible();
      } else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
        if (this.fsm === 'WAIT_PICK' && this.legalMoves.length > 0) {
          e.preventDefault();
          const current = this.legalMoves.indexOf(this.selectedTokenIdx);
          const step = e.code === 'ArrowRight' ? 1 : -1;
          this.selectedTokenIdx = this.legalMoves[(current + step + this.legalMoves.length) % this.legalMoves.length];
        }
      } else if (e.code === 'Enter') {
        if (this.fsm === 'WAIT_PICK' && this.selectedTokenIdx !== null) {
          e.preventDefault();
          this.commitMove(this.selectedTokenIdx);
        }
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  },

  // pointer position in board units, whatever size the canvas is shown at
  pointOnBoard(e) {
    const rect = this.canvas.getBoundingClientRect();
    return [
      (e.clientX - rect.left) * (this.renderer.boardSize / rect.width),
      (e.clientY - rect.top) * (this.renderer.boardSize / rect.height)
    ];
  },

  setupResizeObserver() {
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        this.renderer.resize(Math.max(240, Math.min(width, 540)));
      }
    });

    const frame = document.getElementById('ludoBoardFrame');
    if (frame) this.resizeObserver.observe(frame);
  },

  /* ---------- rolling ---------- */

  executeRoll() {
    this.fsm = 'ROLLING';
    this.isRolling = true;
    this.flashText = '';
    this.legalMoves = [];
    this.selectedTokenIdx = null;
    this.syncUI();

    this.diceValue = Math.floor(Math.random() * 6) + 1;
    FXEngine.diceRoll();

    this.animateDiceTumble(this.diceValue, () => {
      if (this.destroyed) return;
      FXEngine.diceLand();
      this.isRolling = false;
      this.handlePostRoll();
    });
  },

  animateDiceTumble(value, onDone) {
    const cube = document.getElementById('ludoDiceCube');
    const shadow = document.getElementById('ludoDiceShadow');
    if (!cube) {
      onDone();
      return;
    }

    const end = DICE_FACES[value];

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cube.style.transform = `rotateX(${end.x}deg) rotateY(${end.y}deg)`;
      onDone();
      return;
    }

    const endX = end.x + (Math.floor(Math.random() * 3) + 2) * 360;
    const endY = end.y + (Math.floor(Math.random() * 3) + 2) * 360;

    const anim = cube.animate([
      { transform: 'translateY(0px) scale(1) rotateX(0deg) rotateY(0deg)' },
      { transform: 'translateY(-28px) scale(1.15) rotateX(360deg) rotateY(180deg)', offset: 0.35 },
      { transform: `translateY(-8px) scale(1.05) rotateX(${endX * 0.75}deg) rotateY(${endY * 0.75}deg)`, offset: 0.7 },
      { transform: `translateY(0px) scale(1) rotateX(${endX}deg) rotateY(${endY}deg)`, offset: 1 }
    ], { duration: 650, easing: 'cubic-bezier(0.25, 1, 0.5, 1)', fill: 'forwards' });

    shadow?.animate([
      { transform: 'scale(1)', opacity: 0.4 },
      { transform: 'scale(0.6)', opacity: 0.15, offset: 0.35 },
      { transform: 'scale(1)', opacity: 0.4, offset: 1 }
    ], { duration: 650, fill: 'forwards' });

    anim.onfinish = () => {
      anim.cancel();
      cube.style.transform = `rotateX(${end.x}deg) rotateY(${end.y}deg)`;
      onDone();
    };
  },

  setDiceFace(value) {
    const cube = document.getElementById('ludoDiceCube');
    if (!cube) return;
    const face = DICE_FACES[value] || DICE_FACES[1];
    cube.style.transform = `rotateX(${face.x}deg) rotateY(${face.y}deg)`;
  },

  handlePostRoll() {
    const isSix = this.diceValue === 6;
    document.getElementById('ludoRollAgainBadge')?.classList.toggle('show', isSix);

    if (isSix) {
      this.consecutiveSixes++;
      if (this.consecutiveSixes === 3) {
        this.consecutiveSixes = 0;
        this.showStatus('Three 6s in a row. Turn lost.');
        this.ctx.scheduler.after(900, () => this.advanceTurn());
        return;
      }
    } else {
      this.consecutiveSixes = 0;
    }

    this.legalMoves = LudoRules.getLegalMoves(this.state, this.activeColor, this.diceValue);

    if (this.legalMoves.length === 0) {
      this.fsm = 'WAIT_ROLL';
      this.showStatus('No move possible');
      this.ctx.scheduler.after(900, () => this.advanceTurn());
      return;
    }

    const player = this.getCurrentPlayer();

    if (player.isBot) {
      this.fsm = 'RESOLVE';
      this.ctx.scheduler.after(450, () => {
        const pick = LudoAI.chooseMove(this.difficulty, this.activeColor, this.state, this.diceValue, this.legalMoves);
        this.commitMove(pick);
      });
    } else if (this.legalMoves.length === 1 && this.autoMoveSingle) {
      this.fsm = 'RESOLVE';
      this.selectedTokenIdx = this.legalMoves[0];
      this.ctx.scheduler.after(300, () => this.commitMove(this.legalMoves[0]));
    } else {
      this.fsm = 'WAIT_PICK';
      this.selectedTokenIdx = this.legalMoves[0];
      this.syncUI();
      this.captureStable();
    }
  },

  /* ---------- moving ---------- */

  commitMove(tokenIndex) {
    this.fsm = 'MOVING';
    this.hoverCell = null;

    const start = this.state.tokens[this.activeColor][tokenIndex];
    const target = start === -1 ? 0 : start + this.diceValue;

    const steps = [];
    if (start === -1) {
      steps.push(0);
    } else {
      for (let s = start + 1; s <= target; s++) steps.push(s);
    }

    this.playStepHopAnimation(this.activeColor, tokenIndex, steps, 0);
  },

  playStepHopAnimation(color, tokenIdx, steps, stepIndex) {
    if (this.destroyed) return;

    if (stepIndex >= steps.length) {
      this.animatingHop = null;
      this.finalizeMove(color, tokenIdx);
      return;
    }

    const next = steps[stepIndex];
    const prev = stepIndex === 0 ? this.state.tokens[color][tokenIdx] : steps[stepIndex - 1];

    this.animatingHop = {
      color,
      tokenIndex: tokenIdx,
      fromGrid: LudoRules.getGridCoordinates(color, tokenIdx, prev),
      toGrid: LudoRules.getGridCoordinates(color, tokenIdx, next),
      progress: 0
    };

    FXEngine.tokenHop();

    // time only counts while the game is not paused
    let elapsed = 0;
    let last = performance.now();

    const frame = (now) => {
      if (this.destroyed) return;

      if (!this.ctx.scheduler.isPaused) elapsed += now - last;
      last = now;

      const t = Math.min(1, elapsed / this.hopMs);
      if (this.animatingHop) this.animatingHop.progress = t;

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        this.state.tokens[color][tokenIdx] = next;
        this.playStepHopAnimation(color, tokenIdx, steps, stepIndex + 1);
      }
    };
    requestAnimationFrame(frame);
  },

  finalizeMove(color, tokenIdx) {
    const finalP = this.state.tokens[color][tokenIdx];
    let extraTurn = this.diceValue === 6;

    const captured = LudoRules.checkCaptures(this.state, color, finalP);
    if (captured.length > 0) {
      for (const hit of captured) this.state.tokens[hit.color][hit.tokenIndex] = -1;
      extraTurn = true;
      FXEngine.cutOpponent();
      const victims = [...new Set(captured.map(hit => titleCase(hit.color)))].join(' and ');
      this.showStatus(`${titleCase(color)} captured ${victims}`);
    }

    if (finalP === 56) {
      extraTurn = true;
      FXEngine.playTone(880, 'triangle', 0.1, 0.2);

      if (this.state.tokens[color].every(step => step === 56)) {
        extraTurn = false;   // all four are home, this player is done
        if (!this.state.finishRank.includes(color)) this.state.finishRank.push(color);
        FXEngine.confetti(80);
        this.renderPlayerSlots();

        if (this.isMatchOver()) {
          this.ctx.scheduler.after(400, () => this.concludeMatch());
          return;
        }
      }
    }

    if (extraTurn) {
      this.fsm = 'WAIT_ROLL';
      this.syncUI();
      this.captureStable();
      if (this.getCurrentPlayer().isBot) {
        this.ctx.scheduler.after(600, () => this.triggerBotCycle());
      }
    } else {
      this.advanceTurn();
    }
  },

  // over when only one player is left, or when every human has finished
  isMatchOver() {
    const done = this.state.finishRank;
    const humansLeft = this.players.filter(p => !p.isBot && !done.includes(p.color));
    return done.length >= this.players.length - 1 || humansLeft.length === 0;
  },

  advanceTurn() {
    const order = this.players.map(p => p.color);
    let i = order.indexOf(this.activeColor);

    do {
      i = (i + 1) % order.length;
      this.activeColor = order[i];
    } while (this.state.finishRank.includes(this.activeColor));

    this.fsm = 'WAIT_ROLL';
    this.consecutiveSixes = 0;
    this.syncUI();
    this.captureStable();

    if (this.getCurrentPlayer().isBot) {
      this.ctx.scheduler.after(600, () => this.triggerBotCycle());
    }
  },

  triggerBotCycle() {
    if (this.destroyed) return;
    if (this.fsm !== 'WAIT_ROLL' || !this.getCurrentPlayer().isBot) return;
    this.executeRoll();
  },

  /* ---------- screen updates ---------- */

  // a short message (capture, no move...) that stays until the next roll
  showStatus(text) {
    this.flashText = text;
    const sub = document.getElementById('ludoSubNotice');
    if (sub) sub.textContent = text;
  },

  syncUI() {
    const player = this.getCurrentPlayer();
    if (!player) return;

    const line = document.getElementById('ludoStatusLine');
    const sub = document.getElementById('ludoSubNotice');
    const dot = document.getElementById('ludoTurnDot');
    const rollBtn = document.getElementById('btnRollDiceDirect');
    const name = this.displayName(player);

    if (line) {
      if (player.isBot) line.textContent = `${name}'s turn`;
      else if (name === 'You') line.textContent = 'Your turn';
      else line.textContent = `${name}'s turn`;
    }

    if (sub) {
      if (this.flashText) sub.textContent = this.flashText;
      else if (player.isBot) sub.textContent = 'Thinking...';
      else if (this.fsm === 'WAIT_PICK') sub.textContent = 'Pick a pawn. Tap it, or use the arrow keys and Enter.';
      else sub.textContent = 'Tap the dice or press Space.';
    }

    if (dot) dot.style.background = LUDO_PALETTE[this.activeColor];

    if (rollBtn) {
      rollBtn.disabled = player.isBot || this.fsm !== 'WAIT_ROLL';
      rollBtn.textContent = player.isBot ? 'Waiting...' : 'Roll dice';
    }

    document.getElementById('ludoRollAgainBadge')?.classList.remove('show');
    this.renderPlayerSlots();
  },

  renderPlayerSlots() {
    const box = document.getElementById('ludoPlayerSlots');
    if (!box) return;

    box.innerHTML = this.players.map(p => {
      const home = this.state.tokens[p.color].filter(step => step === 56).length;
      const place = this.state.finishRank.indexOf(p.color);
      const info = place !== -1 ? `Finished #${place + 1}` : `${home} of 4 home`;
      const active = p.color === this.activeColor && this.fsm !== 'GAME_OVER';

      return `
        <div class="ludo-player-card${active ? ' active' : ''}" style="--card-color:${LUDO_PALETTE[p.color]}">
          <span class="ludo-player-dot"></span>
          <div class="ludo-player-text">
            <span class="ludo-player-name">${this.displayName(p)}</span>
            <span class="ludo-player-info">${info}</span>
          </div>
        </div>
      `;
    }).join('');
  },

  startRenderLoop() {
    const frame = () => {
      if (this.destroyed || !this.renderer) return;

      this.renderer.renderFrame(this.state, {
        activeColor: this.activeColor,
        legalMoves: this.legalMoves,
        animatingHop: this.animatingHop,
        selectedToken: this.selectedTokenIdx !== null ? { color: this.activeColor, index: this.selectedTokenIdx } : null,
        hoverPreviewCell: this.hoverCell,
        effects: this.effects
      });
      this.rAFId = requestAnimationFrame(frame);
    };
    this.rAFId = requestAnimationFrame(frame);
  },

  /* ---------- end of the match ---------- */

  concludeMatch() {
    if (this.matchEndedCalled) return;
    this.matchEndedCalled = true;
    this.fsm = 'GAME_OVER';
    this.renderPlayerSlots();

    const winner = this.state.finishRank[0];
    const winnerPlayer = this.players.find(p => p.color === winner);
    const humanWon = !!winnerPlayer && !winnerPlayer.isBot;
    const hasBots = this.players.some(p => p.isBot);

    let summary;
    if (this.humanCount() === 1) {
      const human = this.players.find(p => !p.isBot);
      const place = this.state.finishRank.indexOf(human.color) + 1;
      summary = place === 1
        ? `You finished first out of ${this.players.length}.`
        : `${titleCase(winner)} bot won. You finished ${place > 0 ? 'number ' + place : 'last'}.`;
    } else {
      summary = `${titleCase(winner)} won the match.`;
    }

    // a game between friends on one phone does not count in your scores
    this.ctx.recordResult(humanWon ? 'WIN' : 'LOSS', { summary, counts: hasBots });
  },

  /* ---------- lifecycle ---------- */

  pause() {},

  resume() {},

  restart() {
    this.start({});
  },

  destroy() {
    this.destroyed = true;
    if (this.rAFId) cancelAnimationFrame(this.rAFId);
    this.resizeObserver?.disconnect();
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);

    this.container = null;
    this.canvas = null;
    this.renderer = null;
  }
};

export default LudoGame;
