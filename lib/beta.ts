/** Early-beta copy and the trade list for feature requests. Pricing is live, so nothing here promises free access. */

export const BETA_DISCLOSURE = {
  title: "What beta means",
  body: "Price Ranger is in early beta and still in development. We'd love your feedback and feature requests for how you use it.",
  meaning:
    "Beta means the core tools work and plans are billed as shown, but we're still adding features and smoothing rough edges. Some screens may change as we learn from you.",
} as const;

export const BETA_NOTE_DISMISSED_KEY = "pr-beta-note-dismissed";

export const TRADES = [
  { id: "selling", label: "Selling my stuff" },
  { id: "flipping", label: "Flipping" },
  { id: "trades", label: "Trades & jobs" },
  { id: "makers", label: "Makers & crafts" },
  { id: "services", label: "Services" },
  { id: "buying", label: "Buying" },
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
  if (industry === "trades" || industry === "yard") return "trades";
  if (industry === "services") return "services";
  if (industry === "retail") return "selling";
  return null;
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
    input.need.trim() || "(No details added.)",
    "",
    `Follow-up email: ${input.followUp ? "yes" : "no"}`,
  ];
  if (input.route) lines.push(`From: ${input.route}`);
  return lines.join("\n").slice(0, 2000);
}

export function readFeatureRequestTrade(body: string): TradeId | null {
  const match = body.match(/^Trade: ([a-z]+)/m);
  return match && isTradeId(match[1]) ? match[1] : null;
}
