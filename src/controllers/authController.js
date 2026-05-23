const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../config/postgres');
const { mergeGuestCart } = require('../services/cartMergeService');
const { sendEmail } = require('../services/emailService');
const { buildVerificationEmail } = require('../utils/emailTemplates');

const OTP_EXPIRY_MINUTES = 10;

// Access token: short-lived (15 minutes)
const ACCESS_TOKEN_EXPIRY = '15m';
// Refresh token: long-lived (30 days)
const REFRESH_TOKEN_DAYS = 30;

/**
 * Helper: Generate a short-lived access token
 */
function generateAccessToken(user) {
    return jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
}

/**
 * Helper: Set refresh token as httpOnly cookie
 */
function setRefreshCookie(res, rawToken) {
    res.cookie('refreshToken', rawToken, {
        httpOnly: true,                                         // Not accessible via JavaScript (XSS-safe)
        secure: process.env.NODE_ENV === 'production',          // HTTPS only in production
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,      // 30 days
        path: '/'
    });
}

/**
 * Register new user
 * POST /api/register
 */
exports.register = async (req, res) => {
    try {
        const { email, password, name } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const role = 'user';

        const newUser = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                password: hashedPassword,
                name: name || '',
                role,
                rank: 'Silver'
            }
        });

        // Merge guest cart if provided
        if (req.body.guestCart && Array.isArray(req.body.guestCart) && req.body.guestCart.length > 0) {
            await mergeGuestCart(newUser.id, req.body.guestCart);
        }

        // Generate and store email verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationJwt = jwt.sign(
            { userId: newUser.id, token: verificationToken, purpose: 'email_verification' },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        await prisma.user.update({
            where: { id: newUser.id },
            data: { emailVerificationToken: verificationToken }
        });

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${verificationJwt}`;
        sendEmail({
            to: newUser.email,
            subject: 'Xác nhận email của bạn — Apple Store',
            html: buildVerificationEmail(newUser.name || newUser.email, verifyUrl)
        }).catch(err => console.error('Verification email failed:', err.message));

        res.status(201).json({
            message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.',
            requiresEmailVerification: true
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Login step 1 — verify credentials, send OTP email
 * POST /api/login
 * Returns: { requiresOtp: true, otpToken, maskedEmail }
 */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

        if (!user) return res.status(401).json({ message: 'Invalid email or password' });
        if (!user.password) return res.status(401).json({ message: 'This account uses Google Sign-In. Please log in with Google.' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

        // Admin accounts skip OTP — issue tokens directly
        if (user.role === 'admin') {
            const accessToken = generateAccessToken(user);
            const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
            const rawToken = crypto.randomBytes(40).toString('hex');

            await prisma.refreshToken.create({
                data: {
                    userId: user.id,
                    token: rawToken,
                    expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
                    createdByIp: clientIp
                }
            });

            setRefreshCookie(res, rawToken);

            const { password: _pw, passwordResetToken: _prt, passwordResetExpires: _pre, emailVerificationToken: _evt, ...userInfo } = user;
            return res.status(200).json({ ...userInfo, accessToken });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

        // Sign short-lived OTP token (10 min) — embeds userId + otpHash, never the raw OTP
        const otpToken = jwt.sign(
            { userId: user.id, otpHash, purpose: 'login_otp' },
            process.env.JWT_SECRET,
            { expiresIn: `${OTP_EXPIRY_MINUTES}m` }
        );

        // Send OTP email
        const maskedEmail = user.email.replace(/(.{2}).+(@.+)/, '$1***$2');
        const html = `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Inter',Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;background:#f5f5f7;border-radius:16px;">
                <div style="background:#ffffff;border-radius:12px;padding:40px;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
                    <div style="text-align:center;margin-bottom:28px;">
                        <span style="font-size:36px;font-weight:700;color:#1d1d1f;">&#63743;</span>
                        <p style="color:#86868b;font-size:13px;margin:4px 0 0;">Apple Store</p>
                    </div>
                    <h2 style="color:#1d1d1f;font-size:20px;font-weight:700;text-align:center;margin:0 0 8px;">Your Login Code</h2>
                    <p style="color:#86868b;font-size:14px;text-align:center;margin:0 0 32px;">Use this code to complete your sign-in. It expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
                    <div style="background:#f5f5f7;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
                        <span style="font-size:40px;font-weight:800;letter-spacing:12px;color:#1d1d1f;font-family:monospace;">${otp}</span>
                    </div>
                    <p style="color:#86868b;font-size:13px;text-align:center;margin:0;">If you did not attempt to sign in, please ignore this email.</p>
                    <hr style="border:none;border-top:1px solid #f0f0f0;margin:24px 0 16px;" />
                    <p style="color:#b0b0b5;font-size:12px;text-align:center;margin:0;">&copy; ${new Date().getFullYear()} Apple Store Clone. All rights reserved.</p>
                </div>
            </div>`;

        const emailData = { to: user.email, subject: 'Apple Store — Your Login Verification Code', html };
        try {
            await sendEmail(emailData);
        } catch (emailErr) {
            console.error('OTP email failed:', emailErr.message);
            return res.status(500).json({ message: 'Failed to send verification code. Please try again later.' });
        }

        res.status(200).json({ requiresOtp: true, otpToken, maskedEmail });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Login step 2 — verify OTP, issue tokens
 * POST /api/auth/verify-otp
 */
exports.verifyLoginOtp = async (req, res) => {
    try {
        const { otpToken, otp, guestCart } = req.body;
        if (!otpToken || !otp) return res.status(400).json({ message: 'otpToken and otp are required' });

        // Decode & verify OTP token
        let payload;
        try {
            payload = jwt.verify(otpToken, process.env.JWT_SECRET);
        } catch {
            return res.status(401).json({ message: 'Verification code has expired. Please log in again.' });
        }

        if (payload.purpose !== 'login_otp') {
            return res.status(401).json({ message: 'Invalid token purpose' });
        }

        // Verify OTP matches
        const otpHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
        if (otpHash !== payload.otpHash) {
            return res.status(401).json({ message: 'Incorrect verification code. Please try again.' });
        }

        const user = await prisma.user.findUnique({ where: { id: payload.userId } });
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Issue tokens
        const accessToken = generateAccessToken(user);
        const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
        const rawToken = crypto.randomBytes(40).toString('hex');

        await prisma.refreshToken.create({
            data: {
                userId: user.id,
                token: rawToken,
                expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
                createdByIp: clientIp
            }
        });

        setRefreshCookie(res, rawToken);

        if (Array.isArray(guestCart) && guestCart.length > 0) {
            await mergeGuestCart(user.id, guestCart).catch(() => {});
        }

        const { password: _pw, passwordResetToken: _prt, passwordResetExpires: _pre, emailVerificationToken: _evt, ...userInfo } = user;
        res.status(200).json({ ...userInfo, accessToken });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Refresh access token using refresh token from cookie
 * POST /api/auth/refresh
 */
exports.refreshAccessToken = async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (!token) {
            return res.status(401).json({ message: 'No refresh token provided' });
        }

        // Find the refresh token in DB
        const storedToken = await prisma.refreshToken.findUnique({ where: { token } });
        if (!storedToken) {
            return res.status(403).json({ message: 'Invalid refresh token — please log in again' });
        }

        // Check expiry
        if (storedToken.expiresAt < new Date()) {
            await prisma.refreshToken.delete({ where: { id: storedToken.id } });
            return res.status(403).json({ message: 'Refresh token expired — please log in again' });
        }

        // Find the user
        const user = await prisma.user.findUnique({ where: { id: storedToken.userId } });
        if (!user) {
            await prisma.refreshToken.delete({ where: { id: storedToken.id } });
            return res.status(403).json({ message: 'User not found' });
        }

        // Issue new access token
        const accessToken = generateAccessToken(user);
        res.status(200).json({ accessToken });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Logout — revoke refresh token
 * POST /api/auth/logout
 */
exports.logout = async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (token) {
            await prisma.refreshToken.deleteMany({ where: { token } });
        }

        // Clear the cookie
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            path: '/'
        });

        res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get user profile with orders
 * GET /api/users/profile
 */
exports.getProfile = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true, name: true, email: true, avatar: true, phone: true,
                role: true, rank: true, points: true, totalSpending: true,
                createdAt: true, addresses: true, myVouchers: true
            }
        });
        
        if (!user) return res.status(404).json({ message: 'User not found' });

        const orders = await prisma.order.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' }
        });
        
        res.status(200).json({ user, orders });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Verify email address from the link clicked in the verification email
 * GET /api/auth/verify-email?token=<jwt>
 */
exports.verifyEmail = async (req, res) => {
    const redirectBase = process.env.FRONTEND_URL || '';
    try {
        const { token } = req.query;
        if (!token) {
            return res.redirect(`${redirectBase}/pages/auth/login.html?error=invalid_token`);
        }

        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            return res.redirect(`${redirectBase}/pages/auth/login.html?error=token_expired`);
        }

        if (payload.purpose !== 'email_verification') {
            return res.redirect(`${redirectBase}/pages/auth/login.html?error=invalid_token`);
        }

        const user = await prisma.user.findUnique({ where: { id: payload.userId } });
        if (!user) {
            return res.redirect(`${redirectBase}/pages/auth/login.html?error=user_not_found`);
        }

        if (user.isEmailVerified) {
            return res.redirect(`${redirectBase}/pages/auth/login.html?verified=already`);
        }

        if (user.emailVerificationToken !== payload.token) {
            return res.redirect(`${redirectBase}/pages/auth/login.html?error=invalid_token`);
        }

        await prisma.user.update({
            where: { id: payload.userId },
            data: { isEmailVerified: true, emailVerificationToken: null }
        });

        res.redirect(`${redirectBase}/pages/auth/login.html?verified=true`);
    } catch (error) {
        res.redirect(`${redirectBase}/pages/auth/login.html?error=server_error`);
    }
};

/**
 * Resend verification email
 * POST /api/auth/resend-verification
 */
exports.resendVerification = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email là bắt buộc' });

        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

        // Always succeed to prevent user enumeration
        const successMsg = 'Nếu email chưa được xác nhận, chúng tôi đã gửi lại email xác nhận.';
        if (!user || user.isEmailVerified) {
            return res.status(200).json({ message: successMsg });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationJwt = jwt.sign(
            { userId: user.id, token: verificationToken, purpose: 'email_verification' },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        await prisma.user.update({
            where: { id: user.id },
            data: { emailVerificationToken: verificationToken }
        });

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${verificationJwt}`;

        sendEmail({
            to: user.email,
            subject: 'Xác nhận email của bạn — Apple Store',
            html: buildVerificationEmail(user.name || user.email, verifyUrl)
        }).catch(err => console.error('Resend verification email failed:', err.message));

        res.status(200).json({ message: successMsg });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Google OAuth callback handler
 */
exports.googleCallback = async (req, res) => {
    try {
        const accessToken = generateAccessToken(req.user);

        // Create a refresh token for Google OAuth users
        const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
        const rawToken = require('crypto').randomBytes(40).toString('hex');
        
        await prisma.refreshToken.create({
            data: {
                userId: req.user.id,
                token: rawToken,
                expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
                createdByIp: clientIp
            }
        });
        
        setRefreshCookie(res, rawToken);

        // Redirect with token in URL fragment — fragments are never sent to servers
        // or included in Referer headers, so the token won't appear in server logs.
        const redirectUrl = process.env.FRONTEND_URL || 'https://project3-icy1.onrender.com';
        res.redirect(`${redirectUrl}/#token=${accessToken}`);
    } catch (error) {
        console.error('Google callback error:', error);
        res.redirect('/pages/auth/login.html?error=oauth_failed');
    }
};
