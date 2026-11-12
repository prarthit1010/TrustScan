-- Visible QR ID printed under each QR code: ABC0000 ... ABC9999, ABD0000, ... (about 175 million in total).
-- The secret random `code` is only used inside the QR link.
CREATE SEQUENCE IF NOT EXISTS qr_display_seq MINVALUE 0 START 0;

CREATE OR REPLACE FUNCTION qr_display_id(n BIGINT) RETURNS TEXT AS $$
  SELECT chr((65 + ((28 + n / 10000) / 676) % 26)::int)
      || chr((65 + ((28 + n / 10000) / 26) % 26)::int)
      || chr((65 + (28 + n / 10000) % 26)::int)
      || lpad((n % 10000)::text, 4, '0')
$$ LANGUAGE sql IMMUTABLE;

ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS display_id TEXT;

-- Give existing codes an ID in the order they were created
WITH numbered AS (
  SELECT id, nextval('qr_display_seq') AS n
    FROM (SELECT id FROM qr_codes WHERE display_id IS NULL ORDER BY id) s
)
UPDATE qr_codes q SET display_id = qr_display_id(numbered.n) FROM numbered WHERE q.id = numbered.id;

ALTER TABLE qr_codes ALTER COLUMN display_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS qr_codes_display_id_key ON qr_codes (display_id);
