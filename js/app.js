/**
 * APP — Entry point. Wires engine, AI, audio, and UI together.
 * Manages game setup, timers, game-over, and setup screen.
 */
class App {
  constructor() {
    this.engine  = new ChessEngine();
    this.ai      = new ChessAI('medium');
    this.audio   = new AudioEngine();
    this.ui      = new ChessUI(this.engine, this.audio);

    // Settings
    this.mode        = 'pvp';
    this.playerColor = 'w';
    this.difficulty  = 'medium';
    this.tcBase      = 0;   // base time in seconds (0 = no timer)
    this.tcInc       = 0;   // increment in seconds per move
    this.theme       = 'classic';

    // Timer state
    this.timers      = { w: 0, b: 0 };
    this.timerActive = false;
    this._timerInterval = null;

    this._bindSetup();
    this._bindGame();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SETUP SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  _bindSetup() {
    // Toggle groups
    this._makeToggle('mode-group', val => {
      this.mode = val;
      document.getElementById('ai-options').style.display = val === 'pva' ? '' : 'none';
    });
    this._makeToggle('color-group', val => this.playerColor = val);
    this._makeToggle('diff-group',  val => this.difficulty = val);
    this._bindTimeControl();

    // Theme swatches
    document.getElementById('theme-group').querySelectorAll('.theme-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.theme-swatch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.theme = btn.dataset.theme;
        this.ui.setTheme(this.theme);
      });
    });

    document.getElementById('start-btn').addEventListener('click', () => this._startGame());
  }

  _makeToggle(groupId, onChange) {
    document.getElementById(groupId).querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById(groupId).querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        onChange(btn.dataset.value);
      });
    });
  }

  _bindTimeControl() {
    // Category pill click — show correct preset group
    document.getElementById('tc-cat-group').querySelectorAll('.tc-cat').forEach(cat => {
      cat.addEventListener('click', () => {
        document.querySelectorAll('.tc-cat').forEach(c => c.classList.remove('active'));
        cat.classList.add('active');
        const selected = cat.dataset.cat;
        document.querySelectorAll('.tc-preset-group').forEach(g => {
          g.style.display = g.dataset.cat === selected ? 'flex' : 'none';
        });
        // Auto-select first preset in the group
        const group = document.querySelector(`.tc-preset-group[data-cat="${selected}"]`);
        if (group) {
          const first = group.querySelector('.tc-btn');
          if (first) {
            group.querySelectorAll('.tc-btn').forEach(b => b.classList.remove('active'));
            first.classList.add('active');
            this.tcBase = parseInt(first.dataset.base);
            this.tcInc  = parseInt(first.dataset.inc);
          }
        }
        // Custom: reset to no timer until user customizes
        if (selected === 'custom') { this.tcBase = 0; this.tcInc = 0; }
        if (selected === 'none')   { this.tcBase = 0; this.tcInc = 0; }
      });
    });

    // Preset button click
    document.getElementById('tc-presets').querySelectorAll('.tc-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Deselect all in same group
        btn.closest('.tc-preset-group').querySelectorAll('.tc-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.tcBase = parseInt(btn.dataset.base);
        this.tcInc  = parseInt(btn.dataset.inc);
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  START GAME
  // ══════════════════════════════════════════════════════════════════════════
  _startGame() {
    this.engine.reset();
    this.ui.lastMove = null;
    this.ui.selected = null;
    this.ui.legalMoves = [];
    this.ai.setDifficulty(this.difficulty);
    this.ui.setTheme(this.theme);

    // Flip board if human plays black
    if (this.mode === 'pva' && this.playerColor === 'b') {
      if (!this.ui.flipped) this.ui.flip();
    } else {
      if (this.ui.flipped) this.ui.flip();
    }

    // Timer setup — read custom fields if applicable
    this._stopTimer();
    let base = this.tcBase;
    if (document.querySelector('.tc-cat.active')?.dataset.cat === 'custom') {
      const mins = parseInt(document.getElementById('custom-minutes').value) || 5;
      const inc  = parseInt(document.getElementById('custom-increment').value) || 0;
      base        = mins * 60;
      this.tcInc  = inc;
      this.tcBase = base;
    }
    this.timers = { w: base, b: base };
    this._renderClocks();

    // Player labels
    if (this.mode === 'pvp') {
      document.getElementById('name-top').textContent    = 'Black';
      document.getElementById('avatar-top').textContent  = '♚';
      document.getElementById('name-bottom').textContent = 'White';
      document.getElementById('avatar-bottom').textContent = '♔';
    } else {
      const human = this.playerColor;
      const ai    = human === 'w' ? 'b' : 'w';
      const aiName = this.difficulty.charAt(0).toUpperCase() + this.difficulty.slice(1) + ' AI';
      if (human === 'w') {
        document.getElementById('name-bottom').textContent   = 'You (White)';
        document.getElementById('avatar-bottom').textContent = '♔';
        document.getElementById('name-top').textContent      = aiName;
        document.getElementById('avatar-top').textContent    = '♚';
      } else {
        document.getElementById('name-top').textContent      = 'You (Black)';
        document.getElementById('avatar-top').textContent    = '♚';
        document.getElementById('name-bottom').textContent   = aiName;
        document.getElementById('avatar-bottom').textContent = '♔';
      }
    }

    this.ui.render();
    this.ui.renderHistory();
    this.ui.renderCaptured();
    this._updateStatus();

    // Show game screen
    document.getElementById('setup-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    document.getElementById('gameover-dialog').style.display = 'none';

    // Start timer if needed
    if (this.tcBase > 0) this._startTimer();

    // Move callback
    this.ui.onMoveMade = snap => this._onMoveMade(snap);

    // If AI goes first (human plays black), trigger AI immediately
    if (this.mode === 'pva' && this.playerColor === 'b') {
      this._triggerAI();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MOVE CALLBACK
  // ══════════════════════════════════════════════════════════════════════════
  _onMoveMade(snap) {
    this.ui.renderHistory();
    this.ui.renderCaptured();
    this._updateStatus();
    this._updateTurnIndicator();

    // Add increment to the player who just moved
    if (this.tcInc > 0 && this.tcBase > 0) {
      this.timers[snap.turn] = Math.min(
        this.timers[snap.turn] + this.tcInc,
        this.tcBase + this.tcInc * 300 // reasonable cap
      );
      this._renderClocks();
    }

    if (this.engine.status !== 'playing') {
      this._stopTimer();
      this._showGameOver();
      this.audio.gameOver(this.engine.status === 'checkmate');
      return;
    }

    // AI turn — pause clock while AI thinks, restart after move
    if (this.mode === 'pva' && this.engine.turn !== this.playerColor) {
      this._stopTimer();                           // pause player clock
      this.ui.boardEl.style.pointerEvents = 'none';
      this._setStatus('AI is thinking…');
      this.ai.think(this.engine, this.engine.turn, move => {
        if (!move) {
          this.ui.boardEl.style.pointerEvents = '';
          if (this.tcBase > 0) this._startTimer(); // resume if AI couldn't move
          return;
        }
        const result = this.engine.makeMove(move.from, move.to, move.promo || 'q');
        if (result) {
          this.ui.lastMove = { from: move.from, to: move.to };
          if (result.move.castle) this.audio.castle();
          else if (result.capturedPiece) this.audio.capture();
          else this.audio.move();
          if (this.engine.status === 'checkmate' || this.engine.isInCheck(this.engine.turn))
            setTimeout(() => this.audio.check(), 200);
          this.ui.selected = null;
          this.ui.legalMoves = [];
          this.ui.render();
          this.ui.renderHistory();
          this.ui.renderCaptured();
          this._updateStatus();
          this._updateTurnIndicator();
          if (this.engine.status !== 'playing') {
            this._showGameOver();
            this.audio.gameOver(this.engine.status === 'checkmate');
          } else if (this.tcBase > 0) {
            this._startTimer();                    // resume player's clock
          }
        }
        this.ui.boardEl.style.pointerEvents = '';
      });
    }
  }

  _triggerAI() {
    this._stopTimer();                             // pause clock while AI thinks
    this.ui.boardEl.style.pointerEvents = 'none';
    this._setStatus('AI is thinking…');
    this.ai.think(this.engine, this.engine.turn, move => {
      if (!move) {
        this.ui.boardEl.style.pointerEvents = '';
        if (this.tcBase > 0) this._startTimer();
        return;
      }
      const result = this.engine.makeMove(move.from, move.to, move.promo || 'q');
      if (result) {
        this.ui.lastMove = { from: move.from, to: move.to };
        if (result.move.castle) this.audio.castle();
        else if (result.capturedPiece) this.audio.capture();
        else this.audio.move();
        this.ui.selected = null;
        this.ui.legalMoves = [];
        this.ui.render();
        this.ui.renderHistory();
        this.ui.renderCaptured();
        this._updateStatus();
        this._updateTurnIndicator();
        if (this.engine.status !== 'playing') {
          this._showGameOver();
          this.audio.gameOver(this.engine.status === 'checkmate');
        } else if (this.tcBase > 0) {
          this._startTimer();                      // start player's clock
        }
      }
      this.ui.boardEl.style.pointerEvents = '';
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  STATUS & CLOCKS
  // ══════════════════════════════════════════════════════════════════════════
  _updateStatus() {
    const { status, turn, winner } = this.engine;
    const color = { w: 'White', b: 'Black' };
    const statusEl = document.getElementById('status-text');
    statusEl.className = '';

    if (status === 'playing') {
      const inCheck = this.engine.isInCheck(turn);
      const msg = inCheck
        ? `${color[turn]} is in check!`
        : `${color[turn]} to move`;
      statusEl.textContent = msg;
      if (inCheck) statusEl.className = 'check';
    } else if (status === 'checkmate') {
      statusEl.textContent = `Checkmate! ${color[winner]} wins!`;
      statusEl.className = 'over';
    } else if (status === 'stalemate') {
      statusEl.textContent = 'Stalemate — Draw!';
      statusEl.className = 'over';
    } else {
      statusEl.textContent = 'Draw!';
      statusEl.className = 'over';
    }
  }

  _setStatus(msg) {
    document.getElementById('status-text').textContent = msg;
  }

  _updateTurnIndicator() {
    const turn = this.engine.turn;
    const topIsBlack = !this.ui.flipped;
    const topActive  = topIsBlack ? turn === 'b' : turn === 'w';

    document.getElementById('player-top').classList.toggle('active-turn', topActive);
    document.getElementById('player-bottom').classList.toggle('active-turn', !topActive);

    // Highlight the running clock
    document.getElementById('clock-top').classList.toggle('active-clock', topActive && this.timeControl !== 'none');
    document.getElementById('clock-bottom').classList.toggle('active-clock', !topActive && this.timeControl !== 'none');
  }

  // ── Timer ─────────────────────────────────────────────────────────────────
  _startTimer() {
    if (this._timerInterval) clearInterval(this._timerInterval);
    this.timerActive = true;
    this._timerInterval = setInterval(() => {
      if (!this.timerActive || this.engine.status !== 'playing') return;
      const t = this.engine.turn;
      this.timers[t] = Math.max(0, this.timers[t] - 1);
      this._renderClocks();
      if (this.timers[t] === 0) {
        this._stopTimer();
        this.engine.status = 'checkmate';
        this.engine.winner = t === 'w' ? 'b' : 'w';
        this._updateStatus();
        this._showGameOver();
        this.audio.gameOver(false);
      }
    }, 1000);
  }

  _stopTimer() {
    this.timerActive = false;
    if (this._timerInterval) { clearInterval(this._timerInterval); this._timerInterval = null; }
  }

  _renderClocks() {
    const fmt = s => {
      const m = Math.floor(s / 60), sec = s % 60;
      return `${m}:${String(sec).padStart(2, '0')}`;
    };
    const topColor = this.ui.flipped ? 'w' : 'b';
    const botColor = this.ui.flipped ? 'b' : 'w';
    const noTimer  = this.tcBase === 0;

    const topEl = document.getElementById('clock-top');
    const botEl = document.getElementById('clock-bottom');

    if (noTimer) {
      topEl.textContent = '—';
      botEl.textContent = '—';
      topEl.classList.remove('low', 'active-clock');
      botEl.classList.remove('low', 'active-clock');
      return;
    }

    topEl.textContent = fmt(this.timers[topColor]);
    botEl.textContent = fmt(this.timers[botColor]);
    topEl.classList.toggle('low', this.timers[topColor] < 30);
    botEl.classList.toggle('low', this.timers[botColor] < 30);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  GAME OVER DIALOG
  // ══════════════════════════════════════════════════════════════════════════
  _showGameOver() {
    const { status, winner } = this.engine;
    const iconEl    = document.getElementById('gameover-icon');
    const titleEl   = document.getElementById('gameover-title');
    const subtitleEl = document.getElementById('gameover-subtitle');

    if (status === 'checkmate') {
      const color = winner === 'w' ? 'White' : 'Black';
      iconEl.textContent    = '🏆';
      titleEl.textContent   = 'Checkmate!';
      subtitleEl.textContent = `${color} wins`;
    } else if (status === 'stalemate') {
      iconEl.textContent    = '🤝';
      titleEl.textContent   = 'Stalemate';
      subtitleEl.textContent = 'It\'s a draw!';
    } else {
      iconEl.textContent    = '🤝';
      titleEl.textContent   = 'Draw';
      subtitleEl.textContent = 'Game over';
    }

    setTimeout(() => {
      document.getElementById('gameover-dialog').style.display = 'flex';
    }, 800);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  GAME CONTROLS
  // ══════════════════════════════════════════════════════════════════════════
  _bindGame() {
    document.getElementById('btn-undo').addEventListener('click', () => this._undo());
    document.getElementById('btn-redo').addEventListener('click', () => this._redo());
    document.getElementById('btn-flip').addEventListener('click', () => {
      this.ui.flip();
      this._updateTurnIndicator();
    });
    document.getElementById('btn-resign').addEventListener('click', () => {
      if (this.engine.status !== 'playing') return;
      if (!confirm('Resign this game?')) return;
      this._stopTimer();
      this.engine.status = 'checkmate';
      this.engine.winner = this.engine.turn === 'w' ? 'b' : 'w';
      this._updateStatus();
      this._showGameOver();
      this.audio.gameOver(false);
    });
    document.getElementById('btn-new').addEventListener('click', () => {
      this._stopTimer();
      document.getElementById('game-screen').classList.remove('active');
      document.getElementById('setup-screen').classList.add('active');
    });
    document.getElementById('btn-rematch').addEventListener('click', () => {
      document.getElementById('gameover-dialog').style.display = 'none';
      this._startGame();
    });
    document.getElementById('btn-menu').addEventListener('click', () => {
      this._stopTimer();
      document.getElementById('gameover-dialog').style.display = 'none';
      document.getElementById('game-screen').classList.remove('active');
      document.getElementById('setup-screen').classList.add('active');
    });
    document.getElementById('btn-sound').addEventListener('click', () => {
      const on = this.audio.toggle();
      document.getElementById('btn-sound').textContent = on ? '🔊' : '🔇';
    });
  }

  _undo() {
    if (this.engine.status !== 'playing' && this.engine.status !== 'checkmate') return;
    // In PvA, undo two moves (player + AI)
    const steps = (this.mode === 'pva') ? 2 : 1;
    let undone = 0;
    for (let i = 0; i < steps; i++) {
      if (this.engine.undo()) undone++;
    }
    if (!undone) return;
    this.engine.status = 'playing';
    this.engine.winner = null;
    this.ui.selected = null;
    this.ui.legalMoves = [];
    const last = this.engine.history[this.engine.history.length - 1];
    this.ui.lastMove = last ? { from: last.move.from, to: last.move.to } : null;
    this.ui.render();
    this.ui.renderHistory();
    this.ui.renderCaptured();
    this._updateStatus();
    this._updateTurnIndicator();
  }

  _redo() {
    if (this.engine.redoStack.length === 0) return;
    const steps = (this.mode === 'pva') ? 2 : 1;
    for (let i = 0; i < steps; i++) {
      if (!this.engine.redoStack.length) break;
      const snap = this.engine.redoStack[this.engine.redoStack.length - 1];
      this.engine.makeMove(snap.move.from, snap.move.to, snap.move.promo || null);
    }
    this.ui.selected = null;
    this.ui.legalMoves = [];
    const last = this.engine.history[this.engine.history.length - 1];
    this.ui.lastMove = last ? { from: last.move.from, to: last.move.to } : null;
    this.ui.render();
    this.ui.renderHistory();
    this.ui.renderCaptured();
    this._updateStatus();
    this._updateTurnIndicator();
  }
}

// ── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
