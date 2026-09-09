-- 0001_init.sql — COD Order Manager (production, Supabase / Postgres)
-- Run in Supabase SQL Editor. Matches the Prisma schema of this repo.
-- RLS per spec: orders → anon INSERT only; products → anon SELECT; rest → authenticated only.

create extension if not exists "pgcrypto";

-- ============ TABLES ============
create table products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  image_urls  jsonb not null default '[]',
  price_mad   numeric(10,2) not null,
  old_price_mad numeric(10,2),
  cost_mad    numeric(10,2) not null default 0,
  sizes       jsonb not null default '[]',
  colors      jsonb not null default '[]',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table orders (
  id            uuid primary key default gen_random_uuid(),
  order_number  bigint generated always as identity unique,
  customer_name text not null,
  phone         text not null,                -- local format 06/07XXXXXXXX
  city          text not null,
  district      text,
  landmark      text,
  product_id    uuid not null references products(id),
  size          text not null,
  color         text,
  quantity      int not null default 1 check (quantity between 1 and 3),
  unit_price_mad numeric(10,2) not null,
  status        text not null default 'new'
                check (status in ('new','confirmed','no_answer','retry','postponed','canceled','shipped','delivered','returned')),
  attempts      int not null default 0,
  last_attempt_at timestamptz,
  ship_date     date,
  courier_id    uuid,
  tracking      text,
  notes         text,
  return_reason text check (return_reason in ('size','quality','changed_mind','no_show')),
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz,
  shipped_at    timestamptz,
  delivered_at  timestamptz
);
create index orders_phone_idx on orders(phone);
create index orders_status_idx on orders(status);
create index orders_created_idx on orders(created_at desc);

create table order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  type       text not null check (type in ('created','whatsapp_click','status_change','note')),
  detail     jsonb,
  created_at timestamptz not null default now()
);

create table message_templates (
  id      uuid primary key default gen_random_uuid(),
  key     text unique not null,
  body_ar text not null
);

create table blacklist (
  id         uuid primary key default gen_random_uuid(),
  phone      text unique not null,
  strikes    int not null default 0,
  reasons    jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table couriers (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  contact             text,
  fee_per_delivery_mad numeric(10,2) not null default 0,
  fee_per_return_mad   numeric(10,2) not null default 0
);

create table daily_ad_spend (
  id        uuid primary key default gen_random_uuid(),
  date      date unique not null,
  amount_mad numeric(10,2) not null
);

alter table orders add constraint orders_courier_fk
  foreign key (courier_id) references couriers(id);

-- ============ RLS ============
alter table orders enable row level security;
alter table products enable row level security;
alter table order_events enable row level security;
alter table message_templates enable row level security;
alter table blacklist enable row level security;
alter table couriers enable row level security;
alter table daily_ad_spend enable row level security;

-- orders: anon can INSERT only (landing form), no SELECT/UPDATE
create policy "orders_insert_anon" on orders
  for insert to anon with check (true);
create policy "orders_all_authenticated" on orders
  for all to authenticated using (true) with check (true);

-- order_events: written server-side (service key) or by authenticated admin
create policy "events_all_authenticated" on order_events
  for all to authenticated using (true) with check (true);

-- products: anon SELECT (landing page needs it)
create policy "products_select_anon" on products
  for select to anon using (active = true);
create policy "products_all_authenticated" on products
  for all to authenticated using (true) with check (true);

create policy "templates_all_authenticated" on message_templates
  for all to authenticated using (true) with check (true);
create policy "blacklist_all_authenticated" on blacklist
  for all to authenticated using (true) with check (true);
create policy "couriers_all_authenticated" on couriers
  for all to authenticated using (true) with check (true);
create policy "adspend_all_authenticated" on daily_ad_spend
  for all to authenticated using (true) with check (true);
