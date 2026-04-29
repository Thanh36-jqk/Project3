const winston = require('winston');
const path = require('path');

/**
 * Enterprise Logger Configuration
 * - Console: Colored output for development
 * - File: JSON structured logs for production analysis
 * - Error file: Separate file for errors only
 */

const logDir = path.join(__dirname, '../../logs');

// Custom format for console output
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level}: ${message}${metaStr}`;
    })
);

// Structured JSON format for file output
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    defaultMeta: { service: 'apple-store' },
    transports: [
        // Console transport — always active
        new winston.transports.Console({
            format: consoleFormat
        }),

        // Combined log file — all levels
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            format: fileFormat,
            maxsize: 5242880,  // 5MB
            maxFiles: 5
        }),

        // Error-only log file
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            format: fileFormat,
            maxsize: 5242880,
            maxFiles: 5
        })
    ]
});

module.exports = logger;
