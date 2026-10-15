"use client";

import { useEffect, useState } from "react";

import { sendMagicLink } from "@/app/actions";
import { rateLimitCopy } from "@/lib/auth-errors";
import { PendingLink } from "@/components/pending-link";

export function RateLimitNotice({ seconds, email }: { seconds: number; email: string }) {
  const wait = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
  const [left, setLeft] = useState(wait);

  useEffect(() => {
    const id = window.setInterval(() => {
      setLeft((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const ready = left <= 0;
  const hourly = wait >= 3600;

  return (
    <div role="alert" className="rounded-2xl bg-[#f8f1df] px-4 py-3 text-body leading-6 text-ink">
      <p>{ready ? "You can request another email now." : rateLimitCopy(left)}</p>
      {hourly ? (
        <PendingLink href="/signin" className="mt-3 inline-flex h-12 items-center font-semibold text-pine">
          Sign in with your password
        </PendingLink>
      ) : null}
      <form action={sendMagicLink} className="mt-3">
        <input type="hidden" name="email" value={email} />
        <button
          type="submit"
          disabled={!ready || !email}
          className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-pine text-base font-semibold text-cream disabled:opacity-50"
        >
          Send again
        </button>
      </form>
    </div>
  );
}
