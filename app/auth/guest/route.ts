import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionUser, safeNext, setLocalSession } from "@/lib/auth";
import { dataBackend } from "@/lib/env";
import { guestErrorDetail } from "@/lib/form";
import {
  GUEST_PROBE_COOKIE,
  GUEST_READY_PARAM,
  GUEST_SENT_PARAM,
  guestGate,
  hasCookie,
  isGuestRateLimited,
  withParam,
  withoutParam,
} from "@/lib/guest-gate";
import { createGuestUser } from "@/lib/store/local";
import { createClient } from "@/lib/supabase/server";

const probeCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 120,
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const gate = guestGate({
    userAgent: request.headers.get("user-agent"),
    ready: url.searchParams.get(GUEST_READY_PARAM) === "1",
    hasProbe: hasCookie(request.headers.get("cookie"), GUEST_PROBE_COOKIE),
  });

  if (gate === "public") redirect("/login");

  const existing = await getSessionUser();
  if (existing) redirect(withoutParam(next, GUEST_SENT_PARAM));

  if (gate === "probe") {
    const jar = await cookies();
    jar.set(GUEST_PROBE_COOKIE, "1", probeCookie);
    url.searchParams.set(GUEST_READY_PARAM, "1");
    redirect(`${url.pathname}${url.search}`);
  }

  if (gate === "refuse") redirect("/login?notice=cookies");

  if (dataBackend() === "supabase") {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      if (isGuestRateLimited(error)) redirect("/login?notice=busy");
      const detail = encodeURIComponent(guestErrorDetail(error.message));
      redirect(`/login?error=guest&detail=${detail}`);
    }
    redirect(withParam(next, GUEST_SENT_PARAM, "1"));
  }
  if (dataBackend() !== "local") redirect("/setup");

  const user = await createGuestUser();
  await setLocalSession(user.id, "guest");
  redirect(withParam(next, GUEST_SENT_PARAM, "1"));
}
