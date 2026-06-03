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

                // Find user by googleId only — do NOT auto-link by email
                // (auto-linking by email allows account takeover if attacker controls Google email)
                let user = await prisma.user.findUnique({ where: { googleId } });

                if (!user) {
                    // Check if email already registered via password — block auto-link
                    const existingByEmail = await prisma.user.findUnique({ where: { email } });
                    if (existingByEmail && !existingByEmail.googleId) {
                        return done(null, false, { message: 'EMAIL_EXISTS_NO_GOOGLE' });
                    }

                    // Create new Google user
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
