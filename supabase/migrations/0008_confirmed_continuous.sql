-- 0008_confirmed_continuous.sql: Add 'confirmed_continuous' (مؤكدة مستمرة) to orders status check constraint

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN (
    'new',
    'confirmed',
    'confirmed_continuous',
    'no_answer',
    'retry',
    'postponed',
    'canceled',
    'shipped',
    'delivered',
    'returned'
  ));
