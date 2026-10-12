"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { TourStep } from "@/lib/store/basecamp";

import { Spotlight } from "./spotlight";

export function TourPlayer({ steps }: { steps: TourStep[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(false);
  const step = steps[index];

  if (!step) return <p className="text-sm text-muted">This tour has no steps.</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted">
        This replay only points at the screen. It does not change your prices or quotes again.
      </p>
      <ol className="space-y-2">
        {steps.map((item, itemIndex) => (
          <li key={`${item.spotlight}-${itemIndex}`} className="rounded-2xl border border-line bg-paper px-3 py-2 text-sm">
            {itemIndex + 1}. {item.caption}
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="h-12 rounded-2xl bg-pine px-4 text-sm font-semibold text-cream"
        onClick={() => {
          setActive(true);
          if (step.href.startsWith("/")) router.push(step.href);
        }}
      >
        Show me
      </button>
      {active ? (
        <Spotlight
          selector={step.spotlight}
          caption={`${step.caption} Step ${index + 1} of ${steps.length}.`}
          onStop={() => setActive(false)}
        />
      ) : null}
      {active ? (
        <div className="fixed bottom-6 right-6 z-[90] flex gap-2">
          <button
            type="button"
            className="h-11 rounded-2xl bg-paper px-4 text-sm font-semibold text-ink shadow"
            onClick={() => {
              const next = Math.min(steps.length - 1, index + 1);
              setIndex(next);
              const href = steps[next]?.href;
              if (href?.startsWith("/")) router.push(href);
            }}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
