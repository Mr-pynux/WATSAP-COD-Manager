# Task 3 — Main Build (COD Order Manager: StyleKicks)

Agent: full-stack developer (main build)
Task ID: 3
Date: 2026-09-09

## Scope delivered (P0+P1+P2 — ALL)

Full COD e-commerce app for a Moroccan shoe seller, Arabic RTL end-to-end:
public landing + order form, success page, cookie-HMAC auth + middleware,
admin dashboard (KPIs), orders table (filters/pagination/bulk/CSV/edit sheet),
WhatsApp deep-link messaging with templates + attempts engine, follow-up queue
(time buckets + double-confirm), auto blacklist, couriers + fees, finance
(ad spend + per-product P&L), templates editor, Prisma seed.

## Files created / modified

**Config**
- `next.config.ts` — + images.remotePatterns (z-cdn.chatglm.cn)
- `.env` — ADMIN_EMAIL/PASSWORD, SESSION_SECRET (random hex), NEXT_PUBLIC_META_PIXEL_ID (empty), NEXT_PUBLIC_SELLER_WHATSAPP
- `src/app/globals.css` — emerald primary (light+dark), Cairo font-sans, `--wa` WhatsApp green token, `.ltr-num`, `.nice-scroll`
- `src/app/layout.tsx` — `<html lang="ar" dir="rtl">`, Cairo `<link>`, ThemeProvider, sonner Toaster (RTL, top-center)

**Prisma / seed**
- `prisma/schema.prisma` — Product, Order, OrderEvent, MessageTemplate, BlacklistEntry, Courier, DailyAdSpend (no enums / no scalar lists; JSON strings)
- `prisma/seed.ts` — 1 product (249/399, cost 140, 6 OSS images), 7 exact templates, 3 couriers, blacklist 0611223344 (2 strikes), 17 orders across 30d in every status (incl. 2 no_answer @4h, 1 confirmed shipDate=tomorrow, shipped w/ TRK88231), 14 ad-spend days, OrderEvents per spec

**Lib (src/lib)**
- `constants.ts` (statuses/labels/badge classes/return reasons/cities/template labels)
- `auth.ts` (node HMAC sign/verify + requireAdmin + cookie opts)
- `phone.ts` (06/07 regex, 212 normalize, wa.me builder)
- `whatsapp.ts` (render vars, formatTotal, pickTemplateKey)
- `csv.ts` (BOM + CRLF, Arabic headers)
- `types.ts` `format.ts` `serialize.ts` `blacklist.ts` (auto rule) `orders-service.ts` (status change + events + timestamps) `orders-query.ts` (shared list/export filters)
- `db.ts` — prisma log reduced to error/warn (was flooding dev.log)

**API (src/app/api)**
- auth/login, auth/logout
- products (GET public)
- orders (POST public zod-validated + GET admin filters/pagination/blacklistPhones)
- orders/[id] (PATCH: status+timestamps+event+auto-blacklist, returnReason/courierId/tracking/shipDate/notes)
- orders/[id]/event (POST manual event — "تأكد اليوم")
- orders/bulk, orders/export (CSV, ids or filters)
- whatsapp (POST: template pick/render, event, attempts++, no_answer→retry)
- kpis, followup (queue+doubleConfirm+suggestedTemplateKey), blacklist (+[id] DELETE by **database id**), couriers (+[id] PATCH), templates (GET/PUT single), finance (GET P&L), finance/adspend (GET/POST upsert)

**Middleware**: `src/middleware.ts` — Web Crypto HMAC verify, protects /admin/*, redirect /login

**Pages**
- `/` — server page fetches product → `components/public/landing-client.tsx` (hero 249/−38%, benefits, configurator w/ size-chart dialog, form with live phone validation + summary, trust strip, gallery next/image, footer + /login link, sticky mobile CTA w/ safe-area; forces light theme; fbq Purchase)
- `/success` — green CheckCircle, ORD-n, wa.me seller support, back link
- `/login` — centered card + demo hint
- `/admin/*` — `components/admin/admin-shell.tsx` (desktop collapsible sidebar, mobile bottom TabBar w/ followup badge + "المزيد" sheet, header w/ theme toggle + logout)
- `/admin` (6 KPI cards + followup highlight + latest 5), orders (filters, desktop Table / mobile cards, inline status select, WA button, edit Sheet, multi-select + bulk + CSV, blacklist banner badge), followup (2 tabs, time buckets, quick actions), blacklist (info alert + manual add + table/cards + delete), couriers (cards + stats + inline fee editor + add form), finance (ad-spend form + 14d list, per-product P&L w/ allocation caption, summary KPIs), templates (cards + RTL textarea + var chips + save)

**Misc**: `src/components/meta-pixel.tsx`, `src/components/status-badge.tsx`, `src/components/admin/wa-button.tsx`, `README.md`

## Decisions

- Statuses as plain strings + app constants (SQLite constraint) — badge colors via class map, not enum.
- `orderNumber` = max+1 at insert (no autoincrement attr in spec schema).
- Blacklist auto rule: entry upserted at count>=2; existing entries always re-synced to current count (spec's "always upsert strikes count").
- Blacklisted phones still accepted on public POST (silent) with "⚠️ رقم فالبلاك ليست" note — banner in orders table uses AlertTriangle (no emoji in chrome; emojis only inside WhatsApp templates).
- GET /api/orders returns `blacklistPhones` set; page joins with /api/blacklist for strike counts.
- pickTemplateKey fallback: confirmed→day_before, new-after-attempt→followup_2.
- "تأكد اليوم" = POST /api/orders/[id]/event (status_change w/ note) — no status mutation.
- Returned orders in KPIs/P&L use deliveredAt window (seed sets deliveredAt on returned).
- Theme toggle icons via CSS (dark:) to avoid hydration mounted-state (also satisfies react-hooks/set-state-in-effect lint rule).

## Test results (curl, cookie jar)

- Pages: / 200, /login 200, /success 200, /admin → 307 → /login; with cookie all 7 admin pages 200
- Bad login 401 (Darija error) / good login 200 + cookie
- POST /api/orders: valid 201 (orderNumber 18), blacklisted phone accepted w/ note, bad phone 400, bad city 400
- POST /api/whatsapp on no_answer: templateKey=followup_2, wa.me URL, attempts 1→2, status→retry, event logged (verified via prisma script)
- PATCH: confirmedAt set + event; full edit (courier/tracking/shipDate/notes) OK; returned+returnReason → blacklist strikes 2→3 reasons updated
- bulk {ids,status} changed=1; event route 201; blacklist POST/DELETE 200; couriers GET/PATCH 200 (fixed: order by name — Courier has no createdAt); templates PUT 200; adspend POST upsert 200; CSV: BOM+CRLF+Arabic headers+Content-Disposition orders-date.csv
- Landing SSR contains product data, Cairo, next/image srcset; optimized image fetch 200 (38KB)
- `bun run lint` — 0 errors 0 warnings
- DB re-seeded to pristine demo state after tests

## Known gaps / notes

- Order filter date pickers are native date inputs (dd/MM/yyyy shown via date-fns after load).
- P&L seed demo shows negative net (ad spend 2100 vs 6 delivered) — realistic cautionary demo, shows rose color.
- followup doubleConfirm list assumes server timezone for "tomorrow" (sandbox UTC; acceptable single-user v1).
- No automated tests per instructions; manual curl flow documented above.
