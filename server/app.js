const express       = require('express');
const mongoose      = require('mongoose');
const cors          = require('cors');
const helmet        = require('helmet');
const mongoSanitize = require('mongo-sanitize');
const rateLimit     = require('express-rate-limit');
const path          = require('path');
require('dotenv').config();

const app = express();

// ─── Security Headers ───
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com", "fonts.googleapis.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdnjs.cloudflare.com", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"]
    }
  }
}));

// ─── CORS (not wildcard) ───
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// ─── Body parsing ───
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── MongoDB Injection Prevention ───
app.use((req, res, next) => {
  if (req.body)   req.body   = mongoSanitize(req.body);
  if (req.query)  req.query  = mongoSanitize(req.query);
  if (req.params) req.params = mongoSanitize(req.params);
  next();
});

// ─── General Rate Limiting ───
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'طلبات كثيرة جداً، يرجى المحاولة لاحقاً' }
});
app.use('/api/', generalLimiter);

const { authenticateToken } = require('./middleware/auth');
const { injectStationFilter } = require('./middleware/stationFilter');

app.use(express.static(path.join(__dirname, '../client')));

// ─── Clean URLs ───
const client = path.join(__dirname, '../client');
app.get('/',               (req, res) => res.sendFile(path.join(client, 'index.html')));
app.get('/login',          (req, res) => res.sendFile(path.join(client, 'login.html')));
app.get('/import',         (req, res) => res.sendFile(path.join(client, 'import.html')));
app.get('/returns',        (req, res) => res.sendFile(path.join(client, 'returns.html')));
app.get('/expenses',       (req, res) => res.sendFile(path.join(client, 'expenses.html')));
app.get('/search',       (req, res) => res.sendFile(path.join(client, 'search.html')));
app.get('/edit',         (req, res) => res.sendFile(path.join(client, 'edit.html')));
app.get('/drivers',       (req, res) => res.sendFile(path.join(client, 'drivers.html')));
app.get('/all-closings',  (req, res) => res.sendFile(path.join(client, 'all-closings.html')));
app.get('/closing',        (req, res) => res.sendFile(path.join(client, 'closing.html')));
app.get('/history',        (req, res) => res.sendFile(path.join(client, 'history.html')));
app.get('/admin',          (req, res) => res.sendFile(path.join(client, 'admin/index.html')));
app.get('/admin/login',    (req, res) => res.sendFile(path.join(client, 'admin/login.html')));
app.get('/admin/stations', (req, res) => res.sendFile(path.join(client, 'admin/stations.html')));
app.get('/admin/users',    (req, res) => res.sendFile(path.join(client, 'admin/users.html')));

// ─── MongoDB Connection ───
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ecomanager';

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  retryWrites: true
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// Routes عامة
app.use('/api/auth', require('./routes/auth'));

// Routes محمية
app.use('/api/parcels',      authenticateToken, injectStationFilter, require('./routes/parcels'));
app.use('/api/cash',         authenticateToken, injectStationFilter, require('./routes/cash'));
app.use('/api/expenses',     authenticateToken, injectStationFilter, require('./routes/expenses'));
app.use('/api/closings',     authenticateToken, injectStationFilter, require('./routes/closings'));
app.use('/api/upload',       authenticateToken, injectStationFilter, require('./routes/upload'));
app.use('/api/returns',      authenticateToken, injectStationFilter, require('./routes/returns'));
app.use('/api/moneybox',     authenticateToken, injectStationFilter, require('./routes/moneybox'));
app.use('/api/drivers',      authenticateToken, injectStationFilter, require('./routes/drivers'));
app.use('/api/all-closings', authenticateToken, injectStationFilter, require('./routes/allClosings'));
app.use('/api/superadmin',   require('./routes/superadmin'));

// 404 handler for API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'المسار غير موجود: ' + req.originalUrl });
  }
  next();
});

// ─── Global Error Handler ───
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: 'خطأ في الخادم' });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on http://localhost:' + PORT);
});

// ─── Process Error Handlers ───
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// ─── Graceful Shutdown ───
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
});