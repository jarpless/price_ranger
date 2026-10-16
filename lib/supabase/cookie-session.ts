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

function valuesFor(cookies: CookiePair[], name: string): string[] {
  return cookies.filter((cookie) => cookie.name === name && cookie.value).map((cookie) => cookie.value);
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

interface ParsedAuth {
  user: CookieSessionUser;
  expiresAt: number | null;
  linkGuest: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  pieces: { name: string; value: string }[];
}

function parseRaw(raw: string, pieces: { name: string; value: string }[]): ParsedAuth | null {
  try {
    const encoded = raw.startsWith("base64-") ? raw.slice("base64-".length) : raw;
    const parsed = JSON.parse(raw.startsWith("base64-") ? decodeBase64Url(encoded) : raw) as {
      expires_at?: unknown;
      access_token?: unknown;
      refresh_token?: unknown;
      user?: { id?: unknown; email?: unknown; is_anonymous?: unknown; user_metadata?: { link_guest?: unknown } };
    };
    const accessToken = typeof parsed.access_token === "string" ? parsed.access_token : null;
    const user = userFromParsed(parsed.user, accessToken);
    if (!user) return null;
    const expiresAt =
      typeof parsed.expires_at === "number" ? parsed.expires_at : accessToken ? tokenExpiry(accessToken) : null;
    const linkGuest = parsed.user?.user_metadata?.link_guest;
    const refreshToken = typeof parsed.refresh_token === "string" ? parsed.refresh_token : null;
    return {
      user,
      expiresAt,
      linkGuest: typeof linkGuest === "string" ? linkGuest : null,
      accessToken,
      refreshToken,
      pieces,
    };
  } catch {
    return null;
  }
}

/** Every auth cookie the browser sent, including a stale guest cookie beside a verified one. */
function listSessions(cookies: CookiePair[]): ParsedAuth[] {
  const key = authCookieKey(cookies);
  if (!key) return [];
  const sessions: ParsedAuth[] = [];
  for (const value of valuesFor(cookies, key)) {
    const parsed = parseRaw(value, [{ name: key, value }]);
    if (parsed) sessions.push(parsed);
  }
  const pieces: { name: string; value: string }[] = [];
  for (let index = 0; index < 8; index += 1) {
    const name = `${key}.${index}`;
    const values = valuesFor(cookies, name);
    if (values.length === 0) break;
    pieces.push({ name, value: values[values.length - 1] });
  }
  if (pieces.length > 0) {
    const parsed = parseRaw(pieces.map((piece) => piece.value).join(""), pieces);
    if (parsed) sessions.push(parsed);
  }
  return sessions;
}

function memberRank(session: ParsedAuth): number {
  if (session.user.email && !session.user.is_anonymous) return 2;
  if (!session.user.is_anonymous) return 1;
  return 0;
}

/** A verified account wins over an anonymous guest cookie with the same name. */
function preferredSession(cookies: CookiePair[]): ParsedAuth | null {
  const sessions = listSessions(cookies);
  if (sessions.length === 0) return null;
  return [...sessions].sort((left, right) => {
    const rank = memberRank(right) - memberRank(left);
    if (rank !== 0) return rank;
    return (right.expiresAt ?? 0) - (left.expiresAt ?? 0);
  })[0];
}

export interface AuthCookieReconcile {
  /** Cookie names that hold a session we are not keeping. */
  drop: string[];
  /** Winning cookie pieces. Written when a same-name guest cookie has to be replaced. */
  set: { name: string; value: string }[];
  replace: boolean;
}

/**
 * When a guest cookie and a verified cookie are both present, keep the verified one.
 * Returns null when there is nothing to change.
 */
export function reconcileAuthCookies(cookies: CookiePair[]): AuthCookieReconcile | null {
  const key = authCookieKey(cookies);
  if (!key) return null;
  const sessions = listSessions(cookies);
  if (sessions.length < 2) return null;
  const best = [...sessions].sort((left, right) => {
    const rank = memberRank(right) - memberRank(left);
    if (rank !== 0) return rank;
    return (right.expiresAt ?? 0) - (left.expiresAt ?? 0);
  })[0];
  if (!best || best.user.is_anonymous || !best.user.email) return null;
  const loser = sessions.some((session) => session.user.id !== best.user.id || session.user.is_anonymous);
  if (!loser) return null;
  const keep = new Set(best.pieces.map((piece) => piece.name));
  const drop = [
    ...new Set(
      cookies
        .map((cookie) => cookie.name)
        .filter((name) => (name === key || name.startsWith(`${key}.`)) && !keep.has(name)),
    ),
  ];
  const replace = sessions.some(
    (session) =>
      session.user.id !== best.user.id && session.pieces.some((piece) => keep.has(piece.name)),
  );
  return { drop, set: best.pieces, replace };
}

/** The user stored in the auth cookie, including a token that is near expiry. */
export function readSupabaseCookieUser(cookies: CookiePair[]): CookieSessionUser | null {
  return preferredSession(cookies)?.user ?? null;
}

/** Guest id stashed on the account when a guest saved an email. */
export function readSupabaseLinkGuest(cookies: CookiePair[]): string | null {
  return preferredSession(cookies)?.linkGuest ?? null;
}

/** Access and refresh tokens from the preferred auth cookie. */
export function readSupabaseCookieTokens(
  cookies: CookiePair[],
): { access_token: string; refresh_token: string } | null {
  const session = preferredSession(cookies);
  if (!session?.accessToken || !session.refreshToken) return null;
  return { access_token: session.accessToken, refresh_token: session.refreshToken };
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
  const parsed = preferredSession(cookies);
  if (!parsed) return { status: "refresh" };
  if (parsed.expiresAt == null || parsed.expiresAt - nowSeconds <= REFRESH_WITHIN_SECONDS) return { status: "refresh" };
  return { status: "known", user: parsed.user };
}
