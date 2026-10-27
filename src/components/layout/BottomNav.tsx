'use client';

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { useMessagingSummary } from "@/hooks/useMessagingSummary";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, LayoutGrid, Menu, Package, ShoppingBag, ShoppingCart, User, X } from "lucide-react";

interface BottomTab {
  icon: typeof Home;
  label: string;
  href: string;
  badge?: number;
}

export function BottomNav() {
  const { user, profile } = useAuthStore();
  const cartCount = useCartStore((state) => state.items.reduce((count, item) => count + item.quantity, 0));
  const cartPulseVersion = useCartStore((state) => state.pulseVersion);
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { conversations, unreadCount: notificationUnreadCount } = useMessagingSummary();
  const messageUnreadCount = conversations.reduce((count, conversation) => count + conversation.unreadCount, 0);
  const menuUnreadCount = notificationUnreadCount + messageUnreadCount;

  useEffect(() => {
    const handleMenuState = (event: Event) => {
      setMenuOpen((event as CustomEvent<{ open: boolean }>).detail.open);
    };
    window.addEventListener("navbar-navigation-state", handleMenuState);
    return () => {
      window.removeEventListener("navbar-navigation-state", handleMenuState);
    };
  }, []);

  const isBuyer = user?.role === "buyer";
  const isVendor = user?.role === "vendor";
  const buyerTabs: BottomTab[] = [
    { icon: Home, label: "Home", href: "/marketplace" },
    { icon: LayoutGrid, label: "Categories", href: "/categories" },
    { icon: User, label: "You", href: user ? "/buyer/profile" : "/login" },
    { icon: ShoppingCart, label: "Cart", href: "/cart", badge: cartCount },
  ];
  const vendorTabs: BottomTab[] = [
    { icon: Home, label: "Dashboard", href: "/vendor/dashboard" },
    { icon: Package, label: "Products", href: "/vendor/products" },
    { icon: ShoppingBag, label: "Orders", href: "/vendor/orders" },
    { icon: ShoppingBag, label: "My Store", href: profile?.id ? `/vendor/${profile.id}/store` : "#" },
    { icon: ShoppingCart, label: "Cart", href: "/cart", badge: cartCount },
  ];
  const guestTabs: BottomTab[] = [
    { icon: Home, label: "Home", href: "/marketplace" },
    { icon: LayoutGrid, label: "Categories", href: "/categories" },
    { icon: User, label: "You", href: "/login" },
    { icon: ShoppingCart, label: "Cart", href: "/cart", badge: cartCount },
  ];
  const tabs = isBuyer ? buyerTabs : isVendor ? vendorTabs : guestTabs;

  const isActive = (href: string) => {
    if (href === "/marketplace") {
      return pathname?.startsWith("/marketplace") && !pathname.startsWith("/marketplace/search");
    }
    if (href === "/login") return pathname === "/login";
    if (href === "#") return false;
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-bottom-nav border-t border-border bg-surface pb-[var(--safe-bottom)] md:hidden"
    >
      <div className="flex min-h-[var(--bottom-nav-height)] items-stretch">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-[var(--bottom-nav-height)] min-w-0 flex-1 flex-col items-center justify-center gap-1 ${isVendor ? "px-0.5 text-[10px] sm:text-xs" : "px-1 text-xs"} py-1 font-medium transition-colors ${
                active ? "text-accent-text" : "text-muted hover:text-text"
              }`}
            >
              <span key={tab.badge !== undefined ? cartPulseVersion : tab.label} className={`relative ${tab.badge !== undefined ? "cart-add-pulse" : ""}`}>
                <Icon className={isVendor ? "h-5 w-5 sm:h-6 sm:w-6" : "h-6 w-6"} />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -right-2 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[0.65rem] font-bold text-accent-on">
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate">{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          data-mobile-menu-trigger
          aria-label={`${menuOpen ? "Close" : "Open"} menu${menuUnreadCount > 0 ? `, ${menuUnreadCount} unread items` : ""}`}
          aria-controls="navbar-mobile-navigation-menu"
          aria-expanded={menuOpen}
          onClick={() => window.dispatchEvent(new Event("navbar-navigation-toggle"))}
          className={`relative flex min-h-[var(--bottom-nav-height)] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-1 text-xs font-medium transition-colors ${
            menuOpen ? "text-accent-text" : "text-muted hover:text-text"
          }`}
        >
          <span className="relative">
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            {menuUnreadCount > 0 && (
              <span aria-hidden="true" className="absolute -right-2 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[0.65rem] font-bold text-accent-on">
                {menuUnreadCount > 99 ? "99+" : menuUnreadCount}
              </span>
            )}
          </span>
          <span>Menu</span>
        </button>
      </div>
    </nav>
  );
}
