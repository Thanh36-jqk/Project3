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
const rabbitmqService = require('./src/services/rabbitmqService');
const { sendEmail } = require('./src/services/emailService');
const rabbitmqConfig = require('./src/config/rabbitmq');

// Import routes
const routes = require('./src/routes');

// Import middleware
const errorHandler = require('./src/middleware/errorHandler');
const { apiLimiter } = require('./src/middleware/rateLimiter');

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
        // Allow requests with no origin (same-origin, Postman, server-to-server)
        if (!origin || allowedOrigins.includes(origin)) {
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
app.use(session({
    secret: process.env.SESSION_SECRET || 'apple_store_secret_key',
    resave: false,
    saveUninitialized: false,           // Changed: don't save empty sessions
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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

// Initialize RabbitMQ Consumer for emails
rabbitmqService.consumeFromQueue(rabbitmqConfig.queues.EMAIL_QUEUE, async (data) => {
    try {
        await sendEmail(data);
        logger.info(`Email sent successfully via RabbitMQ queue to ${data.to}`);
    } catch (error) {
        logger.error(`Error sending email via RabbitMQ queue: ${error.message}`);
        throw error; // Let consumer handle failure if needed
    }
});

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