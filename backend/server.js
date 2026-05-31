const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // Expo Go connects from a LAN IP, so allow all origins in dev
    methods: ['GET', 'POST'],
  },
});

// Track connected users: socketId → { name, language }
const users = new Map();

// Simple health-check so you can confirm the server is up in a browser
app.get('/', (_req, res) => {
  res.send(`BoloBolo server running. Online: ${users.size}`);
});

io.on('connection', (socket) => {
  // ── user:join ──────────────────────────────────────────────────────────
  // Client sends { name, language } when user presses "Join"
  socket.on('user:join', ({ name, language }) => {
    users.set(socket.id, { name, language });

    // Put everyone in the same default room so broadcast targets are simple
    socket.join('global');

    // Tell the joining client AND everyone else a new user arrived
    io.to('global').emit('user:joined', {
      name,
      onlineCount: users.size,
    });
  });

  // ── message:send ───────────────────────────────────────────────────────
  // Client sends { text, sourceLang, room }
  // Server relays as-is; translation happens on the receiver's device
  socket.on('message:send', ({ text, sourceLang, room }) => {
    const sender = users.get(socket.id);
    if (!sender) return; // guard: ignore messages from un-joined sockets

    const target = room || 'global';

    io.to(target).emit('message:receive', {
      senderId: socket.id,
      senderName: sender.name,
      text,
      sourceLang,
      timestamp: new Date().toISOString(),
    });
  });

  // ── user:typing ────────────────────────────────────────────────────────
  // Client sends { name }; forward to everyone else in the room
  socket.on('user:typing', ({ name }) => {
    // broadcast excludes the sender so the typist doesn't see their own indicator
    socket.to('global').emit('user:typing', { name });
  });

  // ── disconnect ─────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (!user) return;

    users.delete(socket.id);

    io.to('global').emit('user:left', {
      name: user.name,
      onlineCount: users.size,
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`BoloBolo server listening on port ${PORT}`);
});
