// Player name, per-game scores and the last few results. Everything lives in localStorage.
import { Storage } from './core/storage.js';

const KEY = 'mini_arcade_stats_v2';
const OLD_KEY = 'parlour_arcade_player_stats_v1';   // from the first version of the site
const OLD_2048_KEY = 'parlour_2048_best';

export const AVATAR_COLORS = ['#2349c9', '#c23b3b', '#2c7a4b', '#d9822b', '#6b4fbf', '#1f8a8a'];

function blankGame() {
  return { plays: 0, wins: 0, losses: 0, draws: 0, best: 0, bestMoves: null, bestTime: null, byMode: {} };
}

function blankData() {
  return { name: 'Player 1', color: AVATAR_COLORS[0], playSeconds: 0, games: {}, history: [] };
}

export const Stats = {
  data: null,

  init() {
    this.data = this.load();
    return this.data;
  },

  load() {
    try {
      const raw = Storage.getItem(KEY);
      if (raw) return { ...blankData(), ...JSON.parse(raw) };
    } catch {
      // fall through to a fresh start
    }
    const fresh = this.migrateOld();
    this.data = fresh;
    this.save();
    return fresh;
  },

  // Old saves had XP, levels and badges. We only keep what is still useful.
  migrateOld() {
    const data = blankData();
    try {
      const raw = Storage.getItem(OLD_KEY);
      if (!raw) return data;
      const old = JSON.parse(raw);

      if (old.callsign) data.name = String(old.callsign).slice(0, 14);
      data.playSeconds = old.totalPlaytimeSec || 0;

      const s = old.stats || {};
      if (s.snake) {
        const g = this.gameIn(data, 'snake');
        g.plays = s.snake.games || 0;
        g.best = Math.max(s.snake.highScore || 0, s.snake.highScoreWrap || 0, s.snake.highScoreWall || 0);
        g.byMode = { wrap: s.snake.highScoreWrap || 0, wall: s.snake.highScoreWall || 0 };
      }
      if (s.flappy) {
        const g = this.gameIn(data, 'flappy');
        g.plays = s.flappy.games || 0;
        g.best = s.flappy.highScore || 0;
      }
      if (s.ludo) {
        const g = this.gameIn(data, 'ludo');
        g.wins = s.ludo.wins || 0;
        g.plays = s.ludo.matches || s.ludo.games || 0;
      }
      if (s.tictactoe) {
        const g = this.gameIn(data, 'tictactoe');
        g.wins = s.tictactoe.wins || 0;
        g.losses = s.tictactoe.lost || 0;
        g.draws = s.tictactoe.ties || 0;
        g.plays = g.wins + g.losses + g.draws;
      }
      if (s.memory) {
        const g = this.gameIn(data, 'memory');
        g.wins = s.memory.wins || 0;
        g.plays = s.memory.games || 0;
        g.bestMoves = s.memory.bestMoves || null;
      }

      const best2048 = parseInt(Storage.getItem(OLD_2048_KEY) || '0', 10);
      if (best2048 > 0) this.gameIn(data, 'twentyfortyeight').best = best2048;
    } catch {
      // old data was broken, start clean
    }
    return data;
  },

  save() {
    try {
      Storage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // storage full or blocked, nothing useful to do
    }
  },

  gameIn(data, key) {
    if (!data.games[key]) data.games[key] = blankGame();
    return data.games[key];
  },

  get(key) {
    if (!this.data) this.init();
    return { ...blankGame(), ...(this.data.games[key] || {}) };
  },

  setName(name) {
    const clean = String(name || '').trim().slice(0, 14);
    this.data.name = clean || 'Player 1';
    this.save();
  },

  setColor(color) {
    if (AVATAR_COLORS.includes(color)) {
      this.data.color = color;
      this.save();
    }
  },

  // for games where you can leave at any time, so the best score is not lost
  noteBest(game, score) {
    const g = this.gameIn(this.data, game);
    if (score > g.best) {
      g.best = score;
      this.save();
    }
  },

  addPlaySeconds(sec) {
    if (sec > 0) this.data.playSeconds += sec;
  },

  // outcome is 'WIN', 'LOSS' or 'DRAW'
  record({ game, outcome, score = 0, moves = null, time = null, mode = null, summary = '' }) {
    if (!this.data) this.init();
    const g = this.gameIn(this.data, game);

    g.plays++;
    if (outcome === 'WIN') g.wins++;
    else if (outcome === 'DRAW') g.draws++;
    else g.losses++;

    if (score > g.best) g.best = score;
    if (mode) g.byMode[mode] = Math.max(g.byMode[mode] || 0, score);
    if (outcome === 'WIN' && moves && (!g.bestMoves || moves < g.bestMoves)) g.bestMoves = moves;
    if (outcome === 'WIN' && time && (!g.bestTime || time < g.bestTime)) g.bestTime = time;

    this.data.history.unshift({ game, outcome, summary, at: Date.now() });
    this.data.history.length = Math.min(this.data.history.length, 8);

    this.save();
  },

  totals() {
    const all = Object.values(this.data.games);
    return {
      plays: all.reduce((n, g) => n + g.plays, 0),
      wins: all.reduce((n, g) => n + g.wins, 0)
    };
  }
};
