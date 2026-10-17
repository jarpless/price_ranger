"use client";

import { useEffect, useState } from "react";

import { pricedView, type Adjustment, type MoneyLine } from "@/lib/guide/pricing";
import { priceFarFromRange } from "@/lib/market-shared";
import { formatUsd } from "@/lib/money";

const listeners = new Set<(cents: number | null) => void>();

/** The price field reports each keystroke here so the total can move before Save. */
export function publishAskingDraft(cents: number | null) {
  for (const listen of listeners) listen(cents);
}

function useAskingDraft(initial: number | null): number | null {
  const [draft, setDraft] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    const listen = (cents: number | null) => setDraft(cents);
    listeners.add(listen);
    return () => {
      listeners.delete(listen);
    };
  }, []);
  useEffect(() => {
    setDraft(undefined);
  }, [initial]);
  if (draft == null) return initial;
  return draft;
}

function usePricedView(lines: MoneyLine[], adjustment: Adjustment, askingCents: number | null) {
  const draft = useAskingDraft(askingCents);
  return pricedView(lines, draft, adjustment);
}

export function AskingTotal({
  lines,
  adjustment,
  askingCents,
  lowCents,
  highCents,
  className,
}: {
  lines: MoneyLine[];
  adjustment: Adjustment;
  askingCents: number | null;
  lowCents: number | null;
  highCents: number | null;
  className: string;
}) {
  const view = usePricedView(lines, adjustment, askingCents);
  const far = priceFarFromRange(view.totalCents, lowCents, highCents);
  const range = lowCents != null && highCents != null ? `${formatUsd(lowCents)}–${formatUsd(highCents)}` : "";
  return (
    <>
      <p data-spotlight="asking-price" className={className}>
        {view.totalCents != null ? formatUsd(view.totalCents) : "—"}
      </p>
      {far && range ? (
        <p role="status" className="mt-2 text-body leading-6 text-danger">
          That&apos;s far from the sold range of {range}.
        </p>
      ) : null}
    </>
  );
}

export function AskingLines({
  lines,
  adjustment,
  askingCents,
}: {
  lines: MoneyLine[];
  adjustment: Adjustment;
  askingCents: number | null;
}) {
  const view = usePricedView(lines, adjustment, askingCents);
  if (view.lines.length === 0) return null;
  return (
    <ul className="mt-4 border-t border-line pt-2">
      {view.lines.map((line, index) => (
        <li key={`${line.name}-${index}`} className="line-row">
          <span className="list-copy">
            <span className="list-title">{line.name}</span>
            {line.detail ? <span className="text-caption text-muted">{line.detail}</span> : null}
          </span>
          <span className="list-price">{line.price}</span>
        </li>
      ))}
      <li className="line-row">
        <span className="list-title">Total</span>
        <span className="list-price">{view.totalCents != null ? formatUsd(view.totalCents) : "—"}</span>
      </li>
    </ul>
  );
}
