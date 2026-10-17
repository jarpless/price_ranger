/**
 * Maker, label, retailer, and marketplace names that must not appear in in-app
 * examples, quick picks, placeholders, starter items, or sample catalog data.
 * Typed input may still name a model; this list is for copy we write.
 */
export const BRAND_WORDS = [
  "nintendo",
  "switch oled",
  "joy-con",
  "playstation",
  "ps5",
  "xbox",
  "iphone",
  "ipad",
  "airpods",
  "macbook",
  "apple",
  "samsung",
  "galaxy",
  "pixel",
  "sony",
  "ikea",
  "nike",
  "adidas",
  "trek",
  "gaf",
  "timberline",
  "owens corning",
  "oakridge",
  "duration shingles",
  "james hardie",
  "hardie",
  "hardieplank",
  "tyvek",
  "dupont",
  "smartside",
  "feltbuster",
  "seal-a-ridge",
  "gcp",
  "ice and water shield",
  "home depot",
  "lowe's",
  "dewalt",
  "milwaukee",
  "kohler",
  "moen",
  "delta",
  "hunter",
  "kitchenaid",
  "ebay",
] as const;

export function brandWordIn(text: string): string | null {
  const lower = text.toLowerCase();
  for (const word of BRAND_WORDS) {
    const pattern = new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i");
    if (pattern.test(lower)) return word;
  }
  return null;
}
