# Mini Arcade

A collection of classic browser games built with plain vanilla JavaScript, HTML5 Canvas, and modern CSS. No heavy game engines, no node build steps, and no third-party runtime frameworks — just clean, modular web code that works offline as an installable PWA.

Live site: [mini-arcade-self.vercel.app](https://mini-arcade-self.vercel.app/)

## Included Games
- **Ludo**: 2 to 4 players, local pass-and-play or against AI bots (Easy, Normal, Hard). Includes exact home entry rolls, safe cells, and state save/resume.
- **Snake**: Classic grid movement with Wrap and Border wall options.
- **Tic-Tac-Toe**: Clean 3x3 board with Minimax defensive bot logic.
- **Connect 4**: Gravity-based 7x6 drop board (vs Bot or local 2-Player).
- **2048**: Responsive tile sliding and number merging.
- **Minesweeper**: 9x9 board with 10 mines, safe first clicks, and direct flagging.
- **Memory Match**: 16 cards (8 pairs) with turn count and blitz timer options.
- **Flappy Bird**: Single-button physics flight with variable speed presets.
- **Brick Breaker**: Multi-row brick layout with ball angle deflection.
- **Whack-a-Mole**: 30-second reflex round with standard and bonus golden moles.
- **Word Guess**: 5-letter hidden word guessing in 6 tries with color hints.

## Running Locally

Clone the repository and start any lightweight static server:

```bash
git clone [https://github.com/yeashkumarsudhir/mini-arcade.git](https://github.com/yeashkumarsudhir/mini-arcade.git)
cd mini-arcade
python3 -m http.server 8000