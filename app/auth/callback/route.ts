import { type EmailOtpType } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { adoptGuestAccount, LINK_COOKIE } from "@/lib/account/link";
import { safeNext } from "@/lib/auth";
import { dataBackend, siteOriginFromHeaders } from "@/lib/env";

type PendingCookie = { name: string; value: string; options?: Record<string, unknown> };

const HASH_PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Signing you in</title>
</head>
<body style="margin:0;background:#f3eee4;color:#1c1915;font-family:Georgia,serif;">
  <p style="margin:0;padding:48px 24px;text-align:center;font-size:22px;">Signing you in…</p>
  <script>
    (function () {
      var hash = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
      var access = hash.get("access_token");
      var refresh = hash.get("refresh_token");
      if (!access || !refresh) {
        location.replace("/signin?error=link");
        return;
      }
      location.replace("/auth/recover" + location.hash);
    })();
  </script>
</body>
</html>`;

function hashRecovery(): NextResponse {
  return new NextResponse(HASH_PAGE, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const origin = siteOriginFromHeaders(request.headers);
  const failure = NextResponse.redirect(new URL("/signin?error=link", origin));
  if (dataBackend() !== "supabase") return failure;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return failure;

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash") || url.searchParams.get("token");
  const type = url.searchParams.get("type");
  const flowId = url.searchParams.get("sb_flow_id");
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
    const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (error) return hashRecovery();
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    if (error) return hashRecovery();
  } else {
    // Signup confirmation often returns the session in the fragment, which a server redirect drops.
    return hashRecovery();
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
