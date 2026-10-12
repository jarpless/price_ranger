import { NextResponse, type NextRequest } from "next/server";

import { dataBackend } from "./lib/env";
import { readSessionValue, SESSION_COOKIE, sessionSecret } from "./lib/session";
import { refreshSupabaseSession } from "./lib/supabase/middleware";

function isPublic(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/auth/") ||
    pathname === "/setup"
  );
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

  if (backend === "supabase") {
    const { response, user } = await refreshSupabaseSession(request);
    if (!user && !isPublic(pathname)) {
      return copyCookies(response, NextResponse.redirect(new URL("/login", request.url)));
    }
    if (user && (pathname === "/login" || pathname.startsWith("/login/"))) {
      return copyCookies(response, NextResponse.redirect(new URL("/", request.url)));
    }
    return response;
  }

  const userId = await readSessionValue(
    request.cookies.get(SESSION_COOKIE)?.value,
    sessionSecret(),
  );
  if (!userId && !isPublic(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (userId && (pathname === "/login" || pathname.startsWith("/login/"))) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
