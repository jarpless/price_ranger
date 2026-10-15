"use client";

import { useEffect, useState } from "react";

import { acceptTerms } from "@/app/guide-actions";
import { PendingLink } from "@/components/pending-link";
import { PrimaryDock } from "@/components/primary-dock";
import { Button } from "@/components/ui";
import type { OnboardingCopy } from "@/lib/guide/flow";

const TERMS_KEY = "pr_terms_checked";

export function WelcomeSlides({
  copy,
  error,
  next = "",
  account,
}: {
  copy: OnboardingCopy;
  error: boolean;
  next?: string;
  account: "member" | "guest";
}) {
  const guest = account === "guest";
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(TERMS_KEY) === "1") setAccepted(true);
    } catch {
      // sessionStorage can be unavailable.
    }
  }, []);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-caption font-semibold text-pine">Get started</p>
        {guest ? (
          <PendingLink href="/signin" className="inline-flex h-11 items-center whitespace-nowrap rounded-2xl bg-pine px-4 text-base font-semibold text-cream lg:hidden">
            Sign in
          </PendingLink>
        ) : null}
      </div>
      <div className="mt-3 h-1 rounded-full bg-pine" aria-hidden="true" />
      <div className="mt-8 grid items-start gap-8 lg:mt-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <h1 className="font-serif text-display text-balance lg:text-[2.5rem] lg:leading-[3rem]">{copy.welcomeTitle}</h1>
          <p className="mt-3 max-w-xl text-body leading-6 text-muted">{copy.welcomeBody}</p>
          <p className="mt-3 max-w-xl text-body leading-6 text-muted">{copy.stepsBody}</p>
          {guest ? <p className="mt-2 text-caption text-muted lg:hidden">Already have an account? Sign in.</p> : null}
          <form action={acceptTerms} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={next} />
            <label className="flex items-start gap-3 rounded-2xl border border-line bg-paper p-4 text-body leading-6 shadow-card">
              <input
                name="acceptTerms"
                type="checkbox"
                required
                checked={accepted}
                onChange={(event) => {
                  const next = event.target.checked;
                  setAccepted(next);
                  try {
                    window.sessionStorage.setItem(TERMS_KEY, next ? "1" : "0");
                  } catch {
                    // The checkbox still submits with the form.
                  }
                }}
                className="mt-1 h-6 w-6 shrink-0"
              />
              <span>
                I agree to the <a className="font-semibold text-pine underline" href="/terms">Terms</a> and{" "}
                <a className="font-semibold text-pine underline" href="/privacy">Privacy Policy</a>. This draft stays on
                this device until you save an account. Anonymized prices may be used in group benchmarks.
              </span>
            </label>
            {error ? <p className="text-body text-danger">Check the box to continue.</p> : null}
            <PrimaryDock>
              <Button type="submit">Continue</Button>
            </PrimaryDock>
          </form>
        </div>
        <div className="rounded-3xl border border-line bg-paper p-6 shadow-card" aria-hidden="true">
          <p className="text-caption font-semibold text-muted">Preview</p>
          <p className="mt-3 font-serif text-title">Nintendo Switch</p>
          <p className="mt-2 font-serif text-price text-pine tabular-nums">$175</p>
          <p className="text-body text-muted">$150–$200 · Good · High confidence</p>
        </div>
      </div>
    </div>
  );
}
