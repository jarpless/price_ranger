"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);

  return (
    <main className="page-frame page-frame-pad flex min-h-dvh flex-col justify-center">
      <div className="mx-auto w-full max-w-md">
      <h1 className="font-serif text-4xl">Something went wrong</h1>
      <p className="mt-3 text-body leading-6 text-muted">
        {online
          ? "That didn't go through. Try again in a minute. If you were adding a photo, add one line instead."
          : "You're offline, or this page didn't load. Try again when you have a connection."}
      </p>
      <Link href="/signin" className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl border border-line px-4 font-semibold">
        Sign in
      </Link>
      <button
        type="button"
        onClick={reset}
        className="mt-6 h-12 rounded-2xl bg-pine font-semibold text-cream"
      >
        Try again
      </button>
      </div>
    </main>
  );
}
