/**
 * DropBeam — server.js
 * Express + Socket.io backend for file transfer
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const fileRoutes = require('./routes/file.js');
const { cleanupExpiredFiles } = require('./fileController');

const app = express();
const server = http.createServer(app);
app.set('trust proxy', 1);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || '*', methods: ['GET', 'POST'], credentials: true }
});

// ---- Config ----
const PORT = process.env.PORT || 3000;
const ENV = process.env.NODE_ENV || 'development';

// ---- Middleware ----
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting — 60 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests. Please slow down.' }
});
app.use('/upload', limiter);
app.use('/download', limiter);

// Serve static client files
app.use(express.static(path.join(__dirname, '../client')));

// ---- Routes ----
app.use('/', fileRoutes(io));

// ---- Catch-all: serve index.html for SPA ----
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ---- Global error handler ----
app.use((err, req, res, next) => {
  console.error('[DropBeam Error]', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ---- Socket.io ----
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on('subscribe:code', (code) => {
    socket.join(`room:${code}`);
    console.log(`[Socket] ${socket.id} subscribed to code room: ${code}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// ---- Auto-cleanup expired files every 5 minutes ----
setInterval(cleanupExpiredFiles, 5 * 60 * 1000);

// Graceful shutdown
function shutdown() {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
  // force exit after 10s
  setTimeout(() => process.exit(1), 10000);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ---- Start ----
server.listen(PORT, () => {
  console.log(`\n🚀 DropBeam running on http://localhost:${PORT}`);
  console.log(`   Environment : ${ENV}`);
  console.log(`   Uploads dir : ${path.join(__dirname, 'uploads')}\n`);
});

module.exports = { app, io };
