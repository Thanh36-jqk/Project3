const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcrypt');
const prisma = require('../config/postgres');

/**
 * Configure Passport authentication strategies
 */
const configurePassport = () => {
    // Serialize user for session
    passport.serializeUser((user, done) => done(null, user.id));

    // Deserialize user from session
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await prisma.user.findUnique({ where: { id } });
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    });

    // Google OAuth Strategy
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "https://project3-icy1.onrender.com/auth/google/callback"
    },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails[0].value;
                const googleId = profile.id;

                // Try to find user by googleId first (most reliable), then by email
                let user = await prisma.user.findUnique({ where: { googleId } });
                if (!user) {
                    user = await prisma.user.findUnique({ where: { email } });
                }

                if (!user) {
                    // Create new user from Google profile
                    console.log("Creating new user via Google...");
                    const randomPassword = await bcrypt.hash(Math.random().toString(36), 10);
                    user = await prisma.user.create({
                        data: {
                            email,
                            password: randomPassword,
                            googleId,
                            name: profile.displayName || '',
                            avatar: profile.photos?.[0]?.value || '',
                            role: 'user',
                            rank: 'Silver',
                            points: 0,
                            isEmailVerified: true  // Google emails are already verified
                        }
                    });
                } else if (!user.googleId) {
                    // Link Google account to existing email-based user
                    user = await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            googleId,
                            name: user.name || profile.displayName,
                            avatar: user.avatar || profile.photos?.[0]?.value,
                            isEmailVerified: true
                        }
                    });
                }

                return done(null, user);
            } catch (err) {
                console.error("Google Auth Error:", err);
                return done(err, null);
            }
        }));
};

module.exports = configurePassport;
