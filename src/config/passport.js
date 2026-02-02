const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { promisePool } = require('./database');

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const [users] = await promisePool.query('SELECT * FROM portal_users WHERE id = ?', [id]);
        done(null, users[0]);
    } catch (error) {
        done(error, null);
    }
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
},
async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;
        const name = profile.displayName;
        const googleId = profile.id;
        const profilePicture = profile.photos[0]?.value;

        const [existingUsers] = await promisePool.query('SELECT * FROM portal_users WHERE email = ?', [email]);

        if (existingUsers.length > 0) {
            await promisePool.query(
                'UPDATE portal_users SET google_id = ?, last_login = NOW(), profile_picture = ? WHERE email = ?',
                [googleId, profilePicture, email]
            );
            return done(null, existingUsers[0]);
        }

        const [employees] = await promisePool.query(
            'SELECT employee_code FROM employees WHERE email = ? AND status = ?',
            [email, 'active']
        );

        const employeeCode = employees.length > 0 ? employees[0].employee_code : null;
        const status = employeeCode ? 'approved' : 'pending';

        const [result] = await promisePool.query(
            'INSERT INTO portal_users (google_id, email, name, profile_picture, employee_code, status, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [googleId, email, name, profilePicture, employeeCode, status, status === 'approved' ? new Date() : null]
        );

        const [newUser] = await promisePool.query('SELECT * FROM portal_users WHERE id = ?', [result.insertId]);
        done(null, newUser[0]);
    } catch (error) {
        done(error, null);
    }
}));

module.exports = passport;
