const crypto = require('crypto');
const express = require('express');
const pool = require('../db');
const { HttpError, isDate, toInt, clean, PROGRAMS } = require('./util');
const { getSettings } = require('./settings');

const router = express.Router();

const MAX_CASHBACK = 100000;

// Validates the request; for cashback programs the tier counts must add up to qr_count exactly
function readAssignment(body) {
  const { program } = body;
  if (!PROGRAMS.includes(program)) throw new HttpError(400, 'Select a program');
  const qrCount = toInt(body.qr_count);
  if (!(qrCount >= 1)) throw new HttpError(400, 'Number of QR codes must be at least 1');
  if (program === 'verification') return { program, qrCount, tiers: [] };

  const raw = Array.isArray(body.tiers) ? body.tiers : [];
  if (!raw.length) throw new HttpError(400, 'Add at least one cashback tier');
  const tiers = raw.map((t) => {
    const count = toInt(t.count);
    const amount = Math.round(Number(t.amount) * 100) / 100;
    if (!(count >= 1)) throw new HttpError(400, 'Each cashback tier needs at least 1 QR code');
    if (!(amount > 0 && amount <= MAX_CASHBACK)) {
      throw new HttpError(400, `Each cashback amount must be between 0.01 and ${MAX_CASHBACK}`);
    }
    return { count, amount };
  });
  const total = tiers.reduce((sum, t) => sum + t.count, 0);
  if (total !== qrCount) {
    throw new HttpError(400, `Cashback tiers add up to ${total} QR codes, but you are assigning ${qrCount}. They must match.`);
  }
  return { program, qrCount, tiers };
}

// Every field turned on in Settings must be filled in for verification programs; saved as [{ key, label, type, value }]
function readVerificationDetails(body, fields) {
  const values = body.verification_details && typeof body.verification_details === 'object' ? body.verification_details : {};
  const details = fields.filter((f) => f.enabled).map((f) => {
    const value = clean(values[f.key]);
    if (!value) throw new HttpError(400, `${f.label} is required for verification`);
    if (value.length > 200) throw new HttpError(400, `${f.label} must be 200 characters or less`);
    if (f.type === 'date' && !isDate(value)) throw new HttpError(400, `${f.label} must be a valid date`);
    if (f.type === 'number' && !(Number.isFinite(Number(value)) && Number(value) >= 0)) {
      throw new HttpError(400, `${f.label} must be a number`);
    }
    return { key: f.key, label: f.label, type: f.type, value };
  });
  const mfg = details.find((d) => d.key === 'mfg_date');
  const expiry = details.find((d) => d.key === 'expiry_date');
  if (mfg && expiry && expiry.value < mfg.value) throw new HttpError(400, `${expiry.label} must be on or after the ${mfg.label.toLowerCase()}`);
  return details;
}

// Fisher-Yates with a CSPRNG so nobody can predict which code carries which reward
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.id, a.batch_id, a.program, a.qr_count, a.tiers, a.total_cashback::float8 AS total_cashback,
            a.verification_details, a.created_at, b.name AS batch_name, c.name AS campaign_name, p.name AS product_name,
            s.first_code, s.last_code, s.scanned, s.redeemed, s.cashback_paid
       FROM program_assignments a
       JOIN qr_batches b ON b.id = a.batch_id
       JOIN campaigns c ON c.id = b.campaign_id
       JOIN products p ON p.id = c.product_id
       LEFT JOIN LATERAL (
         SELECT (ARRAY_AGG(q.display_id ORDER BY q.serial_no))[1] AS first_code,
                (ARRAY_AGG(q.display_id ORDER BY q.serial_no DESC))[1] AS last_code,
                COUNT(*) FILTER (WHERE q.first_scanned_at IS NOT NULL)::int AS scanned,
                COUNT(*) FILTER (WHERE q.redeemed_at IS NOT NULL)::int AS redeemed,
                COALESCE(SUM(q.cashback_amount) FILTER (WHERE q.redeemed_at IS NOT NULL), 0)::float8 AS cashback_paid
           FROM qr_codes q WHERE q.assignment_id = a.id
       ) s ON TRUE
      WHERE c.user_id = $1
      ORDER BY a.id DESC
      LIMIT 100`,
    [req.user.id]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const a = readAssignment(req.body);
  const details = a.program === 'cashback' ? [] : readVerificationDetails(req.body, (await getSettings(req.user.id)).verification_fields);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Locking the batch row serialises concurrent assignments on the same batch
    const { rows: [batch] } = await client.query(
      `SELECT b.id FROM qr_batches b JOIN campaigns c ON c.id = b.campaign_id
        WHERE b.id = $1 AND c.user_id = $2 AND b.deleted_at IS NULL FOR UPDATE OF b`,
      [toInt(req.body.batch_id) || 0, req.user.id]
    );
    if (!batch) throw new HttpError(400, 'Select a valid QR batch');

    // Codes are taken in serial order (the next N unassigned) so they match the printed label sequence
    const { rows: free } = await client.query(
      'SELECT id FROM qr_codes WHERE batch_id = $1 AND program IS NULL ORDER BY serial_no LIMIT $2',
      [batch.id, a.qrCount]
    );
    if (free.length < a.qrCount) {
      throw new HttpError(400, `Only ${free.length} unassigned QR codes are left in this batch`);
    }

    const ids = free.map((r) => r.id);
    // Cashback amounts stay shuffled across those sequential codes so rewards can't be predicted
    const amounts = a.tiers.length
      ? shuffle(a.tiers.flatMap((t) => Array(t.count).fill(t.amount)))
      : Array(a.qrCount).fill(null);
    const totalCashback = Math.round(a.tiers.reduce((sum, t) => sum + t.count * t.amount, 0) * 100) / 100;

    const { rows: [assignment] } = await client.query(
      `INSERT INTO program_assignments (batch_id, program, qr_count, tiers, total_cashback, verification_details)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [batch.id, a.program, a.qrCount, JSON.stringify(a.tiers), totalCashback, JSON.stringify(details)]
    );
    await client.query(
      `UPDATE qr_codes q SET assignment_id = $1, program = $2, cashback_amount = t.amount
         FROM unnest($3::int[], $4::numeric[]) AS t(id, amount)
        WHERE q.id = t.id`,
      [assignment.id, a.program, ids, amounts]
    );
    await client.query('COMMIT');
    res.status(201).json(assignment);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

module.exports = router;
