ALTER TABLE products ADD COLUMN stock_by_size jsonb DEFAULT '{}'::jsonb; NOTIFY pgrst, 'reload schema';
