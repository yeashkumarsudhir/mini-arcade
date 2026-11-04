/**
 * js/app.js
 * Parlour Arcade Application Kernel & Game Lifecycle Controller
 */
import { GlobalBus } from './core/bus.js';
import { SettingsStore } from './core/store.js';
import { Scheduler } from './core/scheduler.js';
import { GameLoop } from './core/loop.js';
import { InputManager } from './core/input.js';
import { Router } from './core/router.js';
import { UI } from './core/ui.js';
import { FXEngine } from './fx.js';
import { Analytics } from './analytics.js';

// Base 5 Games
import LudoGame from './games/ludo.js';
import SnakeGame from './games/snake.js';
import TttGame from './games/tictactoe.js';
import MemoryGame from './games/memory.js';
import FlappyGame from './games/flappy.js';

// 6 New Games
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

    // Register All 11 Games
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

    // Global testing shortcut for DevTools Console
    if (['localhost', '127.0.0.1'].includes(location.hostname)) {
      window.instantWin = () => {
        this.matchResolved = false;
        this.triggerMatchEnd('WIN', { summary: 'Debug Instant Win Test', ranked: true });
      };
    }

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
    const required = ['id', 'title', 'accent', 'mount', 'start', 'pause', 'resume', 'restart', 'destroy'];
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
    const badge = document.getElementById('briefingGameBadge');
    const rules = document.getElementById('briefingRulesList');
    const launchBtn = document.getElementById('btnBriefingLaunch');
    const cancelBtn = document.getElementById('btnBriefingCancel');

    if (!dialog) return;

    title.textContent = game.title;
    badge.textContent = 'Rules';

    const instructions = {
      ludo: [
        'Roll a 6 to bring a pawn out of your yard.',
        'Star cells are safe zones where pawns cannot be captured.',
        'Navigate the full circuit and bring all four pawns home.'
      ],
      snake: [
        'Eat energy pellets to grow longer and score points.',
        'Crashing into walls or your own tail ends the round.',
        'Speed increases steadily as your score climbs.'
      ],
      tictactoe: [
        'Get three of your marks in a horizontal, vertical, or diagonal line.',
        'The bot evaluates counter-moves and plays smart.',
        'Turns alternate after each round.'
      ],
      memory: [
        'Flip pairs of cards to match identical symbols.',
        'Try to clear all eight pairs in as few moves as possible.',
        'Fewer moves earn higher match ratings.'
      ],
      flappy: [
        'Tap the screen or press Spacebar to flap upward.',
        'Navigate through the gaps without colliding with the gates.',
        'Each cleared gate scores one point.'
      ],
      breakout: [
        'Steer the paddle with your mouse, touch, or arrow keys.',
        'Bounce the ball into the bricks to shatter them.',
        'Keep the ball in play without running out of lives.'
      ],
      twentyfortyeight: [
        'Use arrow keys, WASD, or swipe to slide tiles across the board.',
        'When two tiles with the same number touch, they merge into one.',
        'Keep combining numbers until you reach 2048.'
      ],
      minesweeper: [
        'Tap safe squares to clear them; numbers show nearby mines.',
        'Switch to Flag mode or right-click to mark suspected mines.',
        'Clear all safe squares to win without setting off a mine.'
      ],
      mole: [
        'Moles pop out of random holes; tap them before they duck back down.',
        'Standard brown moles are worth 10 points.',
        'Golden crown moles give a 30-point bonus score.'
      ],
      connectfour: [
        'Drop discs into columns one turn at a time.',
        'Connect four of your discs in a line horizontally, vertically, or diagonally.',
        'Block your opponent before they complete their line.'
      ],
      wordguess: [
        'Guess the hidden five-letter word in six tries.',
        'Green tiles show correct letters in the right position.',
        'Yellow tiles show letters that belong in the word but in a different spot.'
      ]
    };

    rules.innerHTML = (instructions[key] || ['Play carefully.', 'Follow the rules.', 'Score points.'])
      .map(t => `<li>${t}</li>`).join('');

    const onLaunch = () => {
      launchBtn.removeEventListener('click', onLaunch);
      cancelBtn.removeEventListener('click', onCancel);
      UI.close(dialog);
      this.launchGame(key);
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

  launchGame(gameKey) {
    const game = this.registry.get(gameKey);
    if (!game) return;

    if (this.activeSession) {
      this.destroyActiveGame();
    }

    this.activeGameKey = gameKey;
    this.matchResolved = false;
    document.documentElement.style.setProperty('--game-accent', game.accent);

    const lobbyView = document.getElementById('viewLobby');
    const arenaView = document.getElementById('viewArena');
    const viewport = document.getElementById('arenaViewport');
    const title = document.getElementById('arenaGameTitle');

    if (lobbyView) lobbyView.style.display = 'none';
    if (arenaView) arenaView.classList.remove('hidden');
    if (title) title.textContent = game.title;
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
    game.start({});
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
    const res = Analytics.record({
      game: this.activeGameKey,
      outcome,
      mode: details.mode || 'Ranked',
      score: details.score || 0,
      moves: details.moves || null,
      ranked: details.ranked !== false
    });

    const dialog = document.getElementById('dialogOutcome');
    const title = document.getElementById('outcomeTitle');
    const sub = document.getElementById('outcomeSubtitle');
    const det = document.getElementById('outcomeDetails');

    if (dialog && title && sub && det) {
      if (outcome === 'WIN') {
        title.textContent = 'Victory!';
        title.style.color = 'var(--status-win)';
        FXEngine.sfx.victory();
      } else if (outcome === 'LOSS') {
        title.textContent = 'Defeat';
        title.style.color = 'var(--status-loss)';
        FXEngine.sfx.defeat();
      } else {
        title.textContent = 'Draw';
        title.style.color = 'var(--brand-accent)';
      }

      sub.textContent = details.ranked === false ? 'Casual match (No XP)' : `+${res.gainedXP || 100} XP Earned`;
      det.textContent = details.summary || `Result: ${outcome}`;

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
        e.stopPropagation();
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
        e.stopPropagation();
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
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
    const avatarGrid = document.getElementById('avatarPickerGrid');

    const closeDrawer = () => {
      drawer.classList.remove('open');
      backdrop.classList.remove('show');
      if (window.location.hash === '#/profile') {
        window.location.hash = '#/';
      }
    };

    if (openBtn) {
      openBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openProfileDrawer();
      };
    }
    if (closeBtn) closeBtn.onclick = closeDrawer;
    if (backdrop) backdrop.onclick = closeDrawer;

    inputCallsign?.addEventListener('change', (e) => {
      Analytics.setCallsign(e.target.value);
    });

    avatarGrid?.addEventListener('click', (e) => {
      const btn = e.target.closest('.avatar-option');
      if (btn) {
        Analytics.setAvatar(btn.textContent.trim());
      }
    });
  },

  initDialogBindings() {
    // If a pause/quit dialog is dismissed natively (Esc), don't leave the game frozen
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

    const heroBtn = document.getElementById('btnHeroDeploy');
    if (heroBtn) {
      heroBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.router.navigate('#/game/ludo');
      };
    }

    const heroContinue = document.getElementById('btnHeroContinue');
    if (heroContinue) {
      heroContinue.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.router.navigate('#/game/ludo');
      };
    }
  },

  initHotkeys() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      const code = e.code;

      // Word Guess uses every letter key: don't let M/T/P/F hotkeys eat typed letters
      if (this.activeGameKey === 'wordguess' && code.startsWith('Key')) return;

      if (code === 'KeyM') {
        e.preventDefault();
        document.getElementById('btnAudioToggle')?.click();
      } else if (code === 'KeyT') {
        e.preventDefault();
        document.getElementById('btnThemeToggle')?.click();
      } else if (code === 'KeyP') {
        if (this.activeSession && !UI.hasOpenDialogs()) {
          e.preventDefault();
          this.pauseActiveGame(true);
        }
      } else if (code === 'KeyF') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      } else if (code === 'Escape') {
        if (UI.hasOpenDialogs()) {
          e.preventDefault();
          UI.closeTop();
        } else if (this.activeSession) {
          e.preventDefault();
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