/**
 * js/analytics.js
 * Parlour Arcade Player Stats, Match History & Achievement Badges
 */
import { Storage } from './core/storage.js';
import { FXEngine } from './fx.js';

export const Analytics = {
  STORAGE_KEY: "parlour_arcade_player_stats_v1",

  ACHIEVEMENTS_LIST: [
    { id: "first_win", name: "First Victory", icon: "🥇", desc: "Win your first game in the parlour" },
    { id: "snake_pro", name: "Snake Charmer", icon: "🐍", desc: "Score 15 or more points in Snake" },
    { id: "bot_slayer", name: "Sharp Mind", icon: "🤖", desc: "Defeat the smart bot in Grid" },
    { id: "flappy_ace", name: "Ace Flyer", icon: "🚀", desc: "Pass 8 or more gates in Flappy" },
    { id: "neuro_sharp", name: "Card Counter", icon: "🧠", desc: "Complete the Memory matrix" },
    { id: "veteran", name: "Parlour Regular", icon: "👑", desc: "Reach Player Level 3" }
  ],

  defaultData: {
    callsign: "Player 1",
    avatar: "🎮",
    tier: "Regular",
    level: 1,
    xp: 0,
    currentXP: 0,
    maxXP: 100,
    totalPlaytimeSec: 0,
    matches: 0,
    victories: 0,
    defeats: 0,
    draws: 0,
    trophies: 0,
    achievements: [],
    stats: {
      snake: { highScore: 0, highScoreWrap: 0, highScoreWall: 0, games: 0, matches: 0 },
      ludo: { wins: 0, games: 0, matches: 0 },
      tictactoe: { wins: 0, lost: 0, ties: 0, games: 0, matches: 0 },
      memory: { bestMoves: null, wins: 0, games: 0, matches: 0 },
      flappy: { highScore: 0, games: 0, matches: 0 }
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
      const saved = Storage ? Storage.getItem(this.STORAGE_KEY) : localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.data = { 
          ...this.defaultData, 
          ...parsed, 
          achievements: parsed.achievements || [],
          stats: { ...this.defaultData.stats, ...(parsed.stats || {}) } 
        };
      } else {
        this.data = JSON.parse(JSON.stringify(this.defaultData));
        this.saveData();
      }
    } catch (e) {
      this.data = JSON.parse(JSON.stringify(this.defaultData));
    }
  },

  saveData(newData = null) {
    if (newData) this.data = newData;
    try {
      const payload = JSON.stringify(this.data);
      if (Storage) Storage.setItem(this.STORAGE_KEY, payload);
      else localStorage.setItem(this.STORAGE_KEY, payload);
    } catch (e) {}
  },

  save() {
    this.saveData();
  },

  getData() {
    if (!this.data) this.loadData();
    return this.data;
  },

  setCallsign(newName, newAvatar = null) {
    if (!this.data) this.loadData();
    if (newName) this.data.callsign = String(newName).trim().slice(0, 14) || "Player 1";
    if (newAvatar) this.data.avatar = newAvatar;
    this.saveData();
    this.syncUI();
  },

  setAvatar(newAvatar) {
    if (!this.data) this.loadData();
    if (newAvatar) this.data.avatar = newAvatar;
    this.saveData();
    this.syncUI();
  },

  unlockAchievement(achievementId) {
    if (!this.data) this.loadData();
    if (!this.data.achievements) this.data.achievements = [];

    if (!this.data.achievements.includes(achievementId)) {
      this.data.achievements.push(achievementId);
      this.data.trophies = this.data.achievements.length;
      this.saveData();

      const ach = this.ACHIEVEMENTS_LIST.find(a => a.id === achievementId);
      if (ach) {
        this.showAchievementToast(ach);
      }
    }
  },

  showAchievementToast(ach) {
    const toast = document.getElementById("popoverToastContainer") || document.getElementById("achievementToast");
    const icon = document.getElementById("toastBadgeIcon");
    const title = document.getElementById("toastBadgeTitle");
    const card = document.getElementById("achievementToastCard");

    if (icon) icon.textContent = ach.icon;
    if (title) title.textContent = ach.name;

    if (card) {
      card.classList.add("active");
      try {
        if (toast && typeof toast.showPopover === "function") toast.showPopover();
      } catch (e) {}

      if (FXEngine && typeof FXEngine.playTone === "function") {
        FXEngine.playTone(880, "triangle", 0.08, 0.18);
        setTimeout(() => FXEngine.playTone(1100, "sine", 0.12, 0.22), 90);
      }

      setTimeout(() => {
        card.classList.remove("active");
        try {
          if (toast && typeof toast.hidePopover === "function") toast.hidePopover();
        } catch (e) {}
      }, 3500);
    }
  },

  record(params) {
    const { game, outcome, mode = 'Ranked', score = 0, moves = null, ranked = true } = params;
    return this.recordMatch(game, outcome, { mode, score, moves, ranked });
  },

  recordMatch(gameKey, outcome, details = {}) {
    if (!this.data) this.loadData();

    const isRanked = (details.ranked !== false);
    let gainedXP = 0;

    if (isRanked) {
      this.data.matches++;

      if (outcome === "WIN") {
        this.data.victories++;
        gainedXP = 100;
        this.unlockAchievement("first_win");
      } else if (outcome === "DRAW") {
        this.data.draws++;
        gainedXP = 50;
      } else {
        this.data.defeats++;
        gainedXP = 20;
      }

      this.addXP(gainedXP);

      if (!this.data.stats[gameKey]) {
        this.data.stats[gameKey] = { games: 0, wins: 0, highScore: 0, matches: 0 };
      }
      const stat = this.data.stats[gameKey];
      stat.games = (stat.games || 0) + 1;
      stat.matches = (stat.matches || 0) + 1;

      if (gameKey === "ludo" && outcome === "WIN") {
        stat.wins = (stat.wins || 0) + 1;
      } else if (gameKey === "tictactoe") {
        if (outcome === "WIN") {
          stat.wins = (stat.wins || 0) + 1;
          this.unlockAchievement("bot_slayer");
        }
        if (outcome === "DRAW") stat.ties = (stat.ties || 0) + 1;
        if (outcome === "LOSS") stat.lost = (stat.lost || 0) + 1;
      } else if (gameKey === "snake" && typeof details.score !== "undefined") {
        stat.highScore = Math.max(stat.highScore || 0, details.score);
        if (details.mode === "wall") {
          stat.highScoreWall = Math.max(stat.highScoreWall || 0, details.score);
        } else {
          stat.highScoreWrap = Math.max(stat.highScoreWrap || 0, details.score);
        }
        if (details.score >= 15) {
          this.unlockAchievement("snake_pro");
        }
      } else if (gameKey === "flappy" && typeof details.score !== "undefined") {
        stat.highScore = Math.max(stat.highScore || 0, details.score);
        if (details.score >= 8) {
          this.unlockAchievement("flappy_ace");
        }
      } else if (gameKey === "memory") {
        if (outcome === "WIN") {
          stat.wins = (stat.wins || 0) + 1;
          this.unlockAchievement("neuro_sharp");
        }
        if (details.moves) {
          stat.bestMoves = (!stat.bestMoves || details.moves < stat.bestMoves) ? details.moves : stat.bestMoves;
        }
      }

      if (this.data.level >= 3) {
        this.unlockAchievement("veteran");
      }
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logItem = {
      game: gameKey.charAt(0).toUpperCase() + gameKey.slice(1),
      outcome,
      mode: details.mode || 'Ranked',
      time: timeStr,
      timestamp: timeStr,
      xpGained: gainedXP,
      xp: gainedXP
    };

    if (!this.data.history) this.data.history = [];
    this.data.history.unshift(logItem);
    if (this.data.history.length > 8) this.data.history.pop();

    this.saveData();
    this.syncUI();

    return { gainedXP, xpGained: gainedXP, level: this.data.level, newLevel: this.data.level };
  },

  addXP(amount) {
    if (!amount) return;
    this.data.xp = (this.data.xp || 0) + amount;
    this.data.currentXP = (this.data.currentXP || 0) + amount;

    while (this.data.currentXP >= this.data.maxXP) {
      this.data.currentXP -= this.data.maxXP;
      this.data.level++;
      this.data.maxXP = Math.floor(this.data.maxXP * 1.25);
      if (FXEngine && FXEngine.sfx && typeof FXEngine.sfx.victory === "function") {
        FXEngine.sfx.victory();
      }
      if (this.data.level >= 3) {
        this.unlockAchievement("veteran");
      }
    }
  },

  getWinRate() {
    if (!this.data || this.data.matches === 0) return 0;
    return Math.round((this.data.victories / this.data.matches) * 100);
  },

  syncUI() {
    this.syncDashboardUI();
  },

  syncDashboardUI() {
    if (!this.data) return;

    // Header Callsign & Avatar
    const navName = document.getElementById("navCallsign") || document.getElementById("navPlayerName");
    const navAvatar = document.getElementById("navAvatarEmoji") || document.getElementById("navAvatar");
    if (navName) navName.textContent = this.data.callsign;
    if (navAvatar) navAvatar.textContent = this.data.avatar || "🎮";

    // Dashboard Telemetry Card
    const mins = Math.floor((this.data.totalPlaytimeSec || 0) / 60);
    const playtimeEl = document.getElementById("hudPlaytime");
    if (playtimeEl) playtimeEl.textContent = `${mins}m`;

    const totalMatchesEl = document.getElementById("hudMatches") || document.getElementById("hudTotalMatches");
    if (totalMatchesEl) totalMatchesEl.textContent = this.data.matches;

    const winRateEl = document.getElementById("hudWinRate");
    if (winRateEl) winRateEl.textContent = `${this.getWinRate()}%`;

    const trophiesEl = document.getElementById("hudTrophies");
    if (trophiesEl) trophiesEl.textContent = this.data.trophies || (this.data.achievements ? this.data.achievements.length : 0);

    // Profile Drawer Readouts
    const drawerAvatar = document.getElementById("drawerAvatarDisplay") || document.getElementById("drawerAvatar");
    const drawerName = document.getElementById("drawerCallsign") || document.getElementById("drawerPlayerName");
    const drawerTier = document.getElementById("drawerTier");
    if (drawerAvatar) drawerAvatar.textContent = this.data.avatar || "🎮";
    if (drawerName) drawerName.textContent = this.data.callsign;
    if (drawerTier) {
      const tiers = ["Novice", "Regular", "Veteran", "Master", "Legend"];
      const idx = Math.min(Math.floor((this.data.level - 1) / 2), tiers.length - 1);
      drawerTier.textContent = tiers[idx];
    }

    const lvlLabel = document.getElementById("labelPlayerLevel") || document.getElementById("drawerLevelLabel");
    const xpLabel = document.getElementById("labelPlayerXp") || document.getElementById("drawerXpLabel");
    const xpBar = document.getElementById("barPlayerXp") || document.getElementById("drawerXpBar");
    if (lvlLabel) lvlLabel.textContent = `Level ${this.data.level}`;
    if (xpLabel) xpLabel.textContent = `${this.data.currentXP} / ${this.data.maxXP} XP`;
    if (xpBar) {
      const pct = Math.min(100, Math.round((this.data.currentXP / this.data.maxXP) * 100));
      xpBar.style.width = `${pct}%`;
    }

    // Lobby Cards Meta Stats
    const metaLudo = document.getElementById("metaLudoStat");
    const metaSnake = document.getElementById("metaSnakeStat");
    const metaTtt = document.getElementById("metaTttStat");
    const metaMemory = document.getElementById("metaMemoryStat");
    const metaFlappy = document.getElementById("metaFlappyStat");

    if (metaLudo) {
      metaLudo.textContent = `Wins: ${this.data.stats?.ludo?.wins || 0} | Total: ${this.data.stats?.ludo?.matches || this.data.stats?.ludo?.games || 0}`;
    }
    if (metaSnake) {
      const best = Math.max(this.data.stats?.snake?.highScore || 0, this.data.stats?.snake?.highScoreWrap || 0, this.data.stats?.snake?.highScoreWall || 0);
      metaSnake.textContent = `Record: ${best} pts`;
    }
    if (metaTtt) {
      metaTtt.textContent = `Wins: ${this.data.stats?.tictactoe?.wins || 0} | Series: ${this.data.stats?.tictactoe?.matches || this.data.stats?.tictactoe?.games || 0}`;
    }
    if (metaMemory) {
      const best = this.data.stats?.memory?.bestMoves;
      metaMemory.textContent = best ? `Best: ${best} moves` : 'Best: - moves';
    }
    if (metaFlappy) {
      metaFlappy.textContent = `Record: ${this.data.stats?.flappy?.highScore || 0} gates`;
    }

    // Trophy Badges Grid
    const badgesGrid = document.getElementById("drawerBadgesGrid");
    if (badgesGrid) {
      const unlockedSet = new Set(this.data.achievements || []);
      badgesGrid.innerHTML = this.ACHIEVEMENTS_LIST.map(ach => {
        const isUnlocked = unlockedSet.has(ach.id);
        return `
          <div class="badge-item ${isUnlocked ? 'unlocked' : 'locked'}" title="${ach.desc}">
            <div class="badge-item-icon">${ach.icon}</div>
            <div class="badge-item-name">${ach.name}</div>
          </div>
        `;
      }).join("");
    }

    // Recent Match Logs
    const logList = document.getElementById("drawerLogsList") || document.getElementById("matchHistoryList");
    if (logList) {
      const list = this.data.history || [];
      if (list.length === 0) {
        logList.innerHTML = `<div style="font-size:0.8rem; color:var(--text-dim); padding:6px 0;">Abhi koi baazi nahi. Pehli khelo.</div>`;
      } else {
        logList.innerHTML = list.map(h => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:7px 10px; background:var(--bg-surface); border:1.5px solid var(--border-strong); border-radius:4px; font-size:0.78rem;">
            <span><strong>${h.game}</strong> (${h.outcome})</span>
            <span style="color:var(--text-dim); font-size:0.7rem;">${h.time || h.timestamp}</span>
          </div>
        `).join("");
      }
    }
  }
};