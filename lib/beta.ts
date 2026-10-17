/** Early-beta copy and the trade list for feature requests. */

/** The one place the beta end date lives. Copy formats it from here. */
export const BETA_ENDS_AT = "2027-01-31";

export function betaEndsLabel(iso: string = BETA_ENDS_AT): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const BETA_DISCLOSURE = {
  title: "What beta means",
  body: "Price Ranger is in early beta and still in development. We'd love your feedback and feature requests for how you use it.",
  meaning:
    "Beta means the core tools work and plans are billed as shown, but we're still adding features and smoothing rough edges. Some screens may change as we learn from you.",
  pricingLead: "Beta pricing:",
  pricing:
    "plan prices may go up after beta. Subscribe during beta and you'll keep your current price for an extra year after beta ends.",
  firstHundred: `The first 100 beta testers get a free pass to everything until beta ends (${betaEndsLabel()}), then normal pricing applies.`,
  pricingShort: "Beta price – locked for 1 year after beta for members who subscribe during beta",
} as const;

export const BETA_NOTE_DISMISSED_KEY = "pr-beta-note-dismissed";

/**
 * The shared trade taxonomy (PR #147 and #149). Ids follow `lib/trades.ts` from #149 where it has
 * the trade, so this list can be replaced by an import from there once #149 lands.
 */
export const TRADES = [
  { id: "home-services", label: "Home services & handyman" },
  { id: "trades", label: "Trades" },
  { id: "selling", label: "Selling personal items" },
  { id: "flipping", label: "Flipping & resale" },
  { id: "makers", label: "Makers & crafts" },
  { id: "events-creative", label: "Events & creative" },
  { id: "food-shop", label: "Food & small shop" },
  { id: "other", label: "Something else" },
] as const;

export type TradeId = (typeof TRADES)[number]["id"];

export function isTradeId(value: string | null | undefined): value is TradeId {
  return TRADES.some((trade) => trade.id === value);
}

export function tradeLabel(id: TradeId): string {
  return TRADES.find((trade) => trade.id === id)?.label ?? "Something else";
}

/** A sensible first chip from the account's industry, so the request can be two taps. */
export function defaultTrade(industry: string | null | undefined): TradeId | null {
  if (industry === "services") return "home-services";
  if (industry === "trades") return "trades";
  if (industry === "yard") return "selling";
  if (industry === "retail") return "flipping";
  return null;
}

export const NEED_MIN_LENGTH = 3;

export function needIsValid(need: string): boolean {
  return need.replace(/\s+/g, " ").trim().length >= NEED_MIN_LENGTH;
}

export function tradeLabelName(id: TradeId): string {
  return `trade:${id}`;
}

export function featureRequestTitle(trade: TradeId, need: string): string {
  const typed = need.replace(/\s+/g, " ").trim();
  const prefix = `Feature request (${tradeLabel(trade)})`;
  if (!typed) return prefix.slice(0, 80);
  return `${prefix}: ${typed}`.slice(0, 80);
}

/** Stored on the feedback row as kind=feature. The `Type` and `Trade` lines are the tags triage reads. */
export function featureRequestBody(input: {
  trade: TradeId;
  need: string;
  followUp: boolean;
  route: string;
}): string {
  const lines = [
    featureRequestTitle(input.trade, input.need),
    "",
    "Type: feature_request",
    `Trade: ${input.trade} (${tradeLabel(input.trade)})`,
    "",
    "What do you need?",
    input.need.trim(),
    "",
    `Follow-up email: ${input.followUp ? "yes" : "no"}`,
  ];
  if (input.route) lines.push(`From: ${input.route}`);
  return lines.join("\n").slice(0, 2000);
}

export function readFeatureRequestTrade(body: string): TradeId | null {
  const match = body.match(/^Trade: ([a-z-]+)/m);
  return match && isTradeId(match[1]) ? match[1] : null;
}
