const { body, validationResult } = require('express-validator');

/**
 * Middleware: Check validation results and return errors if any
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: 'Validation failed',
            errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
        });
    }
    next();
};

/**
 * Validation rules for user registration
 */
const validateRegister = [
    body('email')
        .isEmail().withMessage('Please provide a valid email address')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    handleValidationErrors
];

/**
 * Validation rules for user login
 */
const validateLogin = [
    body('email')
        .isEmail().withMessage('Please provide a valid email address')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required'),
    handleValidationErrors
];

/**
 * Validation rules for order creation
 */
const validateOrder = [
    body('recipientName')
        .trim()
        .notEmpty().withMessage('Recipient name is required')
        .isLength({ max: 100 }).withMessage('Name must be under 100 characters'),
    body('recipientPhone')
        .trim()
        .notEmpty().withMessage('Phone number is required')
        .matches(/^[0-9+\-\s()]{8,15}$/).withMessage('Invalid phone number format'),
    body('recipientAddress')
        .trim()
        .notEmpty().withMessage('Address is required')
        .isLength({ max: 500 }).withMessage('Address must be under 500 characters'),
    body('items')
        .isArray({ min: 1 }).withMessage('Order must contain at least one item'),
    body('items.*.productId')
        .notEmpty().withMessage('Each item must have a productId')
        .isString().withMessage('Invalid product ID format'),
    body('items.*.qty')
        .isInt({ min: 1, max: 99 }).withMessage('Quantity must be between 1 and 99'),
    handleValidationErrors
];

/**
 * Validation rules for password reset request
 */
const validateForgotPassword = [
    body('email')
        .isEmail().withMessage('Please provide a valid email address')
        .normalizeEmail(),
    handleValidationErrors
];

/**
 * Validation rules for password reset
 */
const validateResetPassword = [
    body('token')
        .notEmpty().withMessage('Reset token is required'),
    body('newPassword')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    handleValidationErrors
];

module.exports = {
    validateRegister,
    validateLogin,
    validateOrder,
    validateForgotPassword,
    validateResetPassword,
    handleValidationErrors
};
