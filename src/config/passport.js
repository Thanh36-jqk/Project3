const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcrypt');
const User = require('../models/User');

/**
 * Configure Passport authentication strategies
 */
const configurePassport = () => {
    // Serialize user for session
    passport.serializeUser((user, done) => done(null, user.id));

    // Deserialize user from session
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
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
                let user = await User.findOne({ googleId }) || await User.findOne({ email });

                if (!user) {
                    // Create new user from Google profile
                    console.log("Creating new user via Google...");
                    const randomPassword = await bcrypt.hash(Math.random().toString(36), 10);
                    user = new User({
                        email,
                        password: randomPassword,
                        googleId,
                        name: profile.displayName || '',
                        avatar: profile.photos?.[0]?.value || '',
                        role: 'user',
                        rank: 'Silver',
                        points: 0,
                        isEmailVerified: true  // Google emails are already verified
                    });
                    await user.save();
                } else if (!user.googleId) {
                    // Link Google account to existing email-based user
                    user.googleId = googleId;
                    if (!user.name && profile.displayName) user.name = profile.displayName;
                    if (!user.avatar && profile.photos?.[0]?.value) user.avatar = profile.photos[0].value;
                    user.isEmailVerified = true;
                    await user.save();
                }

                return done(null, user);
            } catch (err) {
                console.error("Google Auth Error:", err);
                return done(err, null);
            }
        }));
};

module.exports = configurePassport;
