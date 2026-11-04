/**
 * js/games/ludo-ai.js
 * Ludo Bot Decision Logic
 * Difficulty levels: Casual (random), Normal (heuristic scoring), Smart (two-ply minimax search)
 */

import { LudoRules, LUDO_CONFIG, LUDO_COLORS } from './ludo-rules.js';

export const LudoAI = {
  chooseMove(difficulty, color, gameState, roll, legalMoves) {
    if (!legalMoves || legalMoves.length === 0) return -1;
    if (legalMoves.length === 1) return legalMoves[0];

    const mode = (difficulty || 'Normal').toLowerCase();

    switch (mode) {
      case 'easy':
      case 'casual':
        return this.chooseEasyMove(legalMoves);
      case 'hard':
      case 'smart':
        return this.chooseSmartMinimax(color, gameState, roll, legalMoves);
      case 'normal':
      default:
        return this.chooseNormalHeuristic(color, gameState, roll, legalMoves);
    }
  },

  chooseEasyMove(legalMoves) {
    const idx = Math.floor(Math.random() * legalMoves.length);
    return legalMoves[idx];
  },

  chooseNormalHeuristic(color, gameState, roll, legalMoves) {
    let bestScore = -Infinity;
    let bestMove = legalMoves[0];

    for (const tokenIdx of legalMoves) {
      const curP = gameState.tokens[color][tokenIdx];
      const targetP = (curP === -1) ? 0 : curP + roll;
      const score = this.evaluateSingleMove(color, gameState, tokenIdx, targetP, roll);

      if (score > bestScore) {
        bestScore = score;
        bestMove = tokenIdx;
      }
    }

    return bestMove;
  },

  evaluateSingleMove(color, gameState, tokenIdx, targetP, roll) {
    let score = 0;

    // Leaving the yard on rolling 6
    if (gameState.tokens[color][tokenIdx] === -1 && targetP === 0) {
      score += 35;
      return score;
    }

    // Landing directly into home goal
    if (targetP === 56) {
      score += 90;
      return score;
    }

    // Advancing down private home column
    if (targetP > 50 && targetP < 56) {
      score += 40;
    }

    // Capturing an opposing pawn on the main track
    if (targetP <= 50) {
      const capture = LudoRules.checkCapture(gameState, color, targetP);
      if (capture) {
        score += 100;
      }

      const targetTrack = LudoRules.getTrackIndex(color, targetP);

      // Safe square landing
      if (LudoRules.isSafeSquare(targetTrack)) {
        score += 30;
      } else if (this.isVulnerableToAttack(gameState, color, targetTrack)) {
        score -= 25;
      }
    }

    // Steady forward progress
    score += targetP * 1.2;

    return score;
  },

  isVulnerableToAttack(gameState, myColor, targetTrackIdx) {
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

  chooseSmartMinimax(myColor, gameState, roll, legalMoves) {
    let bestVal = -Infinity;
    let bestToken = legalMoves[0];

    for (const tokenIdx of legalMoves) {
      const { nextState } = LudoRules.applyMove(gameState, myColor, tokenIdx, roll);
      const expectedEval = this.evaluateChanceLayer(nextState, myColor);

      if (expectedEval > bestVal) {
        bestVal = expectedEval;
        bestToken = tokenIdx;
      }
    }

    return bestToken;
  },

  evaluateChanceLayer(stateAfterMyMove, myColor) {
    const myIdx = LUDO_COLORS.indexOf(myColor);
    const nextOppColor = LUDO_COLORS[(myIdx + 1) % 4];

    let totalScore = 0;

    for (let simRoll = 1; simRoll <= 6; simRoll++) {
      const oppMoves = LudoRules.getLegalMoves(stateAfterMyMove, nextOppColor, simRoll);

      if (oppMoves.length === 0) {
        totalScore += this.evaluateBoardState(stateAfterMyMove, myColor);
      } else {
        let worstForMe = Infinity;
        for (const oppToken of oppMoves) {
          const { nextState: oppNextState } = LudoRules.applyMove(stateAfterMyMove, nextOppColor, oppToken, simRoll);
          const evalScore = this.evaluateBoardState(oppNextState, myColor);
          if (evalScore < worstForMe) {
            worstForMe = evalScore;
          }
        }
        totalScore += worstForMe;
      }
    }

    return totalScore / 6;
  },

  evaluateBoardState(state, myColor) {
    let utility = 0;

    for (const col of LUDO_COLORS) {
      const isMe = (col === myColor);
      const mult = isMe ? 1 : -0.33;
      const pawns = state.tokens[col];

      for (const p of pawns) {
        if (p === 56) {
          utility += 150 * mult;
        } else if (p === -1) {
          utility -= 20 * mult;
        } else {
          utility += p * 2.0 * mult;
          if (p <= 50) {
            const track = LudoRules.getTrackIndex(col, p);
            if (LudoRules.isSafeSquare(track)) {
              utility += 25 * mult;
            }
          }
        }
      }
    }

    return utility;
  }
};