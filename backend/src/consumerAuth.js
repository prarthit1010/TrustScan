const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const { HttpError } = require('./routes/util');
const { isWhatsappConfigured, sendWhatsappOtp } = require('./whatsapp');

// Customer (mobile app) accounts. Uses its own cookie so it never mixes with the brand dashboard session.
// Customers log in with a WhatsApp OTP; a first login creates the account.
const router = express.Router();

const SESSION_DAYS = 30;
const COOKIE_NAME = 'ctoken';
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
};
const clearOptions = { ...cookieOptions, maxAge: undefined };

const MOBILE_RE = /^[6-9]\d{9}$/;
const CODE_RE = /^\d{6}$/;
const PUBLIC_FIELDS = 'id, name, email, mobile, mobile_verified, created_at';

const OTP_TTL_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_SECONDS = 60;
const OTP_MAX_SENDS_PER_HOUR = 5;
const SIGNUP_TOKEN_MINUTES = 15;

const readMobile = (body) => {
  const mobile = String(body?.mobile || '').replace(/\D/g, '');
  if (!MOBILE_RE.test(mobile)) throw new HttpError(400, 'Enter a valid 10-digit mobile number');
  return mobile;
};

const hashCode = (mobile, code) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${mobile}:${code}`).digest('hex');
// Separate key so this token can never pass as a dashboard or customer session
const signupSecret = () => `${process.env.JWT_SECRET}:otp-signup`;

// Applies the send limits and saves the code. The per-number lock stops parallel requests slipping past them.
async function saveOtp(mobile, code) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`consumer-otp:${mobile}`]);
    await client.query(`DELETE FROM consumer_otps WHERE mobile = $1 AND created_at < NOW() - INTERVAL '1 day'`, [mobile]);
    const { rows: [sent] } = await client.query(
      `SELECT COUNT(*) FILTER (WHERE created_at > NOW() - make_interval(secs => $2))::int AS cooling,
              COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')::int AS last_hour
       FROM consumer_otps WHERE mobile = $1`,
      [mobile, OTP_RESEND_SECONDS]
    );
    if (sent.cooling > 0) throw new HttpError(429, 'Please wait a minute before requesting another code');
    if (sent.last_hour >= OTP_MAX_SENDS_PER_HOUR) throw new HttpError(429, 'Too many codes requested. Try again in an hour');
    const { rows: [otp] } = await client.query(
      `INSERT INTO consumer_otps (mobile, code_hash, expires_at)
       VALUES ($1, $2, NOW() + make_interval(mins => $3)) RETURNING id`,
      [mobile, hashCode(mobile, code), OTP_TTL_MINUTES]
    );
    await client.query('COMMIT');
    return otp.id;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function startSession(res, consumer) {
  const token = jwt.sign({ cid: consumer.id, kind: 'consumer' }, process.env.JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
  res.cookie(COOKIE_NAME, token, cookieOptions);
}

function readSession(req) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.kind === 'consumer' ? { id: payload.cid } : null;
  } catch {
    return null;
  }
}

// Sets req.consumer when a customer is logged in, but lets anonymous requests through
function optionalConsumer(req, res, next) {
  req.consumer = readSession(req);
  next();
}

function requireConsumer(req, res, next) {
  req.consumer = readSession(req);
  if (!req.consumer) {
    res.clearCookie(COOKIE_NAME, clearOptions);
    return res.status(401).json({ error: 'Please log in to continue' });
  }
  next();
}

router.post('/otp/send', async (req, res) => {
  const mobile = readMobile(req.body);
  if (!isWhatsappConfigured()) throw new HttpError(503, 'WhatsApp login is not available right now');
  const code = String(crypto.randomInt(1000000)).padStart(6, '0');
  const otpId = await saveOtp(mobile, code);
  try {
    await sendWhatsappOtp(mobile, code);
  } catch (err) {
    console.error(err);
    await pool.query('DELETE FROM consumer_otps WHERE id = $1', [otpId]); // nothing was sent, so let them retry straight away
    throw new HttpError(502, 'Could not send the WhatsApp code. Please try again');
  }
  res.json({ resendAfter: OTP_RESEND_SECONDS });
});

// Logs in an existing customer. A new number gets a signupToken to finish with /otp/signup.
router.post('/otp/verify', async (req, res) => {
  const mobile = readMobile(req.body);
  const code = String(req.body?.code || '').trim();
  if (!CODE_RE.test(code)) throw new HttpError(400, 'Enter the 6-digit code');

  // Only the newest code counts, and the attempt is recorded before the code is compared
  const { rows: [otp] } = await pool.query(
    `UPDATE consumer_otps SET attempts = attempts + 1
     WHERE id = (SELECT id FROM consumer_otps WHERE mobile = $1 ORDER BY id DESC LIMIT 1)
       AND consumed_at IS NULL AND expires_at > NOW() AND attempts < $2
     RETURNING id, code_hash`,
    [mobile, OTP_MAX_ATTEMPTS]
  );
  if (!otp) throw new HttpError(400, 'This code has expired. Request a new one');
  const expected = Buffer.from(otp.code_hash);
  if (!crypto.timingSafeEqual(Buffer.from(hashCode(mobile, code)), expected)) throw new HttpError(400, 'Incorrect code');
  const { rowCount } = await pool.query('UPDATE consumer_otps SET consumed_at = NOW() WHERE id = $1 AND consumed_at IS NULL', [otp.id]);
  if (!rowCount) throw new HttpError(400, 'This code has expired. Request a new one');

  const { rows: [consumer] } = await pool.query(
    `UPDATE consumers SET mobile_verified = TRUE WHERE mobile = $1 RETURNING ${PUBLIC_FIELDS}`,
    [mobile]
  );
  if (!consumer) {
    const signupToken = jwt.sign({ mobile }, signupSecret(), { expiresIn: `${SIGNUP_TOKEN_MINUTES}m` });
    return res.json({ signupToken });
  }
  startSession(res, consumer);
  res.json({ consumer });
});

// Last step for a new customer: their number is already verified, so only the name is needed
router.post('/otp/signup', async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 100);
  if (!name) throw new HttpError(400, 'Enter your name');
  let mobile;
  try {
    ({ mobile } = jwt.verify(String(req.body?.signupToken || ''), signupSecret()));
  } catch {
    throw new HttpError(400, 'Your verification has expired. Please start again');
  }
  const { rows: [consumer] } = await pool.query(
    `INSERT INTO consumers (name, mobile, mobile_verified) VALUES ($1, $2, TRUE)
     ON CONFLICT (mobile) DO UPDATE SET mobile_verified = TRUE
     RETURNING ${PUBLIC_FIELDS}`,
    [name, mobile]
  );
  startSession(res, consumer);
  res.status(201).json({ consumer });
});

router.get('/me', requireConsumer, async (req, res) => {
  const { rows: [consumer] } = await pool.query(`SELECT ${PUBLIC_FIELDS} FROM consumers WHERE id = $1`, [req.consumer.id]);
  if (!consumer) {
    res.clearCookie(COOKIE_NAME, clearOptions);
    throw new HttpError(401, 'Please log in to continue');
  }
  res.json(consumer);
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, clearOptions);
  res.json({ ok: true });
});

module.exports = { router, optionalConsumer, requireConsumer, startSession, PUBLIC_FIELDS };
