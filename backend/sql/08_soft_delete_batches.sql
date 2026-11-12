-- Soft delete for QR batches: the batch and its QR codes stay in the database (so their QR IDs are never
-- silently missing) and are shown as "Deleted" in QR Details, but are hidden everywhere else and can't be scanned.
ALTER TABLE qr_batches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
