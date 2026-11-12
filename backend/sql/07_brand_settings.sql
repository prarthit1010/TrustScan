-- Per-brand settings: app name and logo shown in the dashboard and on scan pages,
-- and which details must be entered when assigning a verification program (defaults live in routes/settings.js)
CREATE TABLE IF NOT EXISTS brand_settings (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL,
  logo TEXT,
  verification_fields JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- The verification details entered for an assignment: [{ key, label, type, value }]
ALTER TABLE program_assignments ADD COLUMN IF NOT EXISTS verification_details JSONB NOT NULL DEFAULT '[]';
