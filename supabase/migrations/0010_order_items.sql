-- 0010_order_items.sql: Add items jsonb column to orders table for multi-item orders and bundle offers

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items jsonb;

COMMENT ON COLUMN public.orders.items IS 'List of ordered items with productId, name, size, color, quantity, price, and imageUrl';
