"use client";

import { useRef, useState } from "react";

import { applyAdjustment } from "@/app/guide-actions";
import { nudgedCents } from "@/lib/guide/pricing";
import { dollarsInputValue } from "@/lib/money";

export function PriceSlider({ quoteId, suggestedCents }: { quoteId: string; suggestedCents: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [percent, setPercent] = useState(0);
  const nextCents = nudgedCents(suggestedCents, percent);
  const label = percent === 0 ? "Suggested" : `${percent > 0 ? "+" : ""}${percent}%`;

  function commit(nextPercent: number) {
    setPercent(nextPercent);
    const input = formRef.current?.elements.namedItem("amount");
    if (input instanceof HTMLInputElement) {
      input.value = dollarsInputValue(nudgedCents(suggestedCents, nextPercent));
    }
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={applyAdjustment} className="space-y-2">
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="kind" value="price" />
      <input type="hidden" name="amount" value={dollarsInputValue(nextCents)} />
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-base font-semibold">Nudge the price</p>
        <p className="shrink-0 font-serif text-title tabular-nums">{label}</p>
      </div>
      <input
        type="range"
        min={-40}
        max={40}
        step={5}
        value={percent}
        aria-valuetext={label}
        aria-label="Nudge the price"
        onChange={(event) => setPercent(Number(event.target.value))}
        onPointerUp={(event) => commit(Number(event.currentTarget.value))}
        onKeyUp={(event) => {
          if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") {
            commit(Number(event.currentTarget.value));
          }
        }}
        className="h-12 w-full accent-pine"
      />
      <p className="text-caption text-muted">Suggested is {dollarsInputValue(suggestedCents) ? `$${dollarsInputValue(suggestedCents)}` : "the original price"}. Resetting the slider returns to it.</p>
    </form>
  );
}
