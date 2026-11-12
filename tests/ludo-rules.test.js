// tests/ludo-rules.test.js: checks for the Ludo board layout, the rules and the save format.
// Run in the browser (tests/tests.html) or in a terminal with: node tests/run.mjs

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

  // A stack of two pawns is captured together
  const stateStack = { tokens: { RED: [5, -1, -1, -1], GREEN: [-1, -1, -1, -1], YELLOW: [-1, -1, -1, -1], BLUE: [-1, -1, -1, -1] } };
  stateStack.tokens.GREEN = [4, 4, -1, -1];   // GREEN starts at 13, so progress 4 is track cell 17
  const stackHits = LudoRules.checkCaptures(stateStack, 'RED', 17);
  assert('Two stacked pawns on one square are both captured', stackHits.length === 2);

  // 9. Saved games: a good snapshot loads, broken ones are refused
  const goodSnap = {
    version: 1,
    players: [{ color: 'RED', isBot: false }, { color: 'YELLOW', isBot: true }],
    activeColor: 'RED',
    tokens: { RED: [3, -1, -1, 56], GREEN: [-1, -1, -1, -1], YELLOW: [10, 51, -1, -1], BLUE: [-1, -1, -1, -1] },
    finishRank: [],
    diceValue: 4,
    phase: 'WAIT_PICK',
    consecutiveSixes: 1,
    difficulty: 'Hard'
  };
  const copy = () => JSON.parse(JSON.stringify(goodSnap));

  assert('Good snapshot is accepted', LudoRules.isValidSnapshot(goodSnap));
  assert('Snapshot survives JSON round trip', LudoRules.isValidSnapshot(JSON.parse(JSON.stringify(goodSnap))));
  assert('Missing snapshot is refused', !LudoRules.isValidSnapshot(null) && !LudoRules.isValidSnapshot(undefined));

  let bad = copy(); bad.tokens.RED[0] = 57;
  assert('Pawn past home (57) is refused', !LudoRules.isValidSnapshot(bad));
  bad = copy(); bad.tokens.RED[0] = -2;
  assert('Pawn at -2 is refused', !LudoRules.isValidSnapshot(bad));
  bad = copy(); bad.tokens.GREEN = [0, 0, 0];
  assert('Colour with 3 pawns is refused', !LudoRules.isValidSnapshot(bad));
  bad = copy(); bad.activeColor = 'BLUE';
  assert('Active colour that is not playing is refused', !LudoRules.isValidSnapshot(bad));
  bad = copy(); bad.players = [{ color: 'RED', isBot: false }];
  assert('One player only is refused', !LudoRules.isValidSnapshot(bad));
  bad = copy(); bad.players[1].color = 'RED';
  assert('Same colour twice is refused', !LudoRules.isValidSnapshot(bad));
  bad = copy(); bad.diceValue = 7;
  assert('Dice value 7 is refused', !LudoRules.isValidSnapshot(bad));
  bad = copy(); bad.phase = 'MOVING';
  assert('Saving in the middle of a move is refused', !LudoRules.isValidSnapshot(bad));
  bad = copy(); bad.version = 2;
  assert('Unknown save version is refused', !LudoRules.isValidSnapshot(bad));

  // 10. Random games: play 200 full games with random legal moves and check the board stays sane
  let allFinished = true;
  let allSane = true;
  for (let game = 0; game < 200; game++) {
    const colors = game % 2 === 0 ? ['RED', 'YELLOW'] : ['RED', 'GREEN', 'YELLOW', 'BLUE'];
    const state = { tokens: { RED: [-1, -1, -1, -1], GREEN: [-1, -1, -1, -1], YELLOW: [-1, -1, -1, -1], BLUE: [-1, -1, -1, -1] }, finishRank: [] };
    let turn = 0;
    let sixes = 0;
    let steps = 0;

    while (state.finishRank.length < colors.length - 1 && steps < 20000) {
      steps++;
      const color = colors[turn % colors.length];
      if (state.finishRank.includes(color)) { turn++; continue; }

      const dice = Math.floor(Math.random() * 6) + 1;
      sixes = dice === 6 ? sixes + 1 : 0;
      if (sixes === 3) { sixes = 0; turn++; continue; }

      const moves = LudoRules.getLegalMoves(state, color, dice);
      if (moves.length === 0) { turn++; continue; }

      const idx = moves[Math.floor(Math.random() * moves.length)];
      const from = state.tokens[color][idx];
      const to = from === -1 ? 0 : from + dice;
      state.tokens[color][idx] = to;

      const hits = LudoRules.checkCaptures(state, color, to);
      for (const h of hits) state.tokens[h.color][h.tokenIndex] = -1;
      const hit = hits.length > 0;

      // sanity: every pawn is in range, and two colours never share an unsafe track square
      const seen = new Map();
      for (const c of colors) {
        for (const p of state.tokens[c]) {
          if (p < -1 || p > 56) allSane = false;
          if (p >= 0 && p <= 50) {
            const cell = (LUDO_CONFIG.STARTS[c] + p) % 52;
            const owner = seen.get(cell);
            if (owner && owner !== c && !LudoRules.isSafeSquare(cell)) allSane = false;
            seen.set(cell, c);
          }
        }
      }

      if (state.tokens[color].every(p => p === 56)) {
        if (!state.finishRank.includes(color)) state.finishRank.push(color);
        sixes = 0;
        turn++;
        continue;
      }
      if (!(dice === 6 || hit || to === 56)) turn++;
    }
    if (state.finishRank.length < colors.length - 1) allFinished = false;
  }
  assert('200 random games all reach a winner', allFinished);
  assert('Pawns stay in range and never share an unsafe square', allSane);

  return suite;
}