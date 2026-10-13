"use client";

import { useState } from "react";

import { acceptTerms } from "@/app/guide-actions";
import { PrimaryDock } from "@/components/primary-dock";
import { Button } from "@/components/ui";
import type { OnboardingCopy } from "@/lib/guide/flow";

const BAR_LABELS = ["Welcome", "Steps", "Agree"];

export function WelcomeSlides({ copy, error, next = "" }: { copy: OnboardingCopy; error: boolean; next?: string }) {
  const [step, setStep] = useState(0);
  const screens = [
    { title: copy.welcomeTitle, body: copy.welcomeBody },
    { title: copy.stepsTitle, body: copy.stepsBody },
    { title: copy.termsTitle, body: copy.termsBody },
  ];
  const current = screens[step];

  return (
    <div className="lg:py-10">
      <p className="text-caption font-semibold text-pine">Intro {step + 1} of 3</p>
      <ol className="mt-3 flex gap-2" aria-label="Intro progress">
        {screens.map((screen, index) => (
          <li key={screen.title} className="min-w-0 flex-1">
            <div className={`h-1 rounded-full ${index <= step ? "bg-pine" : "bg-line"}`} />
            <p className={`mt-2 whitespace-nowrap text-center text-caption font-semibold ${index === step ? "text-ink" : "text-muted"}`}>
              {BAR_LABELS[index]}
            </p>
          </li>
        ))}
      </ol>
      <h1 className="mt-6 font-serif text-display text-balance lg:text-[2.5rem] lg:leading-[3rem]">{current.title}</h1>
      <p className="mt-3 max-w-xl text-body leading-6 text-muted">{current.body}</p>
      {step < 2 ? (
        <PrimaryDock>
          <button
            type="button"
            data-haptic=""
            onClick={() => setStep(step + 1)}
            className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl bg-pine text-base font-semibold text-cream lg:w-auto lg:min-w-48 lg:px-6"
          >
            Next
          </button>
        </PrimaryDock>
      ) : (
        <form action={acceptTerms} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <label className="flex items-start gap-3 rounded-2xl border border-line bg-paper p-4 text-body leading-6 shadow-card">
            <input name="acceptTerms" type="checkbox" required className="h-12 w-12 shrink-0" />
            <span>
              I agree to the <a className="font-semibold text-pine underline" href="/terms">Terms</a> and{" "}
              <a className="font-semibold text-pine underline" href="/privacy">Privacy Policy</a>. Closing this tab keeps
              this draft on this device. Anonymized prices may be used in group benchmarks.
            </span>
          </label>
          {error ? <p className="text-body text-danger">Check the box to continue.</p> : null}
          <PrimaryDock>
            <Button type="submit">Continue</Button>
          </PrimaryDock>
        </form>
      )}
    </div>
  );
}
