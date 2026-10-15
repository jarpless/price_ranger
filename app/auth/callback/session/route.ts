import { cookies } from "next/headers";

import { adoptGuestAccount, LINK_COOKIE } from "@/lib/account/link";
import { safeNext } from "@/lib/auth";
import { dataBackend } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Saves a session that arrived in the URL fragment. The fragment never reaches the server. */
export async function POST(request: Request) {
  if (dataBackend() !== "supabase") return Response.json({ error: "link" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { access_token?: unknown; refresh_token?: unknown } | null;
  const accessToken = typeof body?.access_token === "string" ? body.access_token : "";
  const refreshToken = typeof body?.refresh_token === "string" ? body.refresh_token : "";
  if (!accessToken || !refreshToken) return Response.json({ error: "link" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error || !data.user) return Response.json({ error: "link" }, { status: 400 });

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LINK_COOKIE)?.value || "";
  const fromMeta = data.user.user_metadata?.link_guest;
  const guestId = fromCookie || (typeof fromMeta === "string" ? fromMeta : "");
  if (guestId) {
    try {
      await adoptGuestAccount(guestId, data.user.id);
    } catch (adoptError) {
      console.error(adoptError instanceof Error ? adoptError.message : "Could not move the guest prices.");
    }
    cookieStore.set(LINK_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }

  const next = cookieStore.get("pr_oauth_next")?.value || "";
  return Response.json({ next: safeNext(next || null) });
}
