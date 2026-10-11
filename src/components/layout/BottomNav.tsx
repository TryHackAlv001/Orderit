'use client';

import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Search, ShoppingCart, User, Package, ShoppingBag } from "lucide-react";

export function BottomNav() {
  const { user, profile } = useAuthStore();
  const cartCount = useCartStore((state) => state.items.length);
  const pathname = usePathname();

  if (!user) return null;

  const isBuyer = user.role === "buyer";
  const isVendor = user.role === "vendor";

  const buyerTabs: Array<{ icon: typeof Home; label: string; href: string; color: string; badge?: number }> = [
    { icon: Home, label: "Home", href: "/marketplace", color: "text-muted" },
    { icon: Search, label: "Search", href: "/marketplace/search", color: "text-muted" },
    { icon: ShoppingCart, label: "Cart", href: "/cart", color: "text-muted", badge: cartCount },
    { icon: User, label: "Profile", href: "/buyer/profile", color: "text-muted" },
  ];

  const vendorTabs: Array<{ icon: typeof Home; label: string; href: string; color: string; badge?: number }> = [
    { icon: Home, label: "Dashboard", href: "/vendor/dashboard", color: "text-muted" },
    { icon: Package, label: "Products", href: "/vendor/products", color: "text-muted" },
    { icon: ShoppingBag, label: "Orders", href: "/vendor/orders", color: "text-muted" },
    { icon: ShoppingBag, label: "My Store", href: profile?.id ? `/vendor/${profile.id}/store` : "#", color: "text-muted" },
  ];

  const tabs = isBuyer ? buyerTabs : vendorTabs;

  const isActive = (href: string) => {
    if (href === "/marketplace" || href === "/marketplace/search") {
      return pathname?.startsWith("/marketplace") && pathname !== "/marketplace/search" && href === "/marketplace";
    }
    if (href === "/marketplace/search") {
      return pathname?.startsWith("/marketplace/search");
    }
    return pathname === href;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface md:hidden" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}>
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 px-2 py-3 text-xs font-medium transition-colors ${
                active ? "text-accent-text" : "text-muted hover:text-text"
              }`}
            >
              <div className="relative">
                <Icon className="h-6 w-6" />
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-danger px-1 text-[0.65rem] font-bold text-accent-on">
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </div>
              <span className="line-clamp-1">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
