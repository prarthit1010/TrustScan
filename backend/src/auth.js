const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const router = express.Router();

const SESSION_DAYS = 7;
const COOKIE_NAME = 'token';
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readCredentials(body) {
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!EMAIL_RE.test(email)) return { error: 'A valid email is required' };
  if (password.length < 6) return { error: 'Password must be at least 6 characters' };
  return { email, password };
}

function startSession(res, user) {
  const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: `${SESSION_DAYS}d`,
  });
  res.cookie(COOKIE_NAME, token, cookieOptions);
}

// Verifies the session cookie; rejects with 401 if missing or expired
function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    if (req.user.kind === 'consumer') throw new Error('customer token'); // app customers can't use the brand dashboard
    next();
  } catch {
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
    res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

router.post('/register', async (req, res) => {
  const creds = readCredentials(req.body);
  if (creds.error) return res.status(400).json({ error: creds.error });
  try {
    const hash = await bcrypt.hash(creds.password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [creds.email, hash]
    );
    startSession(res, rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email is already registered' });
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const creds = readCredentials(req.body);
  if (creds.error) return res.status(400).json({ error: creds.error });
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [creds.email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(creds.password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    startSession(res, user);
    res.json({ id: user.id, email: user.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email });
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});

module.exports = { router, requireAuth };
