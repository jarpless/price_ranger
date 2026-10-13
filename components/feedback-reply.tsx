"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FeedbackReply({ id }: { id: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        const response = await fetch(`/api/feedback/${id}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setBusy(false);
        if (!response.ok) {
          setError(payload.error || "Could not send that reply.");
          return;
        }
        setBody("");
        router.refresh();
      }}
    >
      <label className="block text-body font-semibold">
        Reply
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          className="mt-2 min-h-24 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-body outline-none focus:border-pine"
        />
      </label>
      {error ? <p className="mt-2 text-body text-danger">{error}</p> : null}
      <button disabled={busy} className="mt-3 inline-flex h-12 min-w-48 items-center justify-center whitespace-nowrap rounded-2xl bg-pine px-4 text-base font-semibold text-cream disabled:opacity-50">
        {busy ? "Sending" : "Send reply"}
      </button>
    </form>
  );
}
