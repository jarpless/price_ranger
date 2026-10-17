/**
 * Market helpers that client components may import. Named-model matchers and
 * sold comps live in market.ts, which only the server imports.
 */

export const CONDITIONS = [
  { id: "new", label: "New", factor: 1.32 },
  { id: "like_new", label: "Like new", factor: 1.14 },
  { id: "good", label: "Good", factor: 1 },
  { id: "fair", label: "Fair", factor: 0.76 },
  { id: "parts", label: "For parts", factor: 0.38 },
] as const;

export type ConditionId = (typeof CONDITIONS)[number]["id"];
export type Confidence = "low" | "medium" | "high";

export const QUICK_ITEMS: { label: string; description: string; category: string }[] = [
  { category: "Games", label: "Game console", description: "Used game console with controller" },
  { category: "Phones", label: "Smartphone", description: "Used unlocked smartphone 128GB" },
  { category: "Audio", label: "Wireless earbuds", description: "Used wireless earbuds with case" },
  { category: "Computers", label: "Laptop", description: "Used 13 inch laptop" },
  { category: "Furniture", label: "Dresser", description: "Used wooden dresser" },
  { category: "Outdoor", label: "Road bike", description: "Used road bike" },
];

export const CATEGORIES = ["Games", "Phones", "Audio", "Computers", "Furniture", "Outdoor"] as const;

export function conditionById(id: string | null | undefined): ConditionId {
  return CONDITIONS.some((item) => item.id === id) ? (id as ConditionId) : "good";
}

export function conditionLabel(id: ConditionId): string {
  return CONDITIONS.find((item) => item.id === id)?.label ?? "Good";
}

export interface MarketMeta {
  itemId: string | null;
  variantId: string | null;
  condition: ConditionId;
  lowCents: number | null;
  highCents: number | null;
  confidence: Confidence | null;
  suggestedCents: number | null;
  overrideCents: number | null;
  preset: string | null;
}

function metaValue(sources: string[], key: string): string | null {
  const prefix = `meta:${key}=`;
  const found = sources.find((source) => source.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

export function readMarketMeta(sources: string[]): MarketMeta {
  const low = Number(metaValue(sources, "low"));
  const high = Number(metaValue(sources, "high"));
  const suggested = Number(metaValue(sources, "suggested"));
  const override = metaValue(sources, "override");
  const confidence = metaValue(sources, "confidence");
  return {
    itemId: metaValue(sources, "item"),
    variantId: metaValue(sources, "variant"),
    condition: conditionById(metaValue(sources, "condition")),
    lowCents: Number.isFinite(low) && low > 0 ? low : null,
    highCents: Number.isFinite(high) && high > 0 ? high : null,
    confidence: confidence === "low" || confidence === "medium" || confidence === "high" ? confidence : null,
    suggestedCents: Number.isFinite(suggested) && suggested > 0 ? suggested : null,
    overrideCents: override && Number.isFinite(Number(override)) ? Number(override) : null,
    preset: metaValue(sources, "preset"),
  };
}

export function withOverride(sources: string[], cents: number | null): string[] {
  const kept = sources.filter((source) => !source.startsWith("meta:override="));
  if (cents == null) return kept;
  return [...kept, `meta:override=${Math.max(0, Math.round(cents))}`];
}

export function namesForAutocomplete(): string[] {
  return QUICK_ITEMS.map((item) => item.description);
}

/** Matches for the item field. They render in the page, under the field and above See price. */
export function searchSuggestions(query: string, names: string[], limit = 5): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const seen = new Set<string>();
  const matches: string[] = [];
  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (!key.includes(needle) || key === needle || seen.has(key)) continue;
    seen.add(key);
    matches.push(name);
    if (matches.length >= limit) break;
  }
  return matches;
}

/** $1,250 against a $150–$200 sold range is far enough to warn. A few dollars outside is not. */
export function priceFarFromRange(cents: number | null, lowCents: number | null, highCents: number | null): boolean {
  if (cents == null || lowCents == null || highCents == null || lowCents <= 0 || highCents <= 0) return false;
  return cents > highCents * 2 || cents * 2 < lowCents;
}
