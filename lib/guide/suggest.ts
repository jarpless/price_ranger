import { marketPrice } from "../market";
import type { Confidence, ConditionId } from "../market-shared";
import type { Comparable } from "../market";
import type { GuidePath, PriceSuggestion } from "./flow";

/** Server only: suggestPrice reads the named-model sold comps in market.ts. */

function suggestion(partial: {
  cents: number;
  note: string;
  sources: string[];
  lowCents?: number;
  highCents?: number;
  confidence?: Confidence;
  condition?: ConditionId;
  model?: string | null;
  modelChoices?: { id: string; label: string }[];
  itemId?: string | null;
  comparables?: Comparable[];
}): PriceSuggestion {
  return {
    lowCents: partial.lowCents ?? partial.cents,
    highCents: partial.highCents ?? partial.cents,
    confidence: partial.confidence ?? "medium",
    condition: partial.condition ?? "good",
    model: partial.model ?? null,
    modelChoices: partial.modelChoices ?? [],
    itemId: partial.itemId ?? null,
    comparables: partial.comparables ?? [],
    cents: partial.cents,
    note: partial.note,
    sources: stampSuggestion(partial.sources, {
      cents: partial.cents,
      lowCents: partial.lowCents ?? partial.cents,
      highCents: partial.highCents ?? partial.cents,
      confidence: partial.confidence ?? "medium",
    }),
  };
}

function stampSuggestion(
  sources: string[],
  meta: { cents: number; lowCents: number; highCents: number; confidence: string },
): string[] {
  const next = [...sources];
  const add = (key: string, value: string | number) => {
    if (!next.some((source) => source.startsWith(`meta:${key}=`))) next.push(`meta:${key}=${value}`);
  };
  add("suggested", meta.cents);
  add("low", meta.lowCents);
  add("high", meta.highCents);
  add("confidence", meta.confidence);
  return next;
}

const PRICE_RULES: { test: RegExp; cents: number; note: string }[] = [
  { test: /service call|trip charge/, cents: 9500, note: "A typical service call to show up and diagnose." },
  { test: /drywall/, cents: 17500, note: "A typical price to patch, mud, and sand a small drywall hole." },
  { test: /faucet/, cents: 18500, note: "A typical labor price to replace a faucet the customer supplies." },
  { test: /ceiling fan/, cents: 22000, note: "A typical price to hang a fan on an existing box." },
  { test: /\b(outlet|light switch|switch swap)\b/, cents: 9500, note: "A typical price to swap one outlet or switch." },
  { test: /\btv mount|mount (a |the )?tv\b/, cents: 15000, note: "A typical price to mount a TV and hide the cables." },
  { test: /furniture assembly|assemble/, cents: 9000, note: "A typical price to assemble one flat-pack piece." },
  { test: /door rehang|rehang|hang a door/, cents: 16500, note: "A typical price to rehang an interior door." },
  { test: /gutter/, cents: 17500, note: "A typical price to clean gutters on a one-story home." },
  { test: /portrait|photo session/, cents: 25000, note: "A typical price for a one-hour portrait session." },
  { test: /\bdj\b/, cents: 60000, note: "A typical price for a four-hour event DJ set." },
  { test: /logo design/, cents: 50000, note: "A typical starting price for a small-business logo." },
  { test: /rental/, cents: 15000, note: "A typical price for a small party rental package." },
  { test: /catering/, cents: 8500, note: "A typical price for a catering tray that serves about 10." },
  { test: /cake/, cents: 12000, note: "A typical price for a custom two-tier cake." },
  { test: /booth/, cents: 7500, note: "A typical weekend market booth fee." },
  { test: /candle/, cents: 2200, note: "A typical price for a handmade 8 oz candle." },
  { test: /mixer|kitchenaid/, cents: 18000, note: "A common resale price for a used stand mixer." },
  { test: /lawn|mow/, cents: 4500, note: "A typical visit for a small lawn." },
  { test: /table/, cents: 18000, note: "A fair price for a solid wood table in good shape." },
  { test: /bike|bicycle/, cents: 12000, note: "A common resale price for a used bike that still rides well." },
  { test: /hour|consult/, cents: 9500, note: "A typical hourly rate to start from." },
];

export function suggestPrice(description: string, path: GuidePath): PriceSuggestion {
  const text = description.toLowerCase();
  const priced = marketPrice(description);
  if (priced) {
    return suggestion({
      cents: priced.cents,
      lowCents: priced.lowCents,
      highCents: priced.highCents,
      note: priced.note,
      sources: priced.sources,
      confidence: priced.confidence,
      condition: priced.condition,
      model: priced.variantLabel,
      modelChoices: priced.ambiguousModel ? priced.variants : [],
      itemId: priced.itemId,
      comparables: priced.comparables,
    });
  }
  if (/roof|shingle/.test(text)) {
    const repair = /\b(small|repair|patch|leak|fix)\b/.test(text);
    const full = /\b(replac|full|reroof|tear-?off|new roof)\b/.test(text);
    if (repair && !full) {
      return suggestion({
        cents: 85000,
        lowCents: 65000,
        highCents: 120000,
        confidence: "medium",
        note: "A small roof repair, not a full replacement.",
        sources: ["Similar small repairs in Price Ranger", "Not priced as a full roof"],
      });
    }
    return suggestion({
      cents: 850000,
      lowCents: 700000,
      highCents: 1100000,
      confidence: "medium",
      note: "Most full roof jobs like this land around this price.",
      sources: ["Similar prices in Price Ranger", "A typical range for this kind of job"],
    });
  }
  const match = PRICE_RULES.find((rule) => rule.test.test(text));
  const fallback = path === "job" ? 35000 : path === "check" ? 2500 : 4000;
  const cents = match?.cents ?? fallback;
  const note = match?.note ?? "A starting price. We don't have enough sold listings to be sure.";
  const confidence: Confidence = match ? "medium" : "low";
  return suggestion({
    cents,
    lowCents: Math.round(cents * 0.8),
    highCents: Math.round(cents * 1.2),
    confidence,
    note,
    sources: match
      ? ["Similar prices in Price Ranger", "A typical range for this kind of " + (path === "job" ? "job" : "sale")]
      : ["Not enough sold listings yet", "A typical range for this kind of " + (path === "job" ? "job" : "sale")],
  });
}
