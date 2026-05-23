const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT token
 */
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.token;
    if (authHeader) {
        const token = authHeader.split(" ")[1];
        jwt.verify(token, process.env.JWT_SECRET, (err, userPayload) => {
            if (err) return res.status(403).json({ message: "Invalid token" });
            req.user = userPayload;
            next();
        });
    } else {
        return res.status(401).json({ message: "Not authenticated" });
    }
};

/**
 * Middleware to verify admin role
 */
const verifyAdmin = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user.role === 'admin') {
            next();
        } else {
            res.status(403).json({ message: "Admin access required" });
        }
    });
};

/**
 * Optional auth — sets req.user if a valid token is present, but never blocks.
 * Used for endpoints that serve both authenticated and guest users.
 */
const optionalVerifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.token;
    if (authHeader) {
        const token = authHeader.split(" ")[1];
        jwt.verify(token, process.env.JWT_SECRET, (err, userPayload) => {
            if (!err) req.user = userPayload;
            next();
        });
    } else {
        next();
    }
};

module.exports = { verifyToken, verifyAdmin, optionalVerifyToken };
