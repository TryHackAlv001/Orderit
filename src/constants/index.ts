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

export const MARKETPLACE_ANNOUNCEMENTS = [
  { id: "shipping", text: "Free shipping on qualifying orders" },
  { id: "delivery", text: "Delivery guarantee · Refund for any issues" },
] as const;

export const HOME_HERO_COPY = {
  tagline: "Shop the season's best",
  heading: "EXPLORE YOUR INTERESTS",
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
