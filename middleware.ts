import { NextResponse, type NextRequest } from "next/server";

import { dataBackend } from "./lib/env";
import { KIND_COOKIE, readSessionValue, SESSION_COOKIE, sessionSecret } from "./lib/session";
import { refreshSupabaseSession } from "./lib/supabase/middleware";

function isPublic(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/auth/") ||
    pathname === "/setup" ||
    pathname.startsWith("/p/")
  );
}

function isLogin(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/login/");
}

function guestEntry(request: NextRequest) {
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const url = new URL("/auth/guest", request.url);
  url.searchParams.set("next", next);
  return url;
}

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}

export async function middleware(request: NextRequest) {
  const backend = dataBackend();
  const { pathname } = request.nextUrl;

  if (backend === "unconfigured") {
    if (pathname === "/setup") return NextResponse.next();
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  if (pathname.startsWith("/api/")) {
    if (backend === "supabase") {
      const { response, user } = await refreshSupabaseSession(request);
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
    const { response, user } = await refreshSupabaseSession(request);
    const account = user as { email?: string | null; is_anonymous?: boolean } | null;
    const guest = Boolean(account?.is_anonymous) || Boolean(account && !account.email);
    if (!user && !isPublic(pathname)) {
      return copyCookies(response, NextResponse.redirect(guestEntry(request)));
    }
    if (user && isLogin(pathname) && !guest) {
      return copyCookies(response, NextResponse.redirect(new URL("/", request.url)));
    }
    return response;
  }

  const userId = await readSessionValue(
    request.cookies.get(SESSION_COOKIE)?.value,
    sessionSecret(),
  );
  const guest = request.cookies.get(KIND_COOKIE)?.value === "guest";
  if (!userId && !isPublic(pathname)) {
    return NextResponse.redirect(guestEntry(request));
  }
  if (userId && isLogin(pathname) && !guest) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
