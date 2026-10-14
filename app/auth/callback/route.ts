import { type EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { adoptGuestAccount, LINK_COOKIE } from "@/lib/account/link";
import { dataBackend } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const failure = new URL("/signin?error=link", url.origin);
  if (dataBackend() !== "supabase") return NextResponse.redirect(failure);

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(failure);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    if (error) return NextResponse.redirect(failure);
  } else {
    return NextResponse.redirect(failure);
  }

  const { data } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LINK_COOKIE)?.value || "";
  const fromMeta = data.user?.user_metadata?.link_guest;
  const guestId = fromCookie || (typeof fromMeta === "string" ? fromMeta : "");
  if (data.user && guestId) await adoptGuestAccount(guestId, data.user.id);
  cookieStore.set(LINK_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });

  return NextResponse.redirect(new URL("/", url.origin));
}
