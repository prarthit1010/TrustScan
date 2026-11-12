-- Fast "contains" search on the visible QR ID (e.g. typing 0047 finds ABC0047) in QR Details.
-- Without this, ILIKE '%...%' has to read every QR code.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS qr_codes_display_id_trgm ON qr_codes USING gin (display_id gin_trgm_ops);
