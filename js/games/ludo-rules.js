// ludo-rules.js: the Ludo rules and board layout.
// A pawn's "progress" is -1 in the yard, 0 to 50 on the shared track, 51 to 55 in its own
// home column and 56 once it is home. The board is a 15 by 15 grid.

export const LUDO_COLORS = ['RED', 'GREEN', 'YELLOW', 'BLUE'];

export const LUDO_PALETTE = {
  RED: '#E53935',
  GREEN: '#43A047',
  YELLOW: '#FDD835',
  BLUE: '#1E88E5',
  PAPER: '#FFFDF5',
  INK: '#2B2B2B',
  FRAME: '#22304A'
};

export const LUDO_CONFIG = {
  TRACK_LENGTH: 52,
  HOME_STEPS: 56,
  SAFE_SQUARES: [0, 8, 13, 21, 26, 34, 39, 47],
  STARTS: {
    RED: 0,
    GREEN: 13,
    YELLOW: 26,
    BLUE: 39
  }
};

export const TRACK_COORDINATES = [
  // Red runway exit heading right
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  // Heading up towards Green
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  // Top crossing
  [7, 0], [8, 0],
  // Heading down towards Green runway exit
  [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  // Heading right towards Yellow
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
  // Right crossing
  [14, 7], [14, 8],
  // Heading left towards Yellow runway exit
  [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  // Heading down towards Blue
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  // Bottom crossing
  [7, 14], [6, 14],
  // Heading up towards Blue runway exit
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  // Heading left towards Red
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  // Left crossing back to start
  [0, 7], [0, 6]
];

export const HOME_COLUMNS = {
  RED:    [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  GREEN:  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  YELLOW: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  BLUE:   [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]]
};

export const YARD_WELL_COORDINATES = {
  RED:    [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]],
  GREEN:  [[10.5, 1.5], [12.5, 1.5], [10.5, 3.5], [12.5, 3.5]],
  YELLOW: [[10.5, 10.5], [12.5, 10.5], [10.5, 12.5], [12.5, 12.5]],
  BLUE:   [[1.5, 10.5], [3.5, 10.5], [1.5, 12.5], [3.5, 12.5]]
};

export const CENTER_GOAL_COORDINATES = {
  RED:    [6.5, 7],
  GREEN:  [7, 6.5],
  YELLOW: [7.5, 7],
  BLUE:   [7, 7.5]
};

export const LudoRules = {
  getGridCoordinates(color, tokenIndex, progress) {
    if (progress === -1) {
      return YARD_WELL_COORDINATES[color][tokenIndex];
    }
    if (progress >= 0 && progress <= 50) {
      const startIndex = LUDO_CONFIG.STARTS[color];
      const trackIndex = (startIndex + progress) % LUDO_CONFIG.TRACK_LENGTH;
      return TRACK_COORDINATES[trackIndex];
    }
    if (progress >= 51 && progress <= 55) {
      const colIndex = progress - 51;
      return HOME_COLUMNS[color][colIndex];
    }
    if (progress === 56) {
      return CENTER_GOAL_COORDINATES[color];
    }
    throw new Error(`Invalid pawn progress: ${progress}`);
  },

  getTrackIndex(color, progress) {
    if (progress < 0 || progress > 50) return -1;
    return (LUDO_CONFIG.STARTS[color] + progress) % LUDO_CONFIG.TRACK_LENGTH;
  },

  isSafeSquare(trackIndex) {
    return trackIndex !== -1 && LUDO_CONFIG.SAFE_SQUARES.includes(trackIndex);
  },

  getLegalMoves(gameState, color, roll, options = { blockadeRule: false }) {
    if (roll < 1 || roll > 6) return [];
    const tokens = gameState.tokens[color];
    if (!tokens) return [];

    const legalIndices = [];

    for (let i = 0; i < tokens.length; i++) {
      const p = tokens[i];

      if (p === -1) {
        if (roll === 6) {
          if (options.blockadeRule) {
            const hasStartBlockade = this.isCellBlockaded(gameState, color, 0);
            if (!hasStartBlockade) legalIndices.push(i);
          } else {
            legalIndices.push(i);
          }
        }
        continue;
      }

      if (p === 56) continue;

      const targetProgress = p + roll;
      if (targetProgress > 56) continue;

      if (options.blockadeRule && this.isPathBlocked(gameState, color, p, targetProgress)) {
        continue;
      }

      legalIndices.push(i);
    }

    return legalIndices;
  },

  // Every opponent pawn on the square we land on is captured. If an opponent had two pawns
  // stacked there, both go back to the yard, so two colours can never share a square.
  checkCaptures(gameState, movingColor, targetProgress) {
    const hits = [];
    if (targetProgress < 0 || targetProgress > 50) return hits;

    const targetTrackIdx = this.getTrackIndex(movingColor, targetProgress);
    if (this.isSafeSquare(targetTrackIdx)) return hits;

    for (const oppColor of LUDO_COLORS) {
      if (oppColor === movingColor) continue;
      const oppTokens = gameState.tokens[oppColor];
      if (!oppTokens) continue;

      for (let tIdx = 0; tIdx < oppTokens.length; tIdx++) {
        const oppProg = oppTokens[tIdx];
        if (oppProg >= 0 && oppProg <= 50 && this.getTrackIndex(oppColor, oppProg) === targetTrackIdx) {
          hits.push({ color: oppColor, tokenIndex: tIdx });
        }
      }
    }

    return hits;
  },

  // first captured pawn, or null (the bots only need to know if something is hit)
  checkCapture(gameState, movingColor, targetProgress) {
    return this.checkCaptures(gameState, movingColor, targetProgress)[0] || null;
  },

  isCellBlockaded(gameState, color, progress) {
    if (progress < 0 || progress > 50) return false;
    const trackIdx = this.getTrackIndex(color, progress);
    const tokens = gameState.tokens[color];
    let count = 0;
    for (const p of tokens) {
      if (p >= 0 && p <= 50 && this.getTrackIndex(color, p) === trackIdx) {
        count++;
        if (count >= 2) return true;
      }
    }
    return false;
  },

  isPathBlocked(gameState, movingColor, fromProgress, toProgress) {
    for (let step = fromProgress + 1; step <= toProgress; step++) {
      if (step > 50) break;
      const stepTrackIdx = this.getTrackIndex(movingColor, step);
      for (const oppColor of LUDO_COLORS) {
        if (oppColor === movingColor) continue;
        let count = 0;
        const oppTokens = gameState.tokens[oppColor] || [];
        for (const p of oppTokens) {
          if (p >= 0 && p <= 50 && this.getTrackIndex(oppColor, p) === stepTrackIdx) {
            count++;
            if (count >= 2) return true;
          }
        }
      }
    }
    return false;
  },

  applyMove(gameState, color, tokenIndex, roll) {
    const nextState = {
      tokens: {
        RED: [...gameState.tokens.RED],
        GREEN: [...gameState.tokens.GREEN],
        YELLOW: [...gameState.tokens.YELLOW],
        BLUE: [...gameState.tokens.BLUE]
      },
      consecutiveSixes: gameState.consecutiveSixes || 0,
      activeColor: color
    };

    const curP = nextState.tokens[color][tokenIndex];
    let nextP = (curP === -1) ? 0 : curP + roll;
    nextState.tokens[color][tokenIndex] = nextP;

    let captured = null;
    if (nextP >= 0 && nextP <= 50) {
      const hits = this.checkCaptures(gameState, color, nextP);
      captured = hits[0] || null;
      for (const hit of hits) {
        nextState.tokens[hit.color][hit.tokenIndex] = -1;
      }
    }

    const earnedExtraTurn = (roll === 6) || (captured !== null) || (nextP === 56);

    return {
      nextState,
      captured,
      reachedHome: nextP === 56,
      earnedExtraTurn
    };
  },

  isColorFinished(tokensOfColor) {
    return tokensOfColor.every(p => p === 56);
  },

  // Used before loading a saved game, so a broken save can never crash the board.
  isValidSnapshot(snap) {
    if (!snap || snap.version !== 1) return false;
    if (!Array.isArray(snap.players) || snap.players.length < 2 || snap.players.length > 4) return false;

    const seats = new Set();
    for (const p of snap.players) {
      if (!LUDO_COLORS.includes(p.color) || seats.has(p.color) || typeof p.isBot !== 'boolean') return false;
      seats.add(p.color);
    }
    if (!seats.has(snap.activeColor)) return false;

    for (const color of LUDO_COLORS) {
      const pawns = snap.tokens && snap.tokens[color];
      const ok = Array.isArray(pawns) && pawns.length === 4 &&
        pawns.every(n => Number.isInteger(n) && n >= -1 && n <= 56);
      if (!ok) return false;
    }

    if (!Array.isArray(snap.finishRank) || !snap.finishRank.every(c => seats.has(c))) return false;
    if (!Number.isInteger(snap.diceValue) || snap.diceValue < 1 || snap.diceValue > 6) return false;
    return snap.phase === 'WAIT_ROLL' || snap.phase === 'WAIT_PICK';
  }
};