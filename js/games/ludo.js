/**
 * js/games/ludo.js
 * Classic Physical Ludo Orchestrator & Game State Machine
 * Real Paper Board, Moulded Plastic Pawns & 3D Ivory Tumbling Dice
 */

import { LudoRules, LUDO_COLORS, LUDO_PALETTE } from './ludo-rules.js';
import { LudoAI } from './ludo-ai.js';
import { LudoRenderer } from './ludo-render.js';
import { FXEngine } from '../fx.js';
import { ArcadeApp } from '../app.js';

class SafeScheduler {
  constructor() {
    this.tasks = new Map();
    this.idCounter = 0;
    this.isPaused = false;
  }

  after(ms, fn) {
    const id = ++this.idCounter;
    const task = {
      fn,
      remaining: ms,
      targetTime: performance.now() + ms,
      handle: null
    };

    if (!this.isPaused) {
      task.handle = setTimeout(() => {
        this.tasks.delete(id);
        fn();
      }, ms);
    }

    this.tasks.set(id, task);
    return id;
  }

  pauseAll() {
    if (this.isPaused) return;
    this.isPaused = true;
    const now = performance.now();

    for (const [, task] of this.tasks) {
      if (task.handle) {
        clearTimeout(task.handle);
        task.handle = null;
      }
      task.remaining = Math.max(0, task.targetTime - now);
    }
  }

  resumeAll() {
    if (!this.isPaused) return;
    this.isPaused = false;
    const now = performance.now();

    for (const [id, task] of this.tasks) {
      task.targetTime = now + task.remaining;
      task.handle = setTimeout(() => {
        this.tasks.delete(id);
        task.fn();
      }, task.remaining);
    }
  }

  cancelAll() {
    for (const [, task] of this.tasks) {
      if (task.handle) clearTimeout(task.handle);
    }
    this.tasks.clear();
  }

  cancel(id) {
    const task = this.tasks.get(id);
    if (task && task.handle) clearTimeout(task.handle);
    this.tasks.delete(id);
  }
}

export const LudoGame = {
  id: 'ludo',
  title: 'Ludo Royale',
  accent: '#E53935',

  container: null,
  canvas: null,
  renderer: null,
  scheduler: new SafeScheduler(),
  resizeObserver: null,

  fsm: 'WAIT_ROLL',

  activeColor: 'RED',
  humanColor: 'RED',
  mode: '1P_3BOT',
  difficulty: 'Normal',
  pace: 'NORMAL',
  hopMs: 150,

  autoMoveSingle: true,
  perspectiveView: false,
  colorBlindAssist: false,

  diceValue: 1,
  consecutiveSixes: 0,
  isRolling: false,

  state: {
    tokens: {
      RED: [-1, -1, -1, -1],
      GREEN: [-1, -1, -1, -1],
      YELLOW: [-1, -1, -1, -1],
      BLUE: [-1, -1, -1, -1]
    },
    consecutiveSixes: 0,
    finishRank: []
  },

  players: [],
  legalMoves: [],
  selectedTokenIdx: null,
  hoverCell: null,
  effects: [],

  animatingHop: null,
  rAFId: null,
  lastFrameTime: 0,
  matchEndedCalled: false,

  mount(el) {
    this.container = el;
    this.matchEndedCalled = false;
    this.scheduler = new SafeScheduler();

    this.container.innerHTML = `
      <div class="ludo-tabletop-container" id="ludoTableContainer">
        <!-- Physical Board Viewport -->
        <div class="ludo-board-frame" id="ludoBoardFrame">
          <canvas id="ludoCanvas" width="540" height="540"></canvas>
        </div>

        <!-- Cabinet Side Deck Controls -->
        <div class="ludo-deck-controls">
          <!-- 4-Player Card Slots -->
          <div class="ludo-players-grid" id="ludoPlayerSlots"></div>

          <!-- Turn Status Readout -->
          <div class="telemetry-cell" style="text-align:center; padding:12px;">
            <div id="ludoStatusLine" class="t-val" style="font-size:1.15rem; color:var(--ludo-red); margin:0;" aria-live="polite">
              Your turn - roll dice
            </div>
            <div id="ludoSubNotice" style="font-size:0.75rem; color:var(--text-dim); margin-top:4px; font-weight:600;">
              Press SPACE or click the dice
            </div>
          </div>

          <!-- 3D Ivory Dice Tray -->
          <div class="ludo-dice-tray" id="ludoDiceTray">
            <div class="ludo-roll-again-badge" id="ludoRollAgainBadge">ROLL AGAIN!</div>

            <div class="ludo-dice-viewport" id="ludoDiceViewport" role="button" tabindex="0" aria-label="Roll Dice">
              <div class="ludo-dice-shadow" id="ludoDiceShadow"></div>
              <div class="ludo-dice-cube" id="ludoDiceCube">
                <div class="ludo-dice-face face-1">
                  <span class="ludo-pip red-pip"></span>
                </div>
                <div class="ludo-dice-face face-2">
                  <span class="ludo-pip"></span><span class="ludo-pip"></span>
                </div>
                <div class="ludo-dice-face face-3">
                  <span class="ludo-pip"></span><span class="ludo-pip"></span><span class="ludo-pip"></span>
                </div>
                <div class="ludo-dice-face face-4">
                  <span class="ludo-pip"></span><span class="ludo-pip"></span><span class="ludo-pip"></span><span class="ludo-pip"></span>
                </div>
                <div class="ludo-dice-face face-5">
                  <span class="ludo-pip"></span><span class="ludo-pip"></span><span class="ludo-pip"></span><span class="ludo-pip"></span><span class="ludo-pip"></span>
                </div>
                <div class="ludo-dice-face face-6">
                  <span class="ludo-pip"></span><span class="ludo-pip"></span><span class="ludo-pip"></span><span class="ludo-pip"></span><span class="ludo-pip"></span><span class="ludo-pip"></span>
                </div>
              </div>
            </div>

            <button type="button" class="btn-cta-primary" id="btnRollDiceDirect" style="width:100%; height:40px; font-size:0.8rem;">
              Roll Dice (Space)
            </button>
          </div>

          <!-- Quick Switches -->
          <div class="telemetry-cell" style="gap:8px; padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.75rem; color:var(--text-sub); font-weight:700;">Auto-move single</span>
              <input type="checkbox" id="chkAutoMove" checked style="cursor:pointer;">
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.75rem; color:var(--text-sub); font-weight:700;">Pawn numbers</span>
              <input type="checkbox" id="chkColorBlind" style="cursor:pointer;">
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.75rem; color:var(--text-sub); font-weight:700;">Perspective tilt</span>
              <input type="checkbox" id="chkTableTilt" style="cursor:pointer;">
            </div>
          </div>
        </div>
      </div>
    `;

    this.canvas = document.getElementById('ludoCanvas');
    this.renderer = new LudoRenderer(this.canvas);

    // Global reference for console testing
    window.LudoGameInstance = this;

    this.bindEvents();
    this.setupResizeObserver();
    this.startRenderLoop();
  },

  start(opts = {}) {
    this.mode = opts.mode || '1P_3BOT';
    this.difficulty = opts.difficulty || 'Normal';
    this.humanColor = opts.pickedColor || 'RED';
    this.activeColor = 'RED';
    this.matchEndedCalled = false;
    this.consecutiveSixes = 0;
    this.fsm = 'WAIT_ROLL';
    this.animatingHop = null;
    this.legalMoves = [];
    this.selectedTokenIdx = null;

    if (this.mode === '1P_1BOT') {
      this.players = [
        { color: 'RED', isBot: this.humanColor !== 'RED', name: this.humanColor === 'RED' ? 'You' : 'Bot' },
        { color: 'YELLOW', isBot: this.humanColor !== 'YELLOW', name: this.humanColor === 'YELLOW' ? 'You' : 'Bot' }
      ];
    } else if (this.mode === '4P_LOCAL') {
      this.players = [
        { color: 'RED', isBot: false, name: 'P1 Red' },
        { color: 'GREEN', isBot: false, name: 'P2 Green' },
        { color: 'YELLOW', isBot: false, name: 'P3 Yellow' },
        { color: 'BLUE', isBot: false, name: 'P4 Blue' }
      ];
    } else {
      this.players = LUDO_COLORS.map(c => ({
        color: c,
        isBot: c !== this.humanColor,
        name: c === this.humanColor ? 'You' : `Bot (${this.difficulty})`
      }));
    }

    this.state = {
      tokens: {
        RED: [-1, -1, -1, -1],
        GREEN: [-1, -1, -1, -1],
        YELLOW: [-1, -1, -1, -1],
        BLUE: [-1, -1, -1, -1]
      },
      consecutiveSixes: 0,
      finishRank: []
    };

    const saved = localStorage.getItem('parlour_ludo_autosave');
    if (opts.resumeSave && saved) {
      try {
        const parsed = JSON.parse(saved);
        this.state = parsed.state;
        this.activeColor = parsed.activeColor;
        this.mode = parsed.mode;
      } catch {}
    }

    this.renderPlayerSlots();
    this.syncUI();
    this.setDiceFace(1);

    if (this.getCurrentPlayer().isBot) {
      this.triggerBotCycle();
    }
  },

  getCurrentPlayer() {
    return this.players.find(p => p.color === this.activeColor) || this.players[0];
  },

  bindEvents() {
    const handleRollTrigger = (e) => {
      e?.preventDefault();
      if (this.fsm === 'WAIT_ROLL' && !this.getCurrentPlayer().isBot && !this.isRolling) {
        this.executeRoll();
      }
    };

    document.getElementById('ludoDiceViewport')?.addEventListener('click', handleRollTrigger);
    document.getElementById('btnRollDiceDirect')?.addEventListener('click', handleRollTrigger);

    document.getElementById('chkAutoMove')?.addEventListener('change', (e) => {
      this.autoMoveSingle = e.target.checked;
    });

    document.getElementById('chkColorBlind')?.addEventListener('change', (e) => {
      this.colorBlindAssist = e.target.checked;
      this.renderer.setColorBlind(this.colorBlindAssist);
    });

    document.getElementById('chkTableTilt')?.addEventListener('change', (e) => {
      this.perspectiveView = e.target.checked;
      document.getElementById('ludoTableContainer')?.classList.toggle('perspective-view', this.perspectiveView);
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.fsm !== 'WAIT_PICK' || this.getCurrentPlayer().isBot) return;

      const rect = this.canvas.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) * (this.renderer.boardSize / rect.width);
      const clickY = (e.clientY - rect.top) * (this.renderer.boardSize / rect.height);
      const cell = this.renderer.cellSize;

      for (const tokenIdx of this.legalMoves) {
        const p = this.state.tokens[this.activeColor][tokenIdx];
        const [gx, gy] = LudoRules.getGridCoordinates(this.activeColor, tokenIdx, p);
        const cx = gx * cell + cell / 2;
        const cy = gy * cell + cell / 2;
        const dist = Math.hypot(clickX - cx, clickY - cy);

        if (dist <= cell * 0.72) {
          this.commitMove(tokenIdx);
          break;
        }
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (this.fsm !== 'WAIT_PICK' || this.getCurrentPlayer().isBot) {
        this.hoverCell = null;
        return;
      }

      const rect = this.canvas.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (this.renderer.boardSize / rect.width);
      const py = (e.clientY - rect.top) * (this.renderer.boardSize / rect.height);
      const cell = this.renderer.cellSize;

      let found = null;
      for (const tokenIdx of this.legalMoves) {
        const p = this.state.tokens[this.activeColor][tokenIdx];
        const [gx, gy] = LudoRules.getGridCoordinates(this.activeColor, tokenIdx, p);
        const dist = Math.hypot(px - (gx * cell + cell / 2), py - (gy * cell + cell / 2));

        if (dist <= cell * 0.65) {
          const targetP = (p === -1) ? 0 : p + this.diceValue;
          found = LudoRules.getGridCoordinates(this.activeColor, tokenIdx, targetP);
          break;
        }
      }
      this.hoverCell = found;
    });

    this.keyHandler = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleRollTrigger();
      } else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
        if (this.fsm === 'WAIT_PICK' && this.legalMoves.length > 0) {
          e.preventDefault();
          const curIdx = this.legalMoves.indexOf(this.selectedTokenIdx);
          const nextIdx = (curIdx + (e.code === 'ArrowRight' ? 1 : -1) + this.legalMoves.length) % this.legalMoves.length;
          this.selectedTokenIdx = this.legalMoves[nextIdx];
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

  setupResizeObserver() {
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const frameW = entry.contentRect.width;
        const targetSize = Math.max(320, Math.min(frameW - 20, 540));
        this.renderer.resize(targetSize);
      }
    });

    const frame = document.getElementById('ludoBoardFrame');
    if (frame) this.resizeObserver.observe(frame);
  },

  executeRoll() {
    this.fsm = 'ROLLING';
    this.isRolling = true;
    this.legalMoves = [];
    this.selectedTokenIdx = null;

    this.diceValue = Math.floor(Math.random() * 6) + 1;

    FXEngine.diceRoll();

    this.animateDiceTumble(this.diceValue, () => {
      FXEngine.diceLand();
      this.isRolling = false;
      this.handlePostRoll();
    });
  },

  animateDiceTumble(targetValue, onComplete) {
    const cube = document.getElementById('ludoDiceCube');
    const shadow = document.getElementById('ludoDiceShadow');
    if (!cube) {
      onComplete();
      return;
    }

    const faceRotations = {
      1: { x: 0, y: 0 },
      2: { x: 0, y: -90 },
      3: { x: -90, y: 0 },
      4: { x: 90, y: 0 },
      5: { x: 0, y: 90 },
      6: { x: 0, y: 180 }
    };

    const targetRot = faceRotations[targetValue];
    const extraTurnsX = (Math.floor(Math.random() * 3) + 2) * 360;
    const extraTurnsY = (Math.floor(Math.random() * 3) + 2) * 360;

    const endX = targetRot.x + extraTurnsX;
    const endY = targetRot.y + extraTurnsY;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cube.style.transform = `rotateX(${targetRot.x}deg) rotateY(${targetRot.y}deg)`;
      onComplete();
      return;
    }

    const anim = cube.animate([
      { transform: 'translateY(0px) scale(1) rotateX(0deg) rotateY(0deg)' },
      { transform: 'translateY(-36px) scale(1.2) rotateX(360deg) rotateY(180deg)', offset: 0.35 },
      { transform: `translateY(-10px) scale(1.05) rotateX(${endX * 0.75}deg) rotateY(${endY * 0.75}deg)`, offset: 0.7 },
      { transform: `translateY(0px) scale(1) rotateX(${endX}deg) rotateY(${endY}deg)`, offset: 1 }
    ], {
      duration: 800,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
      fill: 'forwards'
    });

    if (shadow) {
      shadow.animate([
        { transform: 'scale(1)', opacity: 0.45 },
        { transform: 'scale(0.55)', opacity: 0.15, offset: 0.35 },
        { transform: 'scale(1)', opacity: 0.45, offset: 1 }
      ], { duration: 800, fill: 'forwards' });
    }

    anim.onfinish = () => {
      cube.style.transform = `rotateX(${targetRot.x}deg) rotateY(${targetRot.y}deg)`;
      onComplete();
    };
  },

  setDiceFace(val) {
    const cube = document.getElementById('ludoDiceCube');
    if (!cube) return;
    const faceRotations = {
      1: { x: 0, y: 0 },
      2: { x: 0, y: -90 },
      3: { x: -90, y: 0 },
      4: { x: 90, y: 0 },
      5: { x: 0, y: 90 },
      6: { x: 0, y: 180 }
    };
    const r = faceRotations[val] || faceRotations[1];
    cube.style.transform = `rotateX(${r.x}deg) rotateY(${r.y}deg)`;
  },

  handlePostRoll() {
    const isSix = (this.diceValue === 6);
    const badge = document.getElementById('ludoRollAgainBadge');
    if (badge) badge.classList.toggle('show', isSix);

    if (isSix) {
      this.consecutiveSixes++;
      if (this.consecutiveSixes === 3) {
        this.consecutiveSixes = 0;
        this.showStatusNotification('3 Sixes in a row. Turn skipped.');
        this.scheduler.after(700, () => this.advanceTurn());
        return;
      }
    } else {
      this.consecutiveSixes = 0;
    }

    this.legalMoves = LudoRules.getLegalMoves(this.state, this.activeColor, this.diceValue);

    if (this.legalMoves.length === 0) {
      this.fsm = 'WAIT_ROLL';
      this.showStatusNotification('No moves available');
      this.scheduler.after(700, () => this.advanceTurn());
      return;
    }

    const curPlayer = this.getCurrentPlayer();

    if (curPlayer.isBot) {
      this.fsm = 'RESOLVE';
      this.scheduler.after(450, () => {
        const chosenToken = LudoAI.chooseMove(
          this.difficulty,
          this.activeColor,
          this.state,
          this.diceValue,
          this.legalMoves
        );
        this.commitMove(chosenToken);
      });
    } else {
      if (this.legalMoves.length === 1 && this.autoMoveSingle) {
        this.fsm = 'RESOLVE';
        this.selectedTokenIdx = this.legalMoves[0];
        this.scheduler.after(350, () => this.commitMove(this.legalMoves[0]));
      } else {
        this.fsm = 'WAIT_PICK';
        this.selectedTokenIdx = this.legalMoves[0];
        this.syncUI();
      }
    }
  },

  commitMove(tokenIndex) {
    this.fsm = 'MOVING';
    this.hoverCell = null;
    const startP = this.state.tokens[this.activeColor][tokenIndex];
    const targetP = (startP === -1) ? 0 : startP + this.diceValue;

    const waypoints = [];
    if (startP === -1) {
      waypoints.push(0);
    } else {
      for (let s = startP + 1; s <= targetP; s++) {
        waypoints.push(s);
      }
    }

    this.playStepHopAnimation(this.activeColor, tokenIndex, waypoints, 0);
  },

  playStepHopAnimation(color, tokenIdx, waypoints, waypointIndex) {
    if (waypointIndex >= waypoints.length) {
      this.animatingHop = null;
      this.finalizeMoveResolution(color, tokenIdx);
      return;
    }

    const nextStep = waypoints[waypointIndex];
    const prevStep = waypointIndex === 0 ? this.state.tokens[color][tokenIdx] : waypoints[waypointIndex - 1];

    const fromGrid = LudoRules.getGridCoordinates(color, tokenIdx, prevStep);
    const toGrid = LudoRules.getGridCoordinates(color, tokenIdx, nextStep);

    this.animatingHop = {
      color,
      tokenIndex: tokenIdx,
      fromGrid,
      toGrid,
      progress: 0
    };

    FXEngine.tokenHop();

    const startTime = performance.now();
    const duration = this.hopMs;

    const hopStep = (now) => {
      if (this.scheduler.isPaused) {
        requestAnimationFrame(hopStep);
        return;
      }

      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      if (this.animatingHop) {
        this.animatingHop.progress = t;
      }

      if (t < 1) {
        requestAnimationFrame(hopStep);
      } else {
        this.state.tokens[color][tokenIdx] = nextStep;
        this.playStepHopAnimation(color, tokenIdx, waypoints, waypointIndex + 1);
      }
    };

    requestAnimationFrame(hopStep);
  },

  finalizeMoveResolution(color, tokenIdx) {
    const finalP = this.state.tokens[color][tokenIdx];
    let extraTurn = (this.diceValue === 6);

    const capture = LudoRules.checkCapture(this.state, color, finalP);
    if (capture) {
      this.state.tokens[capture.color][capture.tokenIndex] = -1;
      extraTurn = true;
      FXEngine.cutOpponent();
      this.showStatusNotification(`${color} captured ${capture.color}!`);
    }

    if (finalP === 56) {
      extraTurn = true;
      FXEngine.playTone(880, 'triangle', 0.1, 0.2);

      const allHome = this.state.tokens[color].every(step => step === 56);
      if (allHome) {
        if (!this.state.finishRank.includes(color)) {
          this.state.finishRank.push(color);
        }
        FXEngine.confetti(80);

        this.renderPlayerSlots();

        if (color === this.humanColor) {
          this.showStatusNotification('Victory! All 4 pawns home!');
          this.scheduler.after(400, () => this.concludeMatch('WIN'));
          return;
        }

        if (this.state.finishRank.length >= this.players.length - 1) {
          const humanWon = (this.state.finishRank[0] === this.humanColor);
          this.scheduler.after(400, () => this.concludeMatch(humanWon ? 'WIN' : 'LOSS'));
          return;
        }
      }
    }

    localStorage.setItem('parlour_ludo_autosave', JSON.stringify({
      state: this.state,
      activeColor: this.activeColor,
      mode: this.mode
    }));

    if (extraTurn) {
      this.fsm = 'WAIT_ROLL';
      this.syncUI();
      if (this.getCurrentPlayer().isBot) {
        this.scheduler.after(600, () => this.triggerBotCycle());
      }
    } else {
      this.advanceTurn();
    }
  },

  advanceTurn() {
    const order = this.players.map(p => p.color);
    let curIdx = order.indexOf(this.activeColor);

    do {
      curIdx = (curIdx + 1) % order.length;
      this.activeColor = order[curIdx];
    } while (this.state.finishRank.includes(this.activeColor));

    this.fsm = 'WAIT_ROLL';
    this.consecutiveSixes = 0;
    this.syncUI();

    if (this.getCurrentPlayer().isBot) {
      this.scheduler.after(600, () => this.triggerBotCycle());
    }
  },

  triggerBotCycle() {
    if (this.fsm !== 'WAIT_ROLL' || !this.getCurrentPlayer().isBot) return;
    this.executeRoll();
  },

  showStatusNotification(text) {
    const line = document.getElementById('ludoStatusLine');
    if (line) line.textContent = text;
  },

  syncUI() {
    const curPlayer = this.getCurrentPlayer();
    const line = document.getElementById('ludoStatusLine');
    const sub = document.getElementById('ludoSubNotice');
    const tray = document.getElementById('ludoDiceTray');
    const rollBtn = document.getElementById('btnRollDiceDirect');

    if (line) {
      if (this.fsm === 'WAIT_ROLL') {
        line.textContent = `${curPlayer.name}'s turn - roll dice`;
      } else if (this.fsm === 'WAIT_PICK') {
        line.textContent = `${curPlayer.name} - pick a pawn`;
      }
      line.style.color = LUDO_PALETTE[this.activeColor];
    }

    if (sub) {
      sub.textContent = curPlayer.isBot ? 'Bot is thinking...' : 'Press SPACE or click the dice';
    }

    if (tray) {
      tray.style.setProperty('--ludo-tray-tint', LUDO_PALETTE[this.activeColor]);
    }

    if (rollBtn) {
      rollBtn.disabled = curPlayer.isBot || this.fsm !== 'WAIT_ROLL';
    }

    this.renderPlayerSlots();
  },

  renderPlayerSlots() {
    const container = document.getElementById('ludoPlayerSlots');
    if (!container) return;

    container.innerHTML = this.players.map(p => {
      const isCur = (p.color === this.activeColor);
      const pawns = this.state.tokens[p.color];
      const finished = pawns.filter(step => step === 56).length;
      const rankIdx = this.state.finishRank.indexOf(p.color);
      const rankText = rankIdx !== -1 ? `(#${rankIdx + 1})` : `Home ${finished}/4`;

      return `
        <div class="ludo-player-card ${isCur ? 'active' : ''}" style="--card-color:${LUDO_PALETTE[p.color]};">
          <span class="ludo-player-chip" style="background:${LUDO_PALETTE[p.color]};"></span>
          <div class="ludo-player-meta">
            <span class="ludo-player-name">${p.name}</span>
            <span class="ludo-player-home-count">${rankText}</span>
          </div>
        </div>
      `;
    }).join('');
  },

  startRenderLoop() {
    const frame = () => {
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

  concludeMatch(outcome) {
    if (this.matchEndedCalled) return;
    this.matchEndedCalled = true;
    this.fsm = 'GAME_OVER';

    localStorage.removeItem('parlour_ludo_autosave');

    const rank = this.state.finishRank.indexOf(this.humanColor) + 1 || (outcome === 'WIN' ? 1 : 4);
    const isRanked = (this.mode !== '4P_LOCAL');

    const outcomePayload = {
      summary: `Finished #${rank} in ${this.mode === '4P_LOCAL' ? 'Casual 4P' : this.difficulty}`,
      ranked: isRanked
    };

    if (typeof ArcadeApp.triggerMatchEnd === 'function') {
      ArcadeApp.triggerMatchEnd(outcome, outcomePayload);
    } else if (typeof ArcadeApp.handleMatchOutcome === 'function') {
      ArcadeApp.handleMatchOutcome(outcome, outcomePayload);
    }
  },

  pause() {
    this.scheduler.pauseAll();
  },

  resume() {
    this.scheduler.resumeAll();
  },

  restart() {
    this.scheduler.cancelAll();
    this.start({ mode: this.mode, difficulty: this.difficulty, pickedColor: this.humanColor });
  },

  destroy() {
    this.scheduler.cancelAll();
    if (this.rAFId) cancelAnimationFrame(this.rAFId);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);

    delete window.LudoGameInstance;

    this.container = null;
    this.canvas = null;
    this.renderer = null;
  }
};

export default LudoGame;