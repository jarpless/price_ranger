import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { formatUsd } from "@/lib/money";
import { getData } from "@/lib/store";

export const metadata = { title: "Presentation" };

export default async function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const quote = await (await getData()).getQuote(user.id, id);
  if (!quote) notFound();
  const snapshot = quote.presentedSnapshot;

  if (!snapshot) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center bg-pine-deep px-6 text-cream">
        <h1 className="font-serif text-3xl">Nothing to present yet</h1>
        <p className="mt-3 text-sm leading-relaxed text-cream/80">
          Open the quote and tap Present to save a customer copy.
        </p>
        <Link href={`/quotes/${id}`} className="mt-6 font-semibold text-gold">
          Back to quote
        </Link>
      </main>
    );
  }

  const greeting = snapshot.customerName
    ? `${snapshot.customerName}, here are your options`
    : "Here are your options";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-pine-deep text-cream">
      <header className="flex items-center gap-3 px-4 pb-2 pt-4">
        <Image src="/images/logo-mark.png" alt="" width={40} height={40} className="h-10 w-10" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Price Ranger</p>
          <h1 className="truncate font-serif text-lg">{greeting}</h1>
        </div>
        <Link href={`/quotes/${id}`} className="ml-auto shrink-0 text-sm font-semibold">
          Done
        </Link>
      </header>
      <p className="px-4 pb-2 text-sm text-cream/75">{snapshot.title}</p>
      {snapshot.tiers.length > 1 ? (
        <p className="px-4 pb-1 text-xs font-medium uppercase tracking-wide text-cream/60">
          Swipe for more options
        </p>
      ) : null}
      <div className="deck">
        {snapshot.tiers.map((tier) => (
          <section key={tier.id} id={tier.id} className="px-4 py-3">
            <article className="flex min-h-[68dvh] flex-col rounded-[28px] bg-cream p-5 text-ink">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-serif text-4xl">{tier.name}</h2>
                {tier.recommended ? (
                  <span className="rounded-full bg-pine px-2 py-1 text-xs font-semibold text-cream">
                    Recommended
                  </span>
                ) : null}
              </div>
              {tier.note ? <p className="mt-2 text-sm leading-relaxed text-muted">{tier.note}</p> : null}
              <p className="mt-6 font-serif text-5xl text-pine">{formatUsd(tier.totalCents)}</p>
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
          </section>
        ))}
      </div>
      {snapshot.tiers.length > 1 ? (
        <div className="flex justify-center gap-2 px-4 pb-6">
          {snapshot.tiers.map((tier, index) => (
            <a
              key={tier.id}
              href={`#${tier.id}`}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-cream/40 text-sm font-semibold"
            >
              {index + 1}
            </a>
          ))}
        </div>
      ) : (
        <div className="h-6" />
      )}
    </main>
  );
}
