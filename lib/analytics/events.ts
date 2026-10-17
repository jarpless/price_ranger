import { FUNNEL_EVENTS } from "../guide/flow";

/** Every name the funnel_events table accepts. Keep in step with 20261017200000_pmf_events.sql. */
export const PMF_EVENTS = [
  ...FUNNEL_EVENTS,
  "session_started",
  "price_started",
  "price_result_shown",
  "price_adjusted",
  "quote_shared",
  "pdf_downloaded",
  "item_marked_sold",
  "assistant_message",
  "checkout_started",
  "feedback_submitted",
  "share_viewed",
  "share_header_click",
  "share_signup_click",
  "beta_survey_completed",
  "tagline_other_submitted",
] as const;

export type PmfEventName = (typeof PMF_EVENTS)[number];

/** Events a browser may send to /api/track. Everything else is recorded on the server only. */
export const CLIENT_EVENTS = ["share_viewed", "share_header_click", "share_signup_click", "pdf_downloaded", "session_started"] as const;

export type ClientEventName = (typeof CLIENT_EVENTS)[number];

/** Events an account-less visitor may record. Matches the anon insert policy. */
export const ANON_EVENTS: readonly PmfEventName[] = CLIENT_EVENTS;

export type Platform = "web" | "pwa";

export type PmfProps = Record<string, string | number | boolean | null | undefined>;

export const ANON_COOKIE = "pr_aid";
export const SESSION_COOKIE_NAME = "pr_sid";
export const PLATFORM_COOKIE = "pr_plat";
export const ANON_MAX_AGE = 60 * 60 * 24 * 365;
/** A session ends after 30 minutes without a request. */
export const SESSION_IDLE_SECONDS = 30 * 60;

const PROP_KEYS = 12;
const PROP_VALUE = 120;
/** Keys that would carry personal data. Callers must not send them; this is the backstop. */
const BLOCKED_KEY = /email|phone|name|address|message|note|description|ip|token/i;
const ALLOWED_KEYS = new Set(["tagline_choice", "tagline_order", "persona", "trade", "ellis"]);

export function isPmfEvent(value: unknown): value is PmfEventName {
  return typeof value === "string" && (PMF_EVENTS as readonly string[]).includes(value);
}

export function isClientEvent(value: unknown): value is ClientEventName {
  return typeof value === "string" && (CLIENT_EVENTS as readonly string[]).includes(value);
}

export function isPlatform(value: unknown): value is Platform {
  return value === "web" || value === "pwa";
}

/** Flat, short, string-valued props with personal-data keys dropped. */
export function cleanProps(props: PmfProps | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!props || typeof props !== "object") return out;
  for (const [key, raw] of Object.entries(props)) {
    if (Object.keys(out).length >= PROP_KEYS) break;
    if (!/^[a-z][a-z0-9_]{0,31}$/.test(key)) continue;
    if (BLOCKED_KEY.test(key) && !ALLOWED_KEYS.has(key)) continue;
    if (raw == null) continue;
    if (typeof raw !== "string" && typeof raw !== "number" && typeof raw !== "boolean") continue;
    out[key] = String(raw).slice(0, PROP_VALUE);
  }
  return out;
}

/** Opaque id for anon and session cookies. Rejects anything else a client might send. */
export function isOpaqueId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(value);
}

/** Owner and test accounts are flagged so every view and the admin page can leave them out. */
export function isInternalEmail(email: string | null | undefined, owner = process.env.OWNER_EMAIL): boolean {
  const value = (email || "").trim().toLowerCase();
  if (!value) return false;
  if (owner && value === owner.trim().toLowerCase()) return true;
  if (/\+test[^@]*@/.test(value)) return true;
  if (value.endsWith("@priceranger.app") || value.endsWith("@example.com")) return true;
  const extra = (process.env.PMF_EXCLUDE_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return extra.includes(value);
}
