import type { Unit } from "./types";

export interface BrandSeed {
  id: string;
  name: string;
  slug: string;
  industry: string;
  website: string | null;
}

export interface ProductSeed {
  id: string;
  brandId: string;
  name: string;
  category: string;
  description: string;
  industry: string;
}

export interface SkuSeed {
  id: string;
  productId: string;
  skuCode: string;
  name: string;
  variation: string | null;
  unit: Unit;
  listPriceCents: number;
  connectorSlug: string;
  attributes: Record<string, string>;
}

/** Every seed item is generic. Ids are stable: saved prices point at them. */
const UNBRANDED = "cbe5746a-ce89-5733-b78c-fb6a997a3c98";

export const BRANDS: BrandSeed[] = [
  { id: UNBRANDED, name: "Unbranded", slug: "unbranded", industry: "home_improvement", website: null },
];

/** Handyman and trade-tech work leads. The order here is the order on screen. */
export const DEFAULT_TRADE_CATEGORIES = ["Labor & fees", "Handyman", "Carpentry", "Plumbing", "Electrical", "Exterior"] as const;

/** Kept for people who already priced roofing. Listed only when chosen. */
export const ROOFING_CATEGORY = "Roofing & siding";

export function isDefaultTradeCategory(category: string): boolean {
  return (DEFAULT_TRADE_CATEGORIES as readonly string[]).includes(category);
}

function handyman(id: string, name: string, category: (typeof DEFAULT_TRADE_CATEGORIES)[number], description: string): ProductSeed {
  return { id, brandId: UNBRANDED, name, category, description, industry: "home_improvement" };
}

function roofing(id: string, name: string, description: string): ProductSeed {
  return { id, brandId: UNBRANDED, name, category: ROOFING_CATEGORY, description, industry: "home_improvement" };
}

export const PRODUCTS: ProductSeed[] = [
  handyman("89a58da1-73af-4c23-b6ad-72b807575900", "Service call", "Labor & fees", "Trip charge for showing up and diagnosing."),
  handyman("a368ce52-c928-4773-9946-cf526e97848f", "Hourly labor", "Labor & fees", "Time on site, billed by the hour."),
  handyman("b8d5a1e3-73a1-423a-a08f-ed4de4f9bd97", "Drywall patch", "Handyman", "Patch, tape, mud, and sand a small hole."),
  handyman("02184880-8a0d-4b69-9a82-d99be9e00e2b", "Furniture assembly", "Handyman", "Assemble one flat-pack piece."),
  handyman("523085b8-aaea-475c-9777-d2e2a3e13573", "TV mount", "Handyman", "Mount a TV on drywall and hide the cables."),
  handyman("c23b7a7b-6ddc-4119-b5a0-0be336acaa55", "Caulk tub or shower", "Handyman", "Remove old caulk and run a new bead."),
  handyman("09d57177-da86-4fe2-9c36-8dca97dd35e5", "Door rehang", "Carpentry", "Rehang an interior door so it closes and latches."),
  handyman("095e8f38-ea5c-4334-aadb-26e46d361cfa", "Weatherstrip a door", "Carpentry", "Replace worn weatherstrip and the door sweep."),
  handyman("6a8b9b91-4bf5-4149-8dcb-d4fd2488bc07", "Faucet replace", "Plumbing", "Swap a kitchen or bath faucet the customer supplies."),
  handyman("f893035c-4d35-4668-a8f7-35f5eae1196c", "Toilet repair", "Plumbing", "Replace the fill valve, flapper, or wax ring."),
  handyman("f12be2e6-8a98-4675-a287-5558ca8086d0", "Garbage disposal replace", "Plumbing", "Remove the old unit and install a new one."),
  handyman("e185ae25-f2c1-47d2-8d8f-281ad7db5caf", "Ceiling fan install", "Electrical", "Hang a fan on an existing rated box."),
  handyman("eba27971-d705-4dcb-90e8-e86b8a8551da", "Outlet or switch swap", "Electrical", "Replace one outlet or switch on an existing circuit."),
  handyman("47f7fe70-db74-424d-9325-a311fc4feab1", "Light fixture swap", "Electrical", "Replace one light fixture on an existing box."),
  handyman("f72acc55-b151-48fc-ae4f-a840a25c6788", "Smoke detector install", "Electrical", "Install or replace one smoke detector."),
  handyman("a2383ffd-f4fa-469c-b81a-57c14c7c9c4c", "Gutter clean", "Exterior", "Clear gutters and downspouts on a one-story home."),
  roofing("852d9141-5a8f-5453-b3c2-b410fe235c2e", "Architectural shingles", "Asphalt shingles for steep-slope roofs."),
  roofing("ad0c4c46-6b69-55f6-9f81-44a6678b8e20", "Heavyweight architectural shingles", "Thicker asphalt shingles."),
  roofing("93228617-ae96-5157-8aa4-e09dcb84ae10", "Hip and ridge cap shingles", "Cap shingles for hips and ridges."),
  roofing("27b01d2a-1b60-5dfa-b977-e8030cf437f3", "Synthetic underlayment", "Synthetic roof underlayment."),
  roofing("bc9866ef-b797-5e2c-86e4-15148952444c", "Laminated shingles", "Laminated asphalt shingles."),
  roofing("03f960f8-908c-57b7-9f25-1d711d52ba8d", "Standard architectural shingles", "Entry-level architectural shingles."),
  roofing("ed5ed855-5314-51c4-bd66-4afbb6a43329", "Self-adhered leak barrier", "Peel-and-stick barrier for eaves and valleys."),
  roofing("db65fad1-82ad-5cdf-bf21-25283d2ab442", "Aluminum drip edge", "Edge flashing for roof eaves and rakes."),
  roofing("393fb731-271e-5da7-8dc1-992f9a459784", "Roofing nails", "Coil nails for shingle fastening."),
  roofing("f4f27a51-b2a4-5b41-8eb9-950f1d85e385", "Engineered wood lap siding", "Engineered wood lap siding."),
  roofing("b3144b07-fed8-54bd-be51-1d33e652320c", "House wrap", "Weather barrier for exterior walls."),
  roofing("181cb373-89a1-566f-8c55-705c67f98fd7", "Vinyl corner post", "Outside corner trim for vinyl siding."),
  roofing("943e1a6f-b12f-532a-9a59-37f3855fde07", "Fiber-cement lap siding", "Fiber-cement lap siding."),
  roofing("03603b98-dc7d-5fc3-8ce5-4cded6d97722", "Fiber-cement trim boards", "Fiber-cement trim boards."),
  roofing("b108e016-0d8d-586e-9bee-dac5b807667d", "Fiber-cement soffit panels", "Fiber-cement soffit panels."),
];

export const SKUS: SkuSeed[] = [
  { id: "710439d1-2958-4802-bfbf-2f53fa06666a", productId: "89a58da1-73af-4c23-b6ad-72b807575900", skuCode: "HM-TRIP", name: "Service call", variation: "Trip charge", unit: "each", listPriceCents: 9500, connectorSlug: "handyman", attributes: {} },
  { id: "6d37c36c-3f16-40d4-bb7a-0c1bcc523036", productId: "a368ce52-c928-4773-9946-cf526e97848f", skuCode: "HM-HOUR", name: "Hourly labor", variation: null, unit: "hour", listPriceCents: 8500, connectorSlug: "handyman", attributes: {} },
  { id: "2a3bd386-91dc-43fb-8e04-d9a2258ec813", productId: "b8d5a1e3-73a1-423a-a08f-ed4de4f9bd97", skuCode: "HM-DRYWALL", name: "Drywall patch", variation: "Up to 6 in", unit: "each", listPriceCents: 17500, connectorSlug: "handyman", attributes: { size: "Up to 6 in" } },
  { id: "81448051-ab9e-4a8d-aa58-51d068f57db1", productId: "02184880-8a0d-4b69-9a82-d99be9e00e2b", skuCode: "HM-ASSEMBLE", name: "Furniture assembly", variation: "One piece", unit: "each", listPriceCents: 9000, connectorSlug: "handyman", attributes: {} },
  { id: "068eb1cc-4bfe-45c4-9311-83bb9ed6277e", productId: "523085b8-aaea-475c-9777-d2e2a3e13573", skuCode: "HM-TVMOUNT", name: "TV mount", variation: "Up to 65 in", unit: "each", listPriceCents: 15000, connectorSlug: "handyman", attributes: { size: "Up to 65 in" } },
  { id: "26eefa00-a39c-4099-baf7-36cae62a7ab9", productId: "c23b7a7b-6ddc-4119-b5a0-0be336acaa55", skuCode: "HM-CAULK", name: "Caulk tub or shower", variation: null, unit: "each", listPriceCents: 12000, connectorSlug: "handyman", attributes: {} },
  { id: "56c1a122-5424-423c-b025-0aac4fb6e437", productId: "09d57177-da86-4fe2-9c36-8dca97dd35e5", skuCode: "HM-DOOR", name: "Door rehang", variation: "Interior", unit: "each", listPriceCents: 16500, connectorSlug: "handyman", attributes: {} },
  { id: "e2fee4b2-340e-494a-856f-75917701f3ff", productId: "095e8f38-ea5c-4334-aadb-26e46d361cfa", skuCode: "HM-WEATHER", name: "Weatherstrip a door", variation: null, unit: "each", listPriceCents: 8500, connectorSlug: "handyman", attributes: {} },
  { id: "6aafa256-00f1-48ab-9d79-8c817c0c6e4b", productId: "6a8b9b91-4bf5-4149-8dcb-d4fd2488bc07", skuCode: "HM-FAUCET", name: "Faucet replace", variation: "Customer supplies faucet", unit: "each", listPriceCents: 18500, connectorSlug: "handyman", attributes: {} },
  { id: "cde4fe2e-bdbc-4ed3-b63a-375206e100ba", productId: "f893035c-4d35-4668-a8f7-35f5eae1196c", skuCode: "HM-TOILET", name: "Toilet repair", variation: null, unit: "each", listPriceCents: 14500, connectorSlug: "handyman", attributes: {} },
  { id: "ff195a27-ecc0-4ba5-9a39-05df15656a47", productId: "f12be2e6-8a98-4675-a287-5558ca8086d0", skuCode: "HM-DISPOSAL", name: "Garbage disposal replace", variation: null, unit: "each", listPriceCents: 22500, connectorSlug: "handyman", attributes: {} },
  { id: "d71fd93a-a18c-459a-a8f7-ef9b91f73de4", productId: "e185ae25-f2c1-47d2-8d8f-281ad7db5caf", skuCode: "HM-FAN", name: "Ceiling fan install", variation: "Existing box", unit: "each", listPriceCents: 22000, connectorSlug: "handyman", attributes: {} },
  { id: "108726e2-9235-4734-953c-65d71786f506", productId: "eba27971-d705-4dcb-90e8-e86b8a8551da", skuCode: "HM-OUTLET", name: "Outlet or switch swap", variation: null, unit: "each", listPriceCents: 9500, connectorSlug: "handyman", attributes: {} },
  { id: "19439b97-2518-47c8-8694-893fb0d2e1c5", productId: "47f7fe70-db74-424d-9325-a311fc4feab1", skuCode: "HM-LIGHT", name: "Light fixture swap", variation: null, unit: "each", listPriceCents: 13500, connectorSlug: "handyman", attributes: {} },
  { id: "c9093379-42fd-437a-afca-09ffd1698dfe", productId: "f72acc55-b151-48fc-ae4f-a840a25c6788", skuCode: "HM-SMOKE", name: "Smoke detector install", variation: null, unit: "each", listPriceCents: 7500, connectorSlug: "handyman", attributes: {} },
  { id: "2ff138d8-d8bc-41d4-b958-781724c79b56", productId: "a2383ffd-f4fa-469c-b81a-57c14c7c9c4c", skuCode: "HM-GUTTER", name: "Gutter clean", variation: "One story", unit: "each", listPriceCents: 17500, connectorSlug: "handyman", attributes: {} },
  { id: "719c4821-6e7a-5be1-bdf0-dfc4965af742", productId: "852d9141-5a8f-5453-b3c2-b410fe235c2e", skuCode: "RS-ARCH-CHAR", name: "Architectural shingles", variation: "Charcoal", unit: "square", listPriceCents: 32000, connectorSlug: "home-depot", attributes: { color: "Charcoal" } },
  { id: "4b11f167-606f-5d24-9918-faf78ebe30ed", productId: "bc9866ef-b797-5e2c-86e4-15148952444c", skuCode: "RS-LAM-BLK", name: "Laminated shingles", variation: "Black", unit: "square", listPriceCents: 29500, connectorSlug: "home-depot", attributes: { color: "Black" } },
  { id: "573026b2-c096-537f-988f-3092b140540e", productId: "ed5ed855-5314-51c4-bd66-4afbb6a43329", skuCode: "RS-LEAK", name: "Self-adhered leak barrier", variation: null, unit: "roll", listPriceCents: 11500, connectorSlug: "home-depot", attributes: {} },
  { id: "fdb79d12-ac64-58cb-bc79-c16adc6913a5", productId: "db65fad1-82ad-5cdf-bf21-25283d2ab442", skuCode: "RS-DRIP-W", name: "Aluminum drip edge", variation: "White", unit: "linear_ft", listPriceCents: 250, connectorSlug: "home-depot", attributes: { color: "White" } },
  { id: "d0f27a9a-a5ff-5009-bcb5-f15661d3a57f", productId: "393fb731-271e-5da7-8dc1-992f9a459784", skuCode: "RS-NAILS", name: "Roofing nails, coil box", variation: "1-1/4 in", unit: "each", listPriceCents: 4200, connectorSlug: "home-depot", attributes: { size: "1-1/4 in" } },
  { id: "cbb5035d-d157-568e-b64d-66b9dbfdf423", productId: "03f960f8-908c-57b7-9f25-1d711d52ba8d", skuCode: "RS-STD-BRN", name: "Standard architectural shingles", variation: "Brown", unit: "square", listPriceCents: 27500, connectorSlug: "lowes", attributes: { color: "Brown" } },
  { id: "23ccb4b1-fb93-51dd-b8af-83dd1d4cf599", productId: "f4f27a51-b2a4-5b41-8eb9-950f1d85e385", skuCode: "RS-WOODLAP", name: "Engineered wood lap siding", variation: null, unit: "sq_ft", listPriceCents: 310, connectorSlug: "lowes", attributes: {} },
  { id: "6f9ba51b-d289-5d40-9a79-b441ac8c42dc", productId: "b3144b07-fed8-54bd-be51-1d33e652320c", skuCode: "RS-WRAP", name: "House wrap", variation: null, unit: "roll", listPriceCents: 16500, connectorSlug: "lowes", attributes: {} },
  { id: "10508e7a-e6d2-52cb-913e-7c526fed0cac", productId: "181cb373-89a1-566f-8c55-705c67f98fd7", skuCode: "RS-CORNER", name: "Vinyl corner post", variation: "White", unit: "each", listPriceCents: 1800, connectorSlug: "lowes", attributes: { color: "White" } },
  { id: "8151f24a-25a7-55d8-a293-c77bd1f34bcc", productId: "852d9141-5a8f-5453-b3c2-b410fe235c2e", skuCode: "RS-ARCH", name: "Architectural shingles", variation: null, unit: "square", listPriceCents: 34000, connectorSlug: "gaf", attributes: {} },
  { id: "91e51b90-767b-5b67-a530-66a0f8d66184", productId: "ad0c4c46-6b69-55f6-9f81-44a6678b8e20", skuCode: "RS-ARCH-HD", name: "Heavyweight architectural shingles", variation: null, unit: "square", listPriceCents: 41000, connectorSlug: "gaf", attributes: {} },
  { id: "73a32f9a-2d87-5d6a-adab-63db6045bd8f", productId: "93228617-ae96-5157-8aa4-e09dcb84ae10", skuCode: "RS-RIDGE", name: "Hip and ridge cap shingles", variation: null, unit: "bundle", listPriceCents: 6800, connectorSlug: "gaf", attributes: {} },
  { id: "183b11e0-81e4-5d12-bc39-a7f1be75024e", productId: "27b01d2a-1b60-5dfa-b977-e8030cf437f3", skuCode: "RS-UNDER", name: "Synthetic underlayment", variation: null, unit: "roll", listPriceCents: 9500, connectorSlug: "gaf", attributes: {} },
  { id: "efe79e9f-3ab7-52bf-9a0e-b2934cf8a936", productId: "943e1a6f-b12f-532a-9a59-37f3855fde07", skuCode: "RS-FCLAP", name: "Fiber-cement lap siding", variation: null, unit: "sq_ft", listPriceCents: 425, connectorSlug: "james-hardie", attributes: {} },
  { id: "d34f5ec1-f4a3-57fb-b107-f16f45dab6f9", productId: "03603b98-dc7d-5fc3-8ce5-4cded6d97722", skuCode: "RS-FCTRIM", name: "Fiber-cement trim boards", variation: null, unit: "linear_ft", listPriceCents: 380, connectorSlug: "james-hardie", attributes: {} },
  { id: "3d64de28-0e02-5669-99b8-79569799b2a8", productId: "b108e016-0d8d-586e-9bee-dac5b807667d", skuCode: "RS-FCSOFFIT", name: "Fiber-cement soffit panels", variation: null, unit: "sq_ft", listPriceCents: 350, connectorSlug: "james-hardie", attributes: {} },
];

/** Codes from the first catalog, so a saved price sheet still imports. */
const LEGACY_SKU_CODES: Record<string, string> = {
  "hd-thdz-char": "RS-ARCH-CHAR",
  "hd-dur-onyx": "RS-LAM-BLK",
  "hd-iws": "RS-LEAK",
  "hd-drip-w": "RS-DRIP-W",
  "hd-nails": "RS-NAILS",
  "low-oak-brn": "RS-STD-BRN",
  "low-smart": "RS-WOODLAP",
  "low-tyvek": "RS-WRAP",
  "low-corner": "RS-CORNER",
  "gaf-thdz": "RS-ARCH",
  "gaf-uhdz": "RS-ARCH-HD",
  "gaf-ridge": "RS-RIDGE",
  "gaf-felt": "RS-UNDER",
  "jh-plank": "RS-FCLAP",
  "jh-trim": "RS-FCTRIM",
  "jh-soffit": "RS-FCSOFFIT",
};

export function currentSkuCode(code: string): string {
  return LEGACY_SKU_CODES[code.trim().toLowerCase()] ?? code.trim();
}

export function skusForConnector(slug: string): SkuSeed[] {
  return SKUS.filter((sku) => sku.connectorSlug === slug);
}
