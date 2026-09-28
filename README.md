# ShoeSpot COD Manager

## Setup Steps

1. Create a project in [Supabase](https://supabase.com/).
2. Go to the SQL Editor in your Supabase Dashboard.
3. Run the migrations sequentially by copying the contents of the following files:
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_rls.sql`
   - `supabase/migrations/003_seed.sql`
4. Copy `.env.example` to `.env.local` and fill in the required variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Keep this strictly server-side!)
   - `NEXT_PUBLIC_META_PIXEL_ID`
   - `NEXT_PUBLIC_SELLER_WHATSAPP`
5. Create an admin user manually in the Supabase Dashboard (`Authentication` -> `Users` -> `Add user`). Do not build a signup form.
6. Install dependencies and start the dev server:
   ```bash
   npm install
   npm run dev
   ```
