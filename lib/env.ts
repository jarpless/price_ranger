export type DataBackend = "supabase" | "local" | "unconfigured";

export function dataBackend(): DataBackend {
  const url = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (url !== key) return "unconfigured";
  if (url && key) return "supabase";
  if (process.env.NODE_ENV !== "production") return "local";
  return "unconfigured";
}

function firstHeaderValue(value: string | null): string {
  return (value || "").split(",")[0]?.trim() || "";
}

function configuredSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
}

/** Hosts that may receive a magic link or signup verify link. Keeps the link on the browser that holds the sign-in cookie. */
export function allowedBrowserHost(host: string): boolean {
  const bare = host.toLowerCase();
  if (!bare || bare.includes("/") || /\s/.test(bare)) return false;
  const name = bare.split(":")[0];
  if (name === "localhost" || name === "127.0.0.1") return true;
  if (name === "priceranger.app" || name.endsWith(".priceranger.app")) return true;
  if (name.endsWith(".vercel.app")) return true;
  try {
    const configured = configuredSiteUrl();
    if (configured && new URL(configured).host.toLowerCase() === bare) return true;
  } catch {
    // A malformed site URL is not an allow-list entry.
  }
  return false;
}

export function siteOriginFromHeaders(headerList: {
  get(name: string): string | null;
}): string {
  const host = firstHeaderValue(headerList.get("x-forwarded-host") || headerList.get("host"));
  const protoHeader = firstHeaderValue(headerList.get("x-forwarded-proto"));
  const proto = protoHeader || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  if (host && allowedBrowserHost(host)) return `${proto}://${host}`;
  const configured = configuredSiteUrl();
  if (configured) return configured;
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}
