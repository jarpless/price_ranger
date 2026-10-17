import type { GuideQuote } from "./guide/store";
import type { IndustryId } from "./vocabulary";

/**
 * The menu, the trade pages, and Home's filters are generated from this list.
 * Adding a trade is one entry here: no layout, route, or menu edits.
 */

export type TradeIcon = "wrench" | "hammer" | "box" | "repeat" | "brush";

export interface TradeSubcategory {
  id: string;
  label: string;
  /** Prefills the New price search, so one tap starts a price. */
  query: string;
  keywords: string[];
}

export interface TradeTool {
  label: string;
  href: string;
  blurb: string;
}

export interface Trade {
  id: string;
  label: string;
  short: string;
  icon: TradeIcon;
  /** The onboarding answer that opens this folder by default. */
  industry: IndustryId | null;
  /** Quotes on this path that match no keyword land here. */
  fallbackPath: GuideQuote["path"] | null;
  quotesLabel: string;
  subcategories: TradeSubcategory[];
  tools: TradeTool[];
}

const CALCULATOR: TradeTool = { label: "Calculator", href: "/calculators", blurb: "Discounts, fees, and margin." };
const PRICE_LIST: TradeTool = { label: "Price list", href: "/library", blurb: "Your saved line-item prices." };
const JOB_QUOTE: TradeTool = { label: "Job quote", href: "/quotes/new", blurb: "Labor and materials, line by line." };
const CATALOG: TradeTool = { label: "Catalog", href: "/catalogs", blurb: "Sample product names to price." };

export const TRADES: Trade[] = [
  {
    id: "home-services",
    label: "Home services & handyman",
    short: "Handyman",
    icon: "wrench",
    industry: "services",
    fallbackPath: null,
    quotesLabel: "Quotes",
    subcategories: [
      { id: "repairs", label: "Repairs & fixes", query: "Handyman repair", keywords: ["repair", "fix", "patch", "handyman", "drywall"] },
      { id: "assembly", label: "Furniture assembly", query: "Furniture assembly", keywords: ["assembly", "assemble", "ikea"] },
      { id: "mounting", label: "Mounting & install", query: "TV mounting", keywords: ["mount", "install", "hang", "shelf", "shelves"] },
      { id: "painting", label: "Painting", query: "Interior painting", keywords: ["paint", "stain"] },
      { id: "yard", label: "Yard & cleanup", query: "Yard cleanup", keywords: ["yard", "lawn", "mow", "gutter", "cleanup", "haul"] },
      { id: "moving", label: "Moving help", query: "Moving help", keywords: ["moving", "move-out", "movers"] },
    ],
    tools: [JOB_QUOTE, CALCULATOR, PRICE_LIST],
  },
  {
    id: "trades",
    label: "Trades",
    short: "Trades",
    icon: "hammer",
    industry: "trades",
    fallbackPath: "job",
    quotesLabel: "Quotes",
    subcategories: [
      { id: "roofing", label: "Roofing", query: "Roof replacement", keywords: ["roof", "shingle", "gutter guard"] },
      { id: "plumbing", label: "Plumbing", query: "Plumbing repair", keywords: ["plumb", "pipe", "faucet", "toilet", "water heater", "drain"] },
      { id: "electrical", label: "Electrical", query: "Electrical work", keywords: ["electric", "outlet", "wiring", "panel", "breaker", "light switch"] },
      { id: "hvac", label: "HVAC", query: "HVAC service", keywords: ["hvac", "furnace", "air condition", "a/c", "heat pump"] },
      { id: "carpentry", label: "Carpentry", query: "Carpentry job", keywords: ["carpent", "deck", "framing", "cabinet", "trim"] },
      { id: "concrete", label: "Concrete & masonry", query: "Concrete pour", keywords: ["concrete", "masonry", "brick", "paver", "patio"] },
    ],
    tools: [JOB_QUOTE, CALCULATOR, PRICE_LIST],
  },
  {
    id: "selling",
    label: "Selling personal items",
    short: "Selling",
    icon: "box",
    industry: "yard",
    fallbackPath: "item",
    quotesLabel: "Listings",
    subcategories: [
      { id: "electronics", label: "Electronics", query: "Electronics", keywords: ["iphone", "phone", "laptop", "macbook", "ipad", "camera", "headphone", "airpods", "tv"] },
      { id: "games", label: "Games & consoles", query: "Game console", keywords: ["switch", "playstation", "ps5", "ps4", "xbox", "nintendo", "game"] },
      { id: "furniture", label: "Furniture", query: "Furniture", keywords: ["sofa", "couch", "table", "chair", "desk", "dresser", "bed"] },
      { id: "clothing", label: "Clothing & shoes", query: "Clothing", keywords: ["shirt", "jacket", "dress", "jeans", "shoes", "boots"] },
      { id: "tools", label: "Tools & equipment", query: "Power tool", keywords: ["drill", "saw", "dewalt", "milwaukee", "mower", "tool"] },
      { id: "yard-sale", label: "Yard sale lot", query: "Yard sale lot", keywords: ["yard sale", "garage sale", "lot of", "box of"] },
    ],
    tools: [CALCULATOR, CATALOG],
  },
  {
    id: "flipping",
    label: "Flipping & resale",
    short: "Flipping",
    icon: "repeat",
    industry: "retail",
    fallbackPath: null,
    quotesLabel: "Listings",
    subcategories: [
      { id: "thrift", label: "Thrift finds", query: "Thrift find", keywords: ["thrift", "goodwill"] },
      { id: "sneakers", label: "Sneakers", query: "Sneakers", keywords: ["sneaker", "jordan", "yeezy", "dunk"] },
      { id: "vintage", label: "Vintage & collectibles", query: "Vintage collectible", keywords: ["vintage", "collectible", "antique", "card", "pokemon"] },
      { id: "bundles", label: "Bundles & lots", query: "Resale bundle", keywords: ["bundle", "pallet", "wholesale"] },
    ],
    tools: [CALCULATOR, CATALOG, PRICE_LIST],
  },
  {
    id: "makers",
    label: "Makers & crafts",
    short: "Makers",
    icon: "brush",
    industry: null,
    fallbackPath: null,
    quotesLabel: "Listings",
    subcategories: [
      { id: "woodwork", label: "Woodwork", query: "Handmade woodwork", keywords: ["handmade", "woodwork", "cutting board"] },
      { id: "jewelry", label: "Jewelry", query: "Handmade jewelry", keywords: ["jewelry", "necklace", "earring", "bracelet"] },
      { id: "art", label: "Prints & art", query: "Art print", keywords: ["print", "painting on", "canvas", "art"] },
      { id: "baked", label: "Baked goods", query: "Baked goods", keywords: ["cake", "cookie", "bread", "baked"] },
    ],
    tools: [CALCULATOR, PRICE_LIST],
  },
];

export const TRADE_VIEWS = ["quotes", "sold", "tools"] as const;
export type TradeView = (typeof TRADE_VIEWS)[number];

export function tradeById(id: string | null | undefined): Trade | null {
  return TRADES.find((trade) => trade.id === id) ?? null;
}

export function isTradeView(value: string | null | undefined): value is TradeView {
  return Boolean(value && (TRADE_VIEWS as readonly string[]).includes(value));
}

export function tradeHref(trade: Trade, view?: TradeView): string {
  return view ? `/trades/${trade.id}/${view}` : `/trades/${trade.id}`;
}

export function viewLabel(trade: Trade, view: TradeView): string {
  if (view === "quotes") return trade.quotesLabel;
  if (view === "sold") return "Sold";
  return "Tools";
}

export function newPriceHref(subcategory: TradeSubcategory): string {
  return `/new?q=${encodeURIComponent(subcategory.query)}`;
}

export function tradeForIndustry(industry: IndustryId | null | undefined): Trade | null {
  if (!industry) return null;
  return TRADES.find((trade) => trade.industry === industry) ?? null;
}

/** Word-start match, so "art" finds "artwork" but not "part". */
function matches(text: string, keyword: string): boolean {
  const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}`).test(text);
}

/** Keyword match on the description first, then the quote's path. */
export function classifyQuote(quote: Pick<GuideQuote, "description" | "path">): { trade: Trade; subcategory: TradeSubcategory | null } | null {
  const text = (quote.description || "").toLowerCase();
  if (text) {
    for (const trade of TRADES) {
      for (const subcategory of trade.subcategories) {
        if (subcategory.keywords.some((keyword) => matches(text, keyword))) return { trade, subcategory };
      }
    }
  }
  const fallback = TRADES.find((trade) => trade.fallbackPath === quote.path);
  return fallback ? { trade: fallback, subcategory: null } : null;
}

export type ItemStatus = "drafts" | "priced" | "shared" | "sold";
export const ITEM_STATUSES: ItemStatus[] = ["drafts", "priced", "shared", "sold"];

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  drafts: "Drafts",
  priced: "Priced",
  shared: "Shared",
  sold: "Sold",
};

export function isItemStatus(value: string | null | undefined): value is ItemStatus {
  return Boolean(value && (ITEM_STATUSES as readonly string[]).includes(value));
}

export function itemStatus(quote: Pick<GuideQuote, "outcome" | "sharedAt" | "finishedAt">): ItemStatus {
  if (quote.outcome === "sold") return "sold";
  if (quote.sharedAt) return "shared";
  if (quote.finishedAt) return "priced";
  return "drafts";
}
