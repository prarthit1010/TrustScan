const express = require('express');
const pool = require('../db');
const { HttpError } = require('./util');
const { optionalConsumer, requireConsumer } = require('../consumerAuth');

// Endpoints hit when a QR code is scanned (public link or the mobile app)
const router = express.Router();

const CODE_RE = /^[A-Z0-9]{6,32}$/;

// Records the scan and returns what the customer should see: verification, cashback, or both
router.post('/:code', optionalConsumer, async (req, res) => {
  const code = String(req.params.code).toUpperCase();
  if (!CODE_RE.test(code)) return res.json({ result: 'invalid' });

  const { rows: [qr] } = await pool.query(
    `SELECT q.id, q.display_id, q.program, q.cashback_amount::float8 AS cashback_amount,
            q.redeemed_at, q.redeemed_consumer_id,
            b.activation_date, b.expiry_date,
            CURRENT_DATE < b.activation_date AS not_yet_active,
            CURRENT_DATE > b.expiry_date AS expired, b.deleted_at IS NOT NULL AS deleted,
            c.name AS campaign_name, p.name AS product_name, p.sku, p.category, p.description, p.about,
            a.verification_details, s.app_name AS brand_name, s.logo AS brand_logo
       FROM qr_codes q
       JOIN qr_batches b ON b.id = q.batch_id
       JOIN campaigns c ON c.id = b.campaign_id
       JOIN products p ON p.id = c.product_id
       LEFT JOIN program_assignments a ON a.id = q.assignment_id
       LEFT JOIN brand_settings s ON s.user_id = c.user_id
      WHERE q.code = $1`,
    [code]
  );
  if (!qr) return res.json({ result: 'invalid' });

  const result = qr.deleted ? 'deleted' : qr.not_yet_active ? 'not_active' : qr.expired ? 'expired' : !qr.program ? 'unassigned' : 'ok';
  await pool.query('INSERT INTO qr_scans (qr_id, consumer_id, result) VALUES ($1, $2, $3)', [qr.id, req.consumer?.id ?? null, result]);

  const base = {
    result,
    code,
    display_id: qr.display_id,
    product: { name: qr.product_name, sku: qr.sku, category: qr.category, description: qr.description, about: qr.about },
    brand: qr.brand_name ? { name: qr.brand_name, logo: qr.brand_logo } : null,
    campaign: qr.campaign_name,
    activation_date: qr.activation_date,
    expiry_date: qr.expiry_date,
  };
  if (result !== 'ok') return res.json(base);

  const { rows: [scan] } = await pool.query(
    `UPDATE qr_codes SET scan_count = scan_count + 1,
            first_scanned_at = COALESCE(first_scanned_at, NOW()), last_scanned_at = NOW()
      WHERE id = $1 RETURNING scan_count`,
    [qr.id]
  );
  const hasCashback = qr.program === 'cashback' || qr.program === 'both';
  const mine = !!req.consumer && qr.redeemed_consumer_id === req.consumer.id;
  res.json({
    ...base,
    program: qr.program,
    genuine: qr.program !== 'cashback',
    // Details the customer can match against what is printed on the pack
    verification: qr.program !== 'cashback' ? qr.verification_details || [] : [],
    scan_count: scan.scan_count,
    cashback: hasCashback ? { amount: qr.cashback_amount, redeemed: !!qr.redeemed_at, mine } : null,
  });
});

// Credits the code's cashback to the logged-in customer's wallet
router.post('/:code/claim', requireConsumer, async (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const { rows: [consumer] } = await pool.query('SELECT id, mobile FROM consumers WHERE id = $1', [req.consumer.id]);
  if (!consumer) throw new HttpError(401, 'Please log in to continue');
  // Single conditional UPDATE: a code can only ever be redeemed once, even with parallel requests
  const { rows: [claimed] } = await pool.query(
    `UPDATE qr_codes q SET redeemed_at = NOW(), redeemed_by = $2, redeemed_consumer_id = $3
       FROM qr_batches b
      WHERE q.batch_id = b.id AND q.code = $1 AND b.deleted_at IS NULL
        AND q.program IN ('cashback', 'both') AND q.redeemed_at IS NULL
        AND CURRENT_DATE BETWEEN b.activation_date AND b.expiry_date
      RETURNING q.cashback_amount::float8 AS amount`,
    [code, consumer.mobile, consumer.id]
  );
  if (!claimed) throw new HttpError(409, 'Cashback is not available for this code. It may already be claimed or expired.');
  res.json({ ok: true, amount: claimed.amount });
});

module.exports = router;
