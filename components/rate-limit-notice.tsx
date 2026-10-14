"use client";

import { useEffect, useState } from "react";

import { sendMagicLink } from "@/app/actions";

export function RateLimitNotice({ seconds, email }: { seconds: number; email: string }) {
  const [left, setLeft] = useState(Math.max(1, seconds || 60));

  useEffect(() => {
    if (left <= 0) return;
    const id = window.setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(id);
  }, [left]);

  const ready = left <= 0;

  return (
    <div role="alert" className="rounded-2xl bg-[#f8f1df] px-4 py-3 text-body leading-6 text-ink">
      <p>{ready ? "You can request another code now." : `You can request another code in ${left} seconds.`}</p>
      <form action={sendMagicLink} className="mt-3">
        <input type="hidden" name="email" value={email} />
        <button
          type="submit"
          disabled={!ready || !email}
          className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-pine text-base font-semibold text-cream disabled:opacity-50"
        >
          {ready ? "Resend code" : "Resend code"}
        </button>
      </form>
    </div>
  );
}
