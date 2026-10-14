"use client";

import { useRef, useState } from "react";

import { applyAdjustment } from "@/app/guide-actions";

export function PriceSlider({ quoteId }: { quoteId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [percent, setPercent] = useState(0);
  const label = percent === 0 ? "Suggested" : `${percent > 0 ? "+" : ""}${percent}%`;

  function commit() {
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={applyAdjustment} className="space-y-2">
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="kind" value="slider" />
      <input type="hidden" name="percent" value={String(percent)} />
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
        onPointerUp={commit}
        onKeyUp={(event) => {
          if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") commit();
        }}
        className="h-12 w-full accent-pine"
      />
    </form>
  );
}
