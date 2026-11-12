-- Speeds up the per-assignment stats (code range, scans, redemptions) on the Assign Program page
CREATE INDEX IF NOT EXISTS qr_codes_assignment_id_idx ON qr_codes (assignment_id);
