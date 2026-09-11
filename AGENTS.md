{
  "project": "COD Order Manager - BACKEND + ADMIN (frontend landing page handled separately)",
  
  "operating_rules": [
    "Read this entire file before starting. Work PHASE BY PHASE.",
    "After each phase: STOP, list what to verify, wait for my confirmation.",
    "git commit after each phase: 'phase N: <what was done>'",
    "Do NOT add features not in this spec.",
    "Never print or log secrets. Service role key stays server-only.",
    "If context is lost: re-read this file + check git log."
  ],

  "stack": {
    "framework": "Next.js 15 App Router + TypeScript strict",
    "backend": "Supabase (@supabase/ssr) + Server Actions (no separate API needed)",
    "admin_ui": "shadcn/ui + Tailwind (dashboard pages)",
    "no_paid_apis": true,
    "whatsapp": "wa.me deep links ONLY"
  },

  "env_vars_required": [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY (server-only, never client)",
    "NEXT_PUBLIC_META_PIXEL_ID",
    "NEXT_PUBLIC_SELLER_WHATSAPP"
  ],

  "phone_rules": {
    "validation_regex": "^(0)(6|7)[0-9]{8}$",
    "normalize": "strip +212, spaces, dashes; store as 06XXXXXXXX",
    "wa_link": "https://wa.me/212{phone_without_leading_0}?text={urlencoded}"
  },

  "supabase_setup": {
    "migrations_folder": "/supabase/migrations/ (numbered: 001_schema.sql, 002_rls.sql, 003_seed.sql)",
    "tables": {
      "products": "id uuid pk default gen_random_uuid(), name text, image_urls text[], price_mad numeric, cost_mad numeric, sizes text[], colors text[], active boolean default true",
      "orders": "id uuid pk, customer_name text, phone text, city text, district text, landmark text, product_id uuid references products, size text, color text, quantity int default 1, unit_price_mad numeric, status text default 'new', attempts int default 0, courier_id uuid, tracking text, notes text, return_reason text, created_at timestamptz default now(), confirmed_at timestamptz, shipped_at timestamptz, delivered_at timestamptz",
      "order_events": "id uuid pk, order_id uuid references orders, event_type text, payload jsonb, created_at timestamptz default now()",
      "message_templates": "id uuid pk, key text unique, body_ar text",
      "blacklist": "id uuid pk, phone text, strikes int default 1, reasons text[], created_at timestamptz default now()",
      "couriers": "id uuid pk, name text, contact text, fee_per_delivery_mad numeric, fee_per_return_mad numeric",
      "daily_ad_spend": "date date pk, amount_mad numeric"
    },
    "orders_statuses_check": "CHECK constraint: status IN ('new','confirmed','no_answer','retry','postponed','canceled','shipped','delivered','returned')",
    "orders_indexes": "index on status, index on phone, index on created_at desc"
  },

  "rls_policies": [
    "products: SELECT for anon AND authenticated",
    "orders: INSERT for anon (public form), SELECT/UPDATE/DELETE for authenticated only",
    "message_templates, blacklist, couriers, daily_ad_spend, order_events: authenticated only"
  ],

  "seed_sql": {
    "message_templates": [
      "confirm_1: 'سلام {name} 👋\\nوصلنا ططلبك ديال {product} مقاس {size} ✅\\n💰 {total} درهم — الدفع عند الاستلام\\n📍 {city}\\n📏 المقاس عندك التبديل ديالو مجاني إلا ماجاكش\\n\\nجاوب بـ *1* للتأكيد ولا *2* للإلغاء 🙏'",
      "followup_2: 'سلام {name} 🙏 مازال مقفلين معانا فتأكيد {product}...\\nالكمية محدودة — جاوب *1* للتأكيد / *2* للإلغاء'",
      "followup_3: 'آخر رسالة 🙏 إلا ما تأكدش الطلب ديال {product} هاد اليوم غنلغيو من النظام.\\n*1* تأكيد / *2* إلغاء'",
      "day_before: 'سلام {name} ✅ الطلب ديال {product} غيخرج غدا للتوصيل 🚚\\nجاوب *1* باش نأكدو، ورجاك تكون متوفر على الرقم 🙏'",
      "shipped: 'طلبك فالطريق 🚚 رقم التتبع: {tracking}'",
      "thanks: 'شكرا على الثقة 🙏 إلا عجبك المقاس والتصميم شاركهم مع صحابك 😉'"
    ]
  },

  "server_actions_required": [
    "createOrder: public, validates phone regex, checks blacklist (if match: still create but flag), inserts order + order_event 'created'",
    "updateOrderStatus: admin, updates status + relevant timestamp + order_event",
    "logWhatsAppAttempt: admin, increments attempts, sets no_answer->retry, logs event with template key used",
    "addToBlacklist / checkBlacklist: admin + auto after 2 strikes",
    "exportOrdersCSV: admin, takes order IDs array, returns CSV string (CRLF, columns: name, phone, city, district+landmark, product+size+color, COD amount, notes)",
    "saveAdSpend: admin, upsert daily_ad_spend",
    "getFollowupQueue: admin, returns no_answer/retry orders grouped by '3h+' and '24h+' since last attempt",
    "getDoubleConfirmList: admin, confirmed orders where shipped_at is tomorrow"
  ],

  "admin_pages_to_build": [
    "/login: Supabase auth, email + password",
    "/admin: KPI cards (orders_today, confirmation_rate, delivered_rate_30d, cost_per_DELIVERED_order, revenue_30d, net_profit_30d)",
    "/admin/orders: table with filters (status/date/city), phone search, bulk status update, WhatsApp green button per row (calls logWhatsAppAttempt then opens wa.me)",
    "/admin/followups: queue view with next template auto-selected",
    "/admin/double-confirm: list for tomorrow's deliveries",
    "/admin/blacklist: warning banner on matching phones in orders; manage entries",
    "/admin/couriers: list with computed return_rate",
    "/admin/finance: ad spend input form + P&L per product",
    "/admin/templates: CRUD editor with RTL Arabic textareas"
  ],

  "finance_logic": {
    "per_product": "delivered_revenue = SUM(delivered.unit_price*qty) - product_cost - courier fees(delivered+returned) - ad_spend_allocation",
    "ad_spend_allocation": "divide daily spend by number of orders created that day, attribute per product proportionally",
    "cost_per_delivered": "total_ad_spend_30d / total_delivered_30d"
  },

  "phases": [
    "B1: Supabase migrations (001,002,003) + create .env.example + README with setup steps",
    "B2: Auth (login page + middleware protecting /admin/*) + create admin user instructions",
    "B3: Orders table UI + WhatsApp button + server actions + order_events",
    "B4: Followup queue + double-confirm + blacklist logic",
    "B5: CSV export + couriers + finance (ad spend + P&L)",
    "B6: Templates editor + KPIs on /admin"
  ]
}

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
