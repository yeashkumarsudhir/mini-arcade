import { LudoRules, LUDO_CONFIG, LUDO_COLORS } from './ludo-rules.js';

export const LudoAI = {
  chooseMove(difficulty, color, gameState, roll, legalMoves, activePlayers = []) {
    if (!legalMoves || legalMoves.length === 0) return -1;
    if (legalMoves.length === 1) return legalMoves[0];

    const mode = (difficulty || 'Normal').toLowerCase();

    if (mode === 'easy') {
      return this.chooseEasyMove(legalMoves);
    }
    if (mode === 'hard') {
      return this.chooseSmartMove(color, gameState, roll, legalMoves, activePlayers);
    }
    return this.chooseNormalMove(color, gameState, roll, legalMoves);
  },

  chooseEasyMove(legalMoves) {
    const idx = Math.floor(Math.random() * legalMoves.length);
    return legalMoves[idx];
  },

  chooseNormalMove(color, gameState, roll, legalMoves) {
    let bestScore = -Infinity;
    let bestMove = legalMoves[0];

    for (const tokenIdx of legalMoves) {
      const curP = gameState.tokens[color][tokenIdx];
      const targetP = (curP === -1) ? 0 : curP + roll;
      const score = this.evaluateMove(color, gameState, tokenIdx, targetP);

      if (score > bestScore) {
        bestScore = score;
        bestMove = tokenIdx;
      }
    }

    return bestMove;
  },

  evaluateMove(color, gameState, tokenIdx, targetP) {
    let score = 0;

    // Bring pawn out of yard
    if (gameState.tokens[color][tokenIdx] === -1 && targetP === 0) {
      return 50;
    }

    // Direct home finish
    if (targetP === 56) {
      return 100;
    }

    // Advance inside private home stretch
    if (targetP > 50 && targetP < 56) {
      score += 40;
    }

    // Main circuit: check capture and safe squares
    if (targetP <= 50) {
      const capture = LudoRules.checkCapture(gameState, color, targetP);
      if (capture) {
        score += 85;
      }

      const targetTrack = LudoRules.getTrackIndex(color, targetP);
      if (LudoRules.isSafeSquare(targetTrack)) {
        score += 25;
      } else if (this.isVulnerable(gameState, color, targetTrack)) {
        score -= 20;
      }
    }

    // Steady forward progress
    score += targetP * 1.5;
    return score;
  },

  isVulnerable(gameState, myColor, targetTrackIdx) {
    for (const oppColor of LUDO_COLORS) {
      if (oppColor === myColor) continue;
      const oppTokens = gameState.tokens[oppColor];
      if (!oppTokens) continue;

      for (const oppP of oppTokens) {
        if (oppP >= 0 && oppP <= 50) {
          const oppTrack = LudoRules.getTrackIndex(oppColor, oppP);
          const dist = (targetTrackIdx - oppTrack + LUDO_CONFIG.TRACK_LENGTH) % LUDO_CONFIG.TRACK_LENGTH;
          if (dist >= 1 && dist <= 6) {
            return true;
          }
        }
      }
    }
    return false;
  },

  chooseSmartMove(myColor, gameState, roll, legalMoves, activePlayers) {
    let bestVal = -Infinity;
    let bestToken = legalMoves[0];

    for (const tokenIdx of legalMoves) {
      const { nextState } = LudoRules.applyMove(gameState, myColor, tokenIdx, roll);
      const evalScore = this.evaluateNextState(nextState, myColor, activePlayers);

      if (evalScore > bestVal) {
        bestVal = evalScore;
        bestToken = tokenIdx;
      }
    }

    return bestToken;
  },

  evaluateNextState(stateAfterMove, myColor, activePlayers) {
    const activeColors = (activePlayers && activePlayers.length > 0)
      ? activePlayers.map(p => p.color)
      : LUDO_COLORS;

    let utility = 0;
    for (const col of activeColors) {
      const isMe = (col === myColor);
      const mult = isMe ? 1 : -0.4;
      const pawns = stateAfterMove.tokens[col] || [];

      for (const p of pawns) {
        if (p === 56) {
          utility += 120 * mult;
        } else if (p === -1) {
          utility -= 15 * mult;
        } else {
          utility += p * 1.6 * mult;
          if (p <= 50) {
            const track = LudoRules.getTrackIndex(col, p);
            if (LudoRules.isSafeSquare(track)) {
              utility += 20 * mult;
            }
          }
        }
      }
    }

    return utility;
  }
};