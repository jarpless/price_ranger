export const COACH_PAGES = ["new-quote", "quote-builder", "share", "settings"] as const;

export type CoachPage = (typeof COACH_PAGES)[number];

export type PageTip = {
  id: CoachPage;
  title: string;
  body: string;
};

export const PAGE_TIPS: Record<CoachPage, PageTip> = {
  "new-quote": {
    id: "new-quote",
    title: "New quote",
    body: "Name the customer and the job, then create the quote. Prices come next.",
  },
  "quote-builder": {
    id: "quote-builder",
    title: "Quote builder",
    body: "Press Add on a price to drop it into the group. Present when the options look right.",
  },
  share: {
    id: "share",
    title: "Share",
    body: "Copy the link or tap Share. Nothing is sent until you do.",
  },
  settings: {
    id: "settings",
    title: "Settings",
    body: "Your plan and the messages left this month are here. Billing and privacy are one tap away.",
  },
};

export const COACH_DISMISS_KEY = "pr-coach-dismissed-v1";

function cleanPath(pathname: string): string {
  const path = (pathname.split("?")[0] || "/").replace(/\/+$/, "");
  return path || "/";
}

export function coachPage(pathname: string, guideStep?: string | null): CoachPage | null {
  const path = cleanPath(pathname);
  if (path === "/quotes/new") return "new-quote";
  if (/^\/quotes\/[^/]+$/.test(path)) return "quote-builder";
  if (path === "/settings") return "settings";
  if (guideStep === "share") return "share";
  return null;
}

export function parseDismissed(raw: string | null): CoachPage[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is CoachPage => COACH_PAGES.includes(item as CoachPage));
  } catch {
    return [];
  }
}

export function dismissPage(current: readonly CoachPage[], page: CoachPage): CoachPage[] {
  if (current.includes(page)) return [...current];
  return [...current, page];
}
