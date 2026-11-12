const express = require('express');
const pool = require('../db');
const { toInt, PROGRAMS } = require('./util');
const { scanUrl } = require('../scanUrl');

const router = express.Router();

const FROM_SQL = `FROM qr_codes q
  JOIN qr_batches b ON b.id = q.batch_id
  JOIN campaigns c ON c.id = b.campaign_id
  JOIN products p ON p.id = c.product_id`;

const COLUMNS_SQL = `q.id, q.code, q.display_id, q.serial_no, q.program, q.cashback_amount::float8 AS cashback_amount,
  q.scan_count, q.first_scanned_at, q.last_scanned_at, q.redeemed_at, q.redeemed_by, q.created_at,
  b.id AS batch_id, b.name AS batch_name, b.activation_date, b.expiry_date,
  c.id AS campaign_id, c.name AS campaign_name, p.name AS product_name,
  b.deleted_at,
  CASE WHEN b.deleted_at IS NOT NULL THEN 'deleted'
       WHEN CURRENT_DATE < b.activation_date THEN 'not_active'
       WHEN CURRENT_DATE > b.expiry_date THEN 'expired'
       ELSE 'live' END AS validity`;

function buildFilter(query, userId) {
  const params = [userId];
  const where = ['c.user_id = $1'];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };
  if (query.campaign_id) add('c.id = ?', query.campaign_id);
  if (query.batch_id) add('b.id = ?', query.batch_id);
  if (query.program === 'none') where.push('q.program IS NULL');
  else if (PROGRAMS.includes(query.program)) add('q.program = ?', query.program);
  if (query.status === 'scanned') where.push('q.scan_count > 0');
  if (query.status === 'not_scanned') where.push('q.scan_count = 0');
  if (query.status === 'redeemed') where.push('q.redeemed_at IS NOT NULL');
  if (query.status === 'deleted') where.push('b.deleted_at IS NOT NULL');
  if (query.q) {
    params.push(`%${String(query.q).trim()}%`);
    where.push(`q.display_id ILIKE $${params.length}`);
  }
  return { params, where: where.join(' AND ') };
}

const DISPLAY_ID_RE = /^[A-Z]{3}\d{4}$/;

// Server-side pagination with a cursor (keyset): "after" = last QR ID of the current page (Next),
// "before" = first QR ID of the current page (Previous). This stays fast on any page, unlike a large
// OFFSET which makes Postgres read and discard every earlier row. Plain ?page= still works as a fallback.
// The total is only counted when asked (count != 0), so clicking Next/Previous doesn't recount everything.
router.get('/', async (req, res) => {
  const limit = Math.min(Math.max(toInt(req.query.limit) || 50, 1), 200);
  const page = Math.max(toInt(req.query.page) || 1, 1);
  const { params, where } = buildFilter(req.query, req.user.id);
  const after = DISPLAY_ID_RE.test(req.query.after) ? req.query.after : null;
  const before = !after && DISPLAY_ID_RE.test(req.query.before) ? req.query.before : null;

  const pageParams = [...params];
  let pageWhere = where;
  let order = 'DESC';
  let offset = 0;
  if (after) {
    pageParams.push(after);
    pageWhere += ` AND q.display_id < $${pageParams.length}`;
  } else if (before) {
    pageParams.push(before);
    pageWhere += ` AND q.display_id > $${pageParams.length}`;
    order = 'ASC';
  } else {
    offset = (page - 1) * limit;
  }

  const [countResult, { rows }] = await Promise.all([
    req.query.count === '0' ? null : pool.query(`SELECT COUNT(*)::int AS total ${FROM_SQL} WHERE ${where}`, params),
    pool.query(
      `SELECT ${COLUMNS_SQL} ${FROM_SQL} WHERE ${pageWhere}
        ORDER BY q.display_id ${order}
        LIMIT ${limit} OFFSET ${offset}`,
      pageParams
    ),
  ]);
  if (before) rows.reverse();
  // Never send the secret code to the dashboard list; it only lives inside the printed QR link
  res.json({ rows: rows.map(({ code, ...r }) => r), total: countResult?.rows[0].total ?? null, page, limit });
});

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

router.get('/export', async (req, res) => {
  const { params, where } = buildFilter(req.query, req.user.id);
  const { rows } = await pool.query(
    `SELECT ${COLUMNS_SQL} ${FROM_SQL} WHERE ${where} ORDER BY q.display_id LIMIT 50000`,
    params
  );
  const header = ['qr_id', 'secret_code', 'scan_url', 'product', 'campaign', 'batch', 'program', 'cashback_amount',
    'activation_date', 'expiry_date', 'validity', 'scan_count', 'redeemed_at', 'deleted_at'];
  const lines = rows.map((r) =>
    [r.display_id, r.code, scanUrl(r.code), r.product_name,
      r.campaign_name, r.batch_name || `Batch #${r.batch_id}`, r.program || 'unassigned', r.cashback_amount,
      r.activation_date, r.expiry_date, r.validity, r.scan_count, r.redeemed_at?.toISOString(), r.deleted_at?.toISOString()]
      .map(csvCell)
      .join(',')
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="qr-codes.csv"');
  res.send([header.join(','), ...lines].join('\n'));
});

module.exports = router;
