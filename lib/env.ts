export type DataBackend = "supabase" | "local" | "unconfigured";

export function dataBackend(): DataBackend {
  const url = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (url !== key) return "unconfigured";
  if (url && key) return "supabase";
  if (process.env.NODE_ENV !== "production") return "local";
  return "unconfigured";
}

export function siteOriginFromHeaders(headerList: {
  get(name: string): string | null;
}): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}
