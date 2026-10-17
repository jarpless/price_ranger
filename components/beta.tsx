"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { PendingLink as Link } from "@/components/pending-link";
import { BETA_DISCLOSURE, BETA_NOTE_DISMISSED_KEY } from "@/lib/beta";

import { captureShot, deviceId } from "./capture-shot";

export type BetaEvent =
  | "beta_tag_tapped"
  | "beta_disclosure_shown"
  | "beta_disclosure_feedback_tapped"
  | "feature_request_opened"
  | "feature_request_submitted";

/** App events have no props column, so props ride on the route as a query string. */
export function trackEvent(name: BetaEvent, props: Record<string, string> = {}) {
  const query = new URLSearchParams(props).toString();
  const route = `${window.location.pathname}${query ? `?${query}` : ""}`.slice(0, 200);
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, route, deviceId: deviceId() }),
  }).catch(() => undefined);
}

const pillBase =
  "relative inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-semibold uppercase leading-none tracking-[0.08em] before:absolute before:-inset-x-2 before:-inset-y-3 before:content-['']";

const pillTone = {
  pine: "border border-cream/45 text-cream/90 hover:bg-white/10",
  light: "border border-pine/30 bg-pine/[0.06] text-pine hover:bg-pine/10",
} as const;

export function BetaPill({ tone = "light" }: { tone?: keyof typeof pillTone }) {
  return <span className={`${pillBase} ${pillTone[tone]} before:hidden`}>Beta</span>;
}

/** The tag beside the wordmark. Tapping it opens the disclosure. */
export function BetaTag({
  tone = "light",
  signedIn = true,
  className = "",
}: {
  tone?: keyof typeof pillTone;
  signedIn?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-beta-tag="true"
        aria-haspopup="dialog"
        aria-label="Beta. What this means"
        onClick={() => {
          if (signedIn) trackEvent("beta_tag_tapped");
          setOpen(true);
        }}
        className={`${pillBase} ${pillTone[tone]} ${className}`}
      >
        Beta
      </button>
      {open ? <BetaSheet signedIn={signedIn} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

const SHOT_KEY = "pr-feedback-shot";
const ROUTE_KEY = "pr-feedback-route";
export const CONTEXT_KEY = "pr-feedback-context";

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

export function BetaSheet({ signedIn, onClose }: { signedIn: boolean; onClose: () => void }) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (signedIn) trackEvent("beta_disclosure_shown", { from: "tag" });
  }, [signedIn]);

  useEffect(() => {
    if (!mounted) return;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [mounted, onClose]);

  async function shareFeedback() {
    if (busy) return;
    trackEvent("beta_disclosure_feedback_tapped");
    setBusy(true);
    const route = `${window.location.pathname}${window.location.search}`.slice(0, 200);
    onClose();
    await nextFrame();
    try {
      const shot = await captureShot(null);
      window.sessionStorage.setItem(SHOT_KEY, shot.preview);
    } catch {
      window.sessionStorage.removeItem(SHOT_KEY);
    }
    window.sessionStorage.setItem(ROUTE_KEY, route);
    window.sessionStorage.setItem(CONTEXT_KEY, "beta");
    router.push("/feedback/new?shot=1&from=beta");
  }

  if (!mounted) return null;

  return createPortal(
    <div
      data-feedback-chrome="true"
      data-beta-sheet="true"
      className="fixed inset-0 z-[95] flex items-end justify-center bg-ink/40 lg:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="beta-sheet-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-t-3xl bg-paper px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 text-ink shadow-[0_-8px_32px_rgba(28,25,21,0.18)] outline-none lg:rounded-3xl lg:pb-6 lg:pt-6"
      >
        <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-line lg:hidden" />
        <BetaPill />
        <h2 id="beta-sheet-title" className="mt-3 font-serif text-title text-balance">
          {BETA_DISCLOSURE.title}
        </h2>
        <p className="mt-2 text-body leading-6">{BETA_DISCLOSURE.body}</p>
        <p className="mt-3 text-body leading-6 text-muted">{BETA_DISCLOSURE.meaning}</p>
        <div className="mt-6 flex flex-col gap-2">
          {signedIn ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void shareFeedback()}
              className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-2xl bg-pine px-4 text-base font-semibold text-cream active:opacity-70 disabled:opacity-50"
            >
              Share feedback
            </button>
          ) : (
            <Link
              href="/feedback/new"
              onClick={onClose}
              className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-2xl bg-pine px-4 text-base font-semibold text-cream active:opacity-70"
            >
              Share feedback
            </Link>
          )}
          <Link
            href="/feedback/trade?from=beta"
            onClick={onClose}
            className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-2xl border border-line bg-paper px-4 text-base font-semibold text-ink active:opacity-70"
          >
            Request a feature for your trade
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-12 items-center justify-center whitespace-nowrap px-4 text-base font-semibold text-pine"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The inline disclosure. `home` is the first-run card and can be dismissed;
 * the tag in the header keeps it reachable. `plans` and `about` always show.
 */
export function BetaNote({ variant }: { variant: "home" | "plans" | "about" }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(variant !== "home");
  const [open, setOpen] = useState(false);
  const shown = useRef(false);

  useEffect(() => {
    if (variant !== "home") return;
    try {
      setVisible(window.localStorage.getItem(BETA_NOTE_DISMISSED_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, [variant]);

  useEffect(() => {
    if (!visible || shown.current) return;
    shown.current = true;
    trackEvent("beta_disclosure_shown", { from: variant });
  }, [visible, variant, pathname]);

  if (!visible) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(BETA_NOTE_DISMISSED_KEY, "1");
    } catch {
      // Private mode. The note comes back next visit, and the tag still opens it.
    }
    setVisible(false);
  }

  return (
    <section data-beta-note={variant} className="rounded-2xl border border-line bg-paper px-4 py-3 shadow-card">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <BetaPill />
          <p className="mt-2 text-body leading-6">{BETA_DISCLOSURE.body}</p>
        </div>
        {variant === "home" ? (
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-cream"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
              <path d="M5 5l10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-11 items-center whitespace-nowrap text-base font-semibold text-pine"
        >
          What beta means
        </button>
        <Link
          href={`/feedback/trade?from=${variant}`}
          className="inline-flex h-11 items-center whitespace-nowrap text-base font-semibold text-pine"
        >
          Request a feature
        </Link>
      </div>
      {open ? <BetaSheet signedIn onClose={() => setOpen(false)} /> : null}
    </section>
  );
}
