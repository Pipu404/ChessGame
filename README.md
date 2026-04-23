# ♟ Chess App

A premium browser-based chess application with local multiplayer, AI opponent, timers, move history, board themes, and more — built entirely with Vanilla HTML, CSS, and JavaScript. **No frameworks. No build step. No external APIs.**

---

## Features

| Feature | Details |
|---|---|
| 🎮 Game Modes | Player vs Player (local), Player vs AI |
| 🤖 AI Opponent | Easy / Medium / Hard (local, runs in browser) |
| ⏱ Time Controls | Bullet, Blitz, Rapid, Classical, Custom with increment |
| 📋 Move History | Full algebraic notation (SAN) panel |
| ♻ Undo / Redo | Step back through any number of moves |
| 🏴 Captured Pieces | Displayed with material advantage score |
| 🎨 Board Themes | Classic, Dark, Neon, Wood |
| 🔊 Sound Effects | Synthesized via Web Audio API (no audio files) |
| ♟ Pawn Promotion | Dialog to choose Queen / Rook / Bishop / Knight |
| ✅ Legal Move Hints | Click a piece to see all valid moves highlighted |
| 🔄 Board Flip | Rotate the board for the other player |
| 📱 Responsive | Works on desktop, tablet, and mobile |

---

## Getting Started

### Prerequisites
- A modern browser (Chrome, Firefox, Edge, Safari)
- Any static HTTP server (see options below)

> **Why a server?** Browsers block local `file://` requests for images. A simple HTTP server fixes this.

### Option 1 — Node.js (recommended)
```bash
npx -y serve . --listen 8765
```
Then open: **http://localhost:8765**

### Option 2 — Python
```bash
python -m http.server 8765
```
Then open: **http://localhost:8765**

### Option 3 — VS Code Live Server
Install the **Live Server** extension → right-click `index.html` → **Open with Live Server**

---

## Project Structure

```
ChessApp/
├── index.html        Main HTML shell
├── README.md         This file
├── ARCHITECTURE.md   Technical architecture document
├── css/
│   └── style.css     Stylesheet + board themes
├── js/
│   ├── pieces.js     Image asset map
│   ├── chess.js      Chess engine (rules, move gen, notation)
│   ├── ai.js         AI engine (Minimax + Alpha-Beta)
│   ├── audio.js      Sound synthesizer (Web Audio API)
│   ├── ui.js         Board renderer + drag/click interaction
│   └── app.js        App controller (game loop, timers, UI wiring)
└── assets/
    ├── B_*.png       Black piece images
    └── W_*.png       White piece images
```

---

## How the AI Works

The AI is **entirely local** — it runs in your browser tab with no internet connection or server required.

It uses the **Minimax algorithm with Alpha-Beta Pruning**:

### Minimax
The AI looks several moves ahead, simulating both its own moves and the opponent's responses. It assumes:
- **AI always picks the move that maximizes its score**
- **Opponent always picks the move that minimizes AI's score**

```
Depth 0 (current position)
        AI to move → picks MAX
       /           \
    Move A        Move B
   (score 2)     score ?
   /      \
 Opp    Opp       ← Opponent picks MIN
(+3)   (+1)
         ↑
    AI picks Move A path that leads to +3
```

### Alpha-Beta Pruning
Cuts off branches of the search tree that can't possibly affect the result — dramatically reduces computation without changing the answer.

### Piece-Square Tables (PST)
Beyond just counting material, the AI rewards good piece positioning:
- Knights prefer the center
- Pawns are rewarded for advancing
- Kings prefer corner safety in the middlegame

### Difficulty Levels

| Level | Depth | Behaviour |
|---|---|---|
| 🟢 Easy | — | Random legal move |
| 🟡 Medium | 2 ply | Minimax with slight randomness |
| 🔴 Hard | 4 ply | Minimax + move ordering for efficiency |

---

## Time Controls

Select a time control from the setup screen before starting:

| Category | Options |
|---|---|
| ⚡ Bullet | 1+0, 2+1 |
| 🔥 Blitz | 3+0, 3+2, 5+0, 5+3 |
| 🕐 Rapid | 10+0, 10+5, 15+10 |
| ♟ Classical | 30+0, 30+20 |
| ⚙ Custom | Any minutes + increment |

The `+N` is the **increment** — seconds added to your clock after each move you make.

---

## Keyboard / Controls

| Control | Action |
|---|---|
| Click piece | Select + show legal moves |
| Click target | Move piece |
| Drag piece | Drag-and-drop move |
| ↩ Undo | Take back last move |
| ↪ Redo | Re-apply undone move |
| ⇅ Flip | Rotate the board |
| 🔊 | Toggle sound on/off |
| 🏳 Resign | Forfeit the current game |

---

## Board Themes

Switch theme from the setup screen before starting a game.

| Theme | Light Square | Dark Square |
|---|---|---|
| Classic | Cream `#f0d9b5` | Brown `#b58863` |
| Dark | Grey `#97a0a8` | Slate `#4d5964` |
| Neon | Deep navy `#1a1a2e` | Blue `#0f3460` |
| Wood | Tan `#f4c67e` | Walnut `#8B5A2B` |

---

## Chess Rules Implemented

- ✅ All standard piece movements
- ✅ Castling (kingside and queenside)
- ✅ En passant
- ✅ Pawn promotion
- ✅ Check detection
- ✅ Checkmate detection
- ✅ Stalemate detection
- ✅ 50-move draw rule
- ✅ Insufficient material draw (K vs K, K+B vs K, K+N vs K)
- ✅ Pinned piece legality (can't expose own king)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Structure | HTML5 |
| Styling | Vanilla CSS (CSS Grid, Custom Properties, animations) |
| Logic | Vanilla JavaScript (ES6 classes) |
| AI | Minimax + Alpha-Beta (pure JS, client-side) |
| Sound | Web Audio API (synthesized, no files) |
| Fonts | Google Fonts (Inter, JetBrains Mono) |
| Server | Any static file server (`npx serve`, Python, Live Server) |

---

## Credits

- Piece images from [github.com/Pipu404/chess-app](https://github.com/Pipu404/chess-app)
- Chess piece design: classic Staunton silhouette style
- AI algorithm: classic Minimax as described in *Artificial Intelligence: A Modern Approach* (Russell & Norvig)
