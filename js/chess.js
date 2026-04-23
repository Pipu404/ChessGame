/**
 * CHESS ENGINE — Pure game logic, no DOM.
 * Board: board[row][col], row 0 = rank 8 (black back rank), row 7 = rank 1 (white back rank)
 * Piece: { t: type ('p','r','n','b','q','k'), c: color ('w','b') } | null
 */
class ChessEngine {
  constructor() { this.reset(); }

  reset() {
    this.board = this._initBoard();
    this.turn = 'w';
    this.castling = { wK: true, wQ: true, bK: true, bQ: true };
    this.ep = null;          // en-passant target square [row, col] (the square the pawn passed through)
    this.halfClock = 0;
    this.fullMove = 1;
    this.history = [];       // move history for undo
    this.redoStack = [];
    this.status = 'playing'; // 'playing' | 'checkmate' | 'stalemate' | 'draw'
    this.winner = null;
    this.capturedPieces = { w: [], b: [] }; // pieces captured BY each colour
  }

  _initBoard() {
    const b = Array(8).fill(null).map(() => Array(8).fill(null));
    const order = ['r','n','b','q','k','b','n','r'];
    for (let c = 0; c < 8; c++) {
      b[0][c] = { t: order[c], c: 'b' };
      b[1][c] = { t: 'p', c: 'b' };
      b[6][c] = { t: 'p', c: 'w' };
      b[7][c] = { t: order[c], c: 'w' };
    }
    return b;
  }

  sq(r, c) { return (r >= 0 && r < 8 && c >= 0 && c < 8) ? this.board[r][c] : null; }

  // ─── Pseudo-legal move generation ────────────────────────────────────────────
  _pseudo(r, c) {
    const p = this.board[r][c];
    if (!p) return [];
    const moves = [];
    const opp = p.c === 'w' ? 'b' : 'w';
    const dir = p.c === 'w' ? -1 : 1;

    const push = (tr, tc, extra = {}) => {
      if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) moves.push({ from: [r, c], to: [tr, tc], ...extra });
    };
    const slide = (dr, dc) => {
      let tr = r + dr, tc = c + dc;
      while (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
        const t = this.board[tr][tc];
        if (!t) push(tr, tc);
        else { if (t.c === opp) push(tr, tc); break; }
        tr += dr; tc += dc;
      }
    };

    if (p.t === 'p') {
      const r1 = r + dir;
      if (r1 >= 0 && r1 < 8 && !this.board[r1][c]) {
        push(r1, c);
        const startRow = p.c === 'w' ? 6 : 1;
        const r2 = r + 2 * dir;
        if (r === startRow && !this.board[r2][c]) push(r2, c, { doublePush: true });
      }
      for (const dc of [-1, 1]) {
        const tr = r + dir, tc = c + dc;
        if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
          if (this.board[tr][tc]?.c === opp) push(tr, tc);
          if (this.ep && this.ep[0] === tr && this.ep[1] === tc) push(tr, tc, { ep: true });
        }
      }
    } else if (p.t === 'n') {
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        const tr = r + dr, tc = c + dc;
        if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
          const t = this.board[tr][tc];
          if (!t || t.c === opp) push(tr, tc);
        }
      }
    } else if (p.t === 'b') {
      for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) slide(dr, dc);
    } else if (p.t === 'r') {
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) slide(dr, dc);
    } else if (p.t === 'q') {
      for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]) slide(dr, dc);
    } else if (p.t === 'k') {
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        const tr = r + dr, tc = c + dc;
        if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
          const t = this.board[tr][tc];
          if (!t || t.c === opp) push(tr, tc);
        }
      }
      // Castling (legality of passing through check is verified in getLegalMoves)
      const back = p.c === 'w' ? 7 : 0;
      if (r === back && c === 4) {
        if (this.castling[p.c + 'K'] && !this.board[back][5] && !this.board[back][6])
          push(back, 6, { castle: 'K' });
        if (this.castling[p.c + 'Q'] && !this.board[back][3] && !this.board[back][2] && !this.board[back][1])
          push(back, 2, { castle: 'Q' });
      }
    }
    return moves;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  _findKing(color) {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.board[r][c]?.t === 'k' && this.board[r][c]?.c === color) return [r, c];
    return null;
  }

  _isAttacked(row, col, byColor) {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.board[r][c]?.c === byColor)
          if (this._pseudo(r, c).some(m => m.to[0] === row && m.to[1] === col)) return true;
    return false;
  }

  isInCheck(color) {
    const k = this._findKing(color);
    return k ? this._isAttacked(k[0], k[1], color === 'w' ? 'b' : 'w') : false;
  }

  // ─── Apply move to board (mutates this.board in-place) ───────────────────────
  _applyToBoard(board, move, piece) {
    const [fr, fc] = move.from, [tr, tc] = move.to;
    // En passant captured pawn
    if (move.ep) board[fr][tc] = null;
    // Move piece (with optional promotion)
    board[tr][tc] = move.promo ? { t: move.promo, c: piece.c } : piece;
    board[fr][fc] = null;
    // Castling rook
    if (move.castle) {
      const back = fr;
      if (move.castle === 'K') { board[back][5] = board[back][7]; board[back][7] = null; }
      else                     { board[back][3] = board[back][0]; board[back][0] = null; }
    }
  }

  // ─── Legal move generation ────────────────────────────────────────────────────
  getLegalMoves(r, c) {
    const p = this.board[r][c];
    if (!p || p.c !== this.turn) return [];
    const legal = [];
    for (const move of this._pseudo(r, c)) {
      // Castling extra checks
      if (move.castle) {
        if (this.isInCheck(p.c)) continue;
        const midCol = move.castle === 'K' ? 5 : 3;
        const opp = p.c === 'w' ? 'b' : 'w';
        if (this._isAttacked(r, midCol, opp)) continue;
      }
      // Temporarily apply move, check own king safety
      const saved = this.board.map(row => [...row]);
      this._applyToBoard(this.board, move, p);
      const safe = !this.isInCheck(p.c);
      this.board = saved;
      if (safe) legal.push(move);
    }
    return legal;
  }

  getAllLegalMoves(color) {
    const saved = this.turn;
    this.turn = color;
    const moves = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.board[r][c]?.c === color) moves.push(...this.getLegalMoves(r, c));
    this.turn = saved;
    return moves;
  }

  // ─── Make a move (public API) ─────────────────────────────────────────────────
  makeMove(from, to, promo = null) {
    const [fr, fc] = from, [tr, tc] = to;
    const p = this.board[fr][fc];
    if (!p || p.c !== this.turn) return null;

    const legal = this.getLegalMoves(fr, fc);
    const move = legal.find(m => m.to[0] === tr && m.to[1] === tc);
    if (!move) return null;

    // Pawn promotion
    const isPromoRank = (p.c === 'w' && tr === 0) || (p.c === 'b' && tr === 7);
    if (p.t === 'p' && isPromoRank) move.promo = promo || 'q';

    // Save undo snapshot
    const capturedPiece = move.ep
      ? { t: 'p', c: p.c === 'w' ? 'b' : 'w' }
      : this.board[tr][tc];

    const snap = {
      move: { ...move },
      boardSnap: this.board.map(r => [...r]),
      castling: { ...this.castling },
      ep: this.ep,
      halfClock: this.halfClock,
      fullMove: this.fullMove,
      turn: this.turn,
      capturedPieces: { w: [...this.capturedPieces.w], b: [...this.capturedPieces.b] },
      capturedPiece,
    };

    // Apply move
    this._applyToBoard(this.board, move, p);

    // Update captured pieces tracker
    if (capturedPiece) this.capturedPieces[p.c].push(capturedPiece);

    // Update castling rights
    if (p.t === 'k') { this.castling[p.c + 'K'] = false; this.castling[p.c + 'Q'] = false; }
    if (p.t === 'r') {
      if (fc === 7) this.castling[p.c + 'K'] = false;
      if (fc === 0) this.castling[p.c + 'Q'] = false;
    }
    // If a rook is captured on its starting square, remove castling right
    if (tr === 0 && tc === 7) this.castling.bK = false;
    if (tr === 0 && tc === 0) this.castling.bQ = false;
    if (tr === 7 && tc === 7) this.castling.wK = false;
    if (tr === 7 && tc === 0) this.castling.wQ = false;

    // En passant target
    this.ep = move.doublePush ? [fr + (tr - fr) / 2, fc] : null;

    // Clocks
    this.halfClock = (p.t === 'p' || capturedPiece) ? 0 : this.halfClock + 1;
    if (this.turn === 'b') this.fullMove++;

    // Flip turn
    this.turn = this.turn === 'w' ? 'b' : 'w';

    // Generate SAN (before status update so we can add +/#)
    snap.san = this._san(move, p, capturedPiece, snap.boardSnap, snap.castling, snap.ep);

    // Determine game status
    this._updateStatus();
    if (this.status === 'checkmate') snap.san += '#';
    else if (this.isInCheck(this.turn)) snap.san += '+';

    this.history.push(snap);
    this.redoStack = [];

    return snap;
  }

  // ─── Undo ─────────────────────────────────────────────────────────────────────
  undo() {
    if (!this.history.length) return null;
    const snap = this.history.pop();
    this.redoStack.push(snap);
    this.board = snap.boardSnap.map(r => [...r]);
    this.castling = { ...snap.castling };
    this.ep = snap.ep;
    this.halfClock = snap.halfClock;
    this.fullMove = snap.fullMove;
    this.turn = snap.turn;
    this.capturedPieces = { w: [...snap.capturedPieces.w], b: [...snap.capturedPieces.b] };
    this.status = 'playing';
    this.winner = null;
    return snap;
  }

  // ─── Redo ─────────────────────────────────────────────────────────────────────
  redo() {
    if (!this.redoStack.length) return null;
    const snap = this.redoStack.pop();
    const { move } = snap;
    return this.makeMove(move.from, move.to, move.promo || null);
  }

  // ─── Status ──────────────────────────────────────────────────────────────────
  _updateStatus() {
    const moves = this.getAllLegalMoves(this.turn);
    if (moves.length === 0) {
      if (this.isInCheck(this.turn)) {
        this.status = 'checkmate';
        this.winner = this.turn === 'w' ? 'b' : 'w';
      } else {
        this.status = 'stalemate';
      }
    } else if (this.halfClock >= 100) {
      this.status = 'draw';
    } else if (this._insufficientMaterial()) {
      this.status = 'draw';
    } else {
      this.status = 'playing';
    }
  }

  _insufficientMaterial() {
    const pieces = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.board[r][c]) pieces.push(this.board[r][c]);
    if (pieces.length === 2) return true; // K vs K
    if (pieces.length === 3) {
      const types = pieces.map(p => p.t);
      if (types.includes('b') || types.includes('n')) return true; // K+B/N vs K
    }
    return false;
  }

  // ─── SAN Notation ─────────────────────────────────────────────────────────────
  _san(move, piece, captured, boardBefore, castlingBefore, epBefore) {
    const files = 'abcdefgh';
    const [fr, fc] = move.from, [tr, tc] = move.to;
    const toStr = files[tc] + (8 - tr);

    if (move.castle) return move.castle === 'K' ? 'O-O' : 'O-O-O';

    if (piece.t === 'p') {
      let san = '';
      if (captured || move.ep) san = files[fc] + 'x' + toStr;
      else san = toStr;
      if (move.promo) san += '=' + move.promo.toUpperCase();
      return san;
    }

    const sym = { r: 'R', n: 'N', b: 'B', q: 'Q', k: 'K' }[piece.t];
    const isCapture = !!captured;

    // Disambiguation: find other pieces of same type that can reach same square
    const savedTurn = this.turn;
    this.turn = piece.c;
    const savedBoard = this.board;
    this.board = boardBefore.map(r => [...r]);
    const savedCastling = this.castling;
    this.castling = { ...castlingBefore };
    const savedEp = this.ep;
    this.ep = epBefore;

    const ambiguous = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        if (r === fr && c === fc) continue;
        const sq = this.board[r][c];
        if (sq?.t === piece.t && sq?.c === piece.c) {
          const m = this.getLegalMoves(r, c);
          if (m.some(mv => mv.to[0] === tr && mv.to[1] === tc)) ambiguous.push([r, c]);
        }
      }

    this.board = savedBoard;
    this.turn = savedTurn;
    this.castling = savedCastling;
    this.ep = savedEp;

    let disambig = '';
    if (ambiguous.length > 0) {
      const sameFile = ambiguous.some(([, ac]) => ac === fc);
      const sameRank = ambiguous.some(([ar]) => ar === fr);
      if (!sameFile) disambig = files[fc];
      else if (!sameRank) disambig = String(8 - fr);
      else disambig = files[fc] + String(8 - fr);
    }

    return sym + disambig + (isCapture ? 'x' : '') + toStr;
  }

  // ─── Material value (for AI and advantage display) ───────────────────────────
  static PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

  getMaterialAdvantage(color) {
    let val = 0;
    for (const p of this.capturedPieces[color]) val += ChessEngine.PIECE_VALUE[p.t];
    for (const p of this.capturedPieces[color === 'w' ? 'b' : 'w']) val -= ChessEngine.PIECE_VALUE[p.t];
    return val;
  }

  // Return FEN (useful for debugging)
  toFEN() {
    const files = 'abcdefgh';
    let fen = '';
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p) { empty++; }
        else {
          if (empty) { fen += empty; empty = 0; }
          const ch = p.t === 'n' ? 'n' : p.t;
          fen += p.c === 'w' ? ch.toUpperCase() : ch;
        }
      }
      if (empty) fen += empty;
      if (r < 7) fen += '/';
    }
    fen += ' ' + this.turn;
    let cas = '';
    if (this.castling.wK) cas += 'K'; if (this.castling.wQ) cas += 'Q';
    if (this.castling.bK) cas += 'k'; if (this.castling.bQ) cas += 'q';
    fen += ' ' + (cas || '-');
    fen += ' ' + (this.ep ? files[this.ep[1]] + (8 - this.ep[0]) : '-');
    fen += ' ' + this.halfClock + ' ' + this.fullMove;
    return fen;
  }
}
