require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const pool = require('./db');

// Runs every file in sql/ in name order; each file is idempotent (IF NOT EXISTS)
(async () => {
  const dir = path.join(__dirname, '..', 'sql');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8').replace(/^﻿/, '');
    await pool.query(sql);
    console.log('applied', file);
  }
  await pool.end();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
