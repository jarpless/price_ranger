import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { readSupabaseCookieUser } from "./cookie-session";

export async function refreshSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { response, user: null as { id: string } | null };
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const prior = request.cookies.getAll();
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) return { response, user: data.user };
    const cookieUser = readSupabaseCookieUser(prior);
    // A failed refresh must not send the cleared cookies back to the browser.
    if (cookieUser) return { response: NextResponse.next(), user: cookieUser };
    return { response, user: null };
  } catch {
    const cookieUser = readSupabaseCookieUser(prior);
    if (cookieUser) return { response: NextResponse.next(), user: cookieUser };
    return { response, user: null };
  }
}
