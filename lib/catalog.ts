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

export const BRANDS: BrandSeed[] = [
  { id: "fb80cb57-d697-51a2-9fae-be849c68bcc9", name: "GAF", slug: "gaf", industry: "home_improvement", website: "https://www.gaf.com" },
  { id: "f1b2b83a-42e0-55ce-8eba-8bc635c2bad6", name: "Owens Corning", slug: "owens-corning", industry: "home_improvement", website: "https://www.owenscorning.com" },
  { id: "e63e6da6-4ac9-54f3-8470-85151b0ffee8", name: "James Hardie", slug: "james-hardie", industry: "home_improvement", website: "https://www.jameshardie.com" },
  { id: "5226475c-1e0d-5b3c-8a00-e29c3f641cbe", name: "LP", slug: "lp", industry: "home_improvement", website: "https://www.lpcorp.com" },
  { id: "f16cc1a0-4eef-589a-8e23-c6c0bc76501d", name: "GCP", slug: "gcp", industry: "home_improvement", website: "https://gcpat.com" },
  { id: "fe62119d-158f-533b-8ac2-8ae19ac56627", name: "DuPont", slug: "dupont", industry: "home_improvement", website: "https://www.dupont.com" },
  { id: "cbe5746a-ce89-5733-b78c-fb6a997a3c98", name: "Unbranded", slug: "unbranded", industry: "home_improvement", website: null },
];

export const PRODUCTS: ProductSeed[] = [
  { id: "852d9141-5a8f-5453-b3c2-b410fe235c2e", brandId: "fb80cb57-d697-51a2-9fae-be849c68bcc9", name: "Timberline HDZ shingles", category: "Roofing", description: "Architectural asphalt shingles for steep-slope roofs.", industry: "home_improvement" },
  { id: "ad0c4c46-6b69-55f6-9f81-44a6678b8e20", brandId: "fb80cb57-d697-51a2-9fae-be849c68bcc9", name: "Timberline UHDZ shingles", category: "Roofing", description: "Thicker architectural asphalt shingles in the Timberline line.", industry: "home_improvement" },
  { id: "93228617-ae96-5157-8aa4-e09dcb84ae10", brandId: "fb80cb57-d697-51a2-9fae-be849c68bcc9", name: "Seal-A-Ridge cap shingles", category: "Roofing", description: "Hip and ridge cap shingles.", industry: "home_improvement" },
  { id: "27b01d2a-1b60-5dfa-b977-e8030cf437f3", brandId: "fb80cb57-d697-51a2-9fae-be849c68bcc9", name: "FeltBuster underlayment", category: "Roofing", description: "Synthetic roof underlayment.", industry: "home_improvement" },
  { id: "bc9866ef-b797-5e2c-86e4-15148952444c", brandId: "f1b2b83a-42e0-55ce-8eba-8bc635c2bad6", name: "Duration shingles", category: "Roofing", description: "Architectural asphalt shingles.", industry: "home_improvement" },
  { id: "03f960f8-908c-57b7-9f25-1d711d52ba8d", brandId: "f1b2b83a-42e0-55ce-8eba-8bc635c2bad6", name: "Oakridge shingles", category: "Roofing", description: "Architectural asphalt shingles.", industry: "home_improvement" },
  { id: "ed5ed855-5314-51c4-bd66-4afbb6a43329", brandId: "f16cc1a0-4eef-589a-8e23-c6c0bc76501d", name: "Ice and Water Shield", category: "Roofing", description: "Self-adhered roof leak barrier.", industry: "home_improvement" },
  { id: "db65fad1-82ad-5cdf-bf21-25283d2ab442", brandId: "cbe5746a-ce89-5733-b78c-fb6a997a3c98", name: "Aluminum drip edge", category: "Roofing", description: "Edge flashing for roof eaves and rakes.", industry: "home_improvement" },
  { id: "393fb731-271e-5da7-8dc1-992f9a459784", brandId: "cbe5746a-ce89-5733-b78c-fb6a997a3c98", name: "Roofing nails", category: "Roofing", description: "Coil nails for shingle fastening.", industry: "home_improvement" },
  { id: "f4f27a51-b2a4-5b41-8eb9-950f1d85e385", brandId: "5226475c-1e0d-5b3c-8a00-e29c3f641cbe", name: "SmartSide lap siding", category: "Siding", description: "Engineered wood lap siding.", industry: "home_improvement" },
  { id: "b3144b07-fed8-54bd-be51-1d33e652320c", brandId: "fe62119d-158f-533b-8ac2-8ae19ac56627", name: "Tyvek HomeWrap", category: "Weather barrier", description: "House wrap for exterior walls.", industry: "home_improvement" },
  { id: "181cb373-89a1-566f-8c55-705c67f98fd7", brandId: "cbe5746a-ce89-5733-b78c-fb6a997a3c98", name: "Vinyl corner post", category: "Siding", description: "Outside corner trim for vinyl siding.", industry: "home_improvement" },
  { id: "943e1a6f-b12f-532a-9a59-37f3855fde07", brandId: "e63e6da6-4ac9-54f3-8470-85151b0ffee8", name: "HardiePlank lap siding", category: "Siding", description: "Fiber-cement lap siding.", industry: "home_improvement" },
  { id: "03603b98-dc7d-5fc3-8ce5-4cded6d97722", brandId: "e63e6da6-4ac9-54f3-8470-85151b0ffee8", name: "HardieTrim boards", category: "Siding", description: "Fiber-cement trim boards.", industry: "home_improvement" },
  { id: "b108e016-0d8d-586e-9bee-dac5b807667d", brandId: "e63e6da6-4ac9-54f3-8470-85151b0ffee8", name: "HardieSoffit panels", category: "Siding", description: "Fiber-cement soffit panels.", industry: "home_improvement" },
];

export const SKUS: SkuSeed[] = [
  { id: "719c4821-6e7a-5be1-bdf0-dfc4965af742", productId: "852d9141-5a8f-5453-b3c2-b410fe235c2e", skuCode: "HD-THDZ-CHAR", name: "GAF Timberline HDZ shingles", variation: "Charcoal", unit: "square", listPriceCents: 32000, connectorSlug: "home-depot", attributes: { color: "Charcoal" } },
  { id: "4b11f167-606f-5d24-9918-faf78ebe30ed", productId: "bc9866ef-b797-5e2c-86e4-15148952444c", skuCode: "HD-DUR-ONYX", name: "Owens Corning Duration shingles", variation: "Onyx Black", unit: "square", listPriceCents: 29500, connectorSlug: "home-depot", attributes: { color: "Onyx Black" } },
  { id: "573026b2-c096-537f-988f-3092b140540e", productId: "ed5ed855-5314-51c4-bd66-4afbb6a43329", skuCode: "HD-IWS", name: "GCP Ice and Water Shield", variation: null, unit: "roll", listPriceCents: 11500, connectorSlug: "home-depot", attributes: {} },
  { id: "fdb79d12-ac64-58cb-bc79-c16adc6913a5", productId: "db65fad1-82ad-5cdf-bf21-25283d2ab442", skuCode: "HD-DRIP-W", name: "Aluminum drip edge", variation: "White", unit: "linear_ft", listPriceCents: 250, connectorSlug: "home-depot", attributes: { color: "White" } },
  { id: "d0f27a9a-a5ff-5009-bcb5-f15661d3a57f", productId: "393fb731-271e-5da7-8dc1-992f9a459784", skuCode: "HD-NAILS", name: "Roofing nails, coil box", variation: "1-1/4 in", unit: "each", listPriceCents: 4200, connectorSlug: "home-depot", attributes: { size: "1-1/4 in" } },
  { id: "cbb5035d-d157-568e-b64d-66b9dbfdf423", productId: "03f960f8-908c-57b7-9f25-1d711d52ba8d", skuCode: "LOW-OAK-BRN", name: "Owens Corning Oakridge shingles", variation: "Brownwood", unit: "square", listPriceCents: 27500, connectorSlug: "lowes", attributes: { color: "Brownwood" } },
  { id: "23ccb4b1-fb93-51dd-b8af-83dd1d4cf599", productId: "f4f27a51-b2a4-5b41-8eb9-950f1d85e385", skuCode: "LOW-SMART", name: "LP SmartSide lap siding", variation: null, unit: "sq_ft", listPriceCents: 310, connectorSlug: "lowes", attributes: {} },
  { id: "6f9ba51b-d289-5d40-9a79-b441ac8c42dc", productId: "b3144b07-fed8-54bd-be51-1d33e652320c", skuCode: "LOW-TYVEK", name: "DuPont Tyvek HomeWrap", variation: null, unit: "roll", listPriceCents: 16500, connectorSlug: "lowes", attributes: {} },
  { id: "10508e7a-e6d2-52cb-913e-7c526fed0cac", productId: "181cb373-89a1-566f-8c55-705c67f98fd7", skuCode: "LOW-CORNER", name: "Vinyl corner post", variation: "White", unit: "each", listPriceCents: 1800, connectorSlug: "lowes", attributes: { color: "White" } },
  { id: "8151f24a-25a7-55d8-a293-c77bd1f34bcc", productId: "852d9141-5a8f-5453-b3c2-b410fe235c2e", skuCode: "GAF-THDZ", name: "GAF Timberline HDZ shingles", variation: null, unit: "square", listPriceCents: 34000, connectorSlug: "gaf", attributes: {} },
  { id: "91e51b90-767b-5b67-a530-66a0f8d66184", productId: "ad0c4c46-6b69-55f6-9f81-44a6678b8e20", skuCode: "GAF-UHDZ", name: "GAF Timberline UHDZ shingles", variation: null, unit: "square", listPriceCents: 41000, connectorSlug: "gaf", attributes: {} },
  { id: "73a32f9a-2d87-5d6a-adab-63db6045bd8f", productId: "93228617-ae96-5157-8aa4-e09dcb84ae10", skuCode: "GAF-RIDGE", name: "GAF Seal-A-Ridge cap shingles", variation: null, unit: "bundle", listPriceCents: 6800, connectorSlug: "gaf", attributes: {} },
  { id: "183b11e0-81e4-5d12-bc39-a7f1be75024e", productId: "27b01d2a-1b60-5dfa-b977-e8030cf437f3", skuCode: "GAF-FELT", name: "GAF FeltBuster underlayment", variation: null, unit: "roll", listPriceCents: 9500, connectorSlug: "gaf", attributes: {} },
  { id: "efe79e9f-3ab7-52bf-9a0e-b2934cf8a936", productId: "943e1a6f-b12f-532a-9a59-37f3855fde07", skuCode: "JH-PLANK", name: "James Hardie HardiePlank lap siding", variation: null, unit: "sq_ft", listPriceCents: 425, connectorSlug: "james-hardie", attributes: {} },
  { id: "d34f5ec1-f4a3-57fb-b107-f16f45dab6f9", productId: "03603b98-dc7d-5fc3-8ce5-4cded6d97722", skuCode: "JH-TRIM", name: "James Hardie HardieTrim boards", variation: null, unit: "linear_ft", listPriceCents: 380, connectorSlug: "james-hardie", attributes: {} },
  { id: "3d64de28-0e02-5669-99b8-79569799b2a8", productId: "b108e016-0d8d-586e-9bee-dac5b807667d", skuCode: "JH-SOFFIT", name: "James Hardie HardieSoffit panels", variation: null, unit: "sq_ft", listPriceCents: 350, connectorSlug: "james-hardie", attributes: {} },
];

export function skusForConnector(slug: string): SkuSeed[] {
  return SKUS.filter((sku) => sku.connectorSlug === slug);
}
