export interface SizeGuide {
  title: string;
  note: string;
  rows: readonly (readonly string[])[];
}

export const SIZE_GUIDES: Readonly<Record<string, SizeGuide>> = {
  clothing: {
    title: "Clothing size guide",
    note: "Use these body measurements as a guide. Fit can vary by brand and style.",
    rows: [
      ["Size", "Chest (cm)", "Waist (cm)"],
      ["XS", "81–86", "66–71"],
      ["S", "87–92", "72–77"],
      ["M", "93–98", "78–83"],
      ["L", "99–104", "84–89"],
      ["XL", "105–112", "90–97"],
      ["XXL", "113–120", "98–105"],
      ["XXXL", "121–128", "106–113"],
    ],
  },
  shoes: {
    title: "Shoe size guide",
    note: "Sizes are listed in EU sizing. Approximate equivalents are shown below.",
    rows: [
      ["EU", "UK", "US"],
      ["35", "2.5", "4.5"],
      ["36", "3.5", "5.5"],
      ["37", "4", "6"],
      ["38", "5", "7"],
      ["39", "6", "8"],
      ["40", "6.5", "8.5"],
      ["41", "7.5", "9.5"],
      ["42", "8", "10"],
      ["43", "9", "11"],
      ["44", "9.5", "11.5"],
      ["45", "10.5", "12.5"],
      ["46", "11", "13"],
      ["47", "12", "14"],
      ["48", "13", "15"],
    ],
  },
  jewelry: {
    title: "Jewelry size guide",
    note: "Ring sizing varies across manufacturers. Confirm measurements with the seller before ordering.",
    rows: [
      ["US", "UK", "EU", "Diameter (mm)"],
      ["4", "H", "47", "14.9"],
      ["5", "J", "49", "15.7"],
      ["6", "L", "52", "16.5"],
      ["7", "N", "54", "17.3"],
      ["8", "P", "57", "18.1"],
      ["9", "R", "59", "18.9"],
      ["10", "T", "62", "19.8"],
      ["11", "V", "64", "20.6"],
      ["12", "X", "67", "21.4"],
      ["13", "Z", "69", "22.2"],
    ],
  },
  "jewelry-watches": {
    title: "Jewelry and watch size guide",
    note: "Use the reference that matches the item: ring conversions, watch case diameter, or band fit.",
    rows: [
      ["Type", "Size", "Reference"],
      ["Ring", "US 4 / UK H / EU 47", "14.9 mm inner diameter"],
      ["Ring", "US 7 / UK N / EU 54", "17.3 mm inner diameter"],
      ["Ring", "US 10 / UK T / EU 62", "19.8 mm inner diameter"],
      ["Watch case", "28–46 mm", "Case diameter"],
      ["Watch band", "Small / Medium / Large", "Choose by wrist measurement"],
    ],
  },
  watches: {
    title: "Watch size guide",
    note: "Case diameter is measured across the watch face. Choose a band size that fits comfortably around your wrist.",
    rows: [
      ["Case diameter", "Typical fit"],
      ["28–32 mm", "Small"],
      ["36–38 mm", "Small to medium"],
      ["40–42 mm", "Medium"],
      ["44–46 mm", "Large"],
    ],
  },
};

export function getSizeGuideKey(categorySlug: string | null | undefined) {
  const slug = categorySlug?.toLowerCase().replace(/&/g, "and") ?? "";
  if ((slug.includes("jewel") || slug.includes("jewell")) && slug.includes("watch")) return "jewelry-watches";
  if (slug.includes("shoe") || slug.includes("footwear")) return "shoes";
  if (slug.includes("watch") && !slug.includes("jewel")) return "watches";
  if (slug.includes("jewel") || slug.includes("jewell")) return "jewelry";
  if (slug.includes("fashion") || slug.includes("clothing") || slug.includes("apparel") || slug === "tops" || slug === "dresses" || slug === "trousers" || slug === "jeans") return "clothing";
  return null;
}
