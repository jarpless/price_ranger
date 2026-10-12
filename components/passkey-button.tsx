"use client";

import { useState } from "react";

import { createBrowserClient } from "@supabase/ssr";

export function PasskeyButton() {
  const [message, setMessage] = useState("");

  async function signIn() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setMessage("Passkeys need Supabase.");
      return;
    }
    const supabase = createBrowserClient(url, key);
    const { error } = await supabase.auth.signInWithPasskey();
    setMessage(error ? error.message : "Signed in.");
    if (!error) window.location.assign("/");
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void signIn()}
        className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-line bg-paper text-base font-semibold text-ink hover:border-pine"
      >
        Sign in with a passkey
      </button>
      {message ? <p className="mt-2 text-sm text-muted">{message}</p> : null}
    </div>
  );
}

export function PasskeyOffer() {
  const [message, setMessage] = useState("");

  async function register() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const supabase = createBrowserClient(url, key);
    const { error } = await supabase.auth.registerPasskey();
    setMessage(
      error
        ? error.message
        : "Passkey saved on this device. Supabase has to have Passkeys turned on for this to succeed.",
    );
  }

  return (
    <section className="rounded-3xl border border-line bg-paper p-5">
      <h2 className="font-serif text-2xl">Passkey</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Add a passkey so this device can sign in without a code. Turn on Passkeys in the Supabase dashboard first.
      </p>
      <button
        type="button"
        onClick={() => void register()}
        className="mt-4 inline-flex h-11 items-center rounded-2xl bg-pine px-4 text-sm font-semibold text-cream"
      >
        Add a passkey
      </button>
      {message ? <p className="mt-2 text-sm text-muted">{message}</p> : null}
    </section>
  );
}
