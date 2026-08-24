const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const env = require('./config/env');
const { errorHandler } = require('./middleware/errorHandler');
const { apiLimiter, exportLimiter } = require('./middleware/rateLimiter');
const sanitize = require('./middleware/sanitize');

const app = express();

// Trust reverse proxy (Render, Railway, Nginx, etc.)
// Ensures req.ip returns the real client IP from X-Forwarded-For headers
app.set('trust proxy', 1);

// 0. HTTP Response Compression (Gzip / Deflate / Brotli)
app.use(compression({
  threshold: 1024, // only compress responses larger than 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

// 1. Comprehensive HTTP Security Headers via Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Needed for inline dynamic label/print template triggers
        'https://cdn.jsdelivr.net',
        'https://unpkg.com',
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
      ],
      fontSrc: [
        "'self'",
        'https://fonts.gstatic.com',
      ],
      imgSrc: [
        "'self'",
        'data:',
        'blob:',
        'https:',
        'http:',
      ],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for WebRTC camera stream
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  } : false,
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// 2. Restrictive CORS
const allowedOrigins = env.FRONTEND_ORIGIN.split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, same-origin, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*') || env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS policy: Origin not allowed.'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
}));

// 3. Request logging (never logs passwords or authorization headers)
app.use(morgan('combined', {
  skip: (req) => req.url === '/api/health',
}));

// 4. Safe Body Parsing (Limited to 1MB to prevent buffer exhaustion)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 5. NoSQL Injection Query/Body Sanitization
app.use(sanitize);

// 6. Serve local uploads fallback and static frontend files with caching
app.use('/uploads', express.static(path.join(__dirname, '../../uploads'), {
  dotfiles: 'ignore',
  index: false,
  maxAge: '1d',
}));
app.use(express.static(path.join(__dirname, '../../client'), {
  maxAge: env.NODE_ENV === 'production' ? '1d' : '0',
  etag: true,
  lastModified: true,
}));

// Health check (lightweight, unauthenticated)
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'MATIX API is operational', timestamp: new Date().toISOString() });
});

// --- API Routes & Rate Limiting ---
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const projectAssignmentRoutes = require('./routes/projectAssignmentRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const warehouseRoutes = require('./routes/warehouseRoutes');
const itemRoutes = require('./routes/itemRoutes');
const barcodeRoutes = require('./routes/barcodeRoutes');
const projectRoutes = require('./routes/projectRoutes');
const requestRoutes = require('./routes/requestRoutes');
const movementRoutes = require('./routes/movementRoutes');
const transferRoutes = require('./routes/transferRoutes');
const returnRoutes = require('./routes/returnRoutes');
const attachmentRoutes = require('./routes/attachmentRoutes');
const documentRoutes = require('./routes/documentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const idempotency = require('./middleware/idempotency');

// Export rate limiter for heavy operations
app.use('/api/reports/export', exportLimiter);

// General API rate limiter across all other /api routes
app.use('/api', apiLimiter);

// Idempotency protection for creation requests
app.use('/api', idempotency);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/project-assignments', projectAssignmentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/barcodes', barcodeRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/movements', movementRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/notifications', notificationRoutes);

// Standalone marketing landing page route
app.get(['/landing', '/landing/', '/landing.html'], (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/landing/index.html'));
});

// SPA fallback — serve index.html for any non-API route
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../../client/index.html'));
  } else {
    res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'API endpoint not found' });
  }
});

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
