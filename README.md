This is the Tradeloft project, a general ecommerce marketplace built with [Next.js](https://nextjs.org). Tradeloft originated from the Orderit/FreshDrop food-edition codebase and now supports buyers and vendors across many categories.

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

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
