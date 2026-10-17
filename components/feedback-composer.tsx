"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { readConsoleErrors } from "./console-buffer";
import { deviceId } from "./capture-shot";

export function FeedbackComposer({
  preview,
  blob,
  source,
  route,
  onClose,
}: {
  preview: string;
  blob: Blob;
  source: "desktop" | "mobile" | "shake";
  route: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [extras, setExtras] = useState<File[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setStatus("");
    const form = new FormData();
    form.set("title", title);
    form.set("body", body);
    form.set("route", route);
    form.set("source", source);
    form.set("viewport", `${window.innerWidth}x${window.innerHeight}`);
    form.set("userAgent", navigator.userAgent);
    form.set("consoleErrors", JSON.stringify(readConsoleErrors()));
    form.set("deviceId", deviceId());
    form.set("screenshot", blob, "region.png");
    for (const file of extras) form.append("images", file);
    const response = await fetch("/api/feedback", { method: "POST", body: form });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; href?: string };
    setBusy(false);
    if (!response.ok || !payload.href) {
      setStatus(payload.error || "Could not save that note.");
      return;
    }
    router.push(payload.href);
    router.refresh();
  }

  return (
    <form
      data-feedback-chrome="true"
      className="fixed inset-0 z-[80] overflow-y-auto bg-cream px-4 py-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="mx-auto max-w-[40rem]">
        <h2 className="font-serif text-display">Send feedback</h2>
        <p className="mt-2 text-body text-muted">The screenshot is attached. Add a title and a note if you want, and any other photos.</p>
        <label className="mt-6 block text-body font-semibold">
          Title
          <input
            value={title}
            maxLength={80}
            placeholder="Short title"
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 h-12 w-full rounded-2xl border border-line bg-paper px-4 text-body font-normal outline-none focus:border-pine"
          />
        </label>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="Screenshot for this note" className="mt-6 max-h-64 w-full rounded-2xl border border-line bg-paper object-contain shadow-card" />
        <label className="mt-6 block text-body font-semibold">
          What happened?
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="mt-2 min-h-28 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-body outline-none focus:border-pine"
          />
        </label>
        <label className="mt-4 flex h-12 cursor-pointer items-center justify-center whitespace-nowrap rounded-2xl border border-line bg-paper px-4 text-base font-semibold">
          Add photos
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(event) => setExtras(Array.from(event.target.files || []).slice(0, 4))}
          />
        </label>
        {extras.length > 0 ? <p className="mt-2 text-caption text-muted">{extras.length} more photo{extras.length === 1 ? "" : "s"} attached.</p> : null}
        {status ? <p className="mt-3 text-body text-danger">{status}</p> : null}
        <div className="mt-6 flex gap-3">
          <button disabled={busy} className="inline-flex h-12 min-w-48 flex-1 items-center justify-center whitespace-nowrap rounded-2xl bg-pine text-base font-semibold text-cream disabled:opacity-50">
            {busy ? "Sending" : "Send"}
          </button>
          <button type="button" onClick={onClose} className="inline-flex h-12 items-center justify-center whitespace-nowrap px-4 text-base font-semibold text-pine">
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
