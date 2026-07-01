const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const flash = require('connect-flash');
const methodOverride = require('method-override');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
require('dotenv').config();

const { loadUser } = require('./middleware/auth');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:', 'https://res.cloudinary.com'],
      connectSrc: ["'self'"],
    }
  }
}));

app.use(compression());

// Rate limiting - stricter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/auth/', authLimiter);
app.use('/api/', apiLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(methodOverride('_method'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration with PostgreSQL store
const sessionConfig = {
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'session',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 min
  }),
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production-immediately',
  resave: false,
  saveUninitialized: false,
  name: 'portal.sid',
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax',
  }
};

// Trust proxy for secure cookies behind Vercel/Render
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(session(sessionConfig));

// Flash messages
app.use(flash());

// Load user from session
app.use(loadUser);

// Global variables middleware
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.user || null;
  res.locals.currentYear = new Date().getFullYear();
  res.locals.moment = require('moment');
  next();
});

// EJS setup
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');

// Routes
app.use('/', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/notices', require('./routes/notices'));
app.use('/payments', require('./routes/payments'));
app.use('/expenses', require('./routes/expenses'));
app.use('/projects', require('./routes/projects'));
app.use('/schedule', require('./routes/schedule'));
app.use('/documents', require('./routes/documents'));
app.use('/accountant', require('./routes/accountant'));
app.use('/admin', require('./routes/admin'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(), 
    env: process.env.NODE_ENV,
    version: require('./package.json').version
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);

  // Handle specific error types
  if (err.code === 'P2002') {
    req.flash('error_msg', 'A record with this information already exists.');
    return res.redirect('back');
  }

  if (err.code === 'P2025') {
    req.flash('error_msg', 'Record not found.');
    return res.redirect('back');
  }

  res.status(500).render('error', { 
    title: 'Server Error', 
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong! Please try again.' : err.message 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Property Management Portal v2.0 running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
