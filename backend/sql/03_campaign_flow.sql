-- Step 1: the product a campaign is run for
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Step 2: campaign details
CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

-- Step 3: a generated batch of QR codes
CREATE TABLE IF NOT EXISTS qr_batches (
  id SERIAL PRIMARY KEY,
  campaign_id INT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  name TEXT,
  quantity INT NOT NULL CHECK (quantity > 0),
  activation_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (expiry_date >= activation_date)
);

-- Step 4: one "assign program" action (verification / cashback / both)
CREATE TABLE IF NOT EXISTS program_assignments (
  id SERIAL PRIMARY KEY,
  batch_id INT NOT NULL REFERENCES qr_batches(id) ON DELETE CASCADE,
  program TEXT NOT NULL CHECK (program IN ('verification', 'cashback', 'both')),
  qr_count INT NOT NULL CHECK (qr_count > 0),
  tiers JSONB NOT NULL DEFAULT '[]',
  total_cashback NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Step 5: every individual QR code
CREATE TABLE IF NOT EXISTS qr_codes (
  id SERIAL PRIMARY KEY,
  batch_id INT NOT NULL REFERENCES qr_batches(id) ON DELETE CASCADE,
  serial_no INT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  assignment_id INT REFERENCES program_assignments(id) ON DELETE SET NULL,
  program TEXT CHECK (program IN ('verification', 'cashback', 'both')),
  cashback_amount NUMERIC(10, 2),
  scan_count INT NOT NULL DEFAULT 0,
  first_scanned_at TIMESTAMP,
  last_scanned_at TIMESTAMP,
  redeemed_at TIMESTAMP,
  redeemed_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (batch_id, serial_no)
);

CREATE INDEX IF NOT EXISTS qr_codes_batch_program_idx ON qr_codes (batch_id, program);
