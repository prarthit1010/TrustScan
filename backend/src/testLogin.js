const crypto = require('crypto');
const express = require('express');
const pool = require('./db');
const { startSession, PUBLIC_FIELDS } = require('./consumerAuth');
const { HttpError } = require('./routes/util');

// TEMPORARY: lets testers log in without paying for WhatsApp messages.
// Active only while TEST_LOGIN_ID and TEST_LOGIN_PASSWORD are both set in .env; blank them to switch it off.
//
// To remove it for good:
//   1. Delete this file and customer-app/src/components/TestLogin.jsx
//   2. Delete the "test-login" line in server.js
//   3. Delete the "TEST LOGIN" lines in customer-app/src/components/AuthForm.jsx
//   4. Delete TEST_LOGIN_ID and TEST_LOGIN_PASSWORD from .env and .env.example
const router = express.Router();

// Not a valid customer number (those start with 6-9), so it can never clash with a real account
const TEST_MOBILE = '0000000000';

const isEnabled = () => Boolean(process.env.TEST_LOGIN_ID && process.env.TEST_LOGIN_PASSWORD);

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest();
const matches = (a, b) => crypto.timingSafeEqual(sha256(a), sha256(b));

router.get('/', (req, res) => res.json({ enabled: isEnabled() }));

router.post('/', async (req, res) => {
  if (!isEnabled()) throw new HttpError(404, 'Test login is turned off');
  const idOk = matches(req.body?.id ?? '', process.env.TEST_LOGIN_ID);
  const passwordOk = matches(req.body?.password ?? '', process.env.TEST_LOGIN_PASSWORD);
  if (!idOk || !passwordOk) throw new HttpError(401, 'Incorrect test ID or password');

  const { rows: [consumer] } = await pool.query(
    `INSERT INTO consumers (name, mobile, mobile_verified) VALUES ('Test Customer', $1, TRUE)
     ON CONFLICT (mobile) DO UPDATE SET mobile_verified = TRUE
     RETURNING ${PUBLIC_FIELDS}`,
    [TEST_MOBILE]
  );
  startSession(res, consumer);
  res.json(consumer);
});

module.exports = router;
