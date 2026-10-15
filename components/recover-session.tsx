"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect } from "react";

/**
 * Signup confirmation leaves the session in the URL fragment. The browser
 * Supabase client writes that session into its storage and cookies, which
 * survive a reload. A server-only setSession does not.
 */
export function RecoverSession() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hash = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
      const accessToken = hash.get("access_token") || "";
      const refreshToken = hash.get("refresh_token") || "";
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!accessToken || !refreshToken || !url || !key) {
        location.replace("/signin?error=link");
        return;
      }
      // Drop the fragment before the client starts, so it cannot clear the
      // session it is about to store.
      history.replaceState(null, "", `${location.pathname}${location.search}`);
      const supabase = createBrowserClient(url, key);
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (cancelled) return;
      if (error) {
        location.replace("/signin?error=link");
        return;
      }
      const response = await fetch("/auth/callback/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
      });
      const body = (await response.json().catch(() => null)) as { next?: string } | null;
      if (cancelled) return;
      location.replace(response.ok && body?.next ? body.next : "/signin?error=link");
    })().catch(() => {
      if (!cancelled) location.replace("/signin?error=link");
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
