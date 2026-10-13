"use client";

import { useState } from "react";

import { acceptTerms } from "@/app/guide-actions";
import { Button } from "@/components/ui";
import type { OnboardingCopy } from "@/lib/guide/flow";

export function WelcomeSlides({ copy, error }: { copy: OnboardingCopy; error: boolean }) {
  const [step, setStep] = useState(0);
  const screens = [
    { title: copy.welcomeTitle, body: copy.welcomeBody },
    { title: copy.stepsTitle, body: copy.stepsBody },
    { title: copy.termsTitle, body: copy.termsBody },
  ];
  const current = screens[step];

  return (
    <div className="mx-auto flex min-h-[70dvh] w-full max-w-lg flex-col justify-center lg:max-w-xl">
      <p className="text-sm font-semibold text-pine">Intro {step + 1} of 3</p>
      <div className="mt-3 flex gap-2" aria-hidden="true">
        {screens.map((screen, index) => (
          <div key={screen.title} className={`h-2 flex-1 rounded-full ${index <= step ? "bg-pine" : "bg-line"}`} />
        ))}
      </div>
      <h1 className="mt-6 font-serif text-5xl leading-tight">{current.title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">{current.body}</p>
      {step < 2 ? (
        <button
          type="button"
          onClick={() => setStep(step + 1)}
          className="mt-8 inline-flex h-14 w-full items-center justify-center rounded-2xl bg-pine text-lg font-semibold text-cream"
        >
          Next
        </button>
      ) : (
        <form action={acceptTerms} className="mt-8 space-y-4">
          <label className="flex items-start gap-3 rounded-3xl border border-line bg-paper p-4 text-base leading-relaxed">
            <input name="acceptTerms" type="checkbox" required className="mt-1 h-6 w-6 shrink-0" />
            <span>
              I agree to the <a className="font-semibold text-pine underline" href="/terms">Terms</a> and{" "}
              <a className="font-semibold text-pine underline" href="/privacy">Privacy Policy</a>. Anonymized,
              de-identified pricing and outcome data is used for aggregate benchmarks and insights.
            </span>
          </label>
          {error ? <p className="text-base text-danger">Check the box to continue.</p> : null}
          <Button type="submit" className="h-14 text-lg">
            Continue
          </Button>
        </form>
      )}
    </div>
  );
}
