# Chess App — Architecture

## Overview

A fully client-side chess application built with **Vanilla HTML, CSS, and JavaScript**. No frameworks, no build tools, no external APIs. The AI runs entirely in the browser using a classical game-tree search algorithm.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      Browser (Client)                   │
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐  │
│  │  app.js  │───▶│  ui.js   │───▶│  chess-board DOM │  │
│  │ (Entry)  │    │(Renderer)│    │  (HTML Elements) │  │
│  └────┬─────┘    └──────────┘    └──────────────────┘  │
│       │                                                 │
│       ├──────────▶ chess.js  (Pure Game Engine)         │
│       │                                                 │
│       ├──────────▶ ai.js     (Local AI Engine)          │
│       │                                                 │
│       ├──────────▶ audio.js  (Web Audio API)            │
│       │                                                 │
│       └──────────▶ pieces.js (Image Asset Map)          │
│                                                         │
│  Static assets served by any HTTP server (no backend)  │
└─────────────────────────────────────────────────────────┘
```

---

## Module Breakdown

### `js/chess.js` — Game Engine
The brain of the app. Pure logic, zero DOM interaction.

| Responsibility | Details |
|---|---|
| Board state | 8×8 2D array. `board[0][0]` = a8, `board[7][7]` = h1 |
| Piece format | `{ t: 'p'|'r'|'n'|'b'|'q'|'k', c: 'w'|'b' }` |
| Move generation | Pseudo-legal moves per piece type, filtered to legal |
| Special moves | Castling, en passant, pawn promotion |
| Detection | Check, checkmate, stalemate, 50-move rule, insufficient material |
| Undo / Redo | Full board snapshot saved per move in `history[]` stack |
| Notation | Standard Algebraic Notation (SAN) generated for each move |

**Key methods:**
```
getLegalMoves(row, col)      → Move[]
makeMove(from, to, promo)    → MoveSnapshot | null
undo()                       → MoveSnapshot | null
redo()                       → MoveSnapshot | null
isInCheck(color)             → boolean
getAllLegalMoves(color)       → Move[]
toFEN()                      → string
```

---

### `js/ai.js` — Local AI Engine (runs in-browser, no server)

The AI is implemented using **Minimax with Alpha-Beta Pruning** — a classical game tree search algorithm.

```
                  ROOT (AI to move)
                 /        |        \
            Move A      Move B    Move C
           /    \       /    \
        Opp1  Opp2   Opp1  Opp2
          ↓     ↓      ↓     ↓
        eval  eval   eval  eval
```

| Difficulty | Algorithm | Search Depth | Notes |
|---|---|---|---|
| Easy | Random | — | Picks a random legal move |
| Medium | Minimax + Alpha-Beta | 2 ply | Slight randomness to avoid repetition |
| Hard | Minimax + Alpha-Beta | 4 ply | Move ordering for better pruning |

**Evaluation function** (static board evaluation):
- Material value (pawn=1, knight/bishop=3, rook=5, queen=9) × 100
- Piece-Square Tables (PST) — positional bonuses per square per piece type
- Checkmate = ±100,000 score
- Stalemate/Draw = 0

**No external AI API is used. Everything runs client-side in JavaScript.**

---

### `js/ui.js` — Board Renderer and Interaction

| Feature | Implementation |
|---|---|
| Board rendering | 64 `<div class="sq">` elements in a CSS grid |
| Click-to-move | Select piece → highlight legal moves → click target |
| Drag-and-drop | mousedown/mousemove/mouseup events + ghost element |
| Legal move dots | CSS ::after pseudo-elements on `.legal-move` squares |
| Last move highlight | `.last-move` class on from/to squares |
| Check highlight | `.in-check` class on king square |
| Board flip | Re-maps visual row/col to logical row/col |
| Pawn promotion | Modal dialog with 4 piece choices |
| Move history | Rendered as move-row elements in right panel |
| Captured pieces | Images rendered in side panels with material advantage |

---

### `js/app.js` — Application Controller

```
App
├── _bindSetup()           Setup screen toggle logic
├── _bindTimeControl()     Time control category + preset selection
├── _startGame()           Initialize/reset all modules for new game
├── _onMoveMade(snap)      Post-move logic: UI update, AI trigger, timers
├── _triggerAI()           Async AI move computation + apply
├── _updateStatus()        Status bar text (check, checkmate, stalemate...)
├── _updateTurnIndicator() Highlight active player bar + clock
├── _startTimer()          setInterval-based countdown clock
├── _renderClocks()        Format + display MM:SS on player bars
├── _showGameOver()        Game-over dialog with result
├── _undo() / _redo()      Undo/redo with AI-aware double-step
└── _bindGame()            Button event listeners
```

---

### `js/audio.js` — Sound Engine
Synthesized sounds via the **Web Audio API**. No external audio files.

| Sound | Trigger | Waveform |
|---|---|---|
| Move | Any piece moved | Sine tones |
| Capture | Piece taken | Sawtooth burst |
| Castle | Castling move | Rising sine arpeggio |
| Check | King in check | Square wave chord |
| Game Over (win) | Checkmate | Rising fanfare |
| Game Over (loss) | Stalemate/resign | Descending tones |

---

### `js/pieces.js` — Asset Map

Maps `color + type` key to image file path.

```js
PIECE_IMAGES = {
  'bp': 'assets/B_pawn.png',   'wp': 'assets/W_pawn.png',
  'br': 'assets/B_rook.png',   'wr': 'assets/W_rook.png',
  // ...
}
```

---

## Data Flow: Player Move

```
User clicks square
       │
   ui.js _handleSelect()
       │
   chess.js getLegalMoves()   ← computes all legal moves for piece
       │
   ui.js _applyHighlights()   ← shows legal move dots
       │
   User clicks target square
       │
   ui.js _executeMove()
       │
   chess.js makeMove()        ← mutates board, generates SAN notation
       │
   audio.js move() / capture()
       │
   ui.js render()             ← redraws board with updated positions
       │
   app.js _onMoveMade(snap)
       ├── renderHistory()    ← appends SAN to move list
       ├── renderCaptured()   ← updates captured piece panels
       ├── _updateStatus()    ← check / checkmate / stalemate message
       ├── _updateTurnIndicator()
       ├── Apply increment to player's clock (if tcInc > 0)
       └── [if PvA and AI's turn] → ai.js think() → chess.js makeMove()
```

---

## File Structure

```
ChessApp/
├── index.html           Main HTML shell (setup + game screens)
├── ARCHITECTURE.md      This document
├── README.md            Setup and usage guide
├── css/
│   └── style.css        Full design system + board themes
├── js/
│   ├── pieces.js        Image asset map
│   ├── chess.js         Pure chess engine (ChessEngine class)
│   ├── ai.js            Minimax AI (ChessAI class)
│   ├── audio.js         Web Audio synthesizer (AudioEngine class)
│   ├── ui.js            Board renderer + interaction (ChessUI class)
│   └── app.js           Application controller (App class)
└── assets/
    ├── B_bishop.png  B_king.png  B_knight.png
    ├── B_pawn.png    B_queen.png  B_rook.png
    ├── W_Bishop.png  W_king.png  W_knight.png
    ├── W_pawn.png    W_queen.png  W_rook.png
    └── ChessPiecesArray.png
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| No framework | Zero build step, instant load, full control |
| Client-side AI | No server cost, works offline, no latency |
| Web Audio API | No audio files needed, synthesized on-the-fly |
| CSS Grid for board | Clean, responsive, easily flippable |
| Snapshot-based undo | Full board state per move = simple and reliable |
| SAN generated client-side | Standard chess notation for move history |
| Piece images (PNG) | Real chess piece silhouettes for clear identification |
