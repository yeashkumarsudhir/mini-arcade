export const LUDO_COLORS = ['RED', 'GREEN', 'YELLOW', 'BLUE'];

export const LUDO_PALETTE = {
  RED: '#E53935',
  GREEN: '#43A047',
  YELLOW: '#FDD835',
  BLUE: '#1E88E5',
  PAPER: '#FFFDF7',
  INK: '#222222',
  FRAME: '#2B1D16'
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
    throw new Error(`[LudoRules] Invalid progress step: ${progress}`);
  },

  getTrackIndex(color, progress) {
    if (progress < 0 || progress > 50) return -1;
    return (LUDO_CONFIG.STARTS[color] + progress) % LUDO_CONFIG.TRACK_LENGTH;
  },

  isSafeSquare(trackIndex) {
    return trackIndex !== -1 && LUDO_CONFIG.SAFE_SQUARES.includes(trackIndex);
  },

  getLegalMoves(gameState, color, roll) {
    if (roll < 1 || roll > 6) return [];
    const tokens = gameState.tokens[color];
    if (!tokens) return [];

    const legalIndices = [];

    for (let i = 0; i < tokens.length; i++) {
      const p = tokens[i];

      // Pawn in yard only comes out on 6
      if (p === -1) {
        if (roll === 6) {
          legalIndices.push(i);
        }
        continue;
      }

      // Already finished
      if (p === 56) continue;

      // Exact number needed for step 56 (no overshoot)
      const targetProgress = p + roll;
      if (targetProgress > 56) continue;

      legalIndices.push(i);
    }

    return legalIndices;
  },

  checkCapture(gameState, movingColor, targetProgress) {
    if (targetProgress < 0 || targetProgress > 50) return null;

    const targetTrackIdx = this.getTrackIndex(movingColor, targetProgress);
    if (this.isSafeSquare(targetTrackIdx)) return null;

    for (const oppColor of LUDO_COLORS) {
      if (oppColor === movingColor) continue;
      const oppTokens = gameState.tokens[oppColor];
      if (!oppTokens) continue;

      for (let tIdx = 0; tIdx < oppTokens.length; tIdx++) {
        const oppProg = oppTokens[tIdx];
        if (oppProg >= 0 && oppProg <= 50) {
          const oppTrackIdx = this.getTrackIndex(oppColor, oppProg);
          if (oppTrackIdx === targetTrackIdx) {
            return { color: oppColor, tokenIndex: tIdx };
          }
        }
      }
    }

    return null;
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
    const nextP = (curP === -1) ? 0 : curP + roll;
    nextState.tokens[color][tokenIndex] = nextP;

    let captured = null;
    if (nextP >= 0 && nextP <= 50) {
      captured = this.checkCapture(gameState, color, nextP);
      if (captured) {
        nextState.tokens[captured.color][captured.tokenIndex] = -1;
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
  }
};