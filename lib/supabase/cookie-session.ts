const REFRESH_WITHIN_SECONDS = 60;

export interface CookieSessionUser {
  id: string;
  email: string | null;
  is_anonymous: boolean;
}

export type FreshSupabaseSession =
  | { status: "known"; user: CookieSessionUser | null }
  | { status: "refresh" };

interface CookiePair {
  name: string;
  value: string;
}

function authCookieKey(cookies: CookiePair[]): string | null {
  for (const cookie of cookies) {
    const match = cookie.name.match(/^(sb-.+-auth-token)(?:\.\d+)?$/);
    if (match) return match[1];
  }
  return null;
}

function cookieValue(cookies: CookiePair[], name: string): string | null {
  return cookies.find((cookie) => cookie.name === name)?.value ?? null;
}

function combinedCookie(cookies: CookiePair[], key: string): string | null {
  const direct = cookieValue(cookies, key);
  if (direct) return direct;
  const parts: string[] = [];
  for (let index = 0; index < 8; index += 1) {
    const part = cookieValue(cookies, `${key}.${index}`);
    if (!part) break;
    parts.push(part);
  }
  return parts.length > 0 ? parts.join("") : null;
}

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

function tokenExpiry(accessToken: string): number | null {
  const payload = accessToken.split(".")[1];
  if (!payload) return null;
  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as { exp?: unknown };
    return typeof parsed.exp === "number" ? parsed.exp : null;
  } catch {
    return null;
  }
}

function jwtPayload(accessToken: string): { sub?: unknown; email?: unknown; is_anonymous?: unknown } | null {
  const payload = accessToken.split(".")[1];
  if (!payload) return null;
  try {
    return JSON.parse(decodeBase64Url(payload)) as { sub?: unknown; email?: unknown; is_anonymous?: unknown };
  } catch {
    return null;
  }
}

function userFromParsed(
  user: { id?: unknown; email?: unknown; is_anonymous?: unknown } | undefined,
  accessToken: string | null,
): CookieSessionUser | null {
  const claims = accessToken ? jwtPayload(accessToken) : null;
  const id = typeof user?.id === "string" ? user.id : typeof claims?.sub === "string" ? claims.sub : "";
  if (!id) return null;
  const emailFromUser = typeof user?.email === "string" && user.email.includes("@") ? user.email : null;
  const emailFromToken = typeof claims?.email === "string" && claims.email.includes("@") ? claims.email : null;
  const email = emailFromUser || emailFromToken;
  // An email on the session is a real account. Anonymous guests have no email.
  const anonymous = !email || user?.is_anonymous === true || claims?.is_anonymous === true;
  return {
    id,
    email,
    is_anonymous: anonymous && !email,
  };
}

function parseAuthCookie(cookies: CookiePair[]): { user: CookieSessionUser; expiresAt: number | null; linkGuest: string | null } | null {
  const key = authCookieKey(cookies);
  if (!key) return null;
  const raw = combinedCookie(cookies, key);
  if (!raw) return null;
  try {
    const encoded = raw.startsWith("base64-") ? raw.slice("base64-".length) : raw;
    const parsed = JSON.parse(raw.startsWith("base64-") ? decodeBase64Url(encoded) : raw) as {
      expires_at?: unknown;
      access_token?: unknown;
      user?: { id?: unknown; email?: unknown; is_anonymous?: unknown; user_metadata?: { link_guest?: unknown } };
    };
    const accessToken = typeof parsed.access_token === "string" ? parsed.access_token : null;
    const user = userFromParsed(parsed.user, accessToken);
    if (!user) return null;
    const expiresAt =
      typeof parsed.expires_at === "number"
        ? parsed.expires_at
        : typeof parsed.access_token === "string"
          ? tokenExpiry(parsed.access_token)
          : null;
    const linkGuest = parsed.user?.user_metadata?.link_guest;
    return { user, expiresAt, linkGuest: typeof linkGuest === "string" ? linkGuest : null };
  } catch {
    return null;
  }
}

/** The user stored in the auth cookie, including a token that is near expiry. */
export function readSupabaseCookieUser(cookies: CookiePair[]): CookieSessionUser | null {
  return parseAuthCookie(cookies)?.user ?? null;
}

/** Guest id stashed on the account when a guest saved an email. */
export function readSupabaseLinkGuest(cookies: CookiePair[]): string | null {
  return parseAuthCookie(cookies)?.linkGuest ?? null;
}

/**
 * Read a still-valid Supabase auth cookie without calling Auth.
 * Returns "refresh" when the cookie is missing a usable expiry, is near expiry, or cannot be read.
 * A known null user means there is no auth cookie, so middleware can skip the network.
 */
export function readFreshSupabaseSession(
  cookies: CookiePair[],
  nowSeconds = Date.now() / 1000,
): FreshSupabaseSession {
  if (!authCookieKey(cookies)) return { status: "known", user: null };
  const parsed = parseAuthCookie(cookies);
  if (!parsed) return { status: "refresh" };
  if (parsed.expiresAt == null || parsed.expiresAt - nowSeconds <= REFRESH_WITHIN_SECONDS) return { status: "refresh" };
  return { status: "known", user: parsed.user };
}
