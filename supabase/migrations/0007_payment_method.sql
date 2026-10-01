-- Add payment_method to orders
ALTER TABLE orders ADD COLUMN payment_method text NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod', 'paypal', 'rib'));
