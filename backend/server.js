require('dotenv').config();

const fs = require('fs');
const https = require('https');
const http = require('http');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { authMiddleware } = require('./src/middleware/authMiddleware');
const apiRoutes = require('./src/routes');
const { pool } = require('./src/utils/db');

if (process.env.NODE_ENV === 'production') {
  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).trim().length < 16) {
    console.error('Fatal: JWT_SECRET must be set and at least 16 characters in production.');
    process.exit(1);
  }
}

const corsOrigin = process.env.CORS_ORIGIN;
const corsOptions =
  process.env.NODE_ENV === 'production' && corsOrigin
    ? { origin: corsOrigin.split(',').map((s) => s.trim()).filter(Boolean) }
    : {};

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors(corsOptions));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "blob:", "https://cdnjs.cloudflare.com", "https://unpkg.com"],
        scriptSrcElem: ["'self'", "blob:", "https://cdnjs.cloudflare.com", "https://unpkg.com"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        styleSrcElem: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
        connectSrc: ["'self'"],
        workerSrc: ["'self'", "blob:"],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
  })
);
app.use(express.json());
app.use(morgan('dev'));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, try again later.' },
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests, try again later.' },
});
app.use('/api/teachers/login', loginLimiter);
app.use('/api', apiLimiter);

// Static frontend for teacher portal and admin dashboard
app.use(
  '/teacher',
  express.static(path.join(__dirname, '..', 'frontend', 'teacher-portal'))
);
app.use(
  '/admin',
  express.static(path.join(__dirname, '..', 'frontend', 'admin-dashboard'))
);

// Uploaded picker photos (gate comparison). Use UPLOADS_DIR for persistent disk on Render.
const { getPickersUploadsDir } = require('./src/utils/uploadsPath');
app.use('/uploads/pickers', express.static(getPickersUploadsDir()));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'School attendance backend running' });
});

// Public + protected API routes
app.use('/api', apiRoutes);

// Simple protected test route
app.get('/api/protected/ping', authMiddleware, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// Global error handler: never send stack to client; consistent shape
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  console.error('Unhandled error:', err);
  if (process.env.NODE_ENV === 'production') {
    res.status(status).json({ code: status, message: status >= 500 ? 'Internal server error' : message });
  } else {
    res.status(status).json({ code: status, message });
  }
});

const certDir = path.join(__dirname, 'cert');
const keyPath = process.env.SSL_KEY_PATH || path.join(certDir, 'key.pem');
const certPath = process.env.SSL_CERT_PATH || path.join(certDir, 'cert.pem');
const useHttps = fs.existsSync(keyPath) && fs.existsSync(certPath);

const server = useHttps
  ? https.createServer(
      {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      },
      app
    )
  : http.createServer(app);

const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  try {
    await pool.query('SELECT 1');
  } catch (e) {
    console.error('Fatal: Database unreachable.', e.message);
    process.exit(1);
  }
  server.listen(PORT, HOST, () => {
    const protocol = useHttps ? 'https' : 'http';
    console.log(`Server listening on ${protocol}://${HOST}:${PORT}`);
    if (!useHttps && process.env.NODE_ENV !== 'production') {
      console.log('Tip: run "node scripts/generate-cert.js" then restart for HTTPS (camera on other devices).');
    }
  });
}
start();

