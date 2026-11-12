const crypto = require('crypto');
const express = require('express');
const pool = require('../db');
const { HttpError, clean } = require('./util');

const router = express.Router();

const DEFAULT_APP_NAME = 'TrustScan';
const FIELD_TYPES = ['text', 'date', 'number'];
const MAX_FIELDS = 20;
// ~220 KB image once base64-decoded; the logo is sent with every scan, so keep it small
const MAX_LOGO_LENGTH = 300000;
const LOGO_RE = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

// Built-in fields the brand can switch on or off; custom ones are added next to these
const BUILT_IN_FIELDS = [
  { key: 'batch_no', label: 'Batch / Lot number', type: 'text', enabled: true },
  { key: 'mfg_date', label: 'Manufacturing date', type: 'date', enabled: true },
  { key: 'expiry_date', label: 'Expiry / Best before', type: 'date', enabled: true },
  { key: 'mrp', label: 'MRP (₹)', type: 'number', enabled: false },
  { key: 'net_quantity', label: 'Net quantity', type: 'text', enabled: false },
  { key: 'manufactured_at', label: 'Manufactured at', type: 'text', enabled: false },
];
const BUILT_IN_KEYS = BUILT_IN_FIELDS.map((f) => f.key);

// Saved settings, or the defaults if the brand never saved any
async function getSettings(userId, db = pool) {
  const { rows: [s] } = await db.query('SELECT app_name, logo, verification_fields FROM brand_settings WHERE user_id = $1', [userId]);
  const fields = (s?.verification_fields || BUILT_IN_FIELDS).map((f) => ({ ...f, built_in: BUILT_IN_KEYS.includes(f.key) }));
  return { app_name: s?.app_name || DEFAULT_APP_NAME, logo: s?.logo || null, verification_fields: fields };
}

function readFields(raw) {
  if (!Array.isArray(raw) || !raw.length) throw new HttpError(400, 'Add at least one verification field');
  if (raw.length > MAX_FIELDS) throw new HttpError(400, `You can have up to ${MAX_FIELDS} verification fields`);
  const keys = new Set();
  const fields = raw.map((f) => {
    const label = clean(f.label);
    if (!label || label.length > 60) throw new HttpError(400, 'Every verification field needs a name of up to 60 characters');
    // Built-in keys are kept; anything else becomes a custom field with its own key
    const key = BUILT_IN_KEYS.includes(f.key) || /^custom_[a-z0-9]{8}$/.test(f.key) ? f.key : `custom_${crypto.randomBytes(4).toString('hex')}`;
    const builtIn = BUILT_IN_FIELDS.find((b) => b.key === key);
    const type = builtIn ? builtIn.type : f.type;
    if (!FIELD_TYPES.includes(type)) throw new HttpError(400, `Choose a type for "${label}"`);
    if (keys.has(key)) throw new HttpError(400, 'Each verification field can only appear once');
    keys.add(key);
    return { key, label, type, enabled: !!f.enabled };
  });
  if (!fields.some((f) => f.enabled)) throw new HttpError(400, 'Turn on at least one verification field');
  return fields;
}

router.get('/', async (req, res) => {
  res.json(await getSettings(req.user.id));
});

router.put('/', async (req, res) => {
  const appName = clean(req.body.app_name);
  if (!appName || appName.length > 40) throw new HttpError(400, 'App name is required (up to 40 characters)');
  const logo = req.body.logo || null;
  if (logo && (typeof logo !== 'string' || !LOGO_RE.test(logo))) throw new HttpError(400, 'Logo must be a PNG, JPG, WebP or SVG image');
  if (logo && logo.length > MAX_LOGO_LENGTH) throw new HttpError(400, 'Logo is too large. Use an image under 200 KB.');
  const fields = readFields(req.body.verification_fields);

  await pool.query(
    `INSERT INTO brand_settings (user_id, app_name, logo, verification_fields, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET app_name = EXCLUDED.app_name, logo = EXCLUDED.logo,
           verification_fields = EXCLUDED.verification_fields, updated_at = NOW()`,
    [req.user.id, appName, logo, JSON.stringify(fields)]
  );
  res.json(await getSettings(req.user.id));
});

module.exports = { router, getSettings };
