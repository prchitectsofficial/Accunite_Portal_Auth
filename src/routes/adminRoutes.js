const express = require('express');
const router = express.Router();
const { promisePool } = require('../config/database');
const jwt = require('jsonwebtoken');

const isAdmin = (req, res, next) => {
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const adminEmails = process.env.ADMIN_EMAILS.split(',');
        if (!adminEmails.includes(decoded.email)) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

router.get('/users', isAdmin, async (req, res) => {
    try {
        const [users] = await promisePool.query(
            'SELECT id, email, name, profile_picture, role, status, employee_code, approved_by, approved_at, created_at, last_login FROM portal_users ORDER BY created_at DESC'
        );
        res.json({ users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

router.get('/pending-count', isAdmin, async (req, res) => {
    try {
        const [result] = await promisePool.query('SELECT COUNT(*) as count FROM portal_users WHERE status = ?', ['pending']);
        res.json({ count: result[0].count });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pending count' });
    }
});

router.post('/approve/:id', isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { employee_code } = req.body;

        const [users] = await promisePool.query('SELECT * FROM portal_users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });

        await promisePool.query(
            'UPDATE portal_users SET status = ?, approved_by = ?, approved_at = NOW(), employee_code = ? WHERE id = ?',
            ['approved', req.user.email, employee_code || users[0].employee_code, userId]
        );

        await promisePool.query(
            'INSERT INTO admin_audit_log (admin_email, action, target_user_email, details) VALUES (?, ?, ?, ?)',
            [req.user.email, 'approve_user', users[0].email, `Approved user ${users[0].email}`]
        );

        res.json({ message: 'User approved successfully' });
    } catch (error) {
        console.error('Approve user error:', error);
        res.status(500).json({ error: 'Failed to approve user' });
    }
});

router.post('/revoke/:id', isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const [users] = await promisePool.query('SELECT * FROM portal_users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });

        await promisePool.query('UPDATE portal_users SET status = ? WHERE id = ?', ['revoked', userId]);

        await promisePool.query(
            'INSERT INTO admin_audit_log (admin_email, action, target_user_email, details) VALUES (?, ?, ?, ?)',
            [req.user.email, 'revoke_user', users[0].email, `Revoked access for ${users[0].email}`]
        );

        res.json({ message: 'User access revoked successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to revoke user' });
    }
});

router.get('/employees', isAdmin, async (req, res) => {
    try {
        const [employees] = await promisePool.query('SELECT employee_code, name, email FROM employees WHERE status = ? ORDER BY name', ['active']);
        res.json({ employees });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch employees' });
    }
});

module.exports = router;
