const crypto = require('crypto');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');

/**
 * Request password reset — generates a token and (in production) sends an email.
 * POST /api/auth/forgot-password
 */
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });

        // Always respond with success to prevent email enumeration attacks
        if (!user) {
            return res.status(200).json({
                message: 'If an account with that email exists, a password reset link has been sent.'
            });
        }

        // Generate reset token (valid for 1 hour)
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await user.save();

        // Build reset URL
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const resetUrl = `${frontendUrl}/pages/auth/reset-password.html?token=${resetToken}`;

        // Send Email
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
                <p style="color: #555; font-size: 16px;">Hello ${user.name || 'Customer'},</p>
                <p style="color: #555; font-size: 16px;">We received a request to reset the password for your Apple Store account. Click the button below to choose a new password:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" style="background-color: #0070c9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">Reset Password</a>
                </div>
                <p style="color: #777; font-size: 14px; text-align: center;">This link will expire in 1 hour.</p>
                <p style="color: #777; font-size: 14px; text-align: center;">If you did not make this request, please ignore this email. Your password will remain unchanged.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;" />
                <p style="color: #999; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} Apple Store Clone. All rights reserved.</p>
            </div>
        `;

        try {
            await sendEmail({
                to: user.email,
                subject: 'Apple Store - Password Reset Request',
                html: emailHtml
            });
        } catch (emailError) {
            console.error('Failed to send reset email:', emailError);
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save();
            return res.status(500).json({ message: 'Error sending email. Please try again later.' });
        }

        res.status(200).json({
            message: 'If an account with that email exists, a password reset link has been sent.'
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

/**
 * Reset password using token
 * POST /api/auth/reset-password
 */
exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        // Hash the token to compare with stored hash
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: new Date() }  // Token not expired
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        // Update password
        user.password = await bcrypt.hash(newPassword, 10);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        res.status(200).json({ message: 'Password reset successful. You can now log in with your new password.' });

    } catch (error) {
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};
