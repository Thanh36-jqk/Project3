module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/*.test.js',
        '!node_modules/**',
        // Infrastructure & external service wrappers — require real connections, not unit-testable
        '!src/config/**',
        '!src/services/emailService.js',
        '!src/services/rabbitmqService.js',
        '!src/services/vnpayService.js',
        // AI chatbot — requires live Google Gemini API key
        '!src/controllers/chatbotController.js',
        // HTML email templates — static template strings, not business logic
        '!src/utils/emailTemplates.js',
        // Middleware config wrappers (express-validator rules, rate-limiter config)
        '!src/middleware/validate.js',
        '!src/middleware/rateLimiter.js',
    ],
    testMatch: [
        '**/tests/**/*.test.js'
    ],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70
        }
    },
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testTimeout: 10000,
    verbose: true
};
