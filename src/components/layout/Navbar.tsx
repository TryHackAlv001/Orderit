'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell, Check, ChevronDown, Menu, MessageSquare, Monitor, Moon, Package,
  Search, Settings, ShoppingCart, Star, Sun, X,
} from "lucide-react";
import { PRODUCT_CATEGORIES, getCurrencyOption } from "@/constants";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import type { NotificationType } from "@/lib/notifications";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { useCurrencyStore } from "@/store/currencyStore";
import { BottomNav } from "@/components/layout/BottomNav";

type ThemePreference = "light" | "dark" | "system";
type HeaderMenu = "navigation" | "profile" | null;

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

function formatTimeAgo(date: string) {
  const elapsedSeconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (elapsedSeconds < 60) return "Just now";
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m ago`;
  if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)}h ago`;
  return `${Math.floor(elapsedSeconds / 86400)}d ago`;
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "order": return <Package className="h-4 w-4" />;
    case "message": return <MessageSquare className="h-4 w-4" />;
    case "review": return <Star className="h-4 w-4" />;
    default: return <Settings className="h-4 w-4" />;
  }
}

interface NavbarProps {
  variant?: "neutral" | "home";
}

export function Navbar({ variant = "neutral" }: NavbarProps) {
  const [openMenu, setOpenMenu] = useState<HeaderMenu>(null);
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const themePreferenceRef = useRef<ThemePreference>("system");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchExamples, setSearchExamples] = useState<string[]>(PRODUCT_CATEGORIES);
  const [searchExampleIndex, setSearchExampleIndex] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const pathname = usePathname();
  const navigationButtonRef = useRef<HTMLButtonElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const navigationPanelRef = useRef<HTMLDivElement>(null);
  const mobileNavigationPanelRef = useRef<HTMLDivElement>(null);
  const profilePanelRef = useRef<HTMLDivElement>(null);
  const previousPathnameRef = useRef(pathname);
  const { user, profile } = useAuthStore();
  const { signOut, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const cartCount = useCartStore((state) => state.items.reduce((count, item) => count + item.quantity, 0));
  const currencyCode = useCurrencyStore((state) => state.currency);
  const currency = getCurrencyOption(currencyCode);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(user?.id);
  const isVendor = user?.role === "vendor";
  const accountHref = isVendor ? "/vendor/orders" : user ? "/buyer/orders" : "/login";
  const profileHref = isVendor ? "/vendor/profile" : "/buyer/profile";
  const settingsHref = isVendor ? "/vendor/settings" : "/buyer/profile#account-security";

  const closeMenu = useCallback((restoreFocus = false) => {
    const previouslyOpen = openMenu;
    setOpenMenu(null);
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        if (previouslyOpen === "profile") {
          profileButtonRef.current?.focus();
        } else if (window.matchMedia("(min-width: 768px)").matches) {
          navigationButtonRef.current?.focus();
        } else {
          document.querySelector<HTMLButtonElement>("[data-mobile-menu-trigger]")?.focus();
        }
      });
    }
  }, [openMenu]);

  useEffect(() => {
    const handleMobileMenuToggle = () => {
      setOpenMenu((current) => current === "navigation" ? null : "navigation");
    };
    window.addEventListener("navbar-navigation-toggle", handleMobileMenuToggle);
    return () => window.removeEventListener("navbar-navigation-toggle", handleMobileMenuToggle);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("navbar-navigation-state", {
      detail: { open: openMenu === "navigation" },
    }));
  }, [openMenu]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("navbar-notifications-state", {
      detail: { unreadCount },
    }));
  }, [unreadCount]);

  useEffect(() => {
    if (!openMenu) return;
    const navigationPanel = window.matchMedia("(min-width: 768px)").matches
      ? navigationPanelRef.current
      : mobileNavigationPanelRef.current;
    const panel = openMenu === "navigation" ? navigationPanel : profilePanelRef.current;
    const trigger = openMenu === "navigation" ? navigationButtonRef.current : profileButtonRef.current;
    const getFocusable = () => Array.from(panel?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), summary, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) ?? []).filter((element) => element.getClientRects().length > 0);

    window.requestAnimationFrame(() => getFocusable()[0]?.focus());

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panel?.contains(target) || trigger?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-mobile-menu-trigger]")) return;
      closeMenu(true);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
        return;
      }

      const focusable = getFocusable();
      if (!focusable.length) return;
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);

      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        focusable[(currentIndex + 1 + focusable.length) % focusable.length].focus();
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        focusable[(currentIndex - 1 + focusable.length) % focusable.length].focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        focusable[0].focus();
      } else if (event.key === "End") {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (event.key === "Tab") {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || currentIndex === -1)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || currentIndex === -1)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMenu, openMenu]);

  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname;
      closeMenu(true);
    }
  }, [pathname, closeMenu]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/products/suggestions", { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load search examples.");
        setSearchExamples([...(result.suggestions ?? []), ...(result.categories ?? [])]);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Search placeholder examples failed:", error);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (searchExamples.length < 2) return;
    const interval = window.setInterval(() => {
      setSearchExampleIndex((index) => (index + 1) % searchExamples.length);
    }, 7000);
    return () => window.clearInterval(interval);
  }, [searchExamples]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchSuggestions([]);
      setSuggestionError(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/products/suggestions?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load search suggestions.");
        setSearchSuggestions(result.suggestions ?? []);
        setSuggestionError(null);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Product search suggestions failed:", error);
        setSearchSuggestions([]);
        setSuggestionError(
          error instanceof Error ? error.message : "Unable to load search suggestions.",
        );
      }
    }, 200);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [searchQuery]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    let preference: ThemePreference = "system";
    try {
      const saved = window.localStorage.getItem("tradeloft-theme");
      if (saved === "light" || saved === "dark" || saved === "system") preference = saved;
    } catch {}
    themePreferenceRef.current = preference;
    setThemePreference(preference);
    document.documentElement.dataset.theme = preference === "system"
      ? mediaQuery.matches ? "dark" : "light"
      : preference;

    const handleSystemChange = (event: MediaQueryListEvent) => {
      if (themePreferenceRef.current === "system") document.documentElement.dataset.theme = event.matches ? "dark" : "light";
    };
    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, []);

  const selectTheme = (preference: ThemePreference) => {
    themePreferenceRef.current = preference;
    setThemePreference(preference);
    try {
      window.localStorage.setItem("tradeloft-theme", preference);
    } catch {}
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = preference === "system"
      ? systemDark ? "dark" : "light"
      : preference;
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    router.push(`/marketplace/search?q=${encodeURIComponent(query)}`);
    setSearchQuery("");
    closeMenu(true);
  };

  const handleNotificationClick = async (notificationId: string, link?: string) => {
    await markAsRead(notificationId);
    setNotificationsOpen(false);
    if (link) router.push(link);
  };

  const renderThemeMenu = () => (
    <div className="flex gap-2" role="group" aria-label="Theme preference">
      {themeOptions.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={themePreference === value}
          onClick={() => selectTheme(value)}
          className={`inline-flex min-h-10 items-center gap-1 rounded-full border px-3 py-2 text-sm hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            themePreference === value
              ? "border-accent-text bg-accent/10 font-semibold text-accent-text"
              : "border-border text-text"
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
          {themePreference === value && <Check className="h-3.5 w-3.5" />}
        </button>
      ))}
    </div>
  );

  const renderAccountMenu = (closeMobile = false) => (
    <>
      <Link
        href={profileHref}
        onClick={() => {
          closeMenu(true);
          if (closeMobile) setOpenMenu(null);
        }}
        className="block min-h-10 rounded-lg px-3 py-2 text-sm text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        My Profile
      </Link>
      <Link
        href="/messages"
        onClick={() => {
          closeMenu(true);
          if (closeMobile) setOpenMenu(null);
        }}
        className="block min-h-10 rounded-lg px-3 py-2 text-sm text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Messages
      </Link>
      <Link
        href={accountHref}
        onClick={() => {
          closeMenu(true);
          if (closeMobile) setOpenMenu(null);
        }}
        className="block min-h-10 rounded-lg px-3 py-2 text-sm text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Orders
      </Link>
      {isVendor && (
        <Link
          href="/vendor/dashboard"
          onClick={() => {
            closeMenu(true);
            if (closeMobile) setOpenMenu(null);
          }}
          className="block min-h-10 rounded-lg px-3 py-2 text-sm text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Vendor Dashboard
        </Link>
      )}
      <Link
        href={settingsHref}
        onClick={() => {
          closeMenu(false);
          if (closeMobile) setOpenMenu(null);
        }}
        className="block min-h-10 rounded-lg px-3 py-2 text-sm text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Settings
      </Link>
      <button
        type="button"
        onClick={() => {
          closeMenu(false);
          if (closeMobile) setOpenMenu(null);
          void signOut();
        }}
        className="block min-h-10 w-full rounded-lg px-3 py-2 text-left text-sm text-danger-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Sign Out
      </button>
    </>
  );

  const closeAfterNavigation = () => closeMenu(true);
  const toggleHeaderMenu = (menu: Exclude<HeaderMenu, null>) => {
    if (openMenu === menu) {
      closeMenu(true);
      return;
    }
    setOpenMenu(menu);
  };

  const renderNavigationMenuContents = () => (
    <nav aria-label="Navigation menu" className="space-y-2">
      <button type="button" disabled title="Product-level sales ranking is not available yet." className="block min-h-10 w-full rounded-lg px-3 py-2 text-left text-sm text-muted opacity-70">
        Best-Selling
      </button>
      <Link href="/marketplace?rating=4" onClick={closeAfterNavigation} className="block min-h-10 rounded-lg px-3 py-2 text-sm text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Top Rated</Link>
      <Link href="/marketplace?sort=newest" onClick={closeAfterNavigation} className="block min-h-10 rounded-lg px-3 py-2 text-sm text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">New In</Link>
      <details className="rounded-lg border border-border p-3">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between text-sm font-medium text-text">
          Categories <ChevronDown className="h-4 w-4" />
        </summary>
        <div className="mt-2 max-h-48 overflow-y-auto">
          {PRODUCT_CATEGORIES.map((category) => (
            <Link key={category} href={`/marketplace?category=${encodeURIComponent(category)}`} onClick={closeAfterNavigation} className="block min-h-10 rounded-lg px-3 py-2 text-sm text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{category}</Link>
          ))}
        </div>
      </details>
      <Link href="/vendors" onClick={closeAfterNavigation} className="block min-h-10 rounded-lg px-3 py-2 text-sm text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Vendors</Link>
      <div className="border-t border-border pt-2">
        <Link href={accountHref} onClick={closeAfterNavigation} className="block min-h-10 rounded-lg px-3 py-2 text-sm text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Orders &amp; Account</Link>
        <Link href="/messages" onClick={closeAfterNavigation} className="block min-h-10 rounded-lg px-3 py-2 text-sm text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Support</Link>
        {user && <Link href={profileHref} onClick={closeAfterNavigation} className="block min-h-10 rounded-lg px-3 py-2 text-sm text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Profile</Link>}
        {user && <Link href={accountHref} onClick={closeAfterNavigation} className="block min-h-10 rounded-lg px-3 py-2 text-sm text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Orders</Link>}
        <Link href="/cart" onClick={closeAfterNavigation} className="block min-h-10 rounded-lg px-3 py-2 text-sm text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Cart{cartCount > 0 ? ` (${cartCount > 99 ? "99+" : cartCount})` : ""}</Link>
        <Link href={user ? isVendor ? "/vendor/notifications" : "/buyer/notifications" : "/login"} onClick={closeAfterNavigation} className="block min-h-10 rounded-lg px-3 py-2 text-sm text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}</Link>
      </div>
      {isVendor && <Link href="/vendor/dashboard" onClick={closeAfterNavigation} className="block min-h-10 rounded-lg px-3 py-2 text-sm text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Vendor Dashboard</Link>}
      <p className="px-3 py-2 text-sm text-muted" aria-label={`Language English, currency ${currency.code}`}>
        EN / {currency.code} {currency.symbol}
      </p>
      <div className="border-t border-border pt-3">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted">Theme</p>
        {renderThemeMenu()}
      </div>
      {!authLoading && (user ? (
        <button type="button" onClick={() => { closeMenu(true); void signOut(); }} className="block min-h-10 w-full rounded-lg px-3 py-2 text-left text-sm text-danger-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Sign Out</button>
      ) : (
        <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
          <Link href="/login" onClick={closeAfterNavigation} className="inline-flex min-h-10 items-center justify-center rounded-full border border-border px-3 py-2 text-center text-sm font-semibold text-text hover:bg-surface-raised">Sign In</Link>
          <Link href="/register" onClick={closeAfterNavigation} className="inline-flex min-h-10 items-center justify-center rounded-full bg-accent px-3 py-2 text-center text-sm font-semibold text-accent-on hover:bg-accent-hover">Sign Up</Link>
        </div>
      ))}
    </nav>
  );

  const mobileNavigationOverlay = openMenu === "navigation" && typeof document !== "undefined"
    ? createPortal(
      <>
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => closeMenu(true)}
          className="fixed inset-x-0 top-0 z-[45] bg-black/35 md:hidden"
          style={{ bottom: "calc(4rem + 1px + env(safe-area-inset-bottom))" }}
        />
        <div
          id="navbar-mobile-navigation-menu"
          ref={mobileNavigationPanelRef}
          className="fixed right-2 z-[60] max-h-[calc(100dvh-5rem)] w-[min(90vw,20rem)] overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-xl md:hidden"
          style={{
            bottom: "calc(4rem + 1px + env(safe-area-inset-bottom))",
            maxHeight: "calc(100dvh - 5rem - 1px - env(safe-area-inset-bottom))",
          }}
        >
          {renderNavigationMenuContents()}
        </div>
      </>,
      document.body,
    )
    : null;

  return (
    <>
    <header data-variant={variant} className={`fixed inset-x-0 top-0 z-40 border-b border-border shadow-sm backdrop-blur-xl md:sticky md:top-0 ${variant === "home" ? "navbar-home" : "bg-surface/95"}`}>
      <div className="relative mx-auto flex h-16 max-w-[1600px] items-center gap-1 px-4 sm:gap-3 sm:px-6 md:h-auto md:py-3">
        <Link href="/" className="home-header-text hidden shrink-0 font-display text-lg font-bold tracking-tight text-accent-text sm:text-2xl md:block">
          Tradeloft
        </Link>

        <form
          onSubmit={handleSearchSubmit}
          className="home-search mx-0 flex min-w-0 max-w-2xl flex-1 items-center rounded-full border border-border bg-bg p-1 focus-within:ring-2 focus-within:ring-ring md:mx-auto"
        >
          <div className="relative min-w-0 flex-1">
            <input
              className="relative z-10 w-full min-w-0 bg-transparent px-1 py-2 text-sm text-text placeholder:text-transparent focus:outline-none sm:px-2"
              type="search"
              aria-label="Search products and vendors"
              placeholder={`Search ${searchExamples[searchExampleIndex] ?? "products"}...`}
              value={searchQuery}
              list="product-search-suggestions"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            {!searchQuery && !searchFocused && searchExamples.length > 0 && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-1 right-1 flex items-center overflow-hidden whitespace-nowrap text-ellipsis text-sm text-muted sm:left-2"
              >
                <span key={searchExampleIndex} className="search-placeholder-enter">
                  Search {searchExamples[searchExampleIndex]}...
                </span>
              </span>
            )}
          </div>
          <datalist id="product-search-suggestions">
            {searchSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
          <button type="submit" aria-label="Submit search" className="home-search-submit flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-on hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>
          {suggestionError && (
            <p role="alert" className="absolute left-0 top-full z-50 mt-2 rounded-lg border border-danger/30 bg-surface px-3 py-2 text-xs text-danger-text shadow-lg">
              {suggestionError}
            </p>
          )}
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="home-header-text hidden shrink-0 items-center gap-3 text-xs font-medium text-text md:flex xl:text-sm">
            <Link href={accountHref} className="inline-flex min-h-10 items-center whitespace-nowrap hover:text-accent-text">Orders &amp; Account</Link>
            <Link href="/messages" className="inline-flex min-h-10 items-center whitespace-nowrap hover:text-accent-text">Support</Link>
            <span className="whitespace-nowrap text-muted" aria-label={`Language English, currency ${currency.code}`}>
              EN / {currency.code} {currency.symbol}
            </span>
          </div>

          <div className="relative hidden shrink-0 md:block">
              <button
                type="button"
                className="home-header-text relative flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted hover:bg-surface-raised hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setNotificationsOpen((open) => !open)}
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
                aria-expanded={notificationsOpen}
                aria-haspopup="true"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && <span className="home-header-badge absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-on">{unreadCount > 99 ? "99+" : unreadCount}</span>}
              </button>
          </div>

          <Link href="/cart" className="home-header-text relative hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex" aria-label={`Cart${cartCount ? `, ${cartCount} items` : ""}`}>
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && <span className="home-header-badge absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-on">{cartCount > 99 ? "99+" : cartCount}</span>}
          </Link>

          {notificationsOpen && (
            <div className="fixed right-2 top-20 z-50 hidden w-[min(90vw,20rem)] overflow-hidden rounded-xl border border-border bg-surface shadow-lg md:block">
              <div className="flex items-center justify-between border-b border-border p-4">
                <h2 className="font-semibold text-text">Notifications</h2>
                {user && unreadCount > 0 && <button type="button" onClick={markAllAsRead} className="min-h-10 px-2 text-xs font-semibold text-accent-text hover:underline">Mark all read</button>}
              </div>
              {!user ? (
                <p className="p-5 text-sm text-muted">Sign in to view notifications.</p>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="p-5 text-sm text-muted">You&apos;re all caught up.</p>
                  ) : notifications.slice(0, 8).map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => handleNotificationClick(notification.id, notification.link)}
                      className={`flex w-full gap-3 border-b border-border p-4 text-left hover:bg-surface-raised ${!notification.is_read ? "bg-accent/10" : ""}`}
                    >
                      <span className="mt-0.5 text-accent-text">{getNotificationIcon(notification.type as NotificationType)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-text">{notification.title}</span>
                        <span className="mt-1 block line-clamp-2 text-xs text-muted">{notification.body}</span>
                        <span className="mt-1 block text-[11px] text-muted">{formatTimeAgo(notification.created_at)}</span>
                      </span>
                      {!notification.is_read && <span className="mt-1.5 h-2 w-2 rounded-full bg-accent" />}
                    </button>
                  ))}
                </div>
              )}
              {user ? (
                <Link href={isVendor ? "/vendor/notifications" : "/buyer/notifications"} onClick={() => setNotificationsOpen(false)} className="block border-t border-border p-3 text-center text-sm font-medium text-text hover:bg-surface-raised">View all</Link>
              ) : (
                <Link href="/login" onClick={() => setNotificationsOpen(false)} className="block border-t border-border p-3 text-center text-sm font-medium text-accent-text hover:bg-surface-raised">Sign In</Link>
              )}
            </div>
          )}

          <div className="relative hidden shrink-0 md:block">
            {authLoading ? (
              <div aria-label="Loading account" className="h-10 w-10 animate-pulse rounded-full bg-surface-raised" />
            ) : user ? (
              <>
                <button
                  ref={profileButtonRef}
                  type="button"
                  className="home-header-text flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-accent font-semibold text-accent-on focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Open profile menu"
                  aria-haspopup="true"
                  aria-expanded={openMenu === "profile"}
                  aria-controls="navbar-profile-menu"
                  onClick={() => toggleHeaderMenu("profile")}
                >
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    user.full_name?.trim().slice(0, 1).toUpperCase() || user.email?.slice(0, 1).toUpperCase() || "U"
                  )}
                </button>
                {openMenu === "profile" && (
                  <div
                    id="navbar-profile-menu"
                    ref={profilePanelRef}
                    className="absolute right-0 top-full z-50 mt-2 max-h-[calc(100dvh-5rem)] w-[min(90vw,14rem)] overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-lg"
                  >
                    {isVendor && profile?.id && (
                      <Link href={`/vendor/${profile.id}/store`} onClick={closeAfterNavigation} className="block min-h-10 rounded-lg px-3 py-2 text-sm text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">My Store</Link>
                    )}
                    {renderAccountMenu()}
                  </div>
                )}
              </>
            ) : (
              null
            )}
          </div>

          <div className="relative hidden shrink-0 md:block">
            <button
              ref={navigationButtonRef}
              type="button"
              className="home-header-text flex h-10 w-10 items-center justify-center rounded-full border border-border text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={openMenu === "navigation" ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={openMenu === "navigation"}
              aria-controls="navbar-navigation-menu"
              onClick={() => toggleHeaderMenu("navigation")}
            >
              {openMenu === "navigation" ? <X className="h-4 w-4 sm:h-5 sm:w-5" /> : <Menu className="h-4 w-4 sm:h-5 sm:w-5" />}
            </button>
            {openMenu === "navigation" && (
              <div
                id="navbar-navigation-menu"
                ref={navigationPanelRef}
                className="absolute right-0 top-full z-50 mt-2 max-h-[calc(100dvh-5rem)] w-[min(90vw,20rem)] overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-xl"
              >
                {renderNavigationMenuContents()}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
    <div aria-hidden="true" className="h-[101px] md:hidden" />
    {!user && <BottomNav />}
    {mobileNavigationOverlay}
    </>
  );
}
