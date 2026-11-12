// app.js: starts the site, runs the lobby and looks after whichever game is open.
import { SettingsStore } from './core/store.js';
import { Scheduler } from './core/scheduler.js';
import { GameLoop } from './core/loop.js';
import { InputManager } from './core/input.js';
import { Router } from './core/router.js';
import { UI } from './core/ui.js';
import { SaveGame } from './core/savegame.js';
import { Storage } from './core/storage.js';
import { FXEngine } from './fx.js';
import { Stats, AVATAR_COLORS } from './stats.js';

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

const THEME_KEY = 'mini_arcade_theme';

// The short rules shown before a game starts.
const RULES = {
  ludo: [
    'You need a 6 to bring a pawn out of the yard. A 6 also gives you another roll.',
    'Stars and the first square of every colour are safe. Pawns there cannot be captured.',
    'Land on an opponent\'s pawn and it goes back to its yard. You roll again.',
    'Three 6s in a row and you lose that turn.',
    'To get home a pawn needs the exact number.'
  ],
  snake: [
    'Eat the food to grow and score.',
    'Your own tail ends the round. So does a wall, if you pick Walls.',
    'It gets faster as you score. Gold food is worth more but it vanishes.'
  ],
  tictactoe: [
    'Get three in a row: across, down or diagonal.',
    'The Smart bot never loses. Pick Casual if you want an easy win.'
  ],
  memory: [
    'Flip two cards at a time and match the pairs.',
    'Finish in 12 moves or fewer for three stars.',
    'Blitz gives you 60 seconds to clear the board.'
  ],
  flappy: [
    'Tap, click or press Space to flap.',
    'Every gap you get through is one point.',
    'Chill, Normal and Hard change the speed.'
  ],
  breakout: [
    'Slide the paddle with your finger, mouse or the arrow keys.',
    'Tap or press Space to launch the ball.',
    'You have 3 lives. Bricks higher up are worth more points.'
  ],
  twentyfortyeight: [
    'Swipe, or use the arrow keys or WASD, to slide every tile.',
    'Two equal tiles merge into one.',
    'Make a 2048 tile to win.'
  ],
  minesweeper: [
    'Tap a square to open it. The number is how many mines touch it.',
    'Use flag mode (or right-click) to mark a mine.',
    'Open every safe square to win. There are 10 mines.'
  ],
  mole: [
    'Moles pop up in random holes. Tap them before they hide.',
    'Brown moles give 10 points, the golden one gives 30.',
    'Score 120 in 30 seconds to win.'
  ],
  connectfour: [
    'Drop a disc in a column. It falls to the bottom.',
    'Get four in a row: across, down or diagonal.',
    'Block the bot before it gets there first.'
  ],
  wordguess: [
    'Find the hidden 5-letter word in six tries.',
    'Green means right letter, right place.',
    'Yellow means the letter is in the word but somewhere else.'
  ]
};

// What shows on the right of each row in the lobby.
const LOBBY_STATS = {
  ludo: { id: 'metaLudoStat', text: g => g.plays ? `${g.wins} won out of ${g.plays}` : '' },
  snake: { id: 'metaSnakeStat', text: g => g.best ? `best ${g.best}` : '' },
  tictactoe: { id: 'metaTttStat', text: g => g.plays ? `${g.wins} won, ${g.draws} drawn, ${g.losses} lost` : '' },
  memory: { id: 'metaMemoryStat', text: g => g.bestMoves ? `best ${g.bestMoves} moves` : '' },
  flappy: { id: 'metaFlappyStat', text: g => g.best ? `best ${g.best}` : '' },
  breakout: { id: 'metaBreakoutStat', text: g => g.best ? `best ${g.best}` : '' },
  twentyfortyeight: { id: 'meta2048Stat', text: g => g.best ? `best ${g.best}` : '' },
  minesweeper: { id: 'metaMinesweeperStat', text: g => g.bestTime ? `best ${g.bestTime}s` : '' },
  mole: { id: 'metaMoleStat', text: g => g.best ? `best ${g.best}` : '' },
  connectfour: { id: 'metaC4Stat', text: g => g.plays ? `${g.wins} won out of ${g.plays}` : '' },
  wordguess: { id: 'metaWordStat', text: g => g.plays ? `${g.wins} won out of ${g.plays}` : '' }
};

const OUTCOME_WORDS = { WIN: 'won', LOSS: 'lost', DRAW: 'drew' };

export const ArcadeApp = {
  registry: new Map(),
  activeSession: null,
  activeGameKey: null,
  lastLaunchOptions: {},
  router: null,
  matchResolved: false,
  wantsResume: false,
  lastTick: Date.now(),
  toastTimer: null,

  init() {
    Stats.init();
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

    this.initThemeAndSound();
    this.initProfile();
    this.initDialogs();
    this.initLobbyButtons();
    this.initHotkeys();
    this.initPlaytime();

    // handy when testing: run instantWin() in the console on localhost
    if (['localhost', '127.0.0.1'].includes(location.hostname)) {
      window.instantWin = () => {
        this.matchResolved = false;
        this.triggerMatchEnd('WIN', { summary: 'Test win' });
      };
    }

    this.router = new Router({
      '#/': () => this.showLobby(),
      '#/game': (key) => this.openGameFromRoute(key),
      '#/profile': () => this.openProfile()
    });
    this.router.init();
  },

  registerGame(key, module) {
    const required = ['id', 'title', 'accent', 'mount', 'start', 'pause', 'resume', 'restart', 'destroy'];
    for (const prop of required) {
      if (typeof module[prop] === 'undefined') {
        throw new Error(`Game "${key}" is missing "${prop}"`);
      }
    }
    this.registry.set(key, module);
  },

  /* ---------- lobby ---------- */

  showLobby() {
    if (this.activeSession) this.destroyActiveGame();
    document.body.classList.remove('game-open');

    document.getElementById('viewLobby').style.display = '';
    document.getElementById('viewArena').classList.add('hidden');
    this.refreshLobby();
  },

  refreshLobby() {
    const data = Stats.data;

    // line at the top of the page
    const intro = document.getElementById('introLine');
    const totals = Stats.totals();
    intro.textContent = '';
    if (totals.plays === 0) {
      intro.append(`Hi ${data.name}, up for a game of `);
      const mark = document.createElement('mark');
      mark.textContent = 'Ludo';
      intro.append(mark, ' first?');
    } else {
      intro.append(`Hi ${data.name}. ${totals.plays === 1 ? '1 game played' : totals.plays + ' games played'}, `);
      const mark = document.createElement('mark');
      mark.textContent = `${totals.wins} won`;
      intro.append(mark, '.');
    }

    for (const [key, entry] of Object.entries(LOBBY_STATS)) {
      const el = document.getElementById(entry.id);
      if (el) el.textContent = entry.text(Stats.get(key));
    }

    document.getElementById('btnHeroContinue').hidden = !SaveGame.has('ludo');
    this.renderAvatar();
  },

  initLobbyButtons() {
    document.getElementById('btnHeroNew').addEventListener('click', () => {
      this.wantsResume = false;
      this.router.navigate('#/game/ludo');
    });

    document.getElementById('btnHeroContinue').addEventListener('click', () => {
      this.wantsResume = true;
      this.router.navigate('#/game/ludo');
    });
  },

  /* ---------- starting a game ---------- */

  openGameFromRoute(key) {
    const game = this.registry.get(key);
    if (!game) {
      this.router.navigate('#/');
      return;
    }

    if (this.wantsResume && SaveGame.has(key)) {
      this.wantsResume = false;
      this.launchGame(key, { resume: true });
      return;
    }
    this.wantsResume = false;
    this.openBriefing(key, game);
  },

  openBriefing(key, game) {
    const dialog = document.getElementById('dialogBriefing');
    const launchBtn = document.getElementById('btnBriefingLaunch');
    const cancelBtn = document.getElementById('btnBriefingCancel');
    const optionsBox = document.getElementById('briefingCustomOptions');

    document.getElementById('briefingGameTitle').textContent = game.title;
    document.getElementById('briefingRulesList').innerHTML = (RULES[key] || [])
      .map(line => `<li>${line}</li>`).join('');

    optionsBox.innerHTML = '';
    let getOptions = () => ({});
    if (key === 'ludo') getOptions = this.buildLudoOptions(optionsBox);

    const finish = () => {
      launchBtn.removeEventListener('click', onStart);
      cancelBtn.removeEventListener('click', onBack);
      dialog.removeEventListener('cancel', onBack);
    };
    const onStart = () => {
      finish();
      UI.close(dialog);
      this.launchGame(key, getOptions());
    };
    const onBack = () => {
      finish();
      UI.close(dialog);
      this.router.navigate('#/');
    };

    launchBtn.addEventListener('click', onStart);
    cancelBtn.addEventListener('click', onBack);
    dialog.addEventListener('cancel', onBack);
    UI.open(dialog);
  },

  // Ludo: how many players, who plays, how hard the bots are.
  buildLudoOptions(box) {
    const choice = { playerCount: 2, mode: 'vs_bot', difficulty: 'Normal' };

    const group = (label, name, items, extraId = '') => `
      <div class="opt-group" ${extraId ? `id="${extraId}"` : ''}>
        <span class="opt-label">${label}</span>
        <div class="seg" data-name="${name}">
          ${items.map(([value, text]) =>
            `<button type="button" class="seg-btn${String(choice[name]) === String(value) ? ' is-on' : ''}" data-value="${value}">${text}</button>`
          ).join('')}
        </div>
      </div>`;

    box.innerHTML =
      group('Players', 'playerCount', [[2, '2'], [3, '3'], [4, '4']]) +
      group('Play against', 'mode', [['vs_bot', 'Bots'], ['pass_play', 'Friends (same phone)']]) +
      group('Bot level', 'difficulty', [['Easy', 'Easy'], ['Normal', 'Normal'], ['Hard', 'Hard']], 'ludoLevelGroup');

    box.onclick = (e) => {
      const btn = e.target.closest('.seg-btn');
      if (!btn) return;
      const seg = btn.parentElement;
      seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('is-on', b === btn));

      const value = btn.dataset.value;
      choice[seg.dataset.name] = seg.dataset.name === 'playerCount' ? Number(value) : value;
      document.getElementById('ludoLevelGroup').hidden = choice.mode !== 'vs_bot';
    };

    return () => ({ ...choice });
  },

  launchGame(key, options = {}) {
    const game = this.registry.get(key);
    if (!game) return;
    if (this.activeSession) this.destroyActiveGame();

    this.activeGameKey = key;
    this.matchResolved = false;
    this.lastLaunchOptions = { ...options, resume: false };

    document.documentElement.style.setProperty('--game-accent', game.accent);
    document.body.classList.add('game-open');
    document.getElementById('viewLobby').style.display = 'none';
    document.getElementById('viewArena').classList.remove('hidden');
    document.getElementById('arenaGameTitle').textContent = game.title;

    const viewport = document.getElementById('arenaViewport');
    viewport.innerHTML = '';

    const scheduler = new Scheduler();
    const input = new InputManager(viewport);
    let loop = null;

    const ctx = {
      scheduler,
      input,
      fx: FXEngine,
      ui: UI,
      toast: (text) => this.toast(text),
      createLoop: (updateFn, renderFn) => {
        loop = new GameLoop({ onUpdate: updateFn, onRender: renderFn });
        return loop;
      },
      restartWith: (opts) => {
        this.lastLaunchOptions = { ...opts };
        this.restartActiveGame();
      },
      recordResult: (outcome, details = {}) => this.triggerMatchEnd(outcome, details)
    };

    this.activeSession = {
      game,
      ctx,
      isPaused: false,
      getLoop: () => loop,
      scheduler,
      dispose: () => {
        if (loop) loop.stop();
        scheduler.dispose();
        input.dispose();
      }
    };

    // the Save and exit button only makes sense for games that can save
    document.getElementById('btnPauseSaveExit').hidden = typeof game.saveState !== 'function';

    game.mount(viewport, ctx);
    game.start(options);
    FXEngine.sfx.click();
  },

  /* ---------- pause, quit, restart ---------- */

  pauseActiveGame(showDialog = true) {
    const session = this.activeSession;
    if (!session || session.isPaused) return;
    session.isPaused = true;

    session.scheduler.pause();
    session.getLoop()?.pause();
    session.game.pause?.();

    if (showDialog) UI.open(document.getElementById('dialogPause'));
  },

  resumeActiveGame() {
    const session = this.activeSession;
    if (!session || !session.isPaused) return;
    session.isPaused = false;

    session.scheduler.resume();
    session.getLoop()?.resume();
    session.game.resume?.();
  },

  restartActiveGame() {
    if (!this.activeSession) return;
    this.launchGame(this.activeGameKey, this.lastLaunchOptions);
  },

  saveAndExitActiveGame() {
    const session = this.activeSession;
    if (!session) return;

    const snapshot = session.game.saveState?.();
    if (snapshot) {
      SaveGame.write(this.activeGameKey, snapshot);
      this.toast('Saved. Use Continue in the lobby to carry on.');
    }

    this.matchResolved = true;   // leaving like this is not a loss
    this.router.navigate('#/');
  },

  // Games with an opponent count a quit as a loss. Solo games just stop.
  quitActiveGame() {
    const session = this.activeSession;
    if (!session) return;

    if (session.game.vsOpponent && !this.matchResolved) {
      Stats.record({ game: this.activeGameKey, outcome: 'LOSS', summary: 'Quit the match' });
      SaveGame.clear(this.activeGameKey);
      this.toast('Counted as a loss.');
    }
    this.matchResolved = true;
    this.router.navigate('#/');
  },

  askToQuit() {
    const game = this.activeSession?.game;
    if (!game) return;

    document.getElementById('confirmQuitText').textContent = game.vsOpponent
      ? 'Quitting counts as a loss.'
      : 'Your current round will not be saved.';
    UI.open(document.getElementById('dialogConfirmQuit'));
  },

  destroyActiveGame() {
    const session = this.activeSession;
    if (!session) return;

    session.game.destroy?.();
    session.dispose();
    this.activeSession = null;
    this.activeGameKey = null;
    this.matchResolved = false;
    document.getElementById('arenaViewport').innerHTML = '';
  },

  /* ---------- results ---------- */

  triggerMatchEnd(outcome, details = {}) {
    if (this.matchResolved) return;
    this.matchResolved = true;

    const key = this.activeGameKey;
    const game = this.registry.get(key);

    // 2-player games on one phone pass counts: false, so they stay out of your scores
    if (details.counts !== false) {
      Stats.record({
        game: key,
        outcome,
        score: details.score || 0,
        moves: details.moves || null,
        time: details.time || null,
        mode: details.mode || null,
        summary: details.summary || ''
      });
    }
    SaveGame.clear(key);

    const title = document.getElementById('outcomeTitle');
    title.className = '';
    if (outcome === 'WIN') {
      title.textContent = 'You won!';
      title.classList.add('win');
      FXEngine.sfx.victory();
    } else if (outcome === 'DRAW') {
      title.textContent = 'It is a draw';
    } else if (game && !game.vsOpponent) {
      title.textContent = 'Game over';
      FXEngine.sfx.defeat();
    } else {
      title.textContent = 'You lost';
      title.classList.add('loss');
      FXEngine.sfx.defeat();
    }

    document.getElementById('outcomeSubtitle').textContent = details.summary || '';
    UI.open(document.getElementById('dialogOutcome'));
  },

  /* ---------- dialogs ---------- */

  initDialogs() {
    // if a dialog is dismissed with Esc, carry on with the game
    ['dialogPause', 'dialogConfirmQuit'].forEach((id) => {
      document.getElementById(id).addEventListener('close', () => {
        if (this.activeSession?.isPaused && !this.matchResolved && !UI.hasOpenDialogs()) {
          this.resumeActiveGame();
        }
      });
    });

    const on = (id, fn) => document.getElementById(id).addEventListener('click', fn);
    const closeDialog = (id) => UI.close(document.getElementById(id));

    on('btnArenaPause', () => this.pauseActiveGame(true));
    on('btnArenaQuit', () => {
      this.pauseActiveGame(false);
      this.askToQuit();
    });

    on('btnPauseResume', () => {
      closeDialog('dialogPause');
      this.resumeActiveGame();
    });
    on('btnPauseSaveExit', () => {
      closeDialog('dialogPause');
      this.saveAndExitActiveGame();
    });
    on('btnPauseRestart', () => {
      closeDialog('dialogPause');
      this.restartActiveGame();
    });
    on('btnPauseQuit', () => {
      closeDialog('dialogPause');
      this.askToQuit();
    });

    on('btnQuitCancel', () => {
      closeDialog('dialogConfirmQuit');
      this.resumeActiveGame();
    });
    on('btnQuitConfirm', () => {
      closeDialog('dialogConfirmQuit');
      this.quitActiveGame();
    });

    on('btnOutcomeReplay', () => {
      closeDialog('dialogOutcome');
      this.restartActiveGame();
    });
    on('btnOutcomeLobby', () => {
      closeDialog('dialogOutcome');
      this.router.navigate('#/');
    });
  },

  toast(text) {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  },

  /* ---------- theme and sound ---------- */

  initThemeAndSound() {
    const root = document.documentElement;
    const themeColors = { light: '#f2f6fb', dark: '#10151d' };

    const applyTheme = (theme) => {
      root.setAttribute('data-theme', theme);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[theme]);
      // the button offers the other theme
      const other = theme === 'dark' ? 'light' : 'dark';
      document.getElementById('iconThemeState').innerHTML = `<use href="#icon-theme-${theme === 'dark' ? 'light' : 'dark'}"/>`;
      document.getElementById('labelThemeState').textContent = other === 'dark' ? 'Dark' : 'Light';
      Storage.setItem(THEME_KEY, theme);
    };

    document.getElementById('btnThemeToggle').addEventListener('click', () => {
      applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
    applyTheme(root.getAttribute('data-theme') || 'light');

    const updateSound = (muted) => {
      document.getElementById('iconAudioState').innerHTML = `<use href="#icon-sound-${muted ? 'off' : 'on'}"/>`;
      document.getElementById('labelAudioState').textContent = muted ? 'Muted' : 'Sound';
    };

    document.getElementById('btnAudioToggle').addEventListener('click', () => {
      const muted = !SettingsStore.get('muted');
      SettingsStore.set('muted', muted);
      updateSound(muted);
    });
    updateSound(SettingsStore.get('muted'));
  },

  /* ---------- profile ---------- */

  renderAvatar() {
    const letter = (Stats.data.name || 'P').charAt(0);
    for (const id of ['navAvatar', 'drawerAvatar']) {
      const el = document.getElementById(id);
      el.textContent = letter;
      el.style.background = Stats.data.color;
    }
    document.getElementById('navName').textContent = Stats.data.name;
    document.getElementById('drawerName').textContent = Stats.data.name;
  },

  initProfile() {
    const swatchRow = document.getElementById('swatchRow');
    swatchRow.innerHTML = AVATAR_COLORS.map(color =>
      `<button type="button" class="swatch" data-color="${color}" style="background:${color}" aria-label="Colour ${color}"></button>`
    ).join('');

    swatchRow.addEventListener('click', (e) => {
      const swatch = e.target.closest('.swatch');
      if (!swatch) return;
      Stats.setColor(swatch.dataset.color);
      this.renderAvatar();
      this.markSwatch();
    });

    const input = document.getElementById('inputCallsign');
    input.addEventListener('change', () => {
      Stats.setName(input.value);
      input.value = Stats.data.name;
      this.renderAvatar();
      this.refreshLobby();
    });

    document.getElementById('btnProfileDrawerOpen').addEventListener('click', () => this.openProfile());
    document.getElementById('btnProfileDrawerClose').addEventListener('click', () => this.closeProfile());
    document.getElementById('drawerBackdrop').addEventListener('click', () => this.closeProfile());
  },

  markSwatch() {
    document.querySelectorAll('.swatch').forEach(s => {
      s.classList.toggle('is-on', s.dataset.color === Stats.data.color);
    });
  },

  openProfile() {
    document.getElementById('inputCallsign').value = Stats.data.name;
    this.markSwatch();
    this.renderProfileStats();

    document.getElementById('profileDrawer').classList.add('open');
    document.getElementById('drawerBackdrop').classList.add('show');
    document.getElementById('btnProfileDrawerClose').focus();
  },

  closeProfile() {
    document.getElementById('profileDrawer').classList.remove('open');
    document.getElementById('drawerBackdrop').classList.remove('show');
    if (window.location.hash === '#/profile') window.location.hash = '#/';
  },

  renderProfileStats() {
    const rows = document.getElementById('statRows');
    const played = [...this.registry.entries()].filter(([key]) => Stats.get(key).plays > 0);

    rows.innerHTML = '';
    if (played.length === 0) {
      const note = document.createElement('p');
      note.className = 'empty-note';
      note.textContent = 'Play a game and your scores will show up here.';
      rows.append(note);
    }
    for (const [key, game] of played) {
      const g = Stats.get(key);
      const detail = LOBBY_STATS[key].text(g);
      // win/loss lines already say how many were played
      const text = !detail ? `${g.plays} played` : /won/.test(detail) ? detail : `${detail}, ${g.plays} played`;
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = '<span></span><span></span>';
      row.children[0].textContent = game.title;
      row.children[1].textContent = text;
      rows.append(row);
    }

    const list = document.getElementById('historyList');
    list.innerHTML = '';
    if (Stats.data.history.length === 0) {
      const note = document.createElement('p');
      note.className = 'empty-note';
      note.textContent = 'No matches played yet.';
      list.append(note);
    }
    for (const item of Stats.data.history) {
      const title = this.registry.get(item.game)?.title || item.game;
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = '<span></span><span></span>';
      row.children[0].textContent = `${title}: ${OUTCOME_WORDS[item.outcome] || 'played'}`;
      row.children[1].textContent = this.timeAgo(item.at);
      list.append(row);
    }
  },

  timeAgo(then) {
    const mins = Math.round((Date.now() - then) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} h ago`;
    return `${Math.round(hours / 24)} d ago`;
  },

  /* ---------- keyboard ---------- */

  initHotkeys() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      const code = e.code;
      if (this.activeGameKey === 'wordguess' && code.startsWith('Key')) return;

      if (code === 'KeyM') {
        e.preventDefault();
        document.getElementById('btnAudioToggle').click();
      } else if (code === 'KeyP') {
        if (this.activeSession && !UI.hasOpenDialogs()) {
          e.preventDefault();
          this.pauseActiveGame(true);
        }
      } else if (code === 'KeyF') {
        e.preventDefault();
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
        else document.exitFullscreen().catch(() => {});
      } else if (code === 'Escape') {
        if (document.getElementById('profileDrawer').classList.contains('open')) {
          this.closeProfile();
        } else if (UI.hasOpenDialogs()) {
          e.preventDefault();
          UI.closeTop();
        } else if (this.activeSession) {
          e.preventDefault();
          this.pauseActiveGame(true);
        }
      }
    });
  },

  /* ---------- time played ---------- */

  initPlaytime() {
    const tick = () => {
      const now = Date.now();
      const secs = Math.floor((now - this.lastTick) / 1000);
      this.lastTick = now;
      if (this.activeSession && !document.hidden) Stats.addPlaySeconds(secs);
    };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        tick();
        Stats.save();
        if (this.activeSession) this.pauseActiveGame(true);
      } else {
        this.lastTick = Date.now();
      }
    });

    setInterval(() => {
      tick();
      Stats.save();
    }, 30000);

    window.addEventListener('pagehide', () => {
      tick();
      Stats.save();
    });
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ArcadeApp.init());
} else {
  ArcadeApp.init();
}