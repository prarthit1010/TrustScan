const express = require('express');
const pool = require('../db');
const { HttpError, isDate, toInt, clean } = require('./util');

const router = express.Router();

const STATUS_SQL = `CASE WHEN CURRENT_DATE < c.start_date THEN 'upcoming'
                         WHEN CURRENT_DATE > c.end_date THEN 'ended'
                         ELSE 'active' END`;

async function readCampaign(body, userId) {
  const name = clean(body.name);
  if (!name) throw new HttpError(400, 'Campaign name is required');
  if (!isDate(body.start_date) || !isDate(body.end_date)) {
    throw new HttpError(400, 'Start date and end date are required');
  }
  if (body.end_date < body.start_date) throw new HttpError(400, 'End date must be on or after the start date');
  const { rows } = await pool.query('SELECT id FROM products WHERE id = $1 AND user_id = $2', [
    toInt(body.product_id) || 0,
    userId,
  ]);
  if (!rows[0]) throw new HttpError(400, 'Select a valid product');
  return [name, rows[0].id, body.start_date, body.end_date, clean(body.description)];
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.*, p.name AS product_name, ${STATUS_SQL} AS status,
            (SELECT COUNT(*)::int FROM qr_batches b WHERE b.campaign_id = c.id AND b.deleted_at IS NULL) AS batch_count,
            (SELECT COUNT(*)::int FROM qr_codes q JOIN qr_batches b ON b.id = q.batch_id
              WHERE b.campaign_id = c.id AND b.deleted_at IS NULL) AS qr_count
       FROM campaigns c JOIN products p ON p.id = c.product_id
      WHERE c.user_id = $1
      ORDER BY c.id DESC`,
    [req.user.id]
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM campaigns WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (!rows[0]) throw new HttpError(404, 'Campaign not found');
  res.json(rows[0]);
});

router.post('/', async (req, res) => {
  const values = await readCampaign(req.body, req.user.id);
  const { rows } = await pool.query(
    `INSERT INTO campaigns (name, product_id, start_date, end_date, description, user_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [...values, req.user.id]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const values = await readCampaign(req.body, req.user.id);
  const { rows } = await pool.query(
    `UPDATE campaigns SET name = $1, product_id = $2, start_date = $3, end_date = $4, description = $5
      WHERE id = $6 AND user_id = $7 RETURNING *`,
    [...values, req.params.id, req.user.id]
  );
  if (!rows[0]) throw new HttpError(404, 'Campaign not found');
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM campaigns WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id,
    ]);
    if (!rowCount) throw new HttpError(404, 'Campaign not found');
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23503') throw new HttpError(409, "This campaign has QR batches (deleted batches are kept for history), so it can't be deleted.");
    throw err;
  }
});

module.exports = router;
