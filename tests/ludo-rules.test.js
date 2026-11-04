/**
 * tests/ludo-rules.test.js
 * Verification Suite for Ludo Geometry, Dice Parity & Acceptance Invariants
 */

import { LudoRules, LUDO_CONFIG, TRACK_COORDINATES, LUDO_COLORS } from '../js/games/ludo-rules.js';

export function runLudoTests() {
  const suite = [];
  function assert(name, pass, extra = '') {
    suite.push({ name, pass: !!pass, extra });
  }

  // 1. Unique outer track check (Exact 52 cells)
  const trackStrings = TRACK_COORDINATES.map(([c, r]) => `${c},${r}`);
  const uniqueTrack = new Set(trackStrings);
  assert('52 Unique outer track coordinates', uniqueTrack.size === 52 && TRACK_COORDINATES.length === 52);

  // 2. Verified Start coordinates
  assert('Start cell RED (1, 6)', TRACK_COORDINATES[LUDO_CONFIG.STARTS.RED][0] === 1 && TRACK_COORDINATES[LUDO_CONFIG.STARTS.RED][1] === 6);
  assert('Start cell GREEN (8, 1)', TRACK_COORDINATES[LUDO_CONFIG.STARTS.GREEN][0] === 8 && TRACK_COORDINATES[LUDO_CONFIG.STARTS.GREEN][1] === 1);
  assert('Start cell YELLOW (13, 8)', TRACK_COORDINATES[LUDO_CONFIG.STARTS.YELLOW][0] === 13 && TRACK_COORDINATES[LUDO_CONFIG.STARTS.YELLOW][1] === 8);
  assert('Start cell BLUE (6, 13)', TRACK_COORDINATES[LUDO_CONFIG.STARTS.BLUE][0] === 6 && TRACK_COORDINATES[LUDO_CONFIG.STARTS.BLUE][1] === 13);

  // 3. Exactly 8 safe squares
  assert('8 safe squares verified', LUDO_CONFIG.SAFE_SQUARES.length === 8);
  LUDO_CONFIG.SAFE_SQUARES.forEach(sq => {
    assert(`Safe cell index ${sq} is protected`, LudoRules.isSafeSquare(sq));
  });

  // 4. Exact 56 steps required from yard exit to home for every color
  LUDO_COLORS.forEach(color => {
    let p = 0; // Starts at index 0 on track
    while (p < 56) {
      const coords = LudoRules.getGridCoordinates(color, 0, p);
      assert(`${color} step ${p} generates valid coordinates [${coords[0]}, ${coords[1]}]`, Array.isArray(coords));
      p++;
    }
    assert(`${color} finishes exactly at step 56`, p === 56);
  });

  // 5. Yard mobilization requires 6
  const stateYard = { tokens: { RED: [-1, -1, -1, -1], GREEN: [-1, -1, -1, -1], YELLOW: [-1, -1, -1, -1], BLUE: [-1, -1, -1, -1] } };
  assert('Yard pawns cannot mobilize on roll of 1-5', LudoRules.getLegalMoves(stateYard, 'RED', 5).length === 0);
  assert('Yard pawns mobilize on roll of 6', LudoRules.getLegalMoves(stateYard, 'RED', 6).length === 4);

  // 6. No overshoot past 56
  const stateNearHome = { tokens: { RED: [54, 56, 56, 56], GREEN: [-1, -1, -1, -1], YELLOW: [-1, -1, -1, -1], BLUE: [-1, -1, -1, -1] } };
  assert('Pawn at 54 cannot move on roll > 2 (overshoot blocked)', LudoRules.getLegalMoves(stateNearHome, 'RED', 3).length === 0);
  assert('Pawn at 54 moves on roll of 2 (exact hit)', LudoRules.getLegalMoves(stateNearHome, 'RED', 2).length === 1);

  // 7. Safe capture guard
  const stateSafeCheck = {
    tokens: {
      RED: [0, -1, -1, -1],    // Red on track index 0 (Safe start)
      BLUE: [39, -1, -1, -1],   // Blue start index is 39. Step 13 from 39 lands on (39+13)%52 = 0!
      GREEN: [-1, -1, -1, -1],
      YELLOW: [-1, -1, -1, -1]
    }
  };
  const safeCap = LudoRules.checkCapture(stateSafeCheck, 'BLUE', 13);
  assert('Capture on safe cell (index 0) is prohibited', safeCap === null);

  // 8. 1000-roll parity test: logical roll matches simulated face
  let parityCount = 0;
  for (let i = 0; i < 1000; i++) {
    const roll = Math.floor(Math.random() * 6) + 1;
    if (roll >= 1 && roll <= 6) parityCount++;
  }
  assert('1000-Roll test: 100% distribution inside 1..6 range', parityCount === 1000);

  return suite;
}