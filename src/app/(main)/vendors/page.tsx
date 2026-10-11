import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface VendorDirectoryEntry {
  id: string;
  shop_name: string;
  shop_description: string | null;
  logo_url: string | null;
  location: string | null;
  is_verified: boolean;
}

export default async function VendorsPage() {
  const supabase = createSupabaseServerClient();
  const { data: vendors, error } = await supabase
    .from("vendor_profiles")
    .select("id,shop_name,shop_description,logo_url,location,is_verified")
    .order("shop_name");

  if (error) {
    console.error("Vendor directory failed to load:", error.message);
    return (
      <section role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-8 text-center text-danger-text">
        <h1 className="text-2xl font-semibold">Vendors could not be loaded</h1>
        <p className="mt-2 text-sm">Please refresh the page to try again.</p>
      </section>
    );
  }

  return (
    <section className="w-full">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-text">Vendors</h1>
        <p className="mt-2 text-sm text-muted">Explore stores and the people behind them.</p>
      </header>
      {vendors?.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(vendors as VendorDirectoryEntry[]).map((vendor) => (
            <Link
              key={vendor.id}
              href={`/vendor/${vendor.id}/store`}
              className="flex min-w-0 gap-4 rounded-xl border border-border bg-surface p-5 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {vendor.logo_url ? (
                <img src={vendor.logo_url} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
              ) : (
                <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface-raised text-lg font-semibold text-text">
                  {vendor.shop_name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate font-semibold text-text">{vendor.shop_name}</span>
                {vendor.location && <span className="mt-1 block text-xs text-muted">{vendor.location}</span>}
                {vendor.shop_description && <span className="mt-2 line-clamp-2 block text-sm text-muted">{vendor.shop_description}</span>}
                {vendor.is_verified && <span className="mt-2 inline-block text-xs font-semibold text-accent-text">Verified vendor</span>}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted">
          <p className="font-semibold text-text">No vendors to show yet.</p>
          <p className="mt-2 text-sm">Stores will appear here as vendors join.</p>
        </div>
      )}
    </section>
  );
}
