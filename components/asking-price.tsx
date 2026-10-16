"use client";

import { useEffect, useState } from "react";

import { priceFarFromRange } from "@/lib/market";
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

export function AskingTotal({
  itemCents,
  extraCents,
  lowCents,
  highCents,
  className,
}: {
  itemCents: number | null;
  extraCents: number;
  lowCents: number | null;
  highCents: number | null;
  className: string;
}) {
  const item = useAskingDraft(itemCents);
  const total = item == null ? null : item + extraCents;
  const far = priceFarFromRange(item, lowCents, highCents);
  const range = lowCents != null && highCents != null ? `${formatUsd(lowCents)}–${formatUsd(highCents)}` : "";
  return (
    <>
      <p data-spotlight="asking-price" className={className}>
        {total != null ? formatUsd(total) : "—"}
      </p>
      {far && range ? (
        <p role="status" className="mt-2 text-body leading-6 text-danger">
          That&apos;s far from the sold range of {range}.
        </p>
      ) : null}
    </>
  );
}

export function AskingLineTotal({ itemCents, extraCents }: { itemCents: number | null; extraCents: number }) {
  const item = useAskingDraft(itemCents);
  const total = item == null ? null : item + extraCents;
  return <>{total != null ? formatUsd(total) : "—"}</>;
}
