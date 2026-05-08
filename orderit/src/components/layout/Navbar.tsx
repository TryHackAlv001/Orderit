'use client';

import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import Link from "next/link";
import { Bell, Menu, Search, ShoppingCart, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { CURRENCY_OPTIONS } from "@/constants";
import { useCurrencyStore } from "@/store/currencyStore";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user } = useAuthStore();
  const { signOut } = useAuth();
  const cartCount = useCartStore((state) => state.items.length);
  const currency = useCurrencyStore((state) => state.currency);
  const setCurrency = useCurrencyStore((state) => state.setCurrency);

  useEffect(() => {
    const savedCurrency = window.localStorage.getItem("currency");
    if (savedCurrency) {
      setCurrency(savedCurrency);
    }
  }, [setCurrency]);

  const handleCurrencyChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const selectedCurrency = event.target.value;
    setCurrency(selectedCurrency);
    window.localStorage.setItem("currency", selectedCurrency);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-2xl font-bold tracking-tight text-[#1a7a4a]">
            OrderIt
          </Link>
          <div className="hidden items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              className="w-72 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              type="search"
              placeholder="Search products, vendors..."
            />
          </div>
        </div>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-700 lg:flex">
          <Link href="/marketplace" className="hover:text-slate-900">
            Marketplace
          </Link>
          <Link href="/main/vendor" className="hover:text-slate-900">
            Vendors
          </Link>
          <div className="relative">
            <button
              type="button"
              onClick={() => setCategoriesOpen((open) => !open)}
              className="flex items-center gap-1 hover:text-slate-900"
            >
              Categories
            </button>
            {categoriesOpen ? (
              <div className="absolute left-0 top-full mt-2 w-48 rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
                {[
                  "Electronics",
                  "Fashion",
                  "Food & Drinks",
                  "Beauty",
                  "Home & Kitchen",
                  "Agriculture",
                  "Services",
                  "Others",
                ].map((category) => (
                  <Link
                    key={category}
                    href={`/marketplace?category=${encodeURIComponent(category)}`}
                    className="block rounded-2xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    {category}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 md:flex">
            <select
              value={currency}
              onChange={handleCurrencyChange}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
            >
              {CURRENCY_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 md:hidden">
            <button type="button" className="rounded-full bg-slate-100 p-2 text-slate-700" aria-label="Search">
              <Search className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="rounded-full bg-slate-100 p-2 text-slate-700"
              aria-label="Menu"
              onClick={() => setMobileOpen((value) => !value)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {user ? (
            <div className="flex items-center gap-3">
              <Link href="/cart" className="relative rounded-full bg-slate-100 p-2 text-slate-700 hover:bg-slate-200">
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[0.65rem] font-semibold text-white">
                    {cartCount}
                  </span>
                ) : null}
              </Link>
              <button type="button" className="rounded-full bg-slate-100 p-2 text-slate-700 hover:bg-slate-200">
                <Bell className="h-5 w-5" />
              </button>
              <div className="relative">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white"
                  aria-label="Profile menu"
                  onClick={() => setProfileOpen((open) => !open)}
                >
                  {user.full_name?.slice(0, 1) ?? "U"}
                </button>
                {profileOpen ? (
                  <div className="absolute right-0 mt-3 w-52 rounded-3xl border border-slate-200 bg-white text-slate-700 shadow-lg">
                    <Link href="/main/messages" className="block px-4 py-3 text-sm hover:bg-slate-100">
                      Messages
                    </Link>
                    <Link href="/main/orders" className="block px-4 py-3 text-sm hover:bg-slate-100">
                      My Orders
                    </Link>
                    <Link href="/main/profile" className="block px-4 py-3 text-sm hover:bg-slate-100">
                      My Profile
                    </Link>
                    {user.role === "vendor" ? (
                      <Link href="/vendor/dashboard" className="block px-4 py-3 text-sm hover:bg-slate-100">
                        Vendor Dashboard
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => signOut()}
                      className="w-full rounded-b-3xl px-4 py-3 text-left text-sm text-red-600 hover:bg-slate-100"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="hidden items-center gap-3 md:flex">
              <Link href="/login" className="rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
                Login
              </Link>
              <Link href="/register" className="rounded-full bg-[#1a7a4a] px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                Register
              </Link>
            </div>
          )}
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
          <nav className="space-y-3">
            <Link href="/marketplace" className="block rounded-3xl px-4 py-3 text-base font-semibold text-slate-700 hover:bg-slate-100">
              Marketplace
            </Link>
            <Link href="/main/vendor" className="block rounded-3xl px-4 py-3 text-base font-semibold text-slate-700 hover:bg-slate-100">
              Vendors
            </Link>
            <details className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-base font-semibold text-slate-700">Categories</summary>
              <div className="mt-3 space-y-2">
                {[
                  "Electronics",
                  "Fashion",
                  "Food & Drinks",
                  "Beauty",
                  "Home & Kitchen",
                  "Agriculture",
                  "Services",
                  "Others",
                ].map((category) => (
                  <Link
                    key={category}
                    href={`/marketplace?category=${encodeURIComponent(category)}`}
                    className="block rounded-2xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    {category}
                  </Link>
                ))}
              </div>
            </details>
            {user ? (
              <div className="space-y-2 rounded-3xl border border-slate-200 bg-slate-50 p-3">
                <Link href="/main/messages" className="block rounded-2xl px-4 py-3 text-sm text-slate-700 hover:bg-slate-100">
                  Messages
                </Link>
                <Link href="/main/orders" className="block rounded-2xl px-4 py-3 text-sm text-slate-700 hover:bg-slate-100">
                  My Orders
                </Link>
                <Link href="/main/profile" className="block rounded-2xl px-4 py-3 text-sm text-slate-700 hover:bg-slate-100">
                  My Profile
                </Link>
                {user.role === "vendor" ? (
                  <Link href="/vendor/dashboard" className="block rounded-2xl px-4 py-3 text-sm text-slate-700 hover:bg-slate-100">
                    Vendor Dashboard
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="w-full rounded-2xl bg-red-600 px-4 py-3 text-left text-sm font-semibold text-white hover:bg-red-700"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <Link href="/login" className="block rounded-3xl border border-emerald-700 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700">
                  Login
                </Link>
                <Link href="/register" className="block rounded-3xl bg-[#1a7a4a] px-4 py-3 text-center text-sm font-semibold text-white">
                  Register
                </Link>
              </div>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
