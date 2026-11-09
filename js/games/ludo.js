/**
 * js/games/ludo.js
 * Classic Physical Ludo Orchestrator & Game State Machine
 * Real Paper Board, Moulded Plastic Pawns & 3D Ivory Tumbling Dice
 * Enhanced with Ludo-King Style Custom Player / Bot Lobby
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

  fsm: 'LOBBY',

  activeColor: 'RED',
  humanColor: 'RED',
  mode: 'CUSTOM',
  difficulty: 'Normal',
  pace: 'NORMAL',
  hopMs: 150,

  autoMoveSingle: true,
  perspectiveView: false,
  colorBlindAssist: false,

  diceValue: 1,
  consecutiveSixes: 0,
  isRolling: false,

  lobbyConfig: {
    playerCount: 4,
    seats: [
      { color: 'RED', active: true, isBot: false, name: 'Player 1' },
      { color: 'GREEN', active: true, isBot: true, name: 'Bot 1' },
      { color: 'YELLOW', active: true, isBot: true, name: 'Bot 2' },
      { color: 'BLUE', active: true, isBot: true, name: 'Bot 3' }
    ]
  },

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
      <div class="ludo-tabletop-container" id="ludoTableContainer" style="display:flex; flex-direction:column; align-items:center; width:100%; max-width:600px; margin:0 auto; gap:12px;">
        
        <!-- Physical Board Viewport -->
        <div class="ludo-board-frame" id="ludoBoardFrame" style="width:100%; display:flex; justify-content:center;">
          <canvas id="ludoCanvas" width="540" height="540" style="max-width:100%; height:auto; touch-action:none; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.25);"></canvas>
        </div>

        <!-- Cabinet Side Deck Controls -->
        <div class="ludo-deck-controls" style="width:100%; display:flex; flex-direction:column; gap:10px;">
          <!-- Active Player Card Slots -->
          <div class="ludo-players-grid" id="ludoPlayerSlots" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:6px;"></div>

          <!-- Turn Status Readout -->
          <div class="telemetry-cell" style="text-align:center; padding:10px 12px; background:var(--bg-surface, #fff); border:2px solid var(--border-strong, #141712); border-radius:10px;">
            <div id="ludoStatusLine" class="t-val" style="font-size:1.1rem; font-weight:800; color:var(--ludo-red, #E53935); margin:0;" aria-live="polite">
              Starting Match...
            </div>
            <div id="ludoSubNotice" style="font-size:0.75rem; color:var(--text-dim, #666); margin-top:4px; font-weight:600;">
              Tap Roll Dice or press SPACE
            </div>
          </div>

          <!-- Interactive Dice Tray -->
          <div class="ludo-dice-tray" id="ludoDiceTray" style="background:var(--bg-surface, #fff); border:2px solid var(--border-strong, #141712); border-radius:12px; padding:12px; display:flex; flex-direction:column; align-items:center; gap:8px;">
            <div class="ludo-roll-again-badge" id="ludoRollAgainBadge">ROLL AGAIN!</div>

            <!-- Visual Dice Target -->
            <div class="ludo-dice-viewport" id="ludoDiceViewport" role="button" tabindex="0" aria-label="Roll Dice" style="width:68px; height:68px; cursor:pointer;">
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

            <div style="display:flex; width:100%; gap:8px;">
              <button type="button" class="btn-cta-primary" id="btnRollDiceDirect" style="flex:2; height:42px; font-size:0.85rem; font-weight:800;">
                Roll Dice (Space)
              </button>
              <button type="button" id="btnOpenLobbyModal" class="btn-cta-secondary" style="flex:1; height:42px; font-size:0.75rem; font-weight:700; border:2px solid var(--border-strong, #000); border-radius:6px; cursor:pointer;">
                ⚙️ Setup
              </button>
            </div>
          </div>

          <!-- Quick Switches -->
          <div class="telemetry-cell" style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--bg-surface, #fff); border:1.5px solid var(--border-strong, #ccc); border-radius:8px;">
            <label style="display:flex; align-items:center; gap:6px; font-size:0.75rem; font-weight:700; cursor:pointer;">
              <input type="checkbox" id="chkAutoMove" checked> Auto-move
            </label>
            <label style="display:flex; align-items:center; gap:6px; font-size:0.75rem; font-weight:700; cursor:pointer;">
              <input type="checkbox" id="chkColorBlind"> Numbers
            </label>
            <label style="display:flex; align-items:center; gap:6px; font-size:0.75rem; font-weight:700; cursor:pointer;">
              <input type="checkbox" id="chkTableTilt"> Tilt 3D
            </label>
          </div>
        </div>

        <!-- Ludo King Style Match Setup Modal -->
        <div id="ludoLobbyModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:9999; justify-content:center; align-items:center; padding:16px;">
          <div style="background:var(--bg-surface, #fff); border:3px solid var(--border-strong, #000); border-radius:12px; max-width:420px; width:100%; padding:20px; box-shadow:4px 4px 0px #000; display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <h3 style="margin:0; font-family:'Archivo Black', sans-serif; font-size:1.15rem;">🎲 Ludo Match Setup</h3>
              <button type="button" id="btnCloseLobbyModal" style="background:none; border:none; font-size:1.4rem; cursor:pointer; line-height:1;">&times;</button>
            </div>

            <!-- Player Count Selector -->
            <div>
              <span class="ludo-opt-group-label" style="display:block; font-size:0.75rem; font-weight:800; text-transform:uppercase; color:var(--text-dim, #666); margin-bottom:6px;">Select Players</span>
              <div class="ludo-pill-selector" id="ludoPlayerCountPills" style="display:flex; gap:8px;">
                <button type="button" class="ludo-pill-btn" data-count="2">2 Players</button>
                <button type="button" class="ludo-pill-btn" data-count="3">3 Players</button>
                <button type="button" class="ludo-pill-btn active" data-count="4">4 Players</button>
              </div>
            </div>

            <!-- Seat Customization Grid -->
            <div>
              <span class="ludo-opt-group-label" style="display:block; font-size:0.75rem; font-weight:800; text-transform:uppercase; color:var(--text-dim, #666); margin-bottom:6px;">Seats (Human vs Bot)</span>
              <div id="ludoSeatsContainer" class="ludo-seat-config-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;"></div>
            </div>

            <button type="button" class="btn-cta-primary" id="btnStartLobbyGame" style="height:44px; width:100%; font-size:0.9rem; font-weight:900;">
              START MATCH
            </button>
          </div>
        </div>
      </div>
    `;

    this.canvas = document.getElementById('ludoCanvas');
    this.renderer = new LudoRenderer(this.canvas);

    window.LudoGameInstance = this;

    this.bindEvents();
    this.setupResizeObserver();
    this.startRenderLoop();
  },

  start(opts = {}) {
    this.matchEndedCalled = false;
    this.consecutiveSixes = 0;
    this.fsm = 'WAIT_ROLL';
    this.animatingHop = null;
    this.legalMoves = [];
    this.selectedTokenIdx = null;

    if (opts.customPlayers && Array.isArray(opts.customPlayers)) {
      this.players = opts.customPlayers;
    } else {
      this.players = this.buildPlayersFromLobby();
    }

    this.humanColor = this.players.find(p => !p.isBot)?.color || this.players[0].color;
    this.activeColor = this.players[0].color;

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

    this.renderPlayerSlots();
    this.syncUI();
    this.setDiceFace(1);

    if (this.getCurrentPlayer().isBot) {
      this.scheduler.after(500, () => this.triggerBotCycle());
    }
  },

  buildPlayersFromLobby() {
    const activeSeats = this.lobbyConfig.seats.filter(s => s.active);
    return activeSeats.map((seat, idx) => ({
      color: seat.color,
      isBot: seat.isBot,
      name: seat.isBot ? `Bot (${seat.color})` : `P${idx + 1} (${seat.color})`
    }));
  },

  openLobbyModal() {
    const modal = document.getElementById('ludoLobbyModal');
    if (!modal) return;
    this.renderLobbySeats();
    modal.style.display = 'flex';
  },

  closeLobbyModal() {
    const modal = document.getElementById('ludoLobbyModal');
    if (modal) modal.style.display = 'none';
  },

  renderLobbySeats() {
    const container = document.getElementById('ludoSeatsContainer');
    if (!container) return;

    container.innerHTML = this.lobbyConfig.seats.map((seat) => {
      const paletteColor = LUDO_PALETTE[seat.color];
      return `
        <div class="ludo-seat-card ${seat.active ? '' : 'disabled'}" style="border-left: 4px solid ${paletteColor}; padding:6px 8px; background:var(--bg-card, #f9f9f9); border:1px solid #ddd; border-left:5px solid ${paletteColor}; border-radius:6px; opacity:${seat.active ? '1' : '0.4'};">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <strong style="color:${paletteColor}; font-size:0.8rem;">${seat.color}</strong>
            <span style="font-size:0.65rem; color:#666;">${seat.active ? 'Active' : 'Off'}</span>
          </div>
          <button type="button" class="btn-seat-toggle" data-color="${seat.color}" ${!seat.active ? 'disabled' : ''} style="width:100%; font-size:0.75rem; padding:4px 6px; border:1px solid #444; border-radius:4px; cursor:pointer; background:${seat.isBot ? '#f0f0f0' : '#4CAF50'}; color:${seat.isBot ? '#333' : '#fff'}; font-weight:700;">
            ${seat.isBot ? '🤖 Bot (AI)' : '👤 Human'}
          </button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-seat-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const color = e.currentTarget.dataset.color;
        const seat = this.lobbyConfig.seats.find(s => s.color === color);
        if (seat) {
          seat.isBot = !seat.isBot;
          this.renderLobbySeats();
        }
      });
    });
  },

  setPlayerCount(count) {
    this.lobbyConfig.playerCount = count;

    if (count === 2) {
      this.lobbyConfig.seats = [
        { color: 'RED', active: true, isBot: false, name: 'P1 Red' },
        { color: 'GREEN', active: false, isBot: true, name: 'Bot' },
        { color: 'YELLOW', active: true, isBot: true, name: 'P2 / Bot' },
        { color: 'BLUE', active: false, isBot: true, name: 'Bot' }
      ];
    } else if (count === 3) {
      this.lobbyConfig.seats = [
        { color: 'RED', active: true, isBot: false, name: 'P1 Red' },
        { color: 'GREEN', active: true, isBot: true, name: 'P2 Green' },
        { color: 'YELLOW', active: true, isBot: true, name: 'P3 Yellow' },
        { color: 'BLUE', active: false, isBot: true, name: 'Bot' }
      ];
    } else {
      this.lobbyConfig.seats = [
        { color: 'RED', active: true, isBot: false, name: 'P1 Red' },
        { color: 'GREEN', active: true, isBot: true, name: 'Bot Green' },
        { color: 'YELLOW', active: true, isBot: true, name: 'Bot Yellow' },
        { color: 'BLUE', active: true, isBot: true, name: 'Bot Blue' }
      ];
    }

    document.querySelectorAll('#ludoPlayerCountPills .ludo-pill-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.count) === count);
    });

    this.renderLobbySeats();
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

    document.getElementById('btnOpenLobbyModal')?.addEventListener('click', () => this.openLobbyModal());
    document.getElementById('btnCloseLobbyModal')?.addEventListener('click', () => this.closeLobbyModal());

    document.querySelectorAll('#ludoPlayerCountPills .ludo-pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.setPlayerCount(parseInt(e.currentTarget.dataset.count));
      });
    });

    document.getElementById('btnStartLobbyGame')?.addEventListener('click', () => {
      this.closeLobbyModal();
      this.restart();
    });

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

        if (dist <= cell * 0.75) {
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
        const targetSize = Math.max(300, Math.min(frameW, 540));
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

    try { FXEngine.diceRoll(); } catch {}

    this.animateDiceTumble(this.diceValue, () => {
      try { FXEngine.diceLand(); } catch {}
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
      { transform: 'translateY(-28px) scale(1.15) rotateX(360deg) rotateY(180deg)', offset: 0.35 },
      { transform: `translateY(-8px) scale(1.05) rotateX(${endX * 0.75}deg) rotateY(${endY * 0.75}deg)`, offset: 0.7 },
      { transform: `translateY(0px) scale(1) rotateX(${endX}deg) rotateY(${endY}deg)`, offset: 1 }
    ], {
      duration: 650,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
      fill: 'forwards'
    });

    if (shadow) {
      shadow.animate([
        { transform: 'scale(1)', opacity: 0.4 },
        { transform: 'scale(0.6)', opacity: 0.15, offset: 0.35 },
        { transform: 'scale(1)', opacity: 0.4, offset: 1 }
      ], { duration: 650, fill: 'forwards' });
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
        this.showStatusNotification('3 Sixes in a row! Turn skipped.');
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
        this.scheduler.after(300, () => this.commitMove(this.legalMoves[0]));
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

    try { FXEngine.tokenHop(); } catch {}

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
      try { FXEngine.cutOpponent(); } catch {}
      this.showStatusNotification(`${color} captured ${capture.color}!`);
    }

    if (finalP === 56) {
      extraTurn = true;
      try { FXEngine.playTone(880, 'triangle', 0.1, 0.2); } catch {}

      const allHome = this.state.tokens[color].every(step => step === 56);
      if (allHome) {
        if (!this.state.finishRank.includes(color)) {
          this.state.finishRank.push(color);
        }
        try { FXEngine.confetti(80); } catch {}

        this.renderPlayerSlots();

        if (this.state.finishRank.length >= this.players.length - 1) {
          const humanRank = this.state.finishRank.indexOf(this.humanColor);
          const didHumanWin = (humanRank === 0);
          this.scheduler.after(400, () => this.concludeMatch(didHumanWin ? 'WIN' : 'LOSS'));
          return;
        }
      }
    }

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
      sub.textContent = curPlayer.isBot ? 'Bot is thinking...' : 'Tap Dice or press SPACE';
    }

    if (tray) {
      tray.style.setProperty('--ludo-tray-tint', LUDO_PALETTE[this.activeColor]);
    }

    if (rollBtn) {
      rollBtn.disabled = curPlayer.isBot || this.fsm !== 'WAIT_ROLL';
      rollBtn.textContent = curPlayer.isBot ? 'Bot Rolling...' : 'Roll Dice (Space)';
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
        <div class="ludo-player-card ${isCur ? 'active' : ''}" style="display:flex; align-items:center; gap:6px; padding:6px; border:2px solid ${isCur ? LUDO_PALETTE[p.color] : '#ccc'}; border-radius:6px; background:${isCur ? 'rgba(0,0,0,0.04)' : 'transparent'};">
          <span style="width:12px; height:12px; border-radius:50%; background:${LUDO_PALETTE[p.color]}; display:inline-block; border:1px solid #000;"></span>
          <div style="display:flex; flex-direction:column; line-height:1.1;">
            <span style="font-size:0.75rem; font-weight:800; color:${isCur ? LUDO_PALETTE[p.color] : 'inherit'};">${p.name}</span>
            <span style="font-size:0.65rem; color:#666;">${rankText}</span>
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

    const rank = this.state.finishRank.indexOf(this.humanColor) + 1 || (outcome === 'WIN' ? 1 : 4);

    const outcomePayload = {
      summary: `Finished #${rank} in Custom Match`,
      ranked: false
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
    this.start();
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