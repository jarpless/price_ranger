/**
 * Landing categories. Every item is generic: no maker, label, retailer, or marketplace.
 * Tapping an item opens New price with that item filled in.
 */
export interface LandingItem {
  label: string;
  query: string;
}

export interface LandingCategory {
  /** An id from `TRADE_TAXONOMY` in `lib/trades.ts`. */
  id: string;
  name: string;
  who: string;
  sample: { item: string; price: string; unit: string };
  items: LandingItem[];
}

export const LANDING_CATEGORIES: LandingCategory[] = [
  {
    id: "home-services",
    name: "Home services & handyman",
    who: "Repairs, installs, and odd jobs",
    sample: { item: "Drywall patch", price: "$175", unit: "per patch" },
    items: [
      { label: "Drywall patch", query: "Drywall patch" },
      { label: "TV mount", query: "TV mount" },
      { label: "Furniture assembly", query: "Furniture assembly" },
      { label: "Gutter clean", query: "Gutter clean" },
    ],
  },
  {
    id: "trades",
    name: "Trades",
    who: "Contractors and trade techs",
    sample: { item: "Service call", price: "$95", unit: "per visit" },
    items: [
      { label: "Faucet replace", query: "Faucet replace" },
      { label: "Ceiling fan install", query: "Ceiling fan install" },
      { label: "Outlet or switch swap", query: "Outlet or switch swap" },
      { label: "Hourly labor", query: "Hourly labor" },
    ],
  },
  {
    id: "selling",
    name: "Selling personal items",
    who: "Furniture, electronics, gear",
    sample: { item: "Dresser", price: "$240", unit: "sold range $180–$320" },
    items: [
      { label: "Dresser", query: "Used wooden dresser" },
      { label: "Road bike", query: "Used road bike" },
      { label: "Game console", query: "Used game console with controller" },
      { label: "Laptop", query: "Used 13 inch laptop" },
    ],
  },
  {
    id: "events-creative",
    name: "Events & creative",
    who: "Photo, music, design, rentals",
    sample: { item: "Portrait session", price: "$250", unit: "per session" },
    items: [
      { label: "Portrait session", query: "Portrait photo session, one hour" },
      { label: "Event DJ", query: "Event DJ, four hours" },
      { label: "Logo design", query: "Logo design for a small business" },
      { label: "Party rentals", query: "Party table and chair rental" },
    ],
  },
  {
    id: "food-shop",
    name: "Food & small shop",
    who: "Bakers, caterers, makers, booths",
    sample: { item: "Catering tray", price: "$85", unit: "serves 10" },
    items: [
      { label: "Catering tray", query: "Catering tray for 10 people" },
      { label: "Custom cake", query: "Custom two-tier cake" },
      { label: "Market booth", query: "Weekend market booth fee" },
      { label: "Handmade candles", query: "Handmade candle, 8 oz" },
    ],
  },
];

export function newPriceHref(query: string, category?: string | null): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category) params.set("cat", category);
  const search = params.toString();
  return search ? `/new?${search}` : "/new";
}

/** Guests land on New price with the item filled in. */
export function landingStartHref(query: string): string {
  return `/auth/guest?next=${encodeURIComponent(newPriceHref(query))}`;
}
