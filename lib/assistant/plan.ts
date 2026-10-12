import { describeTool, toolNeedsConfirm, type PlannedTool, type ToolName } from "./tools";

function step(
  name: ToolName,
  args: Record<string, string>,
  pathname: string,
): PlannedTool {
  const described = describeTool(name, args, pathname);
  return {
    name,
    args,
    caption: described.caption,
    href: described.href,
    spotlight: described.spotlight,
    needsConfirm: toolNeedsConfirm(name, args),
  };
}

const DESTINATIONS: Record<string, string> = {
  quotes: "/",
  quote: "/",
  prices: "/library",
  price: "/library",
  library: "/library",
  catalog: "/catalogs",
  catalogs: "/catalogs",
  groups: "/library/groups",
  group: "/library/groups",
  settings: "/settings",
};

/**
 * On-device plan used when no model key is set. It only calls the same in-app tools.
 * Anything it does not understand returns null so the caller can say the model is not configured.
 */
export function planLocally(message: string, pathname: string): PlannedTool[] | null {
  const text = message.replace(/\s+/g, " ").trim();
  if (!text) return null;

  const go = text.match(/^(?:please )?(?:open|go to|show|take me to) (?:the )?([a-z ]+)$/i);
  if (go) {
    const key = go[1].trim().toLowerCase();
    const path = DESTINATIONS[key];
    if (!path) return null;
    return [step("navigate", { path }, pathname)];
  }

  const price = text.match(
    /^(?:please )?(?:add|create|new) (?:a |an )?(?:price|item) (?:called |named )?(.+?) (?:at|for) \$?(\d+(?:\.\d{1,2})?)(?: (?:per )?(each|squares?|sq ft|lin ft|rolls?|bundles?|hours?))?$/i,
  );
  if (price) {
    const name = price[1].replace(/^["']|["']$/g, "").trim();
    const unit = (price[3] || "each").toLowerCase();
    return [
      step("navigate", { path: "/library" }, pathname),
      step("create_price", { name, unit, price: price[2] }, pathname),
    ];
  }

  const group = text.match(/^(?:please )?(?:add|create|new) (?:a )?group (?:called |named )?(.+)$/i);
  if (group) {
    const name = group[1].replace(/^["']|["']$/g, "").trim();
    return [
      step("navigate", { path: "/library/groups" }, pathname),
      step("create_group", { name }, pathname),
    ];
  }

  const quote = text.match(
    /^(?:please )?(?:add|create|new|start) (?:a )?quote (?:for )?(.+?)(?: (?:for|about|job) (.+))?$/i,
  );
  if (quote) {
    const customerName = quote[1].trim();
    const title = (quote[2] || "New job").trim();
    return [step("create_quote", { customerName, title }, pathname)];
  }

  const tiers = /good[, ]+better[, ]+and best|good better best/i.test(text);
  const quoteId = pathname.match(/^\/quotes\/([0-9a-f-]{8,})/i)?.[1];
  if (tiers && quoteId) {
    return [step("use_good_better_best", { quoteId }, pathname)];
  }

  return null;
}
