/**
 * UI — Board rendering, interaction, and display updates.
 */
class ChessUI {
  constructor(engine, audio) {
    this.engine = engine;
    this.audio = audio;
    this.flipped = false;       // if true, board is shown from black's perspective
    this.selected = null;       // [row, col] of selected square
    this.legalMoves = [];       // legal moves for selected piece
    this.lastMove = null;       // { from, to }
    this.dragGhost = null;
    this.onPromotion = null;    // callback when promotion needed
    this.onMoveMade = null;     // callback after any move
    this.sqSize = 72;

    this.boardEl = document.getElementById('chess-board');
    this.squares = [];          // DOM elements [row][col]

    this._initBoard();
    this._initDrag();
    this._calcSqSize();
    window.addEventListener('resize', () => this._calcSqSize());
  }

  // ─── Board initialisation ─────────────────────────────────────────────────
  _initBoard() {
    this.boardEl.innerHTML = '';
    this.squares = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = document.createElement('div');
        sq.className = `sq ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
        sq.dataset.row = r; sq.dataset.col = c;
        sq.addEventListener('click', e => this._onClick(e));
        sq.addEventListener('mousedown', e => this._onDragStart(e));
        this.boardEl.appendChild(sq);
        this.squares[r][c] = sq;
      }
    }
    this._updateCoords();
  }

  _calcSqSize() {
    const sidePanels = 2 * 180 + 2 * 12 + 2 * 12; // 2 panels + 2 gaps + padding
    const availW = window.innerWidth - sidePanels;
    // Subtract: status bar ~28px, controls ~48px, coords ~24px, padding ~24px
    const availH = window.innerHeight - 28 - 48 - 24 - 24;
    const boardPx = Math.min(availW, availH, 620);
    this.sqSize = Math.max(44, Math.floor(boardPx / 8));
    document.documentElement.style.setProperty('--sq-size', this.sqSize + 'px');
    this._updateCoords();
  }

  _updateCoords() {
    const ranks = ['8','7','6','5','4','3','2','1'];
    const files = ['a','b','c','d','e','f','g','h'];

    const left = document.getElementById('coords-left');
    const right = document.getElementById('coords-right');
    if (left) {
      left.innerHTML = '';
      right.innerHTML = '';
      const display = this.flipped ? [...ranks].reverse() : ranks;
      display.forEach(r => {
        const s1 = document.createElement('span'); s1.textContent = r;
        const s2 = document.createElement('span'); s2.textContent = r;
        left.appendChild(s1); right.appendChild(s2);
      });
    }

    // Update top/bottom file labels
    document.querySelectorAll('.coords-top span, .coords-bottom span').forEach((el, i) => {
      el.textContent = this.flipped ? files[7 - i] : files[i];
    });
  }

  // ─── Full render ─────────────────────────────────────────────────────────
  render() {
    const { board } = this.engine;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        const sq = this._sqEl(r, c);
        if (!sq) continue;

        // Clear piece
        let pieceEl = sq.querySelector('.piece');
        if (pieceEl) pieceEl.remove();

        if (piece) {
          const div = document.createElement('div');
          div.className = 'piece';
          div.dataset.row = r; div.dataset.col = c;
          div.innerHTML = getPieceSVG(piece.t, piece.c);
          sq.appendChild(div);
        }
      }
    }
    this._applyHighlights();
  }

  // ─── Highlights ───────────────────────────────────────────────────────────
  _applyHighlights() {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = this._sqEl(r, c);
        if (!sq) continue;
        sq.classList.remove('selected','last-move','legal-move','legal-capture','in-check');
      }
    }

    // Last move
    if (this.lastMove) {
      this._sqEl(...this.lastMove.from)?.classList.add('last-move');
      this._sqEl(...this.lastMove.to)?.classList.add('last-move');
    }

    // Selected square
    if (this.selected) {
      this._sqEl(...this.selected)?.classList.add('selected');
    }

    // Legal moves
    for (const m of this.legalMoves) {
      const [tr, tc] = m.to;
      const sq = this._sqEl(tr, tc);
      if (!sq) continue;
      const isCapture = !!this.engine.board[tr][tc] || m.ep;
      sq.classList.add(isCapture ? 'legal-capture' : 'legal-move');
    }

    // King in check
    if (this.engine.isInCheck(this.engine.turn)) {
      const k = this.engine._findKing(this.engine.turn);
      if (k) this._sqEl(k[0], k[1])?.classList.add('in-check');
    }
  }

  // ─── Square element (accounts for flip) ──────────────────────────────────
  _sqEl(r, c) {
    const dr = this.flipped ? 7 - r : r;
    const dc = this.flipped ? 7 - c : c;
    return this.squares[dr]?.[dc] ?? null;
  }

  // Board coordinates from visual row/col (accounting for flip)
  _boardCoord(visualRow, visualCol) {
    return this.flipped
      ? [7 - visualRow, 7 - visualCol]
      : [visualRow, visualCol];
  }

  // ─── Click handler ────────────────────────────────────────────────────────
  _onClick(e) {
    if (this._isDragging) return;
    const vr = parseInt(e.currentTarget.dataset.row);
    const vc = parseInt(e.currentTarget.dataset.col);
    const [r, c] = this._boardCoord(vr, vc);
    this._handleSelect(r, c);
  }

  _handleSelect(r, c) {
    const p = this.engine.board[r][c];

    // If a piece is already selected, try to move
    if (this.selected) {
      const [sr, sc] = this.selected;
      const move = this.legalMoves.find(m => m.to[0] === r && m.to[1] === c);

      if (move) {
        // Pawn promotion
        const movingPiece = this.engine.board[sr][sc];
        if (movingPiece?.t === 'p' && (r === 0 || r === 7)) {
          this._showPromotion(movingPiece.c, promo => this._executeMove([sr, sc], [r, c], promo));
        } else {
          this._executeMove([sr, sc], [r, c]);
        }
        return;
      }

      // Clicking own piece — re-select
      if (p?.c === this.engine.turn) {
        this.selected = [r, c];
        this.legalMoves = this.engine.getLegalMoves(r, c);
        this._applyHighlights();
        return;
      }

      // Deselect
      this.selected = null; this.legalMoves = [];
      this._applyHighlights();
      return;
    }

    // Select a piece
    if (p?.c === this.engine.turn) {
      this.selected = [r, c];
      this.legalMoves = this.engine.getLegalMoves(r, c);
      this._applyHighlights();
    }
  }

  // ─── Execute a move ───────────────────────────────────────────────────────
  _executeMove(from, to, promo = null) {
    const snap = this.engine.makeMove(from, to, promo);
    if (!snap) return;

    this.selected = null;
    this.legalMoves = [];
    this.lastMove = { from, to };

    // Sound
    if (snap.move.castle) this.audio.castle();
    else if (snap.capturedPiece) this.audio.capture();
    else this.audio.move();

    if (this.engine.status === 'checkmate' || this.engine.isInCheck(this.engine.turn))
      setTimeout(() => this.audio.check(), 200);

    this.render();
    if (this.onMoveMade) this.onMoveMade(snap);
  }

  // ─── Promotion dialog ─────────────────────────────────────────────────────
  _showPromotion(color, callback) {
    const dialog = document.getElementById('promo-dialog');
    const opts = document.getElementById('promo-options');
    opts.innerHTML = '';
    for (const type of ['q', 'r', 'b', 'n']) {
      const btn = document.createElement('button');
      btn.className = 'promo-btn';
      btn.id = `promo-${type}`;
      btn.innerHTML = getPieceSVG(type, color);
      btn.title = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[type];
      btn.addEventListener('click', () => {
        dialog.style.display = 'none';
        callback(type);
      });
      opts.appendChild(btn);
    }
    dialog.style.display = 'flex';
  }

  // ─── Drag & drop ─────────────────────────────────────────────────────────
  _isDragging = false;
  _dragData = null;

  _initDrag() {
    window.addEventListener('mousemove', e => this._onDragMove(e));
    window.addEventListener('mouseup', e => this._onDragEnd(e));
  }

  _onDragStart(e) {
    if (e.button !== 0) return;
    const sq = e.currentTarget;
    const vr = parseInt(sq.dataset.row), vc = parseInt(sq.dataset.col);
    const [r, c] = this._boardCoord(vr, vc);
    const p = this.engine.board[r][c];
    if (!p || p.c !== this.engine.turn) return;

    e.preventDefault();

    // Select the square
    this.selected = [r, c];
    this.legalMoves = this.engine.getLegalMoves(r, c);
    this._applyHighlights();

    // Create ghost
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.innerHTML = getPieceSVG(p.t, p.c);
    document.body.appendChild(ghost);
    this.dragGhost = ghost;

    // Mark piece as dragging
    const pieceEl = sq.querySelector('.piece');
    if (pieceEl) pieceEl.classList.add('dragging');

    this._isDragging = true;
    this._dragData = { r, c, pieceEl };
    this._moveDragGhost(e.clientX, e.clientY);
  }

  _onDragMove(e) {
    if (!this._isDragging) return;
    this._moveDragGhost(e.clientX, e.clientY);
  }

  _moveDragGhost(x, y) {
    if (this.dragGhost) {
      this.dragGhost.style.left = x + 'px';
      this.dragGhost.style.top = y + 'px';
    }
  }

  _onDragEnd(e) {
    if (!this._isDragging) return;
    this._isDragging = false;

    // Remove ghost
    if (this.dragGhost) { this.dragGhost.remove(); this.dragGhost = null; }
    if (this._dragData?.pieceEl) this._dragData.pieceEl.classList.remove('dragging');

    // Find target square
    const els = document.elementsFromPoint(e.clientX, e.clientY);
    const sqEl = els.find(el => el.classList.contains('sq'));
    if (!sqEl) { this._dragData = null; return; }

    const vr = parseInt(sqEl.dataset.row), vc = parseInt(sqEl.dataset.col);
    const [tr, tc] = this._boardCoord(vr, vc);
    const { r, c } = this._dragData;
    this._dragData = null;

    if (tr === r && tc === c) return; // dropped on same square

    const move = this.legalMoves.find(m => m.to[0] === tr && m.to[1] === tc);
    if (!move) { this.selected = null; this.legalMoves = []; this._applyHighlights(); return; }

    const movingPiece = this.engine.board[r][c];
    if (movingPiece?.t === 'p' && (tr === 0 || tr === 7)) {
      this._showPromotion(movingPiece.c, promo => this._executeMove([r, c], [tr, tc], promo));
    } else {
      this._executeMove([r, c], [tr, tc]);
    }
  }

  // ─── Flip board ───────────────────────────────────────────────────────────
  flip() {
    this.flipped = !this.flipped;
    this.render();
    this._updateCoords();
  }

  // ─── Theme ───────────────────────────────────────────────────────────────
  setTheme(theme) {
    this.boardEl.className = `chess-board theme-${theme}`;
  }

  // ─── Move history display ─────────────────────────────────────────────────
  renderHistory() {
    const list = document.getElementById('move-list');
    list.innerHTML = '';
    const history = this.engine.history;

    for (let i = 0; i < history.length; i += 2) {
      const row = document.createElement('div');
      row.className = 'move-row';
      const num = document.createElement('span');
      num.className = 'move-num';
      num.textContent = (i / 2 + 1) + '.';

      const wMove = document.createElement('span');
      wMove.className = 'move-san' + (i === history.length - 1 ? ' active' : '');
      wMove.textContent = history[i].san;
      wMove.dataset.idx = i;
      wMove.addEventListener('click', () => this._jumpToMove(parseInt(wMove.dataset.idx)));

      row.appendChild(num); row.appendChild(wMove);

      if (history[i + 1]) {
        const bMove = document.createElement('span');
        bMove.className = 'move-san' + (i + 1 === history.length - 1 ? ' active' : '');
        bMove.textContent = history[i + 1].san;
        bMove.dataset.idx = i + 1;
        bMove.addEventListener('click', () => this._jumpToMove(parseInt(bMove.dataset.idx)));
        row.appendChild(bMove);
      }
      list.appendChild(row);
    }
    list.scrollTop = list.scrollHeight;
  }

  _jumpToMove(idx) {
    // Jump logic: undo/redo to reach that move index
    // Not implemented in this version (complex with AI games)
  }

  // ─── Captured pieces display ──────────────────────────────────────────────
  renderCaptured() {
    const pieceOrder = { q: 0, r: 1, b: 2, n: 3, p: 4 };
    const vals = ChessEngine.PIECE_VALUE;

    for (const [capturedBy, elId, advId] of [
      ['w', 'captured-bottom', 'adv-bottom'],
      ['b', 'captured-top',    'adv-top'],
    ]) {
      const el = document.getElementById(elId);
      const advEl = document.getElementById(advId);
      const pieces = [...this.engine.capturedPieces[capturedBy]];
      pieces.sort((a, b) => (pieceOrder[a.t] ?? 5) - (pieceOrder[b.t] ?? 5));
      el.innerHTML = pieces.map(p =>
        `<span class="cap-piece" title="${p.t}"><img src="${PIECE_IMAGES[p.c + p.t]}" style="width:20px;height:20px;object-fit:contain;vertical-align:middle;" /></span>`
      ).join('');

      const adv = this.engine.getMaterialAdvantage(capturedBy);
      advEl.textContent = adv > 0 ? `+${adv}` : '';
    }
  }
}
