# AGENTS.md — COD Order Manager "ShoeSpot" (v1, single-user)

Read this file fully before making any change. If context is lost, re-read it.

## Project
Cash-on-delivery order manager for a Moroccan shoe seller:
public Arabic RTL landing page (single product) → order form → admin dashboard
(WhatsApp wa.me confirmation, follow-up queue, blacklist, couriers, P&L, CSV export).
All user-facing text: Moroccan Darija / Arabic, RTL. All amounts: MAD (درهم).
Dates: stored ISO, displayed dd/MM/yyyy.

## Stack (this repo)
- Next.js 16 App Router + TypeScript strict + Tailwind CSS 4 + shadcn/ui + lucide-react
- Prisma ORM + SQLite (file `db/custom.db`) — see "Production path" below for Supabase port
- Auth: single admin, HMAC-SHA256 signed httpOnly cookie `admin_session` (`src/lib/auth.ts`, env `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SESSION_SECRET`)
- WhatsApp: **wa.me deep links ONLY** — no WhatsApp API, no whatsapp-web.js
- Meta Pixel: optional, activates only when `NEXT_PUBLIC_META_PIXEL_ID` is set

## Operating rules
1. Work phase by phase. After completing a phase STOP and ask for browser verification.
2. After each phase: git commit `phase N: <summary>`.
3. Stick to this spec. Do NOT add features that are not described here.
4. Prefer official packages: shadcn/ui components, zod, date-fns, sonner.
5. Never commit `.env` / `db/custom.db`.

## Environment variables
```
DATABASE_URL=file:/home/z/my-project/db/custom.db
ADMIN_EMAIL=admin@shop.ma
ADMIN_PASSWORD=admin123            # change in production
SESSION_SECRET=<random 64 hex>
NEXT_PUBLIC_SELLER_WHATSAPP=212600000000   # seller number 2126XXXXXXXX
NEXT_PUBLIC_META_PIXEL_ID=                  # optional
```

## Domain rules
- Phone: Moroccan mobile `^0(6|7)[0-9]{8}$`; normalize (+212/212 → 06/07). wa.me link = `https://wa.me/212{phone without leading 0}?text={encoded}`.
- Statuses: new, confirmed, no_answer, retry, postponed, canceled, shipped, delivered, returned.
- Template selection: new & attempts=0 → confirm_1 | no_answer/retry & attempts=1 → followup_2 | attempts≥2 → followup_3 | confirmed & ships tomorrow → day_before | shipped → shipped.
- WhatsApp click = log order_event, attempts++, lastAttemptAt=now, no_answer → retry.
- Auto-blacklist: when an order becomes returned/canceled, if the phone reaches ≥2 such orders → upsert BlacklistEntry (strikes = count).
- CSV export (for courier): UTF-8 BOM + CRLF. Columns: رقم الطلب، الاسم، الهاتف، المدينة، الحي/نقطة دالة، المنتج (مقاس/لون)، الكمية، المبلغ (درهم)، ملاحظات.
- P&L per product (30d): delivered revenue − product cost − courier fees (delivery + return) − ad-spend allocation (total ad spend × product orders / total orders).

## Structure map
```
src/app/                 routes
  page.tsx               public landing (hero, configurator, order form, gallery, sticky CTA)
  success/               order confirmation page (?n=orderNumber)
  login/                 admin login
  admin/                 dashboard, orders, followup, blacklist, couriers, finance, templates
  api/                   auth, orders (+bulk, export), whatsapp, kpis, followup, blacklist,
                         couriers, templates, finance, products
src/lib/                 auth.ts, whatsapp.ts (templates engine), phone.ts, csv.ts, constants.ts, db.ts
src/components/          ui/ (shadcn) + landing/ + admin/
prisma/schema.prisma     Product, Order, OrderEvent, MessageTemplate, BlacklistEntry, Courier, DailyAdSpend
prisma/seed.ts           demo product, 7 Darija templates, 3 couriers, 17 orders, 14d ad spend
supabase/migrations/     production Postgres port (RLS included) — see below
```

## Production path (v1.1 — when ready to go live)
1. Create Supabase project (region Frankfurt), run `supabase/migrations/0001_init.sql` in SQL Editor, then `0002_seed.sql`.
2. Create the single admin user in Supabase Auth dashboard.
3. Port data access from Prisma to `@supabase/ssr` (tables/columns match the Prisma schema; RLS policies from the user spec are already in the migration: orders → anon INSERT only, products → anon SELECT, everything else → authenticated only).
4. Deploy repo to Vercel (free), set env vars, point the .com domain, verify Pixel with Meta Pixel Helper.
   Alternative (zero porting): keep Prisma + SQLite and host on any small VPS / the seller's own machine.

## Demo credentials
admin@shop.ma / admin123 (see .env; change before going live)
