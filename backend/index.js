// index.js
require('dotenv').config();
const path = require('path');
const app = require('./src/app');
const { createServer } = require('http');
const { Server } = require('socket.io');
const downloadManager = require('./src/services/downloadManager');

const PORT = process.env.PORT || 3001;

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000", "https://daedulus.dahuchsi.net"],
    credentials: true
  }
});

// Make io accessible to routes
app.set('io', io);
downloadManager.setSocketIO(io);

// --- Socket.io Events ---
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join:user', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  socket.on('join:admin', () => {
    socket.join('admin');
    console.log('Admin joined admin room');
  });

  socket.on('typing:start', (data) => {
    socket.to(`user_${data.recipientId}`).emit('typing:start', {
      userId: data.userId,
      username: data.username
    });
  });

  socket.on('typing:stop', (data) => {
    socket.to(`user_${data.recipientId}`).emit('typing:stop', {
      userId: data.userId,
      username: data.username
    });
  });

  socket.on('join:downloads', (userId) => {
    socket.join(`downloads_${userId}`);
    console.log(`User ${userId} joined downloads room for real-time updates`);
  });

  socket.on('admin:broadcast', (data) => {
    if (data.isAdmin) {
      io.emit('broadcast:message', {
        from: 'Dahuchsi',
        content: data.message,
        timestamp: new Date()
      });
      console.log('Admin broadcast sent:', data.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  socket.on('user:online', (userId) => {
    socket.broadcast.emit('user:status', { userId, status: 'online' });
  });

  socket.on('user:offline', (userId) => {
    socket.broadcast.emit('user:status', { userId, status: 'offline' });
  });
});

// --- WebSocket Health Check ---
const checkSocketHealth = () => {
  const connectedSockets = io.engine.clientsCount;
  console.log(`WebSocket Health: ${connectedSockets} clients connected`);
};
setInterval(checkSocketHealth, 5 * 60 * 1000);

io.engine.on('connection_error', (err) => {
  console.error('Socket.io connection error:', err.req);
  console.error('Error code:', err.code);
  console.error('Error message:', err.message);
  console.error('Error context:', err.context);
});

// --- Graceful Shutdown ---
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('HTTP server closed');
    downloadManager.cleanup();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('HTTP server closed');
    downloadManager.cleanup();
    process.exit(0);
  });
});

// --- Start Server ---
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for real-time features`);
  console.log(`💾 Static files served from /uploads`);
  console.log(`🔒 Security headers configured with CSP`);
  
  // Initial socket health check
  setTimeout(checkSocketHealth, 1000);
});