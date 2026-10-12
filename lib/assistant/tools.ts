import type { Unit } from "../types";
import { isUnit } from "../units";

export const TOOL_NAMES = [
  "navigate",
  "create_price",
  "update_price",
  "create_group",
  "add_price_to_group",
  "create_quote",
  "update_quote",
  "use_good_better_best",
  "toggle_group_on_tier",
  "connect_catalog",
  "import_prices",
  "present_quote",
  "delete_quote",
  "delete_price",
  "delete_group",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export interface PlannedTool {
  name: ToolName;
  args: Record<string, string>;
  caption: string;
  href: string;
  spotlight: string;
  needsConfirm: boolean;
}

const DESTRUCTIVE = new Set<ToolName>(["delete_quote", "delete_price", "delete_group"]);

export function isToolName(value: string): value is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(value);
}

export function safeInternalPath(value: string): string | null {
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("://") || value.includes("\\") || value.includes("..")) return null;
  if (!/^\/[A-Za-z0-9/_?-]*$/.test(value)) return null;
  return value.slice(0, 200);
}

export function toolNeedsConfirm(name: ToolName, args: Record<string, string>): boolean {
  if (DESTRUCTIVE.has(name)) return true;
  if (name === "navigate" && !safeInternalPath(args.path || "")) return true;
  return false;
}

export function toolLeavesApp(name: ToolName, args: Record<string, string>): boolean {
  return name === "navigate" && !safeInternalPath(args.path || "");
}

const PAGE_SPOTLIGHT: Record<string, { href: string; spotlight: string; caption: string }> = {
  quotes: { href: "/", spotlight: "new-quote", caption: "Quotes is the home screen. New quote starts a job." },
  quote: { href: "/", spotlight: "new-quote", caption: "Quotes is the home screen. New quote starts a job." },
  prices: { href: "/library", spotlight: "price-table", caption: "Prices holds every line item. You can edit a cell in the table." },
  price: { href: "/library", spotlight: "price-table", caption: "Prices holds every line item. You can edit a cell in the table." },
  library: { href: "/library", spotlight: "price-table", caption: "Prices holds every line item. You can edit a cell in the table." },
  catalog: { href: "/catalogs", spotlight: "catalog-table", caption: "Catalog is the shared product list. Your price is the editable column." },
  catalogs: { href: "/catalogs", spotlight: "catalog-table", caption: "Catalog is the shared product list. Your price is the editable column." },
  groups: { href: "/library/groups", spotlight: "group-list", caption: "Groups bundle prices into a sentence the customer can read." },
  group: { href: "/library/groups", spotlight: "group-list", caption: "Groups bundle prices into a sentence the customer can read." },
  settings: { href: "/settings", spotlight: "settings-feedback", caption: "Settings has the version and, for the owner, feedback mode." },
};

export function describeTool(name: ToolName, args: Record<string, string>, pathname: string): {
  caption: string;
  href: string;
  spotlight: string;
} {
  const quoteId = pathname.match(/^\/quotes\/([^/]+)/)?.[1];
  switch (name) {
    case "navigate": {
      const href = safeInternalPath(args.path || "") || "/";
      const key = href.split("/").filter(Boolean)[0] || "quotes";
      const page = PAGE_SPOTLIGHT[key] || PAGE_SPOTLIGHT.quotes;
      return { href, spotlight: page.spotlight, caption: page.caption };
    }
    case "create_price":
      return {
        href: "/library",
        spotlight: "price-add",
        caption: `Add ${args.name || "a price"} to Prices at ${args.price || "the amount you chose"}. You can edit the row afterward.`,
      };
    case "update_price":
      return {
        href: "/library",
        spotlight: args.id ? `price-${args.id}` : "price-table",
        caption: "Update that price in the table. The row stays editable.",
      };
    case "create_group":
      return {
        href: "/library/groups",
        spotlight: "group-list",
        caption: `Create a group named ${args.name || "the new group"}. The customer description fills in when you add prices.`,
      };
    case "add_price_to_group":
      return {
        href: args.groupId ? `/library/groups/${args.groupId}` : "/library/groups",
        spotlight: args.groupId ? `group-${args.groupId}` : "group-list",
        caption: "Drop that price into the group. The customer sentence updates from the line items.",
      };
    case "create_quote":
      return {
        href: "/quotes/new",
        spotlight: "new-quote",
        caption: `Start a quote for ${args.customerName || "the customer"}. Options come next.`,
      };
    case "update_quote":
      return {
        href: args.id ? `/quotes/${args.id}` : quoteId ? `/quotes/${quoteId}` : "/",
        spotlight: "quote-options",
        caption: "Save the customer and job on this quote.",
      };
    case "use_good_better_best":
      return {
        href: (args.quoteId || quoteId) ? `/quotes/${args.quoteId || quoteId}` : "/",
        spotlight: "quote-options",
        caption: "Turn the options into Good, Better, and Best. Totals stay live on the right.",
      };
    case "toggle_group_on_tier":
      return {
        href: quoteId ? `/quotes/${quoteId}` : "/",
        spotlight: args.tierId ? `tier-${args.tierId}` : "quote-options",
        caption: "Put that group on the option. The total on the right updates.",
      };
    case "connect_catalog":
      return {
        href: "/catalogs",
        spotlight: "catalog-table",
        caption: "Copy that sample catalog into Prices. Replace the sample dollars before you present.",
      };
    case "import_prices":
      return {
        href: "/library",
        spotlight: "price-import",
        caption: "Import the CSV into Prices. Each row becomes an editable line item.",
      };
    case "present_quote":
      return {
        href: (args.quoteId || quoteId) ? `/quotes/${args.quoteId || quoteId}/present` : "/",
        spotlight: "present-button",
        caption: "Present saves a customer copy, then opens the full-screen options.",
      };
    case "delete_quote":
    case "delete_price":
    case "delete_group":
      return {
        href: pathname || "/",
        spotlight: "quote-options",
        caption: "This removes something. Confirm it, or press Stop.",
      };
    default:
      return { href: "/", spotlight: "new-quote", caption: "Open Price Ranger." };
  }
}

export function llmToolDefinitions(): {
  name: ToolName;
  description: string;
  parameters: Record<string, unknown>;
}[] {
  const stringProp = (description: string) => ({ type: "string", description });
  return [
    {
      name: "navigate",
      description: "Open a page inside Price Ranger. path must start with /.",
      parameters: { type: "object", properties: { path: stringProp("In-app path such as /library") }, required: ["path"] },
    },
    {
      name: "create_price",
      description: "Add an editable price to the signed-in user's library.",
      parameters: {
        type: "object",
        properties: {
          name: stringProp("Line item name"),
          unit: stringProp("square, sq_ft, linear_ft, roll, bundle, each, or hour"),
          price: stringProp("Dollar amount such as 40 or 12.50"),
        },
        required: ["name", "unit", "price"],
      },
    },
    {
      name: "update_price",
      description: "Edit an existing library price by id.",
      parameters: {
        type: "object",
        properties: {
          id: stringProp("Library item id"),
          name: stringProp("New name"),
          unit: stringProp("New unit"),
          price: stringProp("New dollar amount"),
        },
        required: ["id"],
      },
    },
    {
      name: "create_group",
      description: "Create an editable line-item group.",
      parameters: { type: "object", properties: { name: stringProp("Group name") }, required: ["name"] },
    },
    {
      name: "add_price_to_group",
      description: "Copy a library price onto a group.",
      parameters: {
        type: "object",
        properties: {
          groupId: stringProp("Group id"),
          libraryItemId: stringProp("Library item id"),
        },
        required: ["groupId", "libraryItemId"],
      },
    },
    {
      name: "create_quote",
      description: "Create an editable quote.",
      parameters: {
        type: "object",
        properties: {
          customerName: stringProp("Customer name"),
          title: stringProp("Job name"),
        },
        required: ["customerName", "title"],
      },
    },
    {
      name: "update_quote",
      description: "Edit the customer or job on a quote.",
      parameters: {
        type: "object",
        properties: {
          id: stringProp("Quote id"),
          customerName: stringProp("Customer name"),
          title: stringProp("Job name"),
        },
        required: ["id"],
      },
    },
    {
      name: "use_good_better_best",
      description: "Replace the quote options with Good, Better, and Best.",
      parameters: { type: "object", properties: { quoteId: stringProp("Quote id") }, required: ["quoteId"] },
    },
    {
      name: "toggle_group_on_tier",
      description: "Add or remove a group on one option.",
      parameters: {
        type: "object",
        properties: {
          tierId: stringProp("Option id"),
          groupId: stringProp("Group id"),
        },
        required: ["tierId", "groupId"],
      },
    },
    {
      name: "connect_catalog",
      description: "Copy a sample catalog into the user's prices. slug is home-depot, lowes, gaf, or james-hardie.",
      parameters: { type: "object", properties: { slug: stringProp("Connector slug") }, required: ["slug"] },
    },
    {
      name: "import_prices",
      description: "Import CSV text with a header name,unit,price.",
      parameters: { type: "object", properties: { csv: stringProp("CSV text") }, required: ["csv"] },
    },
    {
      name: "present_quote",
      description: "Save the customer presentation copy and open it.",
      parameters: { type: "object", properties: { quoteId: stringProp("Quote id") }, required: ["quoteId"] },
    },
    {
      name: "delete_quote",
      description: "Delete a quote. The user must confirm.",
      parameters: { type: "object", properties: { id: stringProp("Quote id") }, required: ["id"] },
    },
    {
      name: "delete_price",
      description: "Delete a library price. The user must confirm.",
      parameters: { type: "object", properties: { id: stringProp("Library item id") }, required: ["id"] },
    },
    {
      name: "delete_group",
      description: "Delete a group. The user must confirm.",
      parameters: { type: "object", properties: { id: stringProp("Group id") }, required: ["id"] },
    },
  ];
}

export function normalizeUnit(value: string | undefined): Unit | null {
  if (!value) return null;
  const cleaned = value.trim().toLowerCase().replace(/\s+/g, " ");
  const aliases: Record<string, Unit> = {
    square: "square",
    squares: "square",
    "sq ft": "sq_ft",
    sqft: "sq_ft",
    sq_ft: "sq_ft",
    "lin ft": "linear_ft",
    linear_ft: "linear_ft",
    roll: "roll",
    rolls: "roll",
    bundle: "bundle",
    bundles: "bundle",
    each: "each",
    hour: "hour",
    hours: "hour",
  };
  if (aliases[cleaned]) return aliases[cleaned];
  return isUnit(cleaned) ? cleaned : null;
}
