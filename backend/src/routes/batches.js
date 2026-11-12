const crypto = require('crypto');
const express = require('express');
const pool = require('../db');
const { writeLabelsPdf } = require('../qrPdf');
const { HttpError, isDate, toInt, clean } = require('./util');

const router = express.Router();

const MAX_BATCH = 10000;
// 32 symbols without look-alikes (0/O, 1/I); 12 chars = 60 bits, so codes can't be guessed
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode() {
  let code = '';
  for (const byte of crypto.randomBytes(12)) code += ALPHABET[byte & 31];
  return code;
}

router.get('/', async (req, res) => {
  const params = [req.user.id];
  let where = 'c.user_id = $1 AND b.deleted_at IS NULL';
  if (req.query.campaign_id) {
    params.push(req.query.campaign_id);
    where += ` AND b.campaign_id = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT b.*, c.name AS campaign_name, p.name AS product_name,
            COUNT(q.id) FILTER (WHERE q.program IS NOT NULL)::int AS assigned_count,
            COUNT(q.id) FILTER (WHERE q.program IS NULL)::int AS unassigned_count,
            COUNT(q.id) FILTER (WHERE q.scan_count > 0)::int AS scanned_count
       FROM qr_batches b
       JOIN campaigns c ON c.id = b.campaign_id
       JOIN products p ON p.id = c.product_id
       LEFT JOIN qr_codes q ON q.batch_id = b.id
      WHERE ${where}
      GROUP BY b.id, c.name, p.name
      ORDER BY b.id DESC`,
    params
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const quantity = toInt(req.body.quantity);
  const { activation_date, expiry_date } = req.body;
  if (!(quantity >= 1 && quantity <= MAX_BATCH)) {
    throw new HttpError(400, `Number of QR codes must be between 1 and ${MAX_BATCH}`);
  }
  if (!isDate(activation_date) || !isDate(expiry_date)) {
    throw new HttpError(400, 'Activation date and expiry date are required');
  }
  if (expiry_date < activation_date) throw new HttpError(400, 'Expiry date must be on or after the activation date');

  const { rows: [campaign] } = await pool.query('SELECT * FROM campaigns WHERE id = $1 AND user_id = $2', [
    toInt(req.body.campaign_id) || 0,
    req.user.id,
  ]);
  if (!campaign) throw new HttpError(400, 'Select a valid campaign');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [batch] } = await client.query(
      `INSERT INTO qr_batches (campaign_id, name, quantity, activation_date, expiry_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [campaign.id, clean(req.body.name), quantity, activation_date, expiry_date]
    );
    const serials = Array.from({ length: quantity }, (_, i) => i + 1);
    const codes = serials.map(() => randomCode());
    // Visible IDs (ABC0000, ABC0001...) come from one global sequence, so they are unique across all batches
    const { rows: seq } = await client.query("SELECT nextval('qr_display_seq') AS n FROM generate_series(1, $1)", [quantity]);
    const numbers = seq.map((r) => Number(r.n)).sort((a, b) => a - b);
    await client.query(
      `INSERT INTO qr_codes (batch_id, serial_no, code, display_id)
       SELECT $1, s, c, qr_display_id(n) FROM unnest($2::int[], $3::text[], $4::bigint[]) AS t(s, c, n)`,
      [batch.id, serials, codes, numbers]
    );
    await client.query('COMMIT');
    res.status(201).json(batch);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

router.get('/:id/pdf', async (req, res) => {
  const { rows: [batch] } = await pool.query(
    `SELECT b.*, c.name AS campaign_name, p.name AS product_name
       FROM qr_batches b
       JOIN campaigns c ON c.id = b.campaign_id
       JOIN products p ON p.id = c.product_id
      WHERE b.id = $1 AND c.user_id = $2 AND b.deleted_at IS NULL`,
    [req.params.id, req.user.id]
  );
  if (!batch) throw new HttpError(404, 'Batch not found');
  const { rows: codes } = await pool.query('SELECT code, display_id FROM qr_codes WHERE batch_id = $1 ORDER BY serial_no', [
    batch.id,
  ]);
  const first = codes[0]?.display_id;
  const last = codes[codes.length - 1]?.display_id;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="qr-codes-${first}-${last}.pdf"`);
  writeLabelsPdf(res, codes, batch);
});

router.delete('/:id', async (req, res) => {
  const { rows: [batch] } = await pool.query(
    `SELECT b.id, COUNT(q.id) FILTER (WHERE q.program IS NOT NULL)::int AS assigned
       FROM qr_batches b
       JOIN campaigns c ON c.id = b.campaign_id
       LEFT JOIN qr_codes q ON q.batch_id = b.id
      WHERE b.id = $1 AND c.user_id = $2 AND b.deleted_at IS NULL
      GROUP BY b.id`,
    [req.params.id, req.user.id]
  );
  if (!batch) throw new HttpError(404, 'Batch not found');
  if (batch.assigned) throw new HttpError(409, "Programs are already assigned in this batch, so it can't be deleted");
  // Soft delete: keep the batch and its QR codes so their IDs still show (as Deleted) in QR Details
  await pool.query('UPDATE qr_batches SET deleted_at = NOW() WHERE id = $1', [batch.id]);
  res.json({ ok: true });
});

module.exports = router;
