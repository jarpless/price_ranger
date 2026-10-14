import { planLocally } from "./plan";

export interface ConfirmedStep {
  name: "navigate";
  args: Record<string, string>;
  caption: string;
  href: string;
  spotlight: string;
  needsConfirm: boolean;
}

export function appPath(path: string): string {
  const clean = path.split("?")[0] || "/";
  if (clean === "/settings/plans" || clean.startsWith("/settings/plans/") || clean === "/plans") return "/upgrade";
  return path.startsWith("/") ? path : "/";
}

/** Imperative account actions. Questions stay answers, including ones that mention plans or sharing. */
export function confirmedAction(message: string, pathname: string): ConfirmedStep | null {
  const text = message.trim().toLowerCase();
  if (!text) return null;
  if (text.includes("?") || /^(why|how|what|when|where|who|explain|tell me|is |are |does |do |can |could |should )/.test(text)) {
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
  const guide = appPath(pathname.split("?")[0] || "/");
  if (/^mark (it |this |that )?sold\b/.test(text)) {
    const href = guide.startsWith("/guide/") ? guide : "/";
    return {
      name: "navigate",
      args: { path: href },
      caption: "Open this price. Tap Yes, sold and enter what it went for.",
      href,
      spotlight: "nav-price",
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
  if (confirmedAction(text, pathname) || planLocally(text, pathname)) return "agent";
  if (/^(please )?(open|go to|show me|take me|add|create|new|delete|remove|start|mark|upgrade|walk|change|update)\b/.test(lower)) {
    return "agent";
  }
  return "ask";
}
