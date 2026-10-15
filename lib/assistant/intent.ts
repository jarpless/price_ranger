import { planLocally } from "./plan";

export interface ConfirmedStep {
  name: "navigate" | "set_asking_price" | "mark_sold";
  args: Record<string, string>;
  caption: string;
  href: string;
  spotlight: string;
  needsConfirm: boolean;
}

export type QuoteCommand = { type: "step"; step: ConfirmedStep } | { type: "reply"; text: string };

export function appPath(path: string): string {
  const clean = path.split("?")[0] || "/";
  if (clean === "/settings/plans" || clean.startsWith("/settings/plans/") || clean === "/plans") return "/upgrade";
  return path.startsWith("/") ? path : "/";
}

function isQuestion(text: string): boolean {
  return text.includes("?") || /^(why|how|what|when|where|who|explain|tell me|is |are |does |do |can |could |should )/.test(text);
}

function guideIdFrom(pathname: string): string | null {
  const match = (pathname.split("?")[0] || "").match(/^\/guide\/([^/]+)/);
  return match?.[1] || null;
}

function amountFrom(text: string): string | null {
  const directed = text.match(/\b(?:to|at|for|be)\s+\$?\s*(\d{1,7}(?:\.\d{1,2})?)\b/);
  if (directed) return directed[1];
  const dollar = text.match(/\$\s*(\d{1,7}(?:\.\d{1,2})?)/);
  return dollar?.[1] || null;
}

/**
 * Price and sold commands act on the open quote.
 * A missing amount is a reply, never a silent edit of the price library.
 */
export function quoteCommand(message: string, pathname: string): QuoteCommand | null {
  const text = message.replace(/\s+/g, " ").trim().toLowerCase();
  if (!text || isQuestion(text)) return null;
  const id = guideIdFrom(pathname);
  if (/\b(?:change|set|update|make) (?:the |my |this |that )?(?:asking )?price\b/.test(text)) {
    const amount = amountFrom(text);
    if (!id) {
      return {
        type: "reply",
        text: "Open the price first. Then say “change the price to 160” and I’ll ask you to confirm before I update that quote.",
      };
    }
    if (!amount) {
      return {
        type: "reply",
        text: "What should this price be? Say “change the price to 160” and I’ll ask you to confirm before I update this quote.",
      };
    }
    return {
      type: "step",
      step: {
        name: "set_asking_price",
        args: { quoteId: id, amount },
        caption: `Set the quote total to $${amount}? Nothing in your price library changes until you confirm.`,
        href: `/guide/${id}`,
        spotlight: "asking-price",
        needsConfirm: true,
      },
    };
  }
  if (/^mark (it |this |that )?sold\b/.test(text)) {
    if (!id) {
      return { type: "reply", text: "Open the price, then say “mark sold” and I’ll ask you to confirm." };
    }
    const amount = amountFrom(text);
    return {
      type: "step",
      step: {
        name: "mark_sold",
        args: amount ? { quoteId: id, amount } : { quoteId: id },
        caption: amount
          ? `Mark this sold for $${amount}? I’ll save that on this quote after you confirm.`
          : "Mark this sold at the price on screen? I’ll save it on this quote after you confirm.",
        href: `/guide/${id}`,
        spotlight: "mark-sold",
        needsConfirm: true,
      },
    };
  }
  return null;
}

/** Imperative account actions. Questions stay answers, including ones that mention plans or sharing. */
export function confirmedAction(message: string, pathname: string): ConfirmedStep | null {
  const text = message.trim().toLowerCase();
  if (!text) return null;
  if (isQuestion(text)) {
    return null;
  }
  if (/\b(upgrade me|subscribe|change my plan|switch to plus|switch to pro|get plus|get pro)\b/.test(text)) {
    return {
      name: "navigate",
      args: { path: "/upgrade" },
      caption: "Open plans. Nothing is charged until you check out.",
      href: "/upgrade",
      spotlight: "nav-plans",
      needsConfirm: true,
    };
  }
  if (/^delete (my )?account\b|^close (my )?account\b/.test(text)) {
    return {
      name: "navigate",
      args: { path: "/settings/delete" },
      caption: "Open delete account. Nothing is removed until you confirm there.",
      href: "/settings/delete",
      spotlight: "settings-feedback",
      needsConfirm: true,
    };
  }
  return null;
}

/** Questions get an answer. A request to open, add, or change something walks the screen. */
export function inferAssistantMode(message: string, pathname = "/"): "ask" | "agent" {
  const text = message.replace(/\s+/g, " ").trim();
  if (!text) return "ask";
  const lower = text.toLowerCase();
  if (text.includes("?") || /^(why|how|what|when|where|who|explain|tell me|is |are |does |do |can |could |should )/.test(lower)) {
    return "ask";
  }
  if (quoteCommand(text, pathname) || confirmedAction(text, pathname) || planLocally(text, pathname)) return "agent";
  if (/^(please )?(open|go to|show me|take me|add|create|new|delete|remove|start|mark|upgrade|walk|change|update)\b/.test(lower)) {
    return "agent";
  }
  return "ask";
}
