const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

// Serve static files
app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Active rooms: code → { white, black, tcBase, tcInc }
const rooms = {};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

io.on('connection', socket => {
  console.log('+ connected:', socket.id);

  // ── Create Room ──────────────────────────────────────────────────────────
  socket.on('create-room', ({ tcBase, tcInc }) => {
    // Clean up any old room this socket was in
    if (socket.roomCode) {
      socket.to(socket.roomCode).emit('opponent-disconnected');
      delete rooms[socket.roomCode];
    }

    let code;
    do { code = generateCode(); } while (rooms[code]);

    rooms[code] = { white: socket.id, black: null, tcBase: tcBase || 0, tcInc: tcInc || 0 };
    socket.join(code);
    socket.roomCode = code;
    socket.color    = 'w';
    socket.emit('room-created', { code });
    console.log('Room created:', code);
  });

  // ── Join Room ─────────────────────────────────────────────────────────────
  socket.on('join-room', ({ code }) => {
    const key  = (code || '').toUpperCase().trim();
    const room = rooms[key];
    if (!room)       return socket.emit('join-error', 'Room not found. Check the code.');
    if (room.black)  return socket.emit('join-error', 'Room is full — game already started.');

    // Clean up old room
    if (socket.roomCode) {
      socket.to(socket.roomCode).emit('opponent-disconnected');
      delete rooms[socket.roomCode];
    }

    room.black   = socket.id;
    socket.join(key);
    socket.roomCode = key;
    socket.color    = 'b';

    // Notify both players to start
    const config = { tcBase: room.tcBase, tcInc: room.tcInc };
    io.to(key).emit('game-start', config);
    // Tell each player their color
    socket.emit('your-color', 'b');
    socket.to(key).emit('your-color', 'w');
    console.log('Game started:', key);
  });

  // ── Move relay ───────────────────────────────────────────────────────────
  socket.on('move', ({ from, to, promo }) => {
    if (socket.roomCode) socket.to(socket.roomCode).emit('move', { from, to, promo });
  });

  // ── Resign ───────────────────────────────────────────────────────────────
  socket.on('resign', () => {
    if (socket.roomCode) {
      socket.to(socket.roomCode).emit('opponent-resigned');
      delete rooms[socket.roomCode];
    }
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log('- disconnected:', socket.id);
    if (socket.roomCode && rooms[socket.roomCode]) {
      socket.to(socket.roomCode).emit('opponent-disconnected');
      delete rooms[socket.roomCode];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Chess server → http://localhost:${PORT}`));
