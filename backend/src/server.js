require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const pool = require('./db');
const { router: authRouter, requireAuth } = require('./auth');
const consumerAuth = require('./consumerAuth');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' })); // room for a logo image in settings
app.use(cookieParser());
app.use(morgan('dev'));

app.use('/api/auth', authRouter);
app.use('/api/scan', require('./routes/scan'));
app.use('/api/app/auth', consumerAuth.router);
app.use('/api/app/auth/test-login', require('./testLogin')); // TEMPORARY: see testLogin.js
app.use('/api/app/wallet', consumerAuth.requireConsumer, require('./routes/wallet'));
app.use('/api/stats', requireAuth, require('./routes/stats'));
app.use('/api/products', requireAuth, require('./routes/products'));
app.use('/api/campaigns', requireAuth, require('./routes/campaigns'));
app.use('/api/batches', requireAuth, require('./routes/batches'));
app.use('/api/assignments', requireAuth, require('./routes/assignments'));
app.use('/api/qr-codes', requireAuth, require('./routes/qrcodes'));
app.use('/api/settings', requireAuth, require('./routes/settings').router);

app.get('/api/health', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT NOW() AS time');
    res.json({ status: 'ok', db: 'connected', time: rows[0].time });
  } catch (err) {
    res.status(500).json({ status: 'error', db: err.message });
  }
});

// Save a name
app.post('/api/names', async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO test_names (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all saved names
app.get('/api/names', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM test_names ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.code === '22P02') return res.status(400).json({ error: 'Invalid input' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`TrustScan API running on port ${port}`));
