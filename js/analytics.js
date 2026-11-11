import { Storage } from './core/storage.js';

export const Analytics = {
  STORAGE_KEY: "parlour_arcade_player_stats_v1",

  defaultData: {
    callsign: "Player 1",
    avatar: "P1",
    totalPlaytimeSec: 0,
    matches: 0,
    victories: 0,
    defeats: 0,
    draws: 0,
    stats: {
      ludo: { wins: 0, matches: 0 },
      snake: { highScore: 0, matches: 0 },
      tictactoe: { wins: 0, lost: 0, ties: 0, matches: 0 },
      memory: { bestMoves: null, matches: 0 },
      flappy: { highScore: 0, matches: 0 },
      breakout: { highScore: 0, matches: 0 },
      twentyfortyeight: { highScore: 0, matches: 0 },
      minesweeper: { cleared: 0, matches: 0 },
      mole: { highScore: 0, matches: 0 },
      connectfour: { wins: 0, matches: 0 },
      wordguess: { solved: 0, matches: 0 }
    },
    history: []
  },

  data: null,

  init() {
    this.loadData();
    this.syncUI();
  },

  loadData() {
    try {
      const raw = Storage ? Storage.getItem(this.STORAGE_KEY) : localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Safe migration: preserve games and stats while discarding unused XP/badge keys
        this.data = {
          ...this.defaultData,
          ...parsed,
          avatar: (parsed.avatar && parsed.avatar.length <= 2 && !/[\uD800-\uDFFF]/.test(parsed.avatar))
            ? parsed.avatar
            : (parsed.callsign ? parsed.callsign.slice(0, 2).toUpperCase() : "P1"),
          stats: {
            ...this.defaultData.stats,
            ...(parsed.stats || {})
          }
        };
      } else {
        this.data = JSON.parse(JSON.stringify(this.defaultData));
        this.saveData();
      }
    } catch {
      this.data = JSON.parse(JSON.stringify(this.defaultData));
    }
  },

  saveData(newData = null) {
    if (newData) this.data = newData;
    try {
      const payload = JSON.stringify(this.data);
      if (Storage) Storage.setItem(this.STORAGE_KEY, payload);
      else localStorage.setItem(this.STORAGE_KEY, payload);
    } catch {}
  },

  save() {
    this.saveData();
  },

  setCallsign(newName) {
    if (!this.data) this.loadData();
    if (newName) {
      const trimmed = String(newName).trim().slice(0, 14) || "Player 1";
      this.data.callsign = trimmed;
      this.data.avatar = trimmed.slice(0, 2).toUpperCase();
    }
    this.saveData();
    this.syncUI();
  },

  record(params) {
    const { game, outcome, score = 0, moves = null } = params;
    return this.recordMatch(game, outcome, { score, moves });
  },

  recordMatch(gameKey, outcome, details = {}) {
    if (!this.data) this.loadData();

    this.data.matches++;

    if (outcome === "WIN") {
      this.data.victories++;
    } else if (outcome === "DRAW") {
      this.data.draws++;
    } else {
      this.data.defeats++;
    }

    if (!this.data.stats[gameKey]) {
      this.data.stats[gameKey] = { matches: 0, wins: 0, highScore: 0 };
    }
    const stat = this.data.stats[gameKey];
    stat.matches = (stat.matches || 0) + 1;

    if (outcome === "WIN") {
      stat.wins = (stat.wins || 0) + 1;
    }

    if (gameKey === "snake" || gameKey === "flappy" || gameKey === "breakout" || gameKey === "twentyfortyeight" || gameKey === "mole") {
      if (typeof details.score === "number") {
        stat.highScore = Math.max(stat.highScore || 0, details.score);
      }
    } else if (gameKey === "memory" && details.moves) {
      stat.bestMoves = (!stat.bestMoves || details.moves < stat.bestMoves) ? details.moves : stat.bestMoves;
    } else if (gameKey === "minesweeper" && outcome === "WIN") {
      stat.cleared = (stat.cleared || 0) + 1;
    } else if (gameKey === "wordguess" && outcome === "WIN") {
      stat.solved = (stat.solved || 0) + 1;
    } else if (gameKey === "tictactoe") {
      if (outcome === "LOSS") stat.lost = (stat.lost || 0) + 1;
      if (outcome === "DRAW") stat.ties = (stat.ties || 0) + 1;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logItem = {
      game: gameKey.charAt(0).toUpperCase() + gameKey.slice(1),
      outcome,
      time: timeStr
    };

    if (!this.data.history) this.data.history = [];
    this.data.history.unshift(logItem);
    if (this.data.history.length > 8) this.data.history.pop();

    this.saveData();
    this.syncUI();

    return { victories: this.data.victories, matches: this.data.matches };
  },

  getWinRate() {
    if (!this.data || this.data.matches === 0) return 0;
    return Math.round((this.data.victories / this.data.matches) * 100);
  },

  syncUI() {
    if (!this.data) return;

    const navName = document.getElementById("navCallsign");
    const navAvatar = document.getElementById("navAvatarEmoji");
    if (navName) navName.textContent = this.data.callsign;
    if (navAvatar) navAvatar.textContent = this.data.avatar || "P1";

    const mins = Math.floor((this.data.totalPlaytimeSec || 0) / 60);
    const playtimeEl = document.getElementById("hudPlaytime");
    if (playtimeEl) playtimeEl.textContent = `${mins}m`;

    const totalMatchesEl = document.getElementById("hudMatches");
    if (totalMatchesEl) totalMatchesEl.textContent = this.data.matches;

    const winRateEl = document.getElementById("hudWinRate");
    if (winRateEl) winRateEl.textContent = `${this.getWinRate()}%`;

    const drawerAvatar = document.getElementById("drawerAvatarDisplay");
    const drawerName = document.getElementById("drawerCallsign");
    if (drawerAvatar) drawerAvatar.textContent = this.data.avatar || "P1";
    if (drawerName) drawerName.textContent = this.data.callsign;

    // Per-card stats on lobby
    const metaLudo = document.getElementById("metaLudoStat");
    const metaSnake = document.getElementById("metaSnakeStat");
    const metaTtt = document.getElementById("metaTttStat");
    const metaMemory = document.getElementById("metaMemoryStat");
    const metaFlappy = document.getElementById("metaFlappyStat");
    const metaBreakout = document.getElementById("metaBreakoutStat");
    const meta2048 = document.getElementById("meta2048Stat");
    const metaMinesweeper = document.getElementById("metaMinesweeperStat");
    const metaMole = document.getElementById("metaMoleStat");
    const metaC4 = document.getElementById("metaC4Stat");
    const metaWord = document.getElementById("metaWordStat");

    if (metaLudo) metaLudo.textContent = `Won: ${this.data.stats?.ludo?.wins || 0} / ${this.data.stats?.ludo?.matches || 0}`;
    if (metaSnake) metaSnake.textContent = `Best: ${this.data.stats?.snake?.highScore || 0} pts`;
    if (metaTtt) metaTtt.textContent = `Won: ${this.data.stats?.tictactoe?.wins || 0} / ${this.data.stats?.tictactoe?.matches || 0}`;
    if (metaMemory) {
      const best = this.data.stats?.memory?.bestMoves;
      metaMemory.textContent = best ? `Best: ${best} moves` : 'Best: --';
    }
    if (metaFlappy) metaFlappy.textContent = `Best: ${this.data.stats?.flappy?.highScore || 0}`;
    if (metaBreakout) metaBreakout.textContent = `Best: ${this.data.stats?.breakout?.highScore || 0} pts`;
    if (meta2048) meta2048.textContent = `Best: ${this.data.stats?.twentyfortyeight?.highScore || 0} pts`;
    if (metaMinesweeper) metaMinesweeper.textContent = `Cleared: ${this.data.stats?.minesweeper?.cleared || 0}`;
    if (metaMole) metaMole.textContent = `Best: ${this.data.stats?.mole?.highScore || 0} pts`;
    if (metaC4) metaC4.textContent = `Won: ${this.data.stats?.connectfour?.wins || 0} / ${this.data.stats?.connectfour?.matches || 0}`;
    if (metaWord) metaWord.textContent = `Solved: ${this.data.stats?.wordguess?.solved || 0}`;

    // Recent match list
    const logList = document.getElementById("drawerLogsList");
    if (logList) {
      const list = this.data.history || [];
      if (list.length === 0) {
        logList.innerHTML = `<div style="font-size:0.8rem; color:var(--text-dim); padding:6px 0;">No games played yet.</div>`;
      } else {
        logList.innerHTML = list.map(h => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:var(--bg-surface); border:1px solid var(--border-line); border-radius:6px; font-size:0.8rem;">
            <span><strong>${h.game}</strong> &mdash; ${h.outcome}</span>
            <span style="color:var(--text-dim); font-size:0.75rem;">${h.time}</span>
          </div>
        `).join("");
      }
    }
  }
};