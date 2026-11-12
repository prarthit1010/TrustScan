-- Customers who use the mobile app to scan QR codes (separate from brand users)
CREATE TABLE IF NOT EXISTS consumers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  mobile TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  mobile_verified BOOLEAN NOT NULL DEFAULT FALSE, -- set once mobile OTP login is added
  created_at TIMESTAMP DEFAULT NOW()
);

-- Which customer claimed a code's cashback (redeemed_by keeps their mobile number for the dashboard)
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS redeemed_consumer_id INT REFERENCES consumers(id) ON DELETE SET NULL;

-- Every scan, for the customer's history and brand analytics
CREATE TABLE IF NOT EXISTS qr_scans (
  id SERIAL PRIMARY KEY,
  qr_id INT NOT NULL REFERENCES qr_codes(id) ON DELETE CASCADE,
  consumer_id INT REFERENCES consumers(id) ON DELETE SET NULL,
  result TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS qr_scans_consumer_idx ON qr_scans (consumer_id, created_at DESC);
