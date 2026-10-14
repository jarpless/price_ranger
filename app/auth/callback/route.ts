import { type EmailOtpType } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { adoptGuestAccount, LINK_COOKIE } from "@/lib/account/link";
import { safeNext } from "@/lib/auth";
import { dataBackend, siteOriginFromHeaders } from "@/lib/env";

type PendingCookie = { name: string; value: string; options?: Record<string, unknown> };

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const origin = siteOriginFromHeaders(request.headers);
  const failure = NextResponse.redirect(new URL("/signin?error=link", origin));
  if (dataBackend() !== "supabase") return failure;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return failure;

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  let pending: PendingCookie[] = [];

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        pending = cookiesToSet.map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
          options: cookie.options as Record<string, unknown> | undefined,
        }));
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
        }
      },
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return failure;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    if (error) return failure;
  } else {
    return failure;
  }

  const { data } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LINK_COOKIE)?.value || "";
  const fromMeta = data.user?.user_metadata?.link_guest;
  const guestId = fromCookie || (typeof fromMeta === "string" ? fromMeta : "");
  if (data.user && guestId) {
    try {
      await adoptGuestAccount(guestId, data.user.id);
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Could not move the guest prices.");
    }
  }

  const next = cookieStore.get("pr_oauth_next")?.value || "";
  const response = NextResponse.redirect(new URL(safeNext(next || null), origin));
  for (const cookie of pending) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  const cookieBase = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
  response.cookies.set(LINK_COOKIE, "", { ...cookieBase, maxAge: 0 });
  response.cookies.set("pr_reauth", new Date().toISOString(), { ...cookieBase, maxAge: 60 * 10 });
  response.cookies.set("pr_oauth_next", "", { ...cookieBase, maxAge: 0 });
  return response;
}
