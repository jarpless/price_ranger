import { cookies } from "next/headers";

import { adoptGuestAccount, LINK_COOKIE } from "@/lib/account/link";
import { safeNext } from "@/lib/auth";
import { dataBackend } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { readSupabaseCookieUser, readSupabaseLinkGuest, reconcileAuthCookies } from "@/lib/supabase/cookie-session";

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/**
 * Adopts a guest after the browser Supabase client has stored the fragment
 * session. Calling setSession here again would replace those cookies.
 */
export async function POST(request: Request) {
  if (dataBackend() !== "supabase") return Response.json({ error: "link" }, { status: 400 });
  const cookieStore = await cookies();
  const pairs = cookieStore.getAll();
  const cookieUser = readSupabaseCookieUser(pairs);
  const verified = Boolean(cookieUser?.email && !cookieUser.is_anonymous);
  let userId = verified ? cookieUser?.id || "" : "";
  let metaGuest = verified ? readSupabaseLinkGuest(pairs) || "" : "";

  const plan = reconcileAuthCookies(pairs);
  if (plan && verified) {
    for (const name of plan.drop) cookieStore.set(name, "", { ...cookieBase, maxAge: 0, httpOnly: false });
  }

  if (!userId) {
    const body = (await request.json().catch(() => null)) as { access_token?: unknown; refresh_token?: unknown } | null;
    const accessToken = typeof body?.access_token === "string" ? body.access_token : "";
    const refreshToken = typeof body?.refresh_token === "string" ? body.refresh_token : "";
    if (!accessToken || !refreshToken) {
      if (cookieUser) userId = cookieUser.id;
      else return Response.json({ error: "link" }, { status: 400 });
    } else {
      const supabase = await createClient({ allowAuthClear: true });
      const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error || !data.user) {
        if (!cookieUser) return Response.json({ error: "link" }, { status: 400 });
        userId = cookieUser.id;
      } else {
        userId = data.user.id;
        const linkGuest = data.user.user_metadata?.link_guest;
        if (typeof linkGuest === "string") metaGuest = linkGuest;
      }
    }
  }

  const fromCookie = cookieStore.get(LINK_COOKIE)?.value || "";
  const guestId = fromCookie || readSupabaseLinkGuest(cookieStore.getAll()) || metaGuest;
  if (guestId) {
    try {
      await adoptGuestAccount(guestId, userId);
    } catch (adoptError) {
      console.error(adoptError instanceof Error ? adoptError.message : "Could not move the guest prices.");
    }
    cookieStore.set(LINK_COOKIE, "", { ...cookieBase, maxAge: 0 });
  }

  const next = cookieStore.get("pr_oauth_next")?.value || "";
  cookieStore.set("pr_reauth", new Date().toISOString(), { ...cookieBase, maxAge: 60 * 10 });
  cookieStore.set("pr_oauth_next", "", { ...cookieBase, maxAge: 0 });
  return Response.json({ next: safeNext(next || null) });
}
