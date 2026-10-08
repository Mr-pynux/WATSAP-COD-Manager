-- 0009_reclamations.sql: Customer complaints and claims management table

create table if not exists reclamations (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null default 'زبون',
  phone text not null,
  order_id uuid references orders(id) on delete set null,
  type text not null default 'other' check (type in ('exchange', 'return', 'delivery_delay', 'product_defect', 'cancellation', 'other')),
  issue text not null,
  status text not null default 'pending' check (status in ('pending', 'contacted', 'resolved', 'dismissed')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reclamations_phone_idx on reclamations(phone);
create index if not exists reclamations_status_idx on reclamations(status);
create index if not exists reclamations_created_at_idx on reclamations(created_at desc);

alter table reclamations enable row level security;

create policy "reclamations_all_authenticated" on reclamations
  for all to authenticated using (true) with check (true);

create policy "reclamations_service_role" on reclamations
  for all to service_role using (true) with check (true);
