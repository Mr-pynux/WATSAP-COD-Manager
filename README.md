# COD Order Manager — ShoeSpot

لوحة تحكم للبائع المغربي (الدفع عند الاستلام): صفحة هبوط عربية RTL مع فورم الطلب → لوحة إدارة كاملة (تأكيد عبر واتساب، حالات، متابعة، بلاك ليست، ناقلين، مالية/P&L، تصدير CSV).

## Tech stack

- **Next.js 16** (App Router) + **TypeScript** strict
- **Tailwind CSS 4** + **shadcn/ui** (New York) + **lucide-react** + **sonner** toasts
- **Prisma 6 + SQLite** (`db/custom.db`)
- **zod** لكل مدخلات API · **react-hook-form** للفورمات · **date-fns** للتواريخ (dd/MM/yyyy)
- **next-themes** (فاتح/داكن للوحة التحكم؛ صفحة الهبوط فاتحة دائماً)
- خط **Cairo** عبر `<link>` في root layout

## Run

```bash
bun install
bun run db:push        # تطبيق schema
bun run db:generate    # توليد Prisma Client
bun run prisma/seed.ts # بيانات تجريبية (منتج، 17 طلب، قوالب، ناقلين...)
bun run dev            # (في هذه البيئة: dev server يشتغل أوتوماتيكيا على port 3000)
```

- الصفحة العمومية: `/` · نجاح الطلب: `/success?n={orderNumber}` · دخول المسؤول: `/login`
- اللوحة: `/admin`, `/admin/orders`, `/admin/followup`, `/admin/blacklist`, `/admin/couriers`, `/admin/finance`, `/admin/templates`

## Demo credentials

```
admin@shop.ma / admin123
```

## Env vars (`.env`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite path (`file:.../db/custom.db`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | بيانات دخول المسؤول |
| `SESSION_SECRET` | سر توقيع HMAC-SHA256 لكوكي `admin_session` |
| `NEXT_PUBLIC_META_PIXEL_ID` | (اختياري) Meta Pixel — يحقن فقط إذا معرّف |
| `NEXT_PUBLIC_SELLER_WHATSAPP` | رقم دعم الواتساب في صفحة النجاح (212...) |

## Auth

- `POST /api/auth/login` → يصدر كوكي httpOnly `admin_session` = HMAC-SHA256("admin", SESSION_SECRET)
- `src/middleware.ts` يحمي `/admin/*` (Web Crypto على الـ edge) → redirect `/login`
- كل مسارات API الإدارية تستدعي `requireAdmin()` وترد 401 بدون جلسة صالحة

## Architecture notes

- **بدون enums ولا قوائم في Prisma/SQLite**: الحالات نصوص + ثوابت `src/lib/constants.ts`، والمصفوفات (صور/مقاسات/ألوان/أسباب) JSON strings.
- منطق الأعمال في `src/lib/*`: `whatsapp.ts` (المحرك + pickTemplateKey)، `phone.ts` (06/07 + normalize + wa.me)، `orders-service.ts` (تغيير الحالة + timestamps + أحداث + القاعدة الأوتوماتيكية للبلاك ليست)، `csv.ts` (UTF-8 BOM + CRLF)، `auth.ts`، `blacklist.ts`، `orders-query.ts`، `serialize.ts`، `format.ts`، `types.ts`.
- قاعدة البلاك ليست الأوتوماتيكية: عند تحول طلب إلى مرجع/ملغى، يُحسب عدد الطلبات بنفس الرقم — ≥ 2 مخالفة → upsert للقيد (strikes + reasons JSON)؛ والقيود الموجودة تُحدّث دائماً بالعدد الحالي.
- أحداث كل طلب (`OrderEvent`): `created` / `whatsapp_click` / `status_change` — تُستعمل في توقيت المتابعة.
- تصدير CSV: `/api/orders/export?ids=a,b` أو بالفلاتر الحالية — رؤوس عربية، BOM + CRLF، filename `orders-YYYY-MM-DD.csv`.

## Porting to Supabase (later)

الباكند كله معزول خلف API routes + Prisma — الترحيل يكفي فيه تبديل `datasource` في `prisma/schema.prisma` إلى PostgreSQL (`DATABASE_URL` من Supabase)، رفع enums بدل النصوص إن أردت صرامة أكبر، ثم `prisma db push` / `prisma migrate deploy`؛ لا يتغير أي كود واجهة أو API لأن Prisma Client هو نفسه، وكيكي الجلسة يبقى كما هو (لا علاقة له بقاعدة البيانات).

## Quality gates

- `bun run lint` — نظيف (0 errors)
- كل الصفحات ترجع 200 (و /admin بدون جلسة → 307 → /login)
- تدفق API مُختبر بـ curl: login → orders → whatsapp (تزايد المحاولات + no_answer→retry + event) → PATCH (timestamps + event + بلاك ليست أوتوماتيكية) → CSV → bulk → templates/finance/couriers/blacklist

## ShoeSpot customization (v1.1)
- Store: **ShoeSpot** — logo at `public/logo.png` (favicon auto from `src/app/icon.png`)
- Pricing: unit **150 MAD**; pair offer **2 for 220 MAD** (Product.offerQty/offerTotalMad; per-order `discountMad`)
- Free delivery messaging on the landing
- Seller WhatsApp: `NEXT_PUBLIC_SELLER_WHATSAPP=212696910965`
