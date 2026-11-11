import { GlobalBus } from './core/bus.js';
import { SettingsStore } from './core/store.js';
import { Scheduler } from './core/scheduler.js';
import { GameLoop } from './core/loop.js';
import { InputManager } from './core/input.js';
import { Router } from './core/router.js';
import { UI } from './core/ui.js';
import { FXEngine } from './fx.js';
import { Analytics } from './analytics.js';

// Game modules
import LudoGame from './games/ludo.js';
import SnakeGame from './games/snake.js';
import TttGame from './games/tictactoe.js';
import MemoryGame from './games/memory.js';
import FlappyGame from './games/flappy.js';
import BreakoutGame from './games/breakout.js';
import TwentyFortyEightGame from './games/twentyfortyeight.js';
import MinesweeperGame from './games/minesweeper.js';
import MoleGame from './games/mole.js';
import ConnectFourGame from './games/connectfour.js';
import WordGuessGame from './games/wordguess.js';

export const ArcadeApp = {
  registry: new Map(),
  activeSession: null,
  activeGameKey: null,
  router: null,
  lastPlaytimeCheck: Date.now(),
  matchResolved: false,

  init() {
    this.initSplash();
    Analytics.init();
    FXEngine.init();

    this.registerGame('ludo', LudoGame);
    this.registerGame('snake', SnakeGame);
    this.registerGame('tictactoe', TttGame);
    this.registerGame('memory', MemoryGame);
    this.registerGame('flappy', FlappyGame);
    this.registerGame('breakout', BreakoutGame);
    this.registerGame('twentyfortyeight', TwentyFortyEightGame);
    this.registerGame('minesweeper', MinesweeperGame);
    this.registerGame('mole', MoleGame);
    this.registerGame('connectfour', ConnectFourGame);
    this.registerGame('wordguess', WordGuessGame);

    this.initThemeAndAudioUI();
    this.initProfileDrawer();
    this.initHotkeys();
    this.initDialogBindings();
    this.initPlaytimeTracker();

    this.router = new Router({
      '#/': () => this.showLobby(),
      '#/game': (key) => this.promptOrLaunchGame(key),
      '#/profile': () => this.openProfileDrawer()
    });
    this.router.init();
  },

  initSplash() {
    const splash = document.getElementById('splashScreen');
    if (splash) {
      splash.style.display = 'none';
      splash.remove();
    }
  },

  registerGame(key, module) {
    const required = ['id', 'title', 'mount', 'start', 'pause', 'resume', 'restart', 'destroy'];
    for (const prop of required) {
      if (typeof module[prop] === 'undefined') {
        throw new Error(`[ArcadeApp] Missing property: ${prop} in ${key}`);
      }
    }
    this.registry.set(key, module);
  },

  promptOrLaunchGame(key) {
    const game = this.registry.get(key);
    if (!game) {
      this.router.navigate('#/');
      return;
    }
    this.openBriefing(key, game);
  },

  openBriefing(key, game) {
    const dialog = document.getElementById('dialogBriefing');
    const title = document.getElementById('briefingGameTitle');
    const rules = document.getElementById('briefingRulesList');
    const launchBtn = document.getElementById('btnBriefingLaunch');
    const cancelBtn = document.getElementById('btnBriefingCancel');

    if (!dialog) return;

    title.textContent = game.title || key;

    const existingConfig = document.getElementById('briefingCustomConfig');
    if (existingConfig) existingConfig.remove();

    const plainInstructions = {
      ludo: [
        'Roll a 6 to bring a token out of your yard. A 6 also gives you another roll.',
        'Star cells (★) are safe squares where nobody can cut your pawn.',
        'Landing on another player\'s pawn sends it back to their yard and gives you a bonus turn.',
        'Three 6s in a row skips your turn immediately.',
        'You need an exact number to step into the center home.'
      ],
      snake: [
        'Move around and eat pellets to grow longer.',
        'Hitting the wall or your own tail ends your run.',
        'Speed goes up as your score grows.'
      ],
      tictactoe: [
        'Line up three of your marks horizontally, vertically, or diagonally.',
        'The bot blocks your moves when it can.',
        'Takes only a few seconds per round.'
      ],
      memory: [
        'Flip two cards at a time to find matching pairs.',
        'Remember where you saw each card and clear the board in few moves.',
        'Best score tracks your lowest move count.'
      ],
      flappy: [
        'Press Space or tap the screen to flap upward.',
        'Time your hops through the pipe gaps.',
        'Touching anything ends the flight.'
      ],
      breakout: [
        'Slide the paddle with mouse, touch, or arrow keys.',
        'Bounce the ball into the bricks to clear them.',
        'Do not let the ball drop past your paddle.'
      ],
      twentyfortyeight: [
        'Slide tiles using arrow keys, WASD, or swipe.',
        'Equal numbers merge together when they touch.',
        'Keep going until you build the 2048 tile.'
      ],
      minesweeper: [
        'Tap tiles to clear safe ground. Numbers show nearby mines.',
        'Right click or use Flag mode to mark suspect spots.',
        'Clear all safe squares without setting off a mine.'
      ],
      mole: [
        'Tap moles before they drop back into their holes.',
        'You have 30 seconds to hit as many as possible.',
        'Golden moles give a quick bonus.'
      ],
      connectfour: [
        'Take turns dropping discs into the columns.',
        'Connect four of your discs in a line to win.',
        'Watch your opponent\'s setup and block them in time.'
      ],
      wordguess: [
        'Guess the secret five-letter word in six tries.',
        'Green means the letter is right and in the right spot.',
        'Yellow means the letter is in the word but elsewhere.'
      ]
    };

    rules.innerHTML = (plainInstructions[key] || ['Take turns and follow the game rules.'])
      .map(t => `<li>${t}</li>`).join('');

    let launchOptions = {};

    if (key === 'ludo') {
      const configDiv = document.createElement('div');
      configDiv.id = 'briefingCustomConfig';
      configDiv.style.cssText = 'margin:12px 0; padding:10px; background:var(--bg-surface); border:1px solid var(--border-line); border-radius:6px; display:flex; flex-direction:column; gap:10px; text-align:left;';
      configDiv.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.75rem; font-weight:700;">Players:</span>
          <div style="display:flex; gap:6px;">
            <button type="button" class="btn-ludo-opt active" data-type="players" data-val="2" style="padding:4px 10px; font-size:0.75rem; font-weight:600; border:1px solid var(--border-line); border-radius:4px; cursor:pointer;">2P</button>
            <button type="button" class="btn-ludo-opt" data-type="players" data-val="3" style="padding:4px 10px; font-size:0.75rem; font-weight:600; border:1px solid var(--border-line); border-radius:4px; cursor:pointer;">3P</button>
            <button type="button" class="btn-ludo-opt" data-type="players" data-val="4" style="padding:4px 10px; font-size:0.75rem; font-weight:600; border:1px solid var(--border-line); border-radius:4px; cursor:pointer;">4P</button>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.75rem; font-weight:700;">Mode:</span>
          <div style="display:flex; gap:6px;">
            <button type="button" class="btn-ludo-opt active" data-type="mode" data-val="vs_bot" style="padding:4px 10px; font-size:0.75rem; font-weight:600; border:1px solid var(--border-line); border-radius:4px; cursor:pointer;">vs Bot</button>
            <button type="button" class="btn-ludo-opt" data-type="mode" data-val="pass_play" style="padding:4px 10px; font-size:0.75rem; font-weight:600; border:1px solid var(--border-line); border-radius:4px; cursor:pointer;">Pass & Play</button>
          </div>
        </div>

        <div id="ludoDifficultyRow" style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.75rem; font-weight:700;">Bot AI:</span>
          <div style="display:flex; gap:6px;">
            <button type="button" class="btn-ludo-opt" data-type="diff" data-val="Easy" style="padding:4px 8px; font-size:0.75rem; font-weight:600; border:1px solid var(--border-line); border-radius:4px; cursor:pointer;">Easy</button>
            <button type="button" class="btn-ludo-opt active" data-type="diff" data-val="Normal" style="padding:4px 8px; font-size:0.75rem; font-weight:600; border:1px solid var(--border-line); border-radius:4px; cursor:pointer;">Normal</button>
            <button type="button" class="btn-ludo-opt" data-type="diff" data-val="Hard" style="padding:4px 8px; font-size:0.75rem; font-weight:600; border:1px solid var(--border-line); border-radius:4px; cursor:pointer;">Hard</button>
          </div>
        </div>
      `;

      rules.parentNode.insertBefore(configDiv, rules.nextSibling);

      let selectedCount = 2;
      let selectedMode = 'vs_bot';
      let selectedDiff = 'Normal';

      configDiv.querySelectorAll('.btn-ludo-opt').forEach(btn => {
        btn.onclick = (e) => {
          const type = e.currentTarget.dataset.type;
          const val = e.currentTarget.dataset.val;

          configDiv.querySelectorAll(`.btn-ludo-opt[data-type="${type}"]`).forEach(b => {
            b.classList.remove('active');
            b.style.background = '';
            b.style.color = '';
          });

          e.currentTarget.classList.add('active');
          e.currentTarget.style.background = 'var(--brand-accent)';
          e.currentTarget.style.color = '#fff';

          if (type === 'players') selectedCount = parseInt(val, 10);
          if (type === 'mode') {
            selectedMode = val;
            const diffRow = document.getElementById('ludoDifficultyRow');
            if (diffRow) diffRow.style.display = (val === 'vs_bot') ? 'flex' : 'none';
          }
          if (type === 'diff') selectedDiff = val;
        };
      });

      configDiv.querySelectorAll('.btn-ludo-opt.active').forEach(b => {
        b.style.background = 'var(--brand-accent)';
        b.style.color = '#fff';
      });

      launchOptions = () => ({
        playerCount: selectedCount,
        mode: selectedMode,
        difficulty: selectedDiff
      });
    }

    const onLaunch = () => {
      launchBtn.removeEventListener('click', onLaunch);
      cancelBtn.removeEventListener('click', onCancel);
      UI.close(dialog);
      const opts = typeof launchOptions === 'function' ? launchOptions() : {};
      this.launchGame(key, opts);
    };

    const onCancel = () => {
      launchBtn.removeEventListener('click', onLaunch);
      cancelBtn.removeEventListener('click', onCancel);
      UI.close(dialog);
      this.router.navigate('#/');
    };

    launchBtn.addEventListener('click', onLaunch);
    cancelBtn.addEventListener('click', onCancel);

    UI.open(dialog);
  },

  launchGame(gameKey, options = {}) {
    const game = this.registry.get(gameKey);
    if (!game) return;

    if (this.activeSession) {
      this.destroyActiveGame();
    }

    this.activeGameKey = gameKey;
    this.matchResolved = false;

    const lobbyView = document.getElementById('viewLobby');
    const arenaView = document.getElementById('viewArena');
    const viewport = document.getElementById('arenaViewport');
    const title = document.getElementById('arenaGameTitle');

    if (lobbyView) lobbyView.style.display = 'none';
    if (arenaView) arenaView.classList.remove('hidden');
    if (title) title.textContent = game.title || gameKey;
    if (viewport) viewport.innerHTML = '';

    const scheduler = new Scheduler();
    const input = new InputManager(viewport);
    let loop = null;

    const ctx = {
      scheduler,
      input,
      fx: FXEngine,
      ui: UI,
      createLoop: (updateFn, renderFn) => {
        loop = new GameLoop({ onUpdate: updateFn, onRender: renderFn });
        return loop;
      },
      recordResult: (outcome, details = {}) => {
        this.triggerMatchEnd(outcome, details);
      }
    };

    this.activeSession = {
      game,
      ctx,
      scheduler,
      input,
      isPaused: false,
      getLoop: () => loop,
      dispose: () => {
        if (loop) loop.stop();
        scheduler.dispose();
        input.dispose();
      }
    };

    game.mount(viewport, ctx);

    if (gameKey === 'ludo') {
      if (typeof game.setPlayerCount === 'function' && options.playerCount) {
        game.setPlayerCount(options.playerCount);
      }
      if (options.difficulty) game.difficulty = options.difficulty;
      if (game.lobbyConfig && Array.isArray(game.lobbyConfig.seats)) {
        if (options.mode === 'pass_play') {
          game.lobbyConfig.seats.forEach(s => { s.isBot = false; });
        } else {
          game.lobbyConfig.seats.forEach((s, idx) => { s.isBot = (idx > 0); });
        }
      }
    }

    game.start(options);
    FXEngine.sfx.click();
  },

  triggerMatchEnd(outcome, details = {}) {
    if (this.matchResolved) return;
    this.matchResolved = true;
    this.handleMatchOutcome(outcome, details);
  },

  pauseActiveGame(showModal = true) {
    if (!this.activeSession || this.activeSession.isPaused) return;
    this.activeSession.isPaused = true;

    this.activeSession.scheduler.pause();
    const loop = this.activeSession.getLoop();
    if (loop) loop.pause();
    if (this.activeSession.game.pause) this.activeSession.game.pause();

    if (showModal) {
      UI.open(document.getElementById('dialogPause'));
    }
  },

  resumeActiveGame() {
    if (!this.activeSession || !this.activeSession.isPaused) return;
    this.activeSession.isPaused = false;

    this.activeSession.scheduler.resume();
    const loop = this.activeSession.getLoop();
    if (loop) loop.resume();
    if (this.activeSession.game.resume) this.activeSession.game.resume();
  },

  restartActiveGame() {
    if (!this.activeSession) return;
    this.launchGame(this.activeGameKey);
  },

  saveAndExitActiveGame() {
    if (!this.activeSession) return;
    if (typeof this.activeSession.game.saveState === 'function') {
      this.activeSession.game.saveState();
    }
    this.matchResolved = true;
    this.destroyActiveGame();
    this.router.navigate('#/');
  },

  forfeitActiveGame() {
    if (!this.activeSession) return;
    this.triggerMatchEnd('LOSS', { summary: 'Match quit early' });
  },

  destroyActiveGame() {
    if (!this.activeSession) return;
    if (this.activeSession.game.destroy) {
      this.activeSession.game.destroy();
    }
    this.activeSession.dispose();
    this.activeSession = null;
    this.activeGameKey = null;
    this.matchResolved = false;

    const viewport = document.getElementById('arenaViewport');
    if (viewport) viewport.innerHTML = '';
  },

  showLobby() {
    if (this.activeSession) {
      this.destroyActiveGame();
    }
    const lobbyView = document.getElementById('viewLobby');
    const arenaView = document.getElementById('viewArena');
    if (lobbyView) lobbyView.style.display = 'block';
    if (arenaView) arenaView.classList.add('hidden');
    Analytics.syncUI();
  },

  openProfileDrawer() {
    const drawer = document.getElementById('profileDrawer');
    const backdrop = document.getElementById('drawerBackdrop');
    const inputCallsign = document.getElementById('inputCallsign');

    if (drawer && backdrop) {
      drawer.classList.add('open');
      backdrop.classList.add('show');
      Analytics.syncUI();
      if (inputCallsign) inputCallsign.value = Analytics.data.callsign;
    }
  },

  handleMatchOutcome(outcome, details) {
    Analytics.record({
      game: this.activeGameKey,
      outcome,
      score: details.score || 0,
      moves: details.moves || null
    });

    const dialog = document.getElementById('dialogOutcome');
    const title = document.getElementById('outcomeTitle');
    const det = document.getElementById('outcomeDetails');

    if (dialog && title && det) {
      if (outcome === 'WIN') {
        title.textContent = 'You Won!';
        title.style.color = 'var(--status-win)';
        FXEngine.sfx.victory();
      } else if (outcome === 'LOSS') {
        title.textContent = 'Game Over';
        title.style.color = 'var(--status-loss)';
        FXEngine.sfx.defeat();
      } else {
        title.textContent = 'Draw';
        title.style.color = 'var(--text-main)';
      }

      det.textContent = details.summary || (outcome === 'WIN' ? 'Good game!' : 'Better luck next round.');
      UI.open(dialog);
    }
  },

  initThemeAndAudioUI() {
    const btnAudio = document.getElementById('btnAudioToggle');
    const labelAudio = document.getElementById('labelAudioState');
    const iconAudio = document.getElementById('iconAudioState');

    const updateAudioUI = (muted) => {
      if (labelAudio) labelAudio.textContent = muted ? 'MUTED' : 'SOUND';
      if (iconAudio) {
        iconAudio.innerHTML = `<use href="#icon-sound-${muted ? 'off' : 'on'}"/>`;
      }
    };

    if (btnAudio) {
      btnAudio.onclick = (e) => {
        e.preventDefault();
        const next = !SettingsStore.get('muted');
        SettingsStore.set('muted', next);
        if (next) FXEngine.stopAmbientDrone();
        else FXEngine.startAmbientDrone();
        updateAudioUI(next);
      };
    }

    const btnTheme = document.getElementById('btnThemeToggle');
    const labelTheme = document.getElementById('labelThemeState');
    const iconTheme = document.getElementById('iconThemeState');

    const applyTheme = (theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      if (labelTheme) labelTheme.textContent = theme === 'dark' ? 'NIGHT' : 'DAY';
      if (iconTheme) {
        iconTheme.innerHTML = `<use href="#icon-theme-${theme === 'dark' ? 'night' : 'day'}"/>`;
      }
      localStorage.setItem('cae_settings_theme', theme);
    };

    if (btnTheme) {
      btnTheme.onclick = (e) => {
        e.preventDefault();
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        applyTheme(current === 'dark' ? 'light' : 'dark');
      };
    }

    applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');
    updateAudioUI(SettingsStore.get('muted'));
  },

  initProfileDrawer() {
    const openBtn = document.getElementById('btnProfileDrawerOpen');
    const closeBtn = document.getElementById('btnProfileDrawerClose');
    const drawer = document.getElementById('profileDrawer');
    const backdrop = document.getElementById('drawerBackdrop');
    const inputCallsign = document.getElementById('inputCallsign');

    const closeDrawer = () => {
      drawer.classList.remove('open');
      backdrop.classList.remove('show');
      if (window.location.hash === '#/profile') {
        window.location.hash = '#/';
      }
    };

    if (openBtn) openBtn.onclick = () => this.openProfileDrawer();
    if (closeBtn) closeBtn.onclick = closeDrawer;
    if (backdrop) backdrop.onclick = closeDrawer;

    inputCallsign?.addEventListener('change', (e) => {
      Analytics.setCallsign(e.target.value);
    });
  },

  initDialogBindings() {
    ['dialogPause', 'dialogConfirmForfeit'].forEach((id) => {
      document.getElementById(id)?.addEventListener('close', () => {
        if (this.activeSession && this.activeSession.isPaused && !this.matchResolved && !UI.hasOpenDialogs()) {
          this.resumeActiveGame();
        }
      });
    });

    document.getElementById('btnArenaPause')?.addEventListener('click', () => this.pauseActiveGame(true));
    document.getElementById('btnPauseResume')?.addEventListener('click', () => {
      UI.close(document.getElementById('dialogPause'));
      this.resumeActiveGame();
    });
    document.getElementById('btnPauseSaveExit')?.addEventListener('click', () => {
      UI.close(document.getElementById('dialogPause'));
      this.saveAndExitActiveGame();
    });
    document.getElementById('btnPauseRestart')?.addEventListener('click', () => {
      UI.close(document.getElementById('dialogPause'));
      this.restartActiveGame();
    });
    document.getElementById('btnPauseForfeit')?.addEventListener('click', () => {
      UI.close(document.getElementById('dialogPause'));
      UI.open(document.getElementById('dialogConfirmForfeit'));
    });

    document.getElementById('btnArenaForfeit')?.addEventListener('click', () => {
      this.pauseActiveGame(false);
      UI.open(document.getElementById('dialogConfirmForfeit'));
    });
    document.getElementById('btnForfeitCancel')?.addEventListener('click', () => {
      UI.close(document.getElementById('dialogConfirmForfeit'));
      this.resumeActiveGame();
    });
    document.getElementById('btnForfeitConfirm')?.addEventListener('click', () => {
      UI.close(document.getElementById('dialogConfirmForfeit'));
      this.forfeitActiveGame();
    });

    document.getElementById('btnOutcomeReplay')?.addEventListener('click', () => {
      UI.close(document.getElementById('dialogOutcome'));
      this.restartActiveGame();
    });
    document.getElementById('btnOutcomeLobby')?.addEventListener('click', () => {
      UI.close(document.getElementById('dialogOutcome'));
      this.router.navigate('#/');
    });

    const grid = document.getElementById('gameGridContainer');
    if (grid) {
      grid.addEventListener('click', (e) => {
        const card = e.target.closest('.game-card');
        if (card) {
          const key = card.getAttribute('data-game');
          if (key) {
            this.router.navigate(`#/game/${key}`);
          }
        }
      });
    }

    document.getElementById('btnHeroDeploy')?.addEventListener('click', () => {
      this.router.navigate('#/game/ludo');
    });

    document.getElementById('btnHeroContinue')?.addEventListener('click', () => {
      if (this.registry.has('ludo')) {
        this.launchGame('ludo', { resumeSave: true });
      }
    });
  },

  initHotkeys() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const code = e.code;
      if (this.activeGameKey === 'wordguess' && code.startsWith('Key')) return;

      if (code === 'KeyM') {
        document.getElementById('btnAudioToggle')?.click();
      } else if (code === 'KeyT') {
        document.getElementById('btnThemeToggle')?.click();
      } else if (code === 'KeyP') {
        if (this.activeSession && !UI.hasOpenDialogs()) {
          this.pauseActiveGame(true);
        }
      } else if (code === 'Escape') {
        if (UI.hasOpenDialogs()) {
          UI.closeTop();
        } else if (this.activeSession) {
          this.pauseActiveGame(false);
          UI.open(document.getElementById('dialogConfirmForfeit'));
        }
      }
    });
  },

  initPlaytimeTracker() {
    const updatePlaytime = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - this.lastPlaytimeCheck) / 1000);
      this.lastPlaytimeCheck = now;
      if (this.activeSession && !document.hidden && elapsed > 0) {
        Analytics.data.totalPlaytimeSec += elapsed;
      }
    };

    window.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        updatePlaytime();
        Analytics.save();
        if (this.activeSession) this.pauseActiveGame(true);
      } else {
        this.lastPlaytimeCheck = Date.now();
      }
    });

    setInterval(() => {
      updatePlaytime();
      Analytics.save();
      Analytics.syncUI();
    }, 30000);

    window.addEventListener('pagehide', () => {
      updatePlaytime();
      Analytics.save();
    });
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ArcadeApp.init());
} else {
  ArcadeApp.init();
}