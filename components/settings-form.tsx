"use client";

import { PendingLink as Link } from "@/components/pending-link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { toggleFeedbackMode } from "@/app/basecamp-actions";

export function SettingsForm({ feedbackEnabled }: { feedbackEnabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(feedbackEnabled);
  const [error, setError] = useState("");

  return (
    <section className="rounded-3xl border border-line bg-paper p-5">
      <h2 className="font-serif text-2xl">Feedback mode</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Owner only. When this is on, a Feedback button lets you drag a region, attach the route and version, and save a bug or feature note.
      </p>
      <label className="mt-4 flex items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          checked={on}
          onChange={async (event) => {
            const next = event.target.checked;
            setOn(next);
            const result = await toggleFeedbackMode(next);
            if (!result.ok) {
              setOn(!next);
              setError(result.error);
              return;
            }
            setError("");
            router.refresh();
          }}
        />
        Show the feedback button
      </label>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <Link href="/feedback" className="mt-4 inline-block text-sm font-semibold text-pine">
        Feedback inbox
      </Link>
    </section>
  );
}
