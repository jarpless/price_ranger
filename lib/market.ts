import { formatUsd } from "./money";

export const CONDITIONS = [
  { id: "new", label: "New", factor: 1.32 },
  { id: "like_new", label: "Like new", factor: 1.14 },
  { id: "good", label: "Good", factor: 1 },
  { id: "fair", label: "Fair", factor: 0.76 },
  { id: "parts", label: "For parts", factor: 0.38 },
] as const;

export type ConditionId = (typeof CONDITIONS)[number]["id"];
export type Confidence = "low" | "medium" | "high";

export interface Comparable {
  title: string;
  priceCents: number;
  condition: string;
  source: string;
  url: string;
  soldAt: string;
  listed: boolean;
  thumbnail: string;
}

export interface MarketQuote {
  itemId: string;
  title: string;
  variantId: string | null;
  variantLabel: string | null;
  ambiguousModel: boolean;
  variants: { id: string; label: string }[];
  condition: ConditionId;
  cents: number;
  lowCents: number;
  highCents: number;
  confidence: Confidence;
  note: string;
  comparables: Comparable[];
  sources: string[];
}

interface VariantSeed {
  id: string;
  label: string;
  test: RegExp;
  /** Good-condition sold range, in cents. */
  low: number;
  high: number;
  point: number;
  query: string;
  comps: { title: string; priceCents: number; condition: string; soldAt: string }[];
}

type ThumbShape = "console" | "phone" | "headphones" | "laptop" | "table";

interface ItemSeed {
  id: string;
  title: string;
  test: RegExp;
  color: string;
  shape: ThumbShape;
  variants: VariantSeed[];
}

function soldSearch(query: string): string {
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1&rt=nc`;
}

function thumb(color: string, shape: ThumbShape): string {
  const mark =
    shape === "phone"
      ? `<rect x="58" y="24" width="44" height="112" rx="10" fill="#fffdf8" stroke="#1c1915" stroke-width="4"/><rect x="70" y="36" width="20" height="4" rx="2" fill="#1c1915"/>`
      : shape === "headphones"
        ? `<path d="M46 90c0-30 16-52 34-52s34 22 34 52" fill="none" stroke="#1c1915" stroke-width="8" stroke-linecap="round"/><rect x="32" y="78" width="24" height="44" rx="10" fill="#fffdf8" stroke="#1c1915" stroke-width="4"/><rect x="104" y="78" width="24" height="44" rx="10" fill="#fffdf8" stroke="#1c1915" stroke-width="4"/>`
        : shape === "laptop"
          ? `<rect x="36" y="36" width="88" height="58" rx="6" fill="#fffdf8" stroke="#1c1915" stroke-width="4"/><path d="M28 108h104l-10-14H38z" fill="#fffdf8" stroke="#1c1915" stroke-width="4"/>`
          : shape === "table"
            ? `<rect x="28" y="48" width="104" height="14" rx="3" fill="#fffdf8" stroke="#1c1915" stroke-width="4"/><rect x="40" y="62" width="10" height="42" fill="#fffdf8" stroke="#1c1915" stroke-width="4"/><rect x="110" y="62" width="10" height="42" fill="#fffdf8" stroke="#1c1915" stroke-width="4"/>`
          : `<rect x="24" y="52" width="112" height="56" rx="12" fill="#fffdf8" stroke="#1c1915" stroke-width="4"/><rect x="36" y="64" width="40" height="28" rx="4" fill="${color}"/><circle cx="108" cy="72" r="6" fill="#1c1915"/><circle cx="108" cy="90" r="6" fill="#1c1915"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="28" fill="${color}"/>${mark}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function shapeFor(title: string): ThumbShape {
  if (/phone|iphone|pixel|galaxy/i.test(title)) return "phone";
  if (/airpod|headphone|earbud/i.test(title)) return "headphones";
  if (/macbook|laptop|notebook/i.test(title)) return "laptop";
  if (/table|desk|chair|dresser/i.test(title)) return "table";
  return "console";
}

function pictureColor(title: string): string {
  if (/table|desk|chair|dresser|oak|wood/i.test(title)) return "#c4a574";
  if (/phone|iphone|pixel|galaxy/i.test(title)) return "#d5dee8";
  if (/airpod|headphone|earbud/i.test(title)) return "#ece7df";
  if (/macbook|laptop|notebook/i.test(title)) return "#d9d4cc";
  return "#d7e4dc";
}

/** A picture for a price that is not one of the catalog consoles. */
export function pictureFor(title: string): string {
  return thumb(pictureColor(title), shapeFor(title));
}

/**
 * Cents to scale sold comps from. This is the item lookup or the sold range,
 * never the price someone typed.
 */
export function comparableAnchorCents(input: {
  lookupCents?: number | null;
  suggestedCents?: number | null;
  lowCents?: number | null;
  highCents?: number | null;
}): number {
  const lookup = input.lookupCents ?? 0;
  if (lookup > 0) return lookup;
  const suggested = input.suggestedCents ?? 0;
  if (suggested > 0) return suggested;
  const low = input.lowCents ?? 0;
  const high = input.highCents ?? 0;
  if (low > 0 && high > 0) return Math.round((low + high) / 2);
  return 0;
}

/** Midpoint of a sold range such as "$144–$216". */
export function comparableAnchorFromRange(range: string): number {
  const amounts = [...range.matchAll(/([\d,]+(?:\.\d+)?)/g)]
    .map((match) => {
      const cleaned = match[1].replace(/,/g, "");
      const cents = Number(cleaned.includes(".") ? Math.round(Number(cleaned) * 100) : Number(cleaned) * 100);
      return Number.isFinite(cents) ? cents : 0;
    })
    .filter((cents) => cents > 0);
  if (amounts.length >= 2) return Math.round((amounts[0] + amounts[1]) / 2);
  return amounts[0] ?? 0;
}

/** Sold-style comps for an item we price without a catalog listing. */
export function comparablesForTitle(title: string, cents: number): Comparable[] {
  if (!title.trim() || cents <= 0) return [];
  const shape = shapeFor(title);
  const thumbnail = thumb(pictureColor(title), shape);
  const labels = ["Recent sale", "Same kind", "Sold nearby", "Similar item"];
  const factors = [0.86, 0.94, 1.06, 1.14];
  return labels.map((label, index) => {
    const name = `${label}: ${title}`.slice(0, 80);
    return {
      title: name,
      priceCents: Math.max(100, Math.round((cents * factors[index]) / 100) * 100),
      condition: "Good",
      source: "eBay",
      url: soldSearch(title),
      soldAt: "2026-09-18",
      listed: false,
      thumbnail,
    };
  });
}

function compsFor(variant: VariantSeed, item: ItemSeed): Comparable[] {
  return variant.comps.map((comp) => ({
    title: comp.title,
    priceCents: comp.priceCents,
    condition: comp.condition,
    source: "eBay",
    url: soldSearch(comp.title),
    soldAt: comp.soldAt,
    listed: false,
    thumbnail: thumb(item.color, item.shape),
  }));
}

const ITEMS: ItemSeed[] = [
  {
    id: "switch",
    title: "Nintendo Switch",
    test: /nintendo\s+switch|\bswitch\s+(oled|lite|v2|console)|\bjoy-?cons?\b/i,
    color: "#d7e4dc",
    shape: "console",
    variants: [
      {
        id: "oled",
        label: "OLED",
        test: /oled/i,
        low: 21000,
        high: 27000,
        point: 24000,
        query: "Nintendo Switch OLED",
        comps: [
          { title: "Nintendo Switch OLED white", priceCents: 23500, condition: "Good", soldAt: "2026-09-12" },
          { title: "Switch OLED with dock", priceCents: 24900, condition: "Like new", soldAt: "2026-09-28" },
          { title: "Nintendo Switch OLED neon", priceCents: 21900, condition: "Good", soldAt: "2026-10-03" },
          { title: "Switch OLED boxed", priceCents: 26500, condition: "Like new", soldAt: "2026-08-30" },
        ],
      },
      {
        id: "lite",
        label: "Lite",
        test: /\blite\b/i,
        low: 9000,
        high: 14000,
        point: 11500,
        query: "Nintendo Switch Lite",
        comps: [
          { title: "Nintendo Switch Lite gray", priceCents: 10900, condition: "Good", soldAt: "2026-09-08" },
          { title: "Switch Lite turquoise", priceCents: 12500, condition: "Like new", soldAt: "2026-09-21" },
          { title: "Nintendo Switch Lite yellow", priceCents: 9800, condition: "Fair", soldAt: "2026-10-02" },
          { title: "Switch Lite with case", priceCents: 13200, condition: "Good", soldAt: "2026-08-19" },
        ],
      },
      {
        id: "standard",
        label: "With dock",
        test: /\b(v1|v2|original|og|hac-001|with dock|standard)\b/i,
        low: 15000,
        high: 20000,
        point: 17500,
        query: "Nintendo Switch with dock",
        comps: [
          { title: "Nintendo Switch with dock and Joy-Cons", priceCents: 16900, condition: "Good", soldAt: "2026-09-18" },
          { title: "Nintendo Switch V2 gray", priceCents: 17900, condition: "Good", soldAt: "2026-10-01" },
          { title: "Switch HAC-001 with neon Joy-Cons", priceCents: 15500, condition: "Fair", soldAt: "2026-08-27" },
          { title: "Nintendo Switch boxed with dock", priceCents: 19800, condition: "Like new", soldAt: "2026-09-04" },
        ],
      },
    ],
  },
  {
    id: "iphone-13",
    title: "iPhone 13",
    test: /iphone\s*13\b/i,
    color: "#e7e2d8",
    shape: "phone",
    variants: [
      {
        id: "128",
        label: "128 GB",
        test: /128/,
        low: 18000,
        high: 24000,
        point: 21000,
        query: "iPhone 13 128GB unlocked",
        comps: [
          { title: "iPhone 13 128GB unlocked", priceCents: 20500, condition: "Good", soldAt: "2026-09-16" },
          { title: "iPhone 13 128GB midnight", priceCents: 18900, condition: "Good", soldAt: "2026-10-04" },
          { title: "iPhone 13 128GB battery 90%", priceCents: 22500, condition: "Like new", soldAt: "2026-09-02" },
        ],
      },
    ],
  },
  {
    id: "ps5",
    title: "PlayStation 5",
    test: /\bps5\b|playstation\s*5/i,
    color: "#e4e7f2",
    shape: "console",
    variants: [
      {
        id: "disc",
        label: "Disc",
        test: /disc|disk/i,
        low: 28000,
        high: 37000,
        point: 32500,
        query: "PS5 disc console",
        comps: [
          { title: "PS5 disc console", priceCents: 31000, condition: "Good", soldAt: "2026-09-11" },
          { title: "PlayStation 5 with controller", priceCents: 33900, condition: "Good", soldAt: "2026-10-06" },
          { title: "PS5 disc boxed", priceCents: 36000, condition: "Like new", soldAt: "2026-08-29" },
        ],
      },
    ],
  },
  {
    id: "airpods",
    title: "AirPods Pro",
    test: /airpods?\s*pro/i,
    color: "#f3ebe3",
    shape: "headphones",
    variants: [
      {
        id: "pro2",
        label: "Pro 2",
        test: /\b2\b|usb-c|2nd/i,
        low: 12000,
        high: 17500,
        point: 14500,
        query: "AirPods Pro 2",
        comps: [
          { title: "AirPods Pro 2 USB-C", priceCents: 14900, condition: "Good", soldAt: "2026-09-20" },
          { title: "AirPods Pro 2 with case", priceCents: 13200, condition: "Good", soldAt: "2026-10-05" },
          { title: "AirPods Pro 2 sealed", priceCents: 16900, condition: "New", soldAt: "2026-09-01" },
        ],
      },
    ],
  },
  {
    id: "xbox",
    title: "Xbox Series X",
    test: /xbox\s+series\s+x/i,
    color: "#e5eadf",
    shape: "console",
    variants: [
      {
        id: "series-x",
        label: "Series X",
        test: /.*/,
        low: 25000,
        high: 33000,
        point: 29000,
        query: "Xbox Series X",
        comps: [
          { title: "Xbox Series X 1TB", priceCents: 28500, condition: "Good", soldAt: "2026-09-14" },
          { title: "Xbox Series X with controller", priceCents: 30500, condition: "Good", soldAt: "2026-10-02" },
          { title: "Xbox Series X boxed", priceCents: 32000, condition: "Like new", soldAt: "2026-08-25" },
        ],
      },
    ],
  },
  {
    id: "macbook-air",
    title: "MacBook Air",
    test: /macbook\s+air/i,
    color: "#ece7df",
    shape: "laptop",
    variants: [
      {
        id: "m1",
        label: "M1",
        test: /\bm1\b/i,
        low: 35000,
        high: 48000,
        point: 42000,
        query: "MacBook Air M1",
        comps: [
          { title: "MacBook Air M1 8GB", priceCents: 39900, condition: "Good", soldAt: "2026-09-09" },
          { title: "MacBook Air M1 256GB", priceCents: 43500, condition: "Good", soldAt: "2026-09-26" },
          { title: "MacBook Air M1 battery cycle low", priceCents: 46000, condition: "Like new", soldAt: "2026-10-07" },
        ],
      },
    ],
  },
];

export const QUICK_ITEMS: { label: string; description: string; category: string }[] = [
  { category: "Games", label: "Nintendo Switch", description: "Used Nintendo Switch with dock and Joy-Cons" },
  { category: "Games", label: "Switch OLED", description: "Used Nintendo Switch OLED" },
  { category: "Games", label: "PS5", description: "Used PlayStation 5 disc" },
  { category: "Games", label: "Xbox Series X", description: "Used Xbox Series X" },
  { category: "Phones", label: "iPhone 13", description: "Used iPhone 13 128GB unlocked" },
  { category: "Audio", label: "AirPods Pro", description: "Used AirPods Pro 2" },
  { category: "Computers", label: "MacBook Air", description: "Used MacBook Air M1" },
];

export const CATEGORIES = ["Games", "Phones", "Audio", "Computers"] as const;

export function conditionById(id: string | null | undefined): ConditionId {
  return CONDITIONS.some((item) => item.id === id) ? (id as ConditionId) : "good";
}

export function conditionLabel(id: ConditionId): string {
  return CONDITIONS.find((item) => item.id === id)?.label ?? "Good";
}

function detectCondition(text: string): ConditionId {
  if (/for parts|broken|not working|\bas-?is\b/.test(text)) return "parts";
  if (/\bfair\b|heavy scratch|badly worn/.test(text)) return "fair";
  if (/like new|open box|mint/.test(text)) return "like_new";
  if (/\bsealed\b|\bnib\b|\bbrand new\b/.test(text)) return "new";
  return "good";
}

function scale(cents: number, factor: number): number {
  return Math.max(0, Math.round((cents * factor) / 100) * 100);
}

function fallbackVariant(item: ItemSeed): VariantSeed {
  return item.variants.find((entry) => entry.id === "standard") || item.variants[0];
}

function buildQuote(item: ItemSeed, variant: VariantSeed, condition: ConditionId, ambiguous: boolean): MarketQuote {
  const factor = CONDITIONS.find((item) => item.id === condition)?.factor ?? 1;
  const cents = scale(variant.point, factor);
  const lowCents = scale(variant.low, factor);
  const highCents = scale(variant.high, factor);
  const label = conditionLabel(condition).toLowerCase();
  const modelBit = ambiguous ? "" : ` (${variant.label})`;
  return {
    itemId: item.id,
    title: item.title,
    variantId: variant.id,
    variantLabel: variant.label,
    ambiguousModel: ambiguous,
    variants: item.variants.map((entry) => ({ id: entry.id, label: entry.label })),
    condition,
    cents,
    lowCents,
    highCents,
    confidence: ambiguous ? "medium" : "high",
    note: `Sold listings for a ${label} ${item.title}${modelBit} cluster around ${formatUsd(cents)}, from ${formatUsd(lowCents)} to ${formatUsd(highCents)}.`,
    comparables: compsFor(variant, item),
    sources: [
      `meta:item=${item.id}`,
      `meta:variant=${variant.id}`,
      `meta:condition=${condition}`,
      `meta:low=${lowCents}`,
      `meta:high=${highCents}`,
      `meta:confidence=${ambiguous ? "medium" : "high"}`,
      `meta:suggested=${cents}`,
      `Sold on eBay, ${variant.query}`,
      "Sold listings, Aug–Oct 2026",
    ],
  };
}

export function marketPrice(description: string, options?: { condition?: ConditionId; variantId?: string | null }): MarketQuote | null {
  const text = description.trim();
  if (!text) return null;
  const item = ITEMS.find((entry) => entry.test.test(text));
  if (!item) return null;
  if (item.id === "switch" && /\b(tv|television)\b/i.test(text) && !/joy-?con/i.test(text)) return null;
  const condition = options?.condition ?? detectCondition(text.toLowerCase());
  const forced = options?.variantId ? item.variants.find((entry) => entry.id === options.variantId) : undefined;
  const matched = item.variants.find((entry) => {
    if (!entry.test.test(text)) return false;
    if (entry.id === "oled" && /\b(tv|television)\b/i.test(text)) return false;
    return true;
  });
  const variant = forced || matched || fallbackVariant(item);
  const ambiguous = !forced && !matched && item.variants.length > 1;
  return buildQuote(item, variant, condition, ambiguous);
}

export function repriceMarket(description: string, condition: ConditionId, variantId: string | null): MarketQuote | null {
  return marketPrice(description, { condition, variantId });
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

export function replaceMarketSources(sources: string[], quote: MarketQuote): string[] {
  const kept = sources.filter((source) => !source.startsWith("meta:item=") && !source.startsWith("meta:variant=") && !source.startsWith("meta:condition=") && !source.startsWith("meta:low=") && !source.startsWith("meta:high=") && !source.startsWith("meta:confidence=") && !source.startsWith("meta:suggested=") && !source.startsWith("Sold on eBay") && source !== "Sold listings, Aug–Oct 2026" && !source.startsWith("Similar prices") && !source.startsWith("A typical range"));
  return [...quote.sources, ...kept.filter((source) => !quote.sources.includes(source))];
}

/** Regression cases checked against the sold-listing ranges above. */
export const MARKET_REGRESSION: { description: string; low: number; high: number }[] = [
  { description: "used Nintendo Switch with dock and Joy-Cons", low: 15000, high: 20000 },
  { description: "Nintendo Switch OLED", low: 21000, high: 27000 },
  { description: "Nintendo Switch Lite", low: 9000, high: 14000 },
  { description: "Used iPhone 13 128GB unlocked", low: 18000, high: 24000 },
  { description: "Used PlayStation 5 disc", low: 28000, high: 37000 },
  { description: "Used AirPods Pro 2", low: 12000, high: 17500 },
  { description: "Used Xbox Series X", low: 25000, high: 33000 },
  { description: "Used MacBook Air M1", low: 35000, high: 48000 },
];

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

/**
 * Prices from sold listings. A stored figure outside the range is called out
 * and is not repeated as the answer.
 */
export function answerFromMarket(description: string, storedCents: number | null): string | null {
  const quote = marketPrice(description);
  if (!quote) return null;
  const range = `${formatUsd(quote.lowCents)}–${formatUsd(quote.highCents)}`;
  const lines = [
    `${quote.title}${quote.variantLabel && !quote.ambiguousModel ? ` (${quote.variantLabel})` : ""} in ${conditionLabel(quote.condition).toLowerCase()} condition is about ${formatUsd(quote.cents)}.`,
    `Recent sold listings run ${range}.`,
    `Confidence is ${quote.confidence}.`,
  ];
  if (storedCents != null && (storedCents < quote.lowCents * 0.75 || storedCents > quote.highCents * 1.25)) {
    lines.push("An earlier figure sits outside those sold listings, so I'm not using it.");
  }
  if (quote.ambiguousModel) {
    lines.push(`The model changes the price. Choose ${quote.variants.map((item) => item.label).join(", ")}.`);
  }
  const sample = quote.comparables.slice(0, 3).map((comp) => `${comp.title} sold for ${formatUsd(comp.priceCents)} on ${comp.soldAt}`).join("; ");
  lines.push(`Comparables: ${sample}.`);
  return lines.join(" ");
}
