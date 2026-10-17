"use client";

import { useEffect, useRef, useState } from "react";

import { PendingLink as Link } from "@/components/pending-link";
import { NEED_MIN_LENGTH, TRADES, needIsValid, type TradeId } from "@/lib/beta";

import { trackEvent } from "./beta";
import { deviceId } from "./capture-shot";

export function FeatureRequestForm({
  initialTrade,
  canFollowUp,
  from,
}: {
  initialTrade: TradeId | null;
  canFollowUp: boolean;
  from: string;
}) {
  const [trade, setTrade] = useState<TradeId | null>(initialTrade);
  const [need, setNeed] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedHref, setSavedHref] = useState("");
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    trackEvent("feature_request_opened", { from });
  }, [from]);

  const ready = Boolean(trade) && needIsValid(need);

  async function submit() {
    if (!trade || !needIsValid(need) || busy) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("requestType", "feature_request");
    form.set("trade", trade);
    form.set("need", need);
    form.set("followUp", followUp ? "1" : "0");
    form.set("route", `/feedback/trade?from=${from}`.slice(0, 200));
    form.set("source", window.matchMedia("(max-width: 1023px)").matches ? "mobile" : "desktop");
    form.set("viewport", `${window.innerWidth}x${window.innerHeight}`);
    form.set("userAgent", navigator.userAgent);
    form.set("deviceId", deviceId());
    const response = await fetch("/api/feedback", { method: "POST", body: form }).catch(() => null);
    const payload = (await response?.json().catch(() => ({}))) as { error?: string; href?: string } | undefined;
    setBusy(false);
    if (!response?.ok || !payload?.href) {
      setError(payload?.error || "Could not send that. Try again.");
      return;
    }
    trackEvent("feature_request_submitted", { trade });
    setSavedHref(payload.href);
  }

  if (savedHref) {
    return (
      <div className="mx-auto max-w-[40rem]" data-feature-request="sent">
        <h1 className="font-serif text-display text-balance">Thanks, we got it.</h1>
        <p className="mt-2 text-body leading-6 text-muted">
          Requests from people who use Price Ranger every day shape what we build next.
          {followUp ? " We'll email you if there's news on this one." : ""}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link href="/" className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-2xl bg-pine px-6 text-base font-semibold text-cream">
            Done
          </Link>
          <Link href={savedHref} className="inline-flex h-12 items-center justify-center whitespace-nowrap px-4 text-base font-semibold text-pine">
            View your request
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      data-feature-request="form"
      className="mx-auto max-w-[40rem]"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h1 className="font-serif text-display text-balance">Request a feature for your trade</h1>
      <p className="mt-2 text-body leading-6 text-muted">Tell us what would make Price Ranger work better for how you use it.</p>

      <fieldset className="mt-6">
        <legend className="text-body font-semibold">Who is it for?</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {TRADES.map((item) => {
            const active = trade === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setTrade(item.id);
                  setError("");
                }}
                className={`inline-flex h-11 items-center whitespace-nowrap rounded-full border px-4 text-base font-semibold active:opacity-70 ${
                  active ? "border-pine bg-pine text-cream" : "border-line bg-paper text-ink"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="mt-6 block text-body font-semibold">
        What do you need?
        <textarea
          value={need}
          required
          minLength={NEED_MIN_LENGTH}
          maxLength={1500}
          onChange={(event) => setNeed(event.target.value)}
          placeholder="For example, a materials line on job quotes"
          aria-describedby="need-hint"
          className="mt-2 min-h-28 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-body font-normal outline-none placeholder:text-muted/70 focus:border-pine"
        />
        <span id="need-hint" className="mt-1 block text-caption font-normal text-muted">
          A sentence is plenty.
        </span>
      </label>

      {canFollowUp ? (
        <label className="mt-2 flex min-h-12 cursor-pointer items-center gap-3 text-body leading-6">
          <input
            type="checkbox"
            checked={followUp}
            onChange={(event) => setFollowUp(event.target.checked)}
            className="h-5 w-5 shrink-0 accent-[#1e4636]"
          />
          Email me if there&apos;s news on this
        </label>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-body text-danger">
          {error}
        </p>
      ) : null}

      <div data-request-footer="true" className="sticky bottom-0 z-10 -mx-4 mt-4 bg-cream px-4 pb-3 pt-3 shadow-[0_-12px_12px_-12px_rgba(28,25,21,0.18)] lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:shadow-none">
        <button
          disabled={!ready || busy}
          aria-disabled={!ready || busy}
          data-haptic=""
          className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl bg-pine text-base font-semibold text-cream active:opacity-70 disabled:bg-line disabled:text-muted lg:w-auto lg:min-w-48 lg:px-6"
        >
          {busy ? "Sending" : "Send request"}
        </button>
      </div>
    </form>
  );
}
