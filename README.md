# Mini Arcade

Eleven small games that run in the browser. No frameworks, no build step, just HTML, CSS and plain JavaScript. It installs as an app on a phone and keeps working without internet.

Live: https://mini-arcade-self.vercel.app/

## Games

- **Ludo**: 2 to 4 players, against bots (Easy, Normal, Hard) or with friends on one phone. You can save a game and continue it later.
- **Snake**: wrap-around or walls.
- **Tic Tac Toe**: casual, medium and smart bots, or a friend.
- **Connect 4**: against a simple bot or a friend.
- **Memory**: 8 pairs, standard or a 60 second blitz.
- **Flappy**: three speeds.
- **Brick Breaker**: 3 lives.
- **2048**
- **Minesweeper**: 9 by 9 with 10 mines.
- **Whack-a-Mole**: 30 seconds, score 120 to win.
- **Word Guess**: 5-letter words, six tries.

Your name, scores and the last few games are saved in the browser (localStorage). Nothing is sent anywhere.

## Run it on your computer

The code uses ES modules, so it has to be opened through a small server, not by double clicking index.html.

```bash
git clone https://github.com/yeashkumarsudhir/mini-arcade.git
cd mini-arcade
python3 -m http.server 8000
```

Then open http://localhost:8000

## Tests

The Ludo rules, the save format and 200 random full games are tested.

```bash
node tests/run.mjs
```

Or open `tests/tests.html` through the server.

## How the code is laid out

```
index.html        the page, the icons and the dialogs
style.css         all the styling, colours are at the top
sw.js             service worker (offline support)
js/app.js         lobby, rules dialog, pause and quit, results
js/stats.js       name, scores and history
js/fx.js          sounds, shake and confetti
js/core/          small helpers: router, timers, input, storage, dialogs, saved games
js/games/         one file per game (Ludo has four: rules, bots, drawing and the game itself)
tests/            Ludo tests
```

Every game exports the same few things (`mount`, `start`, `pause`, `resume`, `restart`, `destroy`), so adding a game means writing one file and registering it in `app.js`.

## Things I still want to do

- Save and continue for the other games, not only Ludo.
- A bigger word list for Word Guess and a check that the guess is a real word.
- A smarter Connect 4 bot.
- Online Ludo.

## Notes

- If you change a file, change `CACHE_NAME` in `sw.js` too. Otherwise phones keep showing the old version.
- Fonts (Kalam and Mukta) come from Google Fonts. Offline, the browser uses its normal fonts instead.
