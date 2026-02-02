const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const jwt = require('jsonwebtoken');

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        const token = jwt.sign(
            {
                id: req.user.id,
                email: req.user.email,
                name: req.user.name,
                role: req.user.role,
                status: req.user.status,
                employee_code: req.user.employee_code
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: true,
            maxAge: 24 * 60 * 60 * 1000,
            sameSite: 'lax',
            path: '/',
            domain: '.accunite.com'
        });

        // Redirect based on status
        if (req.user.status === 'pending') {
            res.redirect('/?status=pending');
        } else if (req.user.status === 'revoked') {
            res.redirect('/?status=revoked');
        } else {
            res.redirect('/');
        }
    }
);

router.get('/me', (req, res) => {
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        res.json({ user: decoded });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('auth_token', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        domain: '.accunite.com'
    });
    req.logout(() => {
        res.json({ message: 'Logged out successfully' });
    });
});

module.exports = router;
