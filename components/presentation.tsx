"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Logo } from "@/components/logo";
import { formatUsd } from "@/lib/money";
import type { PresentedSnapshot } from "@/lib/types";

export function Presentation({ quoteId, snapshot }: { quoteId: string; snapshot: PresentedSnapshot }) {
  const [index, setIndex] = useState(0);
  const greeting = snapshot.customerName
    ? `${snapshot.customerName}, here are your options`
    : "Here are your options";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      setIndex((current) => {
        const next =
          event.key === "ArrowRight"
            ? Math.min(snapshot.tiers.length - 1, current + 1)
            : Math.max(0, current - 1);
        const wide = window.matchMedia("(min-width: 1024px)").matches;
        if (!wide) {
          document.getElementById(snapshot.tiers[next]?.id || "")?.scrollIntoView({ behavior: "smooth", inline: "start" });
        }
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [snapshot.tiers]);

  return (
    <main data-spotlight="present-deck" className="flex min-h-dvh w-full flex-col bg-pine-deep text-cream">
      <header className="flex items-center gap-3 px-4 pb-2 pt-4 lg:px-8">
        <Logo tone="light" width={40} height={40} className="h-10 w-10" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Price Ranger</p>
          <h1 className="truncate font-serif text-lg lg:text-2xl">{greeting}</h1>
        </div>
        <Link href={`/quotes/${quoteId}`} className="ml-auto shrink-0 text-sm font-semibold">
          Done
        </Link>
      </header>
      <p className="px-4 pb-3 text-sm text-cream/75 lg:px-8">{snapshot.title}</p>

      <div className="deck lg:hidden">
        {snapshot.tiers.map((tier) => (
          <section key={tier.id} id={tier.id} className="px-4 py-3">
            <TierCard tier={tier} />
          </section>
        ))}
      </div>
      {snapshot.tiers.length > 1 ? (
        <div className="flex justify-center gap-2 px-4 pb-6 lg:hidden">
          {snapshot.tiers.map((tier, tierIndex) => (
            <a
              key={tier.id}
              href={`#${tier.id}`}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-cream/40 text-sm font-semibold"
            >
              {tierIndex + 1}
            </a>
          ))}
        </div>
      ) : (
        <div className="h-6 lg:hidden" />
      )}

      <div
        className="hidden min-h-0 flex-1 gap-4 px-8 pb-10 lg:grid"
        style={{ gridTemplateColumns: `repeat(${Math.min(3, Math.max(snapshot.tiers.length, 1))}, minmax(0, 1fr))` }}
      >
        {snapshot.tiers.slice(0, 3).map((tier, tierIndex) => (
          <div key={tier.id} className={tierIndex === index ? "rounded-[28px] ring-2 ring-gold" : ""}>
            <TierCard tier={tier} />
          </div>
        ))}
      </div>
      <p className="hidden px-8 pb-4 text-center text-xs text-cream/60 lg:block">Arrow keys move between options.</p>
    </main>
  );
}

function TierCard({
  tier,
}: {
  tier: PresentedSnapshot["tiers"][number];
}) {
  return (
    <article className="flex h-full min-h-[68dvh] flex-col rounded-[28px] bg-cream p-5 text-ink lg:min-h-0 lg:p-8">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-4xl lg:text-5xl">{tier.name}</h2>
        {tier.recommended ? (
          <span className="rounded-full bg-pine px-2 py-1 text-xs font-semibold text-cream">Recommended</span>
        ) : null}
      </div>
      {tier.note ? <p className="mt-2 text-sm leading-relaxed text-muted">{tier.note}</p> : null}
      <p className="mt-6 font-serif text-5xl text-pine lg:text-6xl">{formatUsd(tier.totalCents)}</p>
      <p className="text-sm text-muted">Total</p>
      <div className="mt-6 space-y-4">
        {tier.groups.length === 0 ? (
          <p className="text-sm text-muted">Nothing is included in this option yet.</p>
        ) : (
          tier.groups.map((group) => (
            <div key={group.id} className="border-t border-line pt-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-semibold">{group.name}</h3>
                <span className="font-serif text-lg">{formatUsd(group.totalCents)}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted">{group.summary}</p>
            </div>
          ))
        )}
      </div>
    </article>
  );
}
