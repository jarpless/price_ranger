"use client";

import { createBrowserClient } from "@supabase/ssr";

function browserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

export async function signInWithPasskey(): Promise<string | null> {
  const supabase = browserClient();
  if (!supabase) return "Passkeys need Supabase.";
  const { error } = await supabase.auth.signInWithPasskey();
  return error ? error.message : null;
}

export async function registerPasskey(): Promise<string> {
  const supabase = browserClient();
  if (!supabase) return "Passkeys need Supabase.";
  const { error } = await supabase.auth.registerPasskey();
  return error
    ? error.message
    : "Passkey saved on this device. Supabase has to have Passkeys turned on for this to succeed.";
}
