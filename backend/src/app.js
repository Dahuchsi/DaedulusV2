// app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// --- Middleware ---
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "https://static.cloudflareinsights.com"],
        "connect-src": ["'self'", "http://localhost:3001", "https://daedulus.dahuchsi.net", "ws:", "wss:"],
        "img-src": ["'self'", "data:", "blob:", "http://localhost:3001", "https://daedulus.dahuchsi.net"],
        "media-src": ["'self'", "http://localhost:3001", "https://daedulus.dahuchsi.net"],
      },
    },
  })
);

app.use(cors({
  origin: ["http://localhost:3000", "https://daedulus.dahuchsi.net"],
  credentials: true
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- Static Asset Routes ---
app.use(express.static(path.join(__dirname, '../../frontend/build')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- API Routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/search', require('./routes/search'));
app.use('/api/downloads', require('./routes/download'));
app.use('/api/messages', require('./routes/message'));
app.use('/api/profile', require('./routes/user'));
app.use('/api/requests', require('./routes/request'));
app.use('/api/admin', require('./routes/admin'));

// --- Frontend Catch-all ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/build', 'index.html'));
});

// --- Final Error Handler ---
app.use(errorHandler);

module.exports = app;