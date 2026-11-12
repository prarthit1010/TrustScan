const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  const uid = [req.user.id];
  const [counts, qr, recent] = await Promise.all([
    pool.query(
      `SELECT (SELECT COUNT(*)::int FROM products WHERE user_id = $1) AS products,
              (SELECT COUNT(*)::int FROM campaigns WHERE user_id = $1) AS campaigns,
              (SELECT COUNT(*)::int FROM campaigns
                WHERE user_id = $1 AND CURRENT_DATE BETWEEN start_date AND end_date) AS active_campaigns,
              (SELECT COUNT(*)::int FROM qr_batches b JOIN campaigns c ON c.id = b.campaign_id
                WHERE c.user_id = $1 AND b.deleted_at IS NULL) AS batches`,
      uid
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE q.program IS NULL)::int AS unassigned,
              COUNT(*) FILTER (WHERE q.program = 'verification')::int AS verification,
              COUNT(*) FILTER (WHERE q.program = 'cashback')::int AS cashback,
              COUNT(*) FILTER (WHERE q.program = 'both')::int AS both,
              COUNT(*) FILTER (WHERE q.scan_count > 0)::int AS scanned,
              COUNT(*) FILTER (WHERE q.redeemed_at IS NOT NULL)::int AS redeemed,
              COALESCE(SUM(q.cashback_amount), 0)::float8 AS cashback_allocated,
              COALESCE(SUM(q.cashback_amount) FILTER (WHERE q.redeemed_at IS NOT NULL), 0)::float8 AS cashback_redeemed
         FROM qr_codes q
         JOIN qr_batches b ON b.id = q.batch_id
         JOIN campaigns c ON c.id = b.campaign_id
        WHERE c.user_id = $1 AND b.deleted_at IS NULL`,
      uid
    ),
    pool.query(
      `SELECT c.id, c.name, c.start_date, c.end_date, p.name AS product_name,
              CASE WHEN CURRENT_DATE < c.start_date THEN 'upcoming'
                   WHEN CURRENT_DATE > c.end_date THEN 'ended'
                   ELSE 'active' END AS status,
              (SELECT COUNT(*)::int FROM qr_codes q JOIN qr_batches b ON b.id = q.batch_id
                WHERE b.campaign_id = c.id AND b.deleted_at IS NULL) AS qr_count
         FROM campaigns c JOIN products p ON p.id = c.product_id
        WHERE c.user_id = $1
        ORDER BY c.id DESC
        LIMIT 5`,
      uid
    ),
  ]);
  res.json({ counts: counts.rows[0], qr: qr.rows[0], recent: recent.rows });
});

module.exports = router;
