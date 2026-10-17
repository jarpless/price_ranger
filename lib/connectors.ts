export type ConnectorAvailability = "stub" | "sample" | "unavailable";

export interface ConnectorDefinition {
  slug: string;
  name: string;
  availability: ConnectorAvailability;
  summary: string;
  access: string;
}

export const CONNECTORS: ConnectorDefinition[] = [
  {
    slug: "handyman",
    name: "Handyman & trade tech",
    availability: "sample",
    summary: "Service calls, hourly labor, and common repairs, with sample prices.",
    access:
      "Generic jobs like a drywall patch, faucet replace, or ceiling fan install. Every dollar amount is a placeholder for your own rate.",
  },
  {
    slug: "home-depot",
    name: "Home Depot",
    availability: "stub",
    summary: "Common retail products, with sample prices you replace.",
    access:
      "Home Depot does not publish an open contractor price book. Approved affiliates can license a product feed through Impact. This app does not scrape homedepot.com and does not show live shelf prices.",
  },
  {
    slug: "lowes",
    name: "Lowe's",
    availability: "stub",
    summary: "A few Lowe's-style products, with sample prices you replace.",
    access:
      "Lowe's product data is available to approved affiliates, not as a public price API. This app does not scrape lowes.com.",
  },
  {
    slug: "gaf",
    name: "Roofing samples",
    availability: "sample",
    summary: "Generic shingles, ridge cap, and underlayment, with sample prices.",
    access: "Generic roofing materials. There is no price feed. Treat every dollar amount as a placeholder.",
  },
  {
    slug: "james-hardie",
    name: "Siding samples",
    availability: "sample",
    summary: "Generic fiber-cement siding, trim, and soffit, with sample prices.",
    access: "Generic siding materials. There is no price feed. Replace sample prices before you quote a customer.",
  },
  {
    slug: "abc-supply",
    name: "ABC Supply",
    availability: "unavailable",
    summary: "Trade catalog. Nothing to import.",
    access:
      "ABC Supply requires a contractor login. There is no public catalog API, so Price Ranger lists it and does not pretend to connect.",
  },
];

export function connectorBySlug(slug: string): ConnectorDefinition | undefined {
  return CONNECTORS.find((connector) => connector.slug === slug);
}

export function connectorName(slug: string | null): string | null {
  if (!slug) return null;
  return connectorBySlug(slug)?.name ?? slug;
}

export function priceSource(item: {
  source: string;
  connectorSlug: string | null;
  samplePrice: boolean;
}): string {
  if (item.source === "custom") return "Your price";
  const name = connectorName(item.connectorSlug);
  if (item.samplePrice) return name ? `${name} sample` : "Sample price";
  return name ?? "Catalog";
}
