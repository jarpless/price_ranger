import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { LINK_COOKIE } from "@/lib/account/link";
import { safeNext } from "@/lib/auth";
import { dataBackend, siteOriginFromHeaders } from "@/lib/env";
import { createSessionValue, KIND_COOKIE, readSessionValue, SESSION_COOKIE, sessionSecret } from "@/lib/session";
import { reassignBasecamp } from "@/lib/store/basecamp";
import { adoptLocalGuest, consumeMagicLink, getLocalUser } from "@/lib/store/local";
import { isIndustryId } from "@/lib/vocabulary";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = siteOriginFromHeaders(request.headers);
  const failure = NextResponse.redirect(new URL("/signin?error=link", origin));
  if (dataBackend() !== "local") return failure;

  const cookieStore = await cookies();
  const sessionGuest = await readSessionValue(cookieStore.get(SESSION_COOKIE)?.value, sessionSecret());
  const linkedGuest = cookieStore.get(LINK_COOKIE)?.value || "";
  const user = await consumeMagicLink(url.searchParams.get("token") || "");
  if (!user) return failure;
  const guestId = sessionGuest && sessionGuest !== user.id ? sessionGuest : linkedGuest && linkedGuest !== user.id ? linkedGuest : "";
  if (guestId) {
    const guest = await getLocalUser(guestId);
    if (guest?.guest) {
      await adoptLocalGuest(guestId, user.id);
      await reassignBasecamp(guestId, user.id);
    }
  }
  const fresh = await getLocalUser(user.id);
  const stored = cookieStore.get("pr_oauth_next")?.value || "";
  const dest = stored ? safeNext(stored) : isIndustryId(fresh?.industry) ? "/" : "/start";
  const response = NextResponse.redirect(new URL(dest, origin));
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
  response.cookies.set(SESSION_COOKIE, await createSessionValue(user.id, sessionSecret()), options);
  response.cookies.set(KIND_COOKIE, "user", options);
  response.cookies.set(LINK_COOKIE, "", { ...options, maxAge: 0 });
  response.cookies.set("pr_oauth_next", "", { ...options, maxAge: 0 });
  return response;
}
