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
                // Find user by email from Google profile
                let user = await User.findOne({ email: profile.emails[0].value });

                if (!user) {
                    // Create new user if doesn't exist
                    console.log("Creating new user via Google...");
                    const randomPassword = await bcrypt.hash(Math.random().toString(36), 10);
                    user = new User({
                        email: profile.emails[0].value,
                        password: randomPassword,
                        role: 'user',
                        rank: 'Silver',
                        points: 0
                    });
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
