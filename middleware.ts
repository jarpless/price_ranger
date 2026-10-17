import { NextResponse, type NextRequest } from "next/server";

import { dataBackend } from "./lib/env";
import { GUEST_SENT_PARAM, unsignedDestination } from "./lib/guest-gate";
import { KIND_COOKIE, readSessionValue, SESSION_COOKIE, sessionSecret } from "./lib/session";
import { readFreshSupabaseSession, reconcileAuthCookies, type CookieSessionUser } from "./lib/supabase/cookie-session";
import { refreshSupabaseSession } from "./lib/supabase/middleware";

function isPublic(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/signin" ||
    pathname.startsWith("/signin/") ||
    pathname.startsWith("/auth/") ||
    pathname === "/setup" ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/p/")
  );
}

function isLogin(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/login/") || pathname === "/signin" || pathname.startsWith("/signin/");
}

function guestEntry(request: NextRequest) {
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const url = new URL("/auth/guest", request.url);
  url.searchParams.set("next", next);
  return url;
}

function unsignedRedirect(request: NextRequest) {
  const where = unsignedDestination({
    userAgent: request.headers.get("user-agent"),
    guestSent: request.nextUrl.searchParams.get(GUEST_SENT_PARAM) === "1",
  });
  if (where === "guest") return NextResponse.redirect(guestEntry(request));
  const url = new URL("/signin", request.url);
  if (where === "cookies") url.searchParams.set("notice", "cookies");
  return NextResponse.redirect(url);
}

const SIGNIN_EMAIL = "pr_pending_email";
const GUEST_LINK = "pr_link_guest";

function rememberAnonymous(request: NextRequest, response: NextResponse, guestId: string) {
  if (!guestId || request.cookies.get(GUEST_LINK)?.value) return response;
  response.cookies.set(GUEST_LINK, guestId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

/** A sign-in error must not leave the address in the query string. */
function stripSignInEmail(request: NextRequest): NextResponse | null {
  const email = request.nextUrl.searchParams.get("email");
  if (!email) return null;
  const { pathname } = request.nextUrl;
  const onLogin = pathname === "/login" || pathname.startsWith("/login/") || pathname === "/signin" || pathname.startsWith("/signin/");
  if (!onLogin) return null;
  const clean = request.nextUrl.clone();
  clean.pathname = pathname.replace(/^\/login/, "/signin");
  clean.searchParams.delete("email");
  const response = NextResponse.redirect(clean);
  response.cookies.set(SIGNIN_EMAIL, email.slice(0, 320), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

function stripGuestSent(request: NextRequest) {
  if (request.nextUrl.searchParams.get(GUEST_SENT_PARAM) !== "1") return null;
  const clean = request.nextUrl.clone();
  clean.searchParams.delete(GUEST_SENT_PARAM);
  return NextResponse.redirect(clean);
}

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}

const authClear = {
  path: "/",
  maxAge: 0,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  httpOnly: false,
};

/** Drop a stale guest auth cookie before the page reads the session. */
function preferVerifiedSession(request: NextRequest): { response: NextResponse; drop: string[] } | null {
  const plan = reconcileAuthCookies(request.cookies.getAll());
  if (!plan) return null;
  for (const name of plan.drop) request.cookies.delete(name);
  if (plan.replace) {
    for (const cookie of plan.set) request.cookies.set(cookie.name, cookie.value);
  }
  const response = NextResponse.next({ request });
  for (const name of plan.drop) response.cookies.set(name, "", authClear);
  if (plan.replace) {
    for (const cookie of plan.set) {
      response.cookies.set(cookie.name, cookie.value, { ...authClear, maxAge: 400 * 24 * 60 * 60 });
    }
  }
  return { response, drop: plan.drop };
}

async function supabaseGate(request: NextRequest): Promise<{
  user: CookieSessionUser | { id: string; email?: string | null; is_anonymous?: boolean } | null;
  response: NextResponse;
}> {
  const verified = preferVerifiedSession(request);
  const fresh = readFreshSupabaseSession(request.cookies.getAll());
  if (fresh.status === "known") {
    return { user: fresh.user, response: verified?.response ?? NextResponse.next({ request }) };
  }
  const refreshed = await refreshSupabaseSession(request);
  if (verified) {
    for (const name of verified.drop) refreshed.response.cookies.set(name, "", authClear);
  }
  return refreshed;
}

export async function middleware(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": request.headers.get("origin") || "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": request.headers.get("access-control-request-headers") || "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const backend = dataBackend();
  const { pathname } = request.nextUrl;

  const emailStripped = stripSignInEmail(request);
  if (emailStripped) return emailStripped;

  if (pathname === "/login" || pathname.startsWith("/login/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/login/, "/signin");
    return NextResponse.redirect(url);
  }

  if (backend === "unconfigured") {
    if (pathname === "/setup") return NextResponse.next();
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  if (pathname.startsWith("/api/")) {
    if (backend === "supabase") {
      const { response, user } = await supabaseGate(request);
      if (!user) {
        return copyCookies(response, NextResponse.json({ error: "Sign in first." }, { status: 401 }));
      }
      return response;
    }
    const apiUser = await readSessionValue(
      request.cookies.get(SESSION_COOKIE)?.value,
      sessionSecret(),
    );
    if (!apiUser) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    return NextResponse.next();
  }

  if (backend === "supabase") {
    const { response, user } = await supabaseGate(request);
    const account = user as { email?: string | null; is_anonymous?: boolean } | null;
    const guest = Boolean(account?.is_anonymous) || Boolean(account && !account.email);
    if (user) {
      const stripped = stripGuestSent(request);
      if (stripped) return copyCookies(response, stripped);
    }
    if (!user && !isPublic(pathname)) {
      return copyCookies(response, unsignedRedirect(request));
    }
    if (user && isLogin(pathname) && !guest) {
      return copyCookies(response, NextResponse.redirect(new URL("/", request.url)));
    }
    const guestId = guest && user && "id" in user ? user.id : "";
    return rememberAnonymous(request, response, guestId);
  }

  const userId = await readSessionValue(
    request.cookies.get(SESSION_COOKIE)?.value,
    sessionSecret(),
  );
  const guest = request.cookies.get(KIND_COOKIE)?.value === "guest";
  if (userId) {
    const stripped = stripGuestSent(request);
    if (stripped) return stripped;
  }
  if (!userId && !isPublic(pathname)) {
    return unsignedRedirect(request);
  }
  if (userId && isLogin(pathname) && !guest) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return rememberAnonymous(request, NextResponse.next(), guest && userId ? userId : "");
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
