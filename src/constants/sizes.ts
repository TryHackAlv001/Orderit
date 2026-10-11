export type SizeType = "none" | "single" | "multi";

export interface SizeConfig {
  type: SizeType;
  label: string;
  unitSystems?: readonly string[];
  options: readonly string[];
  measurement?: {
    unit: string;
    min: number;
    max: number;
    format?: "value" | "dimensions";
  };
}

const clothingSizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;
const waistSizes = Array.from({ length: 17 }, (_, index) => `Waist ${28 + index} in`);
const shoeSizes = Array.from({ length: 14 }, (_, index) => `EU ${35 + index}`);
const phoneOptions = [
  "64 GB", "128 GB", "256 GB", "512 GB", "1 TB",
  "6.1 in screen", "6.7 in screen", "13 in screen", "14 in screen", "15.6 in screen",
];
const volumeSizes = ["30 ml", "50 ml", "100 ml", "150 ml", "250 ml", "500 ml", "1 L"];
const weightSizes = ["100 g", "250 g", "500 g", "1 kg", "2 kg", "5 kg", "10 kg", "25 kg"];
const standardSizes = ["Small", "Medium", "Large"];
const ringSizes = [
  ...Array.from({ length: 10 }, (_, index) => `US ring ${index + 4}`),
  ...["H", "J", "L", "N", "P", "R", "T", "V", "X", "Z"].map((size) => `UK ring ${size}`),
  ...[47, 49, 52, 54, 57, 59, 62, 64, 67, 69].map((size) => `EU ring ${size}`),
];
const jewelrySizes = [
  ...ringSizes,
  "Bracelet 16 cm", "Bracelet 18 cm", "Bracelet 20 cm",
  "Necklace 14 in", "Necklace 16 in", "Necklace 18 in", "Necklace 20 in", "Necklace 24 in",
];

export const SIZE_CONFIG: Readonly<Record<string, SizeConfig>> = {
  clothing: {
    type: "multi",
    label: "Clothing size",
    options: [...clothingSizes, ...waistSizes],
  },
  tops: { type: "multi", label: "Clothing size", options: clothingSizes },
  dresses: { type: "multi", label: "Dress size", options: clothingSizes },
  trousers: { type: "multi", label: "Waist size", options: waistSizes },
  jeans: { type: "multi", label: "Waist size", options: waistSizes },
  shoes: {
    type: "multi",
    label: "Shoe size",
    unitSystems: ["EU", "UK", "US"],
    options: shoeSizes,
  },
  footwear: {
    type: "multi",
    label: "Shoe size",
    unitSystems: ["EU", "UK", "US"],
    options: shoeSizes,
  },
  watches: {
    type: "multi",
    label: "Watch size",
    options: ["28 mm case", "32 mm case", "36 mm case", "38 mm case", "40 mm case", "42 mm case", "44 mm case", "46 mm case", "Small band", "Medium band", "Large band"],
  },
  jewelry: {
    type: "multi",
    label: "Jewelry size",
    unitSystems: ["US", "UK", "EU"],
    options: jewelrySizes,
  },
  "jewelry-watches": {
    type: "multi",
    label: "Jewelry or watch size",
    unitSystems: ["US", "UK", "EU"],
    options: [
      ...jewelrySizes,
      "28 mm case", "32 mm case", "36 mm case", "38 mm case", "40 mm case", "42 mm case", "44 mm case", "46 mm case",
      "Small band", "Medium band", "Large band",
    ],
  },
  electronics: { type: "multi", label: "Storage or screen size", options: phoneOptions },
  "phones-accessories": { type: "multi", label: "Storage or screen size", options: phoneOptions },
  "computers-laptops": { type: "multi", label: "Storage or screen size", options: phoneOptions },
  beauty: { type: "multi", label: "Volume", options: volumeSizes },
  "beauty-personal-care": { type: "multi", label: "Volume", options: volumeSizes },
  "food-drinks": { type: "multi", label: "Pack size", options: [...weightSizes, ...volumeSizes, "Pack of 2", "Pack of 4", "Pack of 6", "Pack of 12"] },
  groceries: { type: "multi", label: "Pack size", options: [...weightSizes, ...volumeSizes, "Pack of 2", "Pack of 4", "Pack of 6", "Pack of 12"] },
  agriculture: { type: "multi", label: "Weight or volume", options: [...weightSizes, ...volumeSizes] },
  "home-kitchen": { type: "single", label: "Product size", options: standardSizes },
  furniture: {
    type: "single",
    label: "Dimensions (L × W × H)",
    options: [],
    measurement: { unit: "cm", min: 1, max: 1000, format: "dimensions" },
  },
  bags: { type: "multi", label: "Bag size", options: standardSizes },
  "baby-kids": { type: "multi", label: "Clothing size", options: [...clothingSizes, "Newborn", "0-3 months", "3-6 months", "6-12 months", "12-18 months", "2T", "3T", "4T"] },
  "sports-outdoors": { type: "multi", label: "Size", options: [...clothingSizes, ...shoeSizes] },
  "pet-supplies": { type: "multi", label: "Product size", options: [...standardSizes, ...weightSizes] },
  "office-stationery": { type: "multi", label: "Pack size", options: ["A4", "A3", "A5", "Small", "Medium", "Large", "Pack of 2", "Pack of 4", "Pack of 6", "Pack of 12"] },
  "health-wellness": { type: "multi", label: "Volume or pack size", options: [...volumeSizes, ...weightSizes, "Pack of 2", "Pack of 4", "Pack of 6", "Pack of 12"] },
  services: { type: "none", label: "Size", options: [] },
  "books-media": { type: "none", label: "Size", options: [] },
  "toys-games": { type: "none", label: "Size", options: [] },
  automotive: { type: "none", label: "Size", options: [] },
  "arts-crafts": { type: "none", label: "Size", options: [] },
  "garden-outdoor": { type: "none", label: "Size", options: [] },
  others: { type: "none", label: "Size", options: [] },
};

export const ALL_SIZE_OPTIONS = Array.from(new Set(
  Object.values(SIZE_CONFIG).flatMap((config) => config.options)
)).sort((a, b) => a.localeCompare(b));

const CATEGORY_ALIASES: Readonly<Record<string, keyof typeof SIZE_CONFIG>> = {
  fashion: "clothing",
  apparel: "clothing",
  clothing: "clothing",
  "fashion-clothing": "clothing",
  "jewelry-watches": "jewelry-watches",
  "jewelry-and-watches": "jewelry-watches",
  "jewellery-watches": "jewelry-watches",
  jewellery: "jewelry",
  "jewelry-accessories": "jewelry",
  "jewellery-accessories": "jewelry",
  "phones-and-accessories": "phones-accessories",
  "computers-and-laptops": "computers-laptops",
  "beauty-and-personal-care": "beauty-personal-care",
  "food-and-drinks": "food-drinks",
  "home-and-kitchen": "home-kitchen",
  "sports-and-outdoors": "sports-outdoors",
  "office-and-stationery": "office-stationery",
  "books-and-media": "books-media",
  "toys-and-games": "toys-games",
  "pet-supplies": "pet-supplies",
  "garden-and-outdoor": "garden-outdoor",
  "health-and-wellness": "health-wellness",
};

function normalizeCategorySlug(categorySlug: string) {
  return categorySlug
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getSizeConfig(categorySlug: string | null | undefined): SizeConfig {
  if (!categorySlug) return SIZE_CONFIG.others;
  const normalized = normalizeCategorySlug(categorySlug);
  const configKey = CATEGORY_ALIASES[normalized] ?? normalized;
  return SIZE_CONFIG[configKey] ?? SIZE_CONFIG.others;
}

export function isValidSize(categorySlug: string, value: string): boolean {
  const config = getSizeConfig(categorySlug);
  const normalizedValue = value.trim();
  if (config.type === "none" || normalizedValue.length === 0) return false;
  if (config.options.includes(normalizedValue)) return true;
  if (config.measurement?.format === "dimensions") {
    const dimensions = normalizedValue.match(/^(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*cm$/i);
    return Boolean(dimensions && dimensions.slice(1).every((part) => {
      const value = Number(part);
      return value >= (config.measurement?.min ?? 0) && value <= (config.measurement?.max ?? 0);
    }));
  }
  return false;
}

export function getSizeLabel(categorySlug: string | null | undefined, value: string) {
  const config = getSizeConfig(categorySlug);
  return `${config.label}: ${value}`;
}
