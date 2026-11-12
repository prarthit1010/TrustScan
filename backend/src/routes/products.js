const express = require('express');
const pool = require('../db');
const { HttpError, clean } = require('./util');

const router = express.Router();

function readProduct(body) {
  const name = clean(body.name);
  if (!name) throw new HttpError(400, 'Product name is required');
  return [name, clean(body.sku), clean(body.category), clean(body.description), clean(body.about)];
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, COUNT(c.id)::int AS campaign_count
       FROM products p LEFT JOIN campaigns c ON c.product_id = p.id
      WHERE p.user_id = $1
      GROUP BY p.id
      ORDER BY p.id DESC`,
    [req.user.id]
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (!rows[0]) throw new HttpError(404, 'Product not found');
  res.json(rows[0]);
});

router.post('/', async (req, res) => {
  const { rows } = await pool.query(
    `INSERT INTO products (name, sku, category, description, about, user_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [...readProduct(req.body), req.user.id]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE products SET name = $1, sku = $2, category = $3, description = $4, about = $5
      WHERE id = $6 AND user_id = $7 RETURNING *`,
    [...readProduct(req.body), req.params.id, req.user.id]
  );
  if (!rows[0]) throw new HttpError(404, 'Product not found');
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM products WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id,
    ]);
    if (!rowCount) throw new HttpError(404, 'Product not found');
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23503') throw new HttpError(409, 'This product has campaigns. Delete those campaigns first.');
    throw err;
  }
});

module.exports = router;
