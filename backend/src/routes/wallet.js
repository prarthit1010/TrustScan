const express = require('express');
const pool = require('../db');

// Logged-in customer's cashback balance and scan history (mounted behind requireConsumer)
const router = express.Router();

router.get('/', async (req, res) => {
  const id = req.consumer.id;
  const [{ rows: [summary] }, { rows: history }] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(cashback_amount), 0)::float8 AS balance, COUNT(*)::int AS claimed
         FROM qr_codes WHERE redeemed_consumer_id = $1`,
      [id]
    ),
    // Latest scan of each code this customer scanned
    pool.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (s.qr_id) s.id, s.result, s.created_at,
                q.display_id, q.program, q.cashback_amount::float8 AS cashback_amount,
                (q.redeemed_consumer_id = $1) AS claimed_by_me, (q.redeemed_at IS NOT NULL) AS redeemed,
                p.name AS product_name, c.name AS campaign_name
           FROM qr_scans s
           JOIN qr_codes q ON q.id = s.qr_id
           JOIN qr_batches b ON b.id = q.batch_id
           JOIN campaigns c ON c.id = b.campaign_id
           JOIN products p ON p.id = c.product_id
          WHERE s.consumer_id = $1
          ORDER BY s.qr_id, s.created_at DESC
       ) latest ORDER BY created_at DESC LIMIT 50`,
      [id]
    ),
  ]);
  const { rows: [{ scans }] } = await pool.query('SELECT COUNT(DISTINCT qr_id)::int AS scans FROM qr_scans WHERE consumer_id = $1', [id]);
  res.json({ ...summary, scans, history });
});

module.exports = router;
