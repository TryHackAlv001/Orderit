export const NIGERIAN_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
  "FCT (Abuja)",
];

export const GLOBAL_LOCATIONS = [
  "United States",
  "United Kingdom",
  "Canada",
  "Germany",
  "France",
  "India",
  "Brazil",
  "Australia",
  "Global",
  "Japan",
  "Mexico",
  "South Africa",
  "China",
  "Spain",
  "Italy",
];

// Use Nigerian states as default locations
export const LOCATIONS = NIGERIAN_STATES;

export const PRODUCT_CATEGORIES = [
  "Electronics",
  "Phones & Accessories",
  "Computers & Laptops",
  "Fashion",
  "Beauty & Personal Care",
  "Jewelry & Watches",
  "Home & Kitchen",
  "Furniture",
  "Food & Drinks",
  "Groceries",
  "Health & Wellness",
  "Baby & Kids",
  "Toys & Games",
  "Sports & Outdoors",
  "Automotive",
  "Books & Media",
  "Office & Stationery",
  "Pet Supplies",
  "Garden & Outdoor",
  "Arts & Crafts",
  "Agriculture",
  "Services",
  "Others",
];

export type CurrencyOption = {
  code: string;
  label: string;
  locale: string;
  symbol: string;
};

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: "NGN", label: "NGN - ₦", locale: "en-NG", symbol: "₦" },
];

export const DEFAULT_CURRENCY = "NGN";

export const MARKETPLACE_ROUTE = "/marketplace";

export const PROTECTED_ROUTE_PREFIXES = [
  "/admin",
  "/buyer",
  "/vendor/dashboard",
  "/vendor/inventory",
  "/vendor/notifications",
  "/vendor/onboarding",
  "/vendor/orders",
  "/vendor/products",
  "/vendor/profile",
  "/vendor/returns",
  "/vendor/settings",
  "/settings",
  "/checkout",
  "/messages",
] as const;

export const MOBILE_LAYOUT = {
  bottomNavHeight: "var(--bottom-nav-height)",
  floatingBackSize: "var(--floating-back-size)",
  safeTop: "var(--safe-top)",
  safeBottom: "var(--safe-bottom)",
} as const;

export const MOBILE_BOTTOM_NAV_HIDDEN_ROUTES = [
  "/settings",
  "/about",
  "/privacy",
  "/terms",
  "/refund-policy",
] as const;

export function isMobileBottomNavHidden(pathname: string) {
  return MOBILE_BOTTOM_NAV_HIDDEN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export const NO_TOP_NAV_ROUTE_PREFIXES = [
  { prefix: "/buyer/orders", hideBelow: "md" },
  { prefix: "/settings", hideAlways: true },
  { prefix: "/buyer/profile", hideAlways: true },
  { prefix: "/checkout", hideAlways: true },
] as const;

export const FLOATING_BACK_BUTTON_CONFIG = {
  routePrefixes: NO_TOP_NAV_ROUTE_PREFIXES.map(({ prefix }) => prefix),
  excludedRoutes: ["/buyer/profile", "/checkout/verify"] as const,
  parentRoutes: {
    buyerOrders: "/buyer/profile",
    buyerOrderDetail: "/buyer/orders",
    settings: "/settings",
    settingsHome: "/buyer/profile",
    checkout: "/cart",
    buyerProfile: "/buyer/profile",
  },
} as const;

function matchesRoutePrefix(pathname: string, routePrefix: string) {
  return pathname === routePrefix || pathname.startsWith(`${routePrefix}/`);
}

export function isProtectedRoute(pathname: string) {
  return PROTECTED_ROUTE_PREFIXES.some((route) =>
    matchesRoutePrefix(pathname, route),
  );
}

export function getNoTopNavRoute(pathname: string) {
  return NO_TOP_NAV_ROUTE_PREFIXES.find(({ prefix }) =>
    matchesRoutePrefix(pathname, prefix),
  );
}

export function isNoTopNavRoute(pathname: string) {
  return !!getNoTopNavRoute(pathname);
}

export function isFloatingBackButtonRoute(pathname: string) {
  const isExcluded = FLOATING_BACK_BUTTON_CONFIG.excludedRoutes.some((route) => route === pathname);
  return !isExcluded && FLOATING_BACK_BUTTON_CONFIG.routePrefixes.some((route) =>
    matchesRoutePrefix(pathname, route),
  );
}

export function getFloatingBackFallback(pathname: string) {
  if (pathname.startsWith("/buyer/profile/")) {
    return FLOATING_BACK_BUTTON_CONFIG.parentRoutes.buyerProfile;
  }
  if (pathname.startsWith("/buyer/orders/")) {
    return FLOATING_BACK_BUTTON_CONFIG.parentRoutes.buyerOrderDetail;
  }
  if (pathname === "/buyer/orders") {
    return FLOATING_BACK_BUTTON_CONFIG.parentRoutes.buyerOrders;
  }
  if (pathname.startsWith("/settings/")) {
    return FLOATING_BACK_BUTTON_CONFIG.parentRoutes.settings;
  }
  if (pathname === "/settings") {
    return FLOATING_BACK_BUTTON_CONFIG.parentRoutes.settingsHome;
  }
  return FLOATING_BACK_BUTTON_CONFIG.parentRoutes.checkout;
}

export const MARKETPLACE_ANNOUNCEMENTS = [
  { id: "shipping", text: "Free shipping on qualifying orders" },
  { id: "delivery", text: "Delivery guarantee · Refund for any issues" },
] as const;

export const HOME_HERO_COPY = {
  tagline: "Shop products from independent sellers",
  heading: "Explore products",
} as const;

export function getCurrencyOption(code: string) {
  return CURRENCY_OPTIONS.find((option) => option.code === code) ?? CURRENCY_OPTIONS[0];
}

export function calculateDeliveryFee(location: string | undefined, subtotal: number) {
  const lowerLocation = location?.toLowerCase() ?? "";
  let baseFee = 500; // Base fee in Naira

  // Nigerian states - lower fees
  if (NIGERIAN_STATES.some((state) => lowerLocation.includes(state.toLowerCase()))) {
    baseFee = 500;
  }
  // International locations
  else if (["united states", "canada", "united kingdom", "australia", "europe"].some((region) => lowerLocation.includes(region))) {
    baseFee = 3000;
  } else if (["india", "brazil", "global", "south africa", "china", "japan", "mexico"].some((region) => lowerLocation.includes(region))) {
    baseFee = 2000;
  }

  if (subtotal >= 50000) {
    return Math.max(0, baseFee - 200);
  }

  return baseFee;
}

export function formatCurrency(value: number, currencyCode = DEFAULT_CURRENCY, locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
