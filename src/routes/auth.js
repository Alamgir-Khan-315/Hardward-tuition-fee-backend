const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { asyncHandler } = require('../middleware/helpers');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Bohat zyada koshishein. 15 minute baad dobara try karein.' },
});

const loginSchema = z.object({ username: z.string().trim().min(1), password: z.string().min(1) });

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);
    const adminUser = (process.env.ADMIN_USERNAME || '').toLowerCase();
    const hash = process.env.ADMIN_PASSWORD_HASH || '';

    const ok = username.toLowerCase() === adminUser && hash && bcrypt.compareSync(password, hash);
    if (!ok) {
      await new Promise((r) => setTimeout(r, 600)); // brute-force ko slow karne ke liye
      return res.status(401).json({ message: 'Username ya password galat hai.' });
    }

    const token = jwt.sign({ username: adminUser, role: 'Admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure,
      maxAge: 8 * 60 * 60 * 1000,
    });
    res.json({ user: { username: adminUser, role: 'Admin' } });
  })
);

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: { username: req.user.username, role: req.user.role } }));

module.exports = router;
