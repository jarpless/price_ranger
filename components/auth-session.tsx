"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect } from "react";

import {
  readSupabaseCookieTokens,
  readSupabaseCookieUser,
  reconcileAuthCookies,
} from "@/lib/supabase/cookie-session";

export type AccountKind = "member" | "guest" | "out";

function cookiesFromDocument(): { name: string; value: string }[] {
  return document.cookie
    .split(";")
    .map((part) => {
      const index = part.indexOf("=");
      if (index <= 0) return null;
      const name = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      return name ? { name, value } : null;
    })
    .filter((cookie): cookie is { name: string; value: string } => Boolean(cookie));
}

function clearCookie(name: string) {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; Path=/; Max-Age=${400 * 24 * 60 * 60}; SameSite=Lax`;
}

/**
 * The server session is the account. A browser Supabase client that still
 * holds the guest cookie must not paint over that.
 */
export function AuthSession({ account }: { account: AccountKind }) {
  useEffect(() => {
    const pairs = cookiesFromDocument();
    const plan = reconcileAuthCookies(pairs);
    if (plan) {
      for (const name of plan.drop) clearCookie(name);
      if (plan.replace) {
        for (const cookie of plan.set) writeCookie(cookie.name, cookie.value);
      }
    }
    const visible = cookiesFromDocument();
    const cookieUser = readSupabaseCookieUser(visible);
    const cookieMember = Boolean(cookieUser?.email && !cookieUser.is_anonymous);
    if (account !== "member" && cookieMember) {
      const guard = "pr_auth_hydrate";
      if (sessionStorage.getItem(guard) === "1") return;
      sessionStorage.setItem(guard, "1");
      location.reload();
      return;
    }
    if (account === "member") sessionStorage.removeItem("pr_auth_hydrate");
    if (account !== "member" && !cookieMember) return;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const supabase = createBrowserClient(url, key);
    let cancelled = false;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      const current = data.session?.user;
      if (current?.email && !current.is_anonymous) return;
      const tokens = readSupabaseCookieTokens(cookiesFromDocument());
      if (!tokens) return;
      await supabase.auth.setSession(tokens);
    });
    return () => {
      cancelled = true;
    };
  }, [account]);

  return null;
}
