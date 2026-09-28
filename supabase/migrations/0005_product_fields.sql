-- 0005_product_fields.sql
-- Add missing columns to products table that were added to the codebase later

ALTER TABLE products
ADD COLUMN video_url text,
ADD COLUMN description text,
ADD COLUMN features jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN offer_qty int,
ADD COLUMN offer_total_mad numeric(10,2);

-- Reload schema cache to ensure PostgREST sees the new columns immediately
NOTIFY pgrst, 'reload schema';
