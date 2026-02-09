// ==================================================================
// Apple Store E-commerce API Server
// ==================================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const path = require('path');

// Import configurations
const connectDatabase = require('./src/config/database');
const configurePassport = require('./src/config/passport');
const { initializeGemini } = require('./src/config/gemini');

// Import routes
const routes = require('./src/routes');

// Import middleware
const errorHandler = require('./src/middleware/errorHandler');

// ==================================================================
// Initialize Express App
// ==================================================================
const app = express();
const PORT = process.env.PORT || 3000;

// ==================================================================
// Middleware Configuration
// ==================================================================

// Trust proxy for deployment platforms (Vercel, Render, etc.)
app.set('trust proxy', 1);

// Middleware: Body parsing
app.use(cors());
app.use(express.json());

// Middleware: Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'apple_store_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',  // HTTPS in production
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000  // 24 hours
    }
}));

// Middleware: Passport authentication
app.use(passport.initialize());
app.use(passport.session());

// ==================================================================
// Static Files Configuration
// ==================================================================

// Serve uploaded images and assets
app.use('/images', express.static(path.join(__dirname, 'public/assets/images')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

// Serve root public directory (for HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// ==================================================================
// Initialize Services
// ==================================================================

// Connect to database
connectDatabase();

// Configure Passport strategies
configurePassport();

// Initialize Gemini AI
initializeGemini();

// ==================================================================
// API Routes
// ==================================================================
app.use('/', routes);

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================================================================
// Error Handling
// ==================================================================
app.use(errorHandler);

// ==================================================================
// Start Server
// ==================================================================
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Access at: http://localhost:${PORT}`);
});