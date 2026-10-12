"use client";

import { useState } from "react";

export function PasskeyButton() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    setMessage("");
    try {
      const { signInWithPasskey } = await import("@/lib/passkey-client");
      const error = await signInWithPasskey();
      setMessage(error ?? "Signed in.");
      if (!error) window.location.assign("/");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void signIn()}
        disabled={pending}
        aria-busy={pending}
        className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-line bg-paper text-base font-semibold text-ink hover:border-pine disabled:opacity-60"
      >
        {pending ? "Checking this device…" : "Sign in with a passkey"}
      </button>
      {message ? <p className="mt-2 text-sm text-muted">{message}</p> : null}
    </div>
  );
}

export function PasskeyOffer() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function register() {
    setPending(true);
    try {
      const { registerPasskey } = await import("@/lib/passkey-client");
      setMessage(await registerPasskey());
    } finally {
      setPending(false);
    }
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
        disabled={pending}
        aria-busy={pending}
        className="mt-4 inline-flex h-11 items-center rounded-2xl bg-pine px-4 text-sm font-semibold text-cream disabled:opacity-60"
      >
        {pending ? "Saving…" : "Add a passkey"}
      </button>
      {message ? <p className="mt-2 text-sm text-muted">{message}</p> : null}
    </section>
  );
}
