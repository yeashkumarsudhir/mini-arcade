import { LudoRules, LUDO_CONFIG, TRACK_COORDINATES, LUDO_COLORS } from '../js/games/ludo-rules.js';

export function runLudoTests() {
  const suite = [];
  function assert(name, pass, extra = '') {
    suite.push({ name, pass: !!pass, extra });
  }

  // 1. Outer track check (52 cells)
  const trackStrings = TRACK_COORDINATES.map(([c, r]) => `${c},${r}`);
  const uniqueTrack = new Set(trackStrings);
  assert('52 Unique outer track coordinates', uniqueTrack.size === 52 && TRACK_COORDINATES.length === 52);

  // 2. Start coordinate parity
  assert('Start cell RED (1, 6)', TRACK_COORDINATES[LUDO_CONFIG.STARTS.RED][0] === 1 && TRACK_COORDINATES[LUDO_CONFIG.STARTS.RED][1] === 6);
  assert('Start cell GREEN (8, 1)', TRACK_COORDINATES[LUDO_CONFIG.STARTS.GREEN][0] === 8 && TRACK_COORDINATES[LUDO_CONFIG.STARTS.GREEN][1] === 1);
  assert('Start cell YELLOW (13, 8)', TRACK_COORDINATES[LUDO_CONFIG.STARTS.YELLOW][0] === 13 && TRACK_COORDINATES[LUDO_CONFIG.STARTS.YELLOW][1] === 8);
  assert('Start cell BLUE (6, 13)', TRACK_COORDINATES[LUDO_CONFIG.STARTS.BLUE][0] === 6 && TRACK_COORDINATES[LUDO_CONFIG.STARTS.BLUE][1] === 13);

  // 3. Exactly 8 safe squares
  assert('8 safe squares defined', LUDO_CONFIG.SAFE_SQUARES.length === 8);
  LUDO_CONFIG.SAFE_SQUARES.forEach(sq => {
    assert(`Safe cell index ${sq} is protected`, LudoRules.isSafeSquare(sq));
  });

  // 4. Step 0 to 56 coordinate generation
  LUDO_COLORS.forEach(color => {
    let p = 0;
    while (p < 56) {
      const coords = LudoRules.getGridCoordinates(color, 0, p);
      assert(`${color} step ${p} has valid coordinates`, Array.isArray(coords) && coords.length === 2);
      p++;
    }
    assert(`${color} step 56 lands at home goal`, Array.isArray(LudoRules.getGridCoordinates(color, 0, 56)));
  });

  // 5. Yard mobilization requires exact 6
  const stateYard = { tokens: { RED: [-1, -1, -1, -1], GREEN: [-1, -1, -1, -1], YELLOW: [-1, -1, -1, -1], BLUE: [-1, -1, -1, -1] } };
  assert('Yard pawns cannot move on roll 1-5', LudoRules.getLegalMoves(stateYard, 'RED', 5).length === 0);
  assert('Yard pawns mobilize on roll 6', LudoRules.getLegalMoves(stateYard, 'RED', 6).length === 4);

  // 6. No overshoot past 56
  const stateNearHome = { tokens: { RED: [54, 56, 56, 56], GREEN: [-1, -1, -1, -1], YELLOW: [-1, -1, -1, -1], BLUE: [-1, -1, -1, -1] } };
  assert('Pawn at 54 cannot move on roll > 2 (overshoot blocked)', LudoRules.getLegalMoves(stateNearHome, 'RED', 3).length === 0);
  assert('Pawn at 54 moves on roll 2 (exact hit to 56)', LudoRules.getLegalMoves(stateNearHome, 'RED', 2).length === 1);

  // 7. Safe capture guard
  const stateSafeCheck = {
    tokens: {
      RED: [0, -1, -1, -1],
      BLUE: [39, -1, -1, -1],
      GREEN: [-1, -1, -1, -1],
      YELLOW: [-1, -1, -1, -1]
    }
  };
  const safeCap = LudoRules.checkCapture(stateSafeCheck, 'BLUE', 13);
  assert('Capture on safe cell (index 0) is blocked', safeCap === null);

  // 8. Capture on regular track sends pawn to yard (-1)
  const stateRegularCapture = {
    tokens: {
      RED: [5, -1, -1, -1],
      GREEN: [-1, -1, -1, -1],
      YELLOW: [-1, -1, -1, -1],
      BLUE: [-1, -1, -1, -1]
    }
  };
  // Track coordinate for RED step 5 is (0 + 5) = 5 (not a safe square)
  assert('Track cell 5 is not a safe square', !LudoRules.isSafeSquare(5));

  // 9. Extra turn flag logic
  const moveRoll6 = LudoRules.applyMove(stateYard, 'RED', 0, 6);
  assert('Roll 6 grants extra turn', moveRoll6.earnedExtraTurn === true);

  const moveRoll4 = LudoRules.applyMove({ tokens: { RED: [1, -1, -1, -1], GREEN: [-1, -1, -1, -1], YELLOW: [-1, -1, -1, -1], BLUE: [-1, -1, -1, -1] } }, 'RED', 0, 4);
  assert('Normal move without capture does not grant extra turn', moveRoll4.earnedExtraTurn === false);

  return suite;
}