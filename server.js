// ==================================================================
// Apple Store E-commerce API Server
// ==================================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const morgan = require('morgan');
const compression = require('compression');
const logger = require('./src/config/logger');

// Import configurations
const connectDatabase = require('./src/config/database');
const configurePassport = require('./src/config/passport');
const { initializeGemini } = require('./src/config/gemini');

// Import routes
const routes = require('./src/routes');

// Import middleware
const errorHandler = require('./src/middleware/errorHandler');
const { apiLimiter } = require('./src/middleware/rateLimiter');

// ==================================================================
// Startup Environment Validation
// ==================================================================
const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL', 'MONGODB_URI'];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length) {
    console.error('FATAL: Missing required environment variables:', missingEnv.join(', '));
    process.exit(1);
}
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.error('FATAL: JWT_SECRET is too weak (minimum 32 characters required)');
    process.exit(1);
}

// ==================================================================
// Initialize Express App
// ==================================================================
const app = express();
const PORT = process.env.PORT || 3000;

// ==================================================================
// Security Middleware
// ==================================================================

// Trust proxy for deployment platforms (Vercel, Render, etc.)
app.set('trust proxy', 1);

// Helmet: Set security HTTP headers (XSS, clickjacking, MIME sniffing protection)
app.use(helmet({
    contentSecurityPolicy: false,       // Disabled for CDN scripts (Tailwind, FontAwesome, Three.js)
    crossOriginEmbedderPolicy: false    // Allow loading external resources
}));

// CORS: Restrict allowed origins in production
const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://project3-icy1.onrender.com',
    'https://project3-alpha-eight.vercel.app',
    'https://applevnuis.vercel.app',
    'http://localhost:3000'
];
app.use(cors({
    origin: function (origin, callback) {
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,                  // Allow cookies (refresh tokens)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'token']  // Support both auth headers
}));

// ==================================================================
// Body Parsing, Cookies & Compression
// ==================================================================
app.use(compression());  // Gzip all responses
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// HTTP Request Logging (Morgan -> Winston)
app.use(morgan('short', {
    stream: { write: (msg) => logger.info(msg.trim()) }
}));

// Global rate limiter for all API routes (100 requests/min/IP)
app.use('/api', apiLimiter);

// ==================================================================
// Session Configuration (for Passport OAuth)
// ==================================================================
// Warn loudly if SESSION_SECRET is missing — generate a random one as fallback
// so sessions work, but they'll be invalidated on every restart.
if (!process.env.SESSION_SECRET) {
    logger.warn('SESSION_SECRET not set — generating a random secret. Sessions will not survive server restarts.');
}
const sessionSecret = process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex');

app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,           // Changed: don't save empty sessions
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Passport authentication
app.use(passport.initialize());
app.use(passport.session());

// ==================================================================
// Static Files Configuration
// ==================================================================
app.use('/images', express.static(path.join(__dirname, 'public/assets/images')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
app.use(express.static(path.join(__dirname, 'public')));

// ==================================================================
// Initialize Services
// ==================================================================
connectDatabase();
configurePassport();
initializeGemini();

// ==================================================================
// API Routes
// ==================================================================
app.use('/', routes);

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint (for Render, UptimeRobot, etc.)
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Temporary DB diagnostics — shows host only, never exposes credentials
app.get('/api/db-check', async (req, res) => {
    const prisma = require('./src/config/postgres');
    const rawUrl = process.env.DATABASE_URL || '';
    let host = '(DATABASE_URL not set)';
    try {
        const match = rawUrl.match(/@([^/?]+)/);
        if (match) host = match[1];
    } catch (_) {}
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ db: 'connected', host });
    } catch (err) {
        res.status(500).json({ db: 'failed', host, error: err.message });
    }
});

// ==================================================================
// Error Handling
// ==================================================================
app.use(errorHandler);

// ==================================================================
// Start Server
// ==================================================================
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`Access at: http://localhost:${PORT}`);
        logger.info(`Helmet: enabled | CORS: restricted | Rate Limiting: active`);
    });
}

// Export the app for Vercel Serverless Functions
module.exports = app;