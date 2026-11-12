-- Key details (ingredients, size, origin…) shown to customers alongside the product description
ALTER TABLE products ADD COLUMN IF NOT EXISTS about TEXT;
