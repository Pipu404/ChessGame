/**
 * AI ENGINE — Minimax with alpha-beta pruning
 * Difficulty levels: easy (random), medium (depth 2), hard (depth 4)
 */
class ChessAI {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty;
    this.thinking = false;
  }

  setDifficulty(d) { this.difficulty = d; }

  // ─── Piece-square tables (from White's perspective, flip for Black) ─────────
  static PST = {
    p: [
      [ 0,  0,  0,  0,  0,  0,  0,  0],
      [50, 50, 50, 50, 50, 50, 50, 50],
      [10, 10, 20, 30, 30, 20, 10, 10],
      [ 5,  5, 10, 25, 25, 10,  5,  5],
      [ 0,  0,  0, 20, 20,  0,  0,  0],
      [ 5, -5,-10,  0,  0,-10, -5,  5],
      [ 5, 10, 10,-20,-20, 10, 10,  5],
      [ 0,  0,  0,  0,  0,  0,  0,  0],
    ],
    n: [
      [-50,-40,-30,-30,-30,-30,-40,-50],
      [-40,-20,  0,  0,  0,  0,-20,-40],
      [-30,  0, 10, 15, 15, 10,  0,-30],
      [-30,  5, 15, 20, 20, 15,  5,-30],
      [-30,  0, 15, 20, 20, 15,  0,-30],
      [-30,  5, 10, 15, 15, 10,  5,-30],
      [-40,-20,  0,  5,  5,  0,-20,-40],
      [-50,-40,-30,-30,-30,-30,-40,-50],
    ],
    b: [
      [-20,-10,-10,-10,-10,-10,-10,-20],
      [-10,  0,  0,  0,  0,  0,  0,-10],
      [-10,  0,  5, 10, 10,  5,  0,-10],
      [-10,  5,  5, 10, 10,  5,  5,-10],
      [-10,  0, 10, 10, 10, 10,  0,-10],
      [-10, 10, 10, 10, 10, 10, 10,-10],
      [-10,  5,  0,  0,  0,  0,  5,-10],
      [-20,-10,-10,-10,-10,-10,-10,-20],
    ],
    r: [
      [ 0,  0,  0,  0,  0,  0,  0,  0],
      [ 5, 10, 10, 10, 10, 10, 10,  5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [ 0,  0,  0,  5,  5,  0,  0,  0],
    ],
    q: [
      [-20,-10,-10, -5, -5,-10,-10,-20],
      [-10,  0,  0,  0,  0,  0,  0,-10],
      [-10,  0,  5,  5,  5,  5,  0,-10],
      [ -5,  0,  5,  5,  5,  5,  0, -5],
      [  0,  0,  5,  5,  5,  5,  0, -5],
      [-10,  5,  5,  5,  5,  5,  0,-10],
      [-10,  0,  5,  0,  0,  0,  0,-10],
      [-20,-10,-10, -5, -5,-10,-10,-20],
    ],
    k: [
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-20,-30,-30,-40,-40,-30,-30,-20],
      [-10,-20,-20,-20,-20,-20,-20,-10],
      [ 20, 20,  0,  0,  0,  0, 20, 20],
      [ 20, 30, 10,  0,  0, 10, 30, 20],
    ],
  };

  // ─── Evaluate board (positive = good for White) ────────────────────────────
  _evaluate(engine) {
    if (engine.status === 'checkmate')
      return engine.winner === 'w' ? 100000 : -100000;
    if (engine.status === 'stalemate' || engine.status === 'draw') return 0;

    let score = 0;
    const vals = ChessEngine.PIECE_VALUE;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = engine.board[r][c];
        if (!p) continue;
        const pst = ChessAI.PST[p.t];
        const pstVal = p.c === 'w' ? pst[r][c] : pst[7 - r][c];
        const material = (vals[p.t] || 0) * 100;
        score += p.c === 'w' ? (material + pstVal) : -(material + pstVal);
      }
    }
    return score;
  }

  // ─── Move ordering (captures & checks first for better pruning) ────────────
  _orderMoves(engine, moves) {
    return moves.sort((a, b) => {
      const capVal = m => {
        const target = engine.board[m.to[0]][m.to[1]];
        return target ? (ChessEngine.PIECE_VALUE[target.t] || 0) * 10 : 0;
      };
      return capVal(b) - capVal(a);
    });
  }

  // ─── Minimax with Alpha-Beta ───────────────────────────────────────────────
  _minimax(engine, depth, alpha, beta, maximizing) {
    if (depth === 0 || engine.status !== 'playing')
      return this._evaluate(engine);

    const color = maximizing ? 'w' : 'b';
    const rawMoves = engine.getAllLegalMoves(color);
    const moves = this._orderMoves(engine, rawMoves);

    if (moves.length === 0) return this._evaluate(engine);

    if (maximizing) {
      let best = -Infinity;
      for (const m of moves) {
        engine.makeMove(m.from, m.to, m.promo || 'q');
        const val = this._minimax(engine, depth - 1, alpha, beta, false);
        engine.undo();
        best = Math.max(best, val);
        alpha = Math.max(alpha, val);
        if (beta <= alpha) break;
      }
      return best;
    } else {
      let best = Infinity;
      for (const m of moves) {
        engine.makeMove(m.from, m.to, m.promo || 'q');
        const val = this._minimax(engine, depth - 1, alpha, beta, true);
        engine.undo();
        best = Math.min(best, val);
        beta = Math.min(beta, val);
        if (beta <= alpha) break;
      }
      return best;
    }
  }

  // ─── Get best move ─────────────────────────────────────────────────────────
  getBestMove(engine, aiColor) {
    const moves = engine.getAllLegalMoves(aiColor);
    if (!moves.length) return null;

    // Easy: random legal move
    if (this.difficulty === 'easy') {
      return moves[Math.floor(Math.random() * moves.length)];
    }

    const depth = this.difficulty === 'medium' ? 2 : 4;
    const maximizing = aiColor === 'w';

    let bestMove = null;
    let bestVal = maximizing ? -Infinity : Infinity;

    // Add slight randomness to medium to avoid repetition
    const shuffled = this.difficulty === 'medium'
      ? [...moves].sort(() => Math.random() - 0.5)
      : this._orderMoves(engine, moves);

    for (const m of shuffled) {
      engine.makeMove(m.from, m.to, m.promo || 'q');
      const val = this._minimax(engine, depth - 1, -Infinity, Infinity, !maximizing);
      engine.undo();

      const better = maximizing ? val > bestVal : val < bestVal;
      if (better) { bestVal = val; bestMove = m; }
    }
    return bestMove;
  }

  // ─── Async wrapper (prevents UI freeze) ───────────────────────────────────
  async think(engine, aiColor, onMove) {
    this.thinking = true;
    // Yield to browser for rendering
    await new Promise(r => setTimeout(r, this.difficulty === 'hard' ? 50 : 20));
    const move = this.getBestMove(engine, aiColor);
    this.thinking = false;
    onMove(move);
  }
}
