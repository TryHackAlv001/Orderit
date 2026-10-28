Tradeloft is a multi-vendor marketplace for buyers and sellers, built with [Next.js](https://nextjs.org).

## Categories

Tradeloft supports a broad range of categories:

- Electronics
- Fashion
- Food & Drinks
- Beauty
- Home & Kitchen
- Jewelry & Watches
- Phones & Accessories
- Agriculture
- Services
- Others

## Getting Started

### Configure Supabase

Create a Supabase project, then copy `.env.example` to `.env.local` and fill in the project URL, anon key, and service-role key from **Project Settings > API**. The URL and anon key are public values used by the browser and server clients. `SUPABASE_SERVICE_ROLE_KEY` is required by server-side messaging, notification, product, and return APIs; keep it server-only and never expose it through a `NEXT_PUBLIC_` variable.

Restart the development server after changing `.env.local` so Next.js picks up the values.

### Catalog, order tracking, and returns setup

Apply the migrations in order using the Supabase SQL Editor (after the existing schema migrations):

1. `supabase/migrations/003_product_attributes.sql`
2. `supabase/migrations/004_order_tracking_returns_wallet.sql`
3. `supabase/migrations/005_category_specific_sizes.sql`

The matching `.down.sql` files roll the additions back in reverse order. The catalog migration backfills existing products with an `Unspecified` brand and marks them incomplete; vendors can find them in **Vendor → Products → Complete missing details**. Incomplete products are excluded from marketplace search until they are fixed and republished. Category sizing is configured in `src/constants/sizes.ts`; products retain their current sizes on migration, while new vendor edits use the selected category's size system.

The product and return photo upload APIs use the existing public `product-images` storage bucket. Keep `SUPABASE_SERVICE_ROLE_KEY` set only in the server environment (for example `.env.local` or the deployment secret store); never expose it through a `NEXT_PUBLIC_` variable.

Apply the order-tracking migrations in numerical order: `020_order_delivery_tracking.sql`, `021_enforce_order_state_updates.sql`, `022_allow_vendor_order_confirmation.sql`, `023_order_status_history_to_status_compat.sql`, `024_order_status_notification_tracker.sql`, `025_order_item_color_snapshot.sql`, and `026_allow_cancellation_of_unpaid_legacy_orders.sql`. Adding a migration file to the repository does not apply it to Supabase; run each new migration in the SQL Editor for the project used by the app. Migration 023 adds a generated `to_status` column when the history table has the legacy `status` column and leaves databases that already have `to_status` unchanged. Migration 024 writes status history through the writable status column and includes a product name and tracker link in buyer status notifications. Migration 025 snapshots selected colors for new purchases; older purchases can only show a color if their saved variant still exists. Migration 026 allows vendors to cancel unpaid orders that are still pending, confirmed, or preparing; fulfillment remains restricted to paid orders.

The return window defaults to 14 days. To configure it, run this SQL with the desired value:

```sql
update public.return_policy_settings
set return_window_days = 21, updated_at = now()
where singleton = true;
```

Existing categories are assigned color/size requirements by category-name matching when the migration runs, and newly added categories receive the same defaults. Review `public.category_attribute_rules` after migration and update its flags for any custom category names that should require variants.

Return refunds are credited once to the buyer's internal wallet after the vendor records receipt. This repository does not currently implement a vendor payout or payment-provider refund service, so no external payout is reversed by this flow.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Netlify

This project uses Next.js middleware, API routes, and server-side rendering, so deploy it as a Next.js app rather than a static export. The included `netlify.toml` sets the build command to `npm run build` and the publish directory to `.next`. Netlify's Next.js adapter is detected and configured automatically; do not add a static-export setting or pin the adapter version.

1. Push the repository to a Git provider and [import it into Netlify](https://app.netlify.com/start).
2. Keep the detected build settings from `netlify.toml` (`npm run build`, publish directory `.next`).
3. In **Site configuration → Environment variables**, add the production variables listed below. Use the same values for deploy previews only if those previews should access production services.
4. Deploy the site. After assigning a custom domain, update `APP_URL`, `NEXT_PUBLIC_APP_URL`, and `PAYMENT_CALLBACK_ALLOWED_ORIGINS` to that site's HTTPS origin, then redeploy.

### Netlify environment variables

Required for the app's Supabase-backed features:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/publishable key.
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key. Keep it server-only; never use a `NEXT_PUBLIC_` prefix.

Required for Paystack checkout in production:

- `APP_URL` — the public HTTPS origin of the deployed app, with no path (for example, `https://shop.example.com`).
- `PAYMENT_CALLBACK_ALLOWED_ORIGINS` — comma-separated trusted HTTPS origins. Include the exact `APP_URL` origin. For a single production site, use the same origin as `APP_URL`.
- Set the Supabase Edge Function secrets `PAYSTACK_SECRET_KEY` and `APP_URL` in Supabase, not in Netlify. Deploy the `paystack-payments` and `paystack-webhook` functions and configure the provider webhook as described in [PAYMENT_INTEGRATION.md](./PAYMENT_INTEGRATION.md).

Optional Flutterwave settings (only when enabling Flutterwave):

- `FLUTTERWAVE_ENABLED=true`
- `NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY`
- `FLUTTERWAVE_SECRET_KEY` — server-only.
- `NEXT_PUBLIC_APP_URL` — the public site URL used for Flutterwave redirects and branding.

Add your deployed site URL to the allowed redirect URLs in Supabase Authentication settings. Keep all service-role and payment secret keys out of browser-exposed variables and source control. `.env.example` lists the app-side variable names; do not copy placeholder values into Netlify.
