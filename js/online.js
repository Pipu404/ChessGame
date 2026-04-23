/**
 * OnlineManager — client-side Socket.io wrapper.
 * Handles connecting to server, room creation/joining, move sending/receiving.
 */
class OnlineManager {
  constructor() {
    this.socket   = null;
    this.color    = null;  // 'w' or 'b' — assigned by server
    this.roomCode = null;

    // Callbacks — set by app.js before connecting
    this.onRoomCreated          = null;
    this.onGameStart            = null;
    this.onColorAssigned        = null;
    this.onOpponentMove         = null;
    this.onOpponentDisconnected = null;
    this.onOpponentResigned     = null;
    this.onJoinError            = null;
  }

  connect() {
    if (this.socket && this.socket.connected) return;
    // io() connects to the same server that served the page
    this.socket = io();

    this.socket.on('room-created', ({ code }) => {
      this.roomCode = code;
      if (this.onRoomCreated) this.onRoomCreated(code);
    });

    this.socket.on('your-color', color => {
      this.color = color;
      if (this.onColorAssigned) this.onColorAssigned(color);
    });

    this.socket.on('game-start', ({ tcBase, tcInc }) => {
      if (this.onGameStart) this.onGameStart({ tcBase, tcInc });
    });

    this.socket.on('move', ({ from, to, promo }) => {
      if (this.onOpponentMove) this.onOpponentMove({ from, to, promo });
    });

    this.socket.on('opponent-disconnected', () => {
      if (this.onOpponentDisconnected) this.onOpponentDisconnected();
    });

    this.socket.on('opponent-resigned', () => {
      if (this.onOpponentResigned) this.onOpponentResigned();
    });

    this.socket.on('join-error', msg => {
      if (this.onJoinError) this.onJoinError(msg);
    });
  }

  createRoom(tcBase, tcInc) {
    this.connect();
    this.socket.emit('create-room', { tcBase, tcInc });
  }

  joinRoom(code) {
    this.connect();
    this.socket.emit('join-room', { code });
  }

  sendMove(from, to, promo) {
    if (this.socket) this.socket.emit('move', { from, to, promo: promo || null });
  }

  resign() {
    if (this.socket) this.socket.emit('resign');
  }

  disconnect() {
    if (this.socket) { this.socket.disconnect(); this.socket = null; }
    this.color = null;
    this.roomCode = null;
  }
}
