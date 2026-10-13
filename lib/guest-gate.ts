export const GUEST_PROBE_COOKIE = "pr_guest_probe";
export const GUEST_READY_PARAM = "ready";
export const GUEST_SENT_PARAM = "gs";

const AUTOMATED_UA =
  /bot\b|crawler|spider|crawling|slurp|facebookexternalhit|facebot|whatsapp|telegrambot|embedly|iframely|quora|pinterest|slackbot|discordbot|linkedinbot|twitterbot|applebot|bingpreview|wget|curl|python-requests|go-http-client|java\/|libwww|scrapy|axios\/|node-fetch|httpie|headless|phantom|bytespider|gptbot|claudebot|amazonbot/i;

export function isAutomatedClient(userAgent: string | null | undefined): boolean {
  const ua = userAgent?.trim() ?? "";
  if (!ua) return true;
  return AUTOMATED_UA.test(ua);
}

export function isGuestRateLimited(error: { message?: string; status?: number; code?: string | null }): boolean {
  if (error.status === 429) return true;
  if (error.code && /rate_limit/i.test(error.code)) return true;
  return /rate limit|too many requests/i.test(error.message ?? "");
}

export function hasCookie(header: string | null | undefined, name: string): boolean {
  if (!header) return false;
  return header.split(";").some((part) => part.trim().startsWith(`${name}=`));
}

export function withParam(path: string, key: string, value: string): string {
  const queryAt = path.indexOf("?");
  const pathname = queryAt === -1 ? path : path.slice(0, queryAt);
  const params = new URLSearchParams(queryAt === -1 ? "" : path.slice(queryAt + 1));
  params.set(key, value);
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export function withoutParam(path: string, key: string): string {
  const queryAt = path.indexOf("?");
  if (queryAt === -1) return path;
  const params = new URLSearchParams(path.slice(queryAt + 1));
  params.delete(key);
  const search = params.toString();
  return search ? `${path.slice(0, queryAt)}?${search}` : path.slice(0, queryAt);
}

export type GuestGate = "public" | "probe" | "refuse" | "create";

// Bots never create a user. A browser must echo a probe cookie before we do.
export function guestGate(input: {
  userAgent: string | null | undefined;
  ready: boolean;
  hasProbe: boolean;
}): GuestGate {
  if (isAutomatedClient(input.userAgent)) return "public";
  if (!input.ready) return "probe";
  if (!input.hasProbe) return "refuse";
  return "create";
}

export type UnsignedDestination = "guest" | "login" | "cookies";

export function unsignedDestination(input: {
  userAgent: string | null | undefined;
  guestSent: boolean;
}): UnsignedDestination {
  if (isAutomatedClient(input.userAgent)) return "login";
  if (input.guestSent) return "cookies";
  return "guest";
}
