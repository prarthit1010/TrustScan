-- Customers now log in with a mobile OTP, so new accounts have no password or email
ALTER TABLE consumers ALTER COLUMN email DROP NOT NULL;
ALTER TABLE consumers ALTER COLUMN password_hash DROP NOT NULL;

-- One row per OTP sent. Only a hash of the code is stored.
CREATE TABLE IF NOT EXISTS consumer_otps (
  id SERIAL PRIMARY KEY,
  mobile TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS consumer_otps_mobile_idx ON consumer_otps (mobile, id DESC);
