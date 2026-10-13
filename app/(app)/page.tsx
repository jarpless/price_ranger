import { PendingLink as Link } from "@/components/pending-link";
import { redirect } from "next/navigation";

import { startSample } from "@/app/guide-actions";
import { SubmitButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { planStatusLine, pricingAccess } from "@/lib/guide/access";
import { onboardingCopy } from "@/lib/guide/flow";
import { ensureGuideUser, listGuideQuotes, type GuideQuote } from "@/lib/guide/store";
import { formatUsd } from "@/lib/money";
import { PLANS } from "@/lib/plans";

export const metadata = { title: "Home" };

function statusLabel(quote: GuideQuote): string {
  if (quote.outcome === "sold") return "Sold";
  if (quote.outcome === "not_yet") return "Not yet";
  if (quote.sharedAt) return "Sent";
  return "Draft";
}

export default async function HomePage() {
  const user = await requireUser();
  const guide = await ensureGuideUser(user.id);
  if (!guide.tosAcceptedAt) redirect("/welcome");
  const quotes = await listGuideQuotes(user.id);
  const finished = quotes.filter((quote) => quote.finishedAt);
  const access = await pricingAccess(user);
  const locked = !access.ok;

  if (finished.length === 0) {
    const draft = quotes.find((quote) => !quote.finishedAt);
    const copy = onboardingCopy(guide.variant);
    return (
      <div className="mx-auto flex min-h-[70dvh] w-full max-w-lg flex-col justify-center lg:max-w-xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-gold">Start here</p>
        <h1 className="mt-2 font-serif text-5xl leading-tight">{copy.welcomeTitle}</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">{copy.welcomeBody}</p>
        <Link
          href={locked ? "/upgrade" : "/new"}
          className="mt-8 inline-flex h-16 w-full items-center justify-center rounded-3xl bg-pine text-xl font-semibold text-cream"
        >
          Price something
        </Link>
        {draft ? (
          <Link href={`/guide/${draft.quoteId}`} className="mt-4 text-center text-base font-semibold text-pine">
            Continue {draft.description || "your price"}
          </Link>
        ) : (
          <form action={startSample} className="mt-3">
            <SubmitButton className="h-12 w-full text-base font-semibold text-pine">
              Try a sample quote
            </SubmitButton>
          </form>
        )}
      </div>
    );
  }

  const draft = quotes.find((quote) => !quote.finishedAt);
  const waiting = quotes.find((quote) => quote.sharedAt && !quote.outcome);
  const plan = PLANS[user.plan];

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
      <div>
        <h1 className="font-serif text-5xl leading-tight">Your prices</h1>
        <p className="mt-3 text-lg text-muted">Pick up a draft, or start a new one.</p>
        <Link
          href={locked ? "/upgrade" : "/new"}
          className="mt-6 inline-flex h-14 w-full items-center justify-center rounded-2xl bg-pine text-lg font-semibold text-cream lg:w-auto lg:px-8"
        >
          New price
        </Link>
        {draft ? (
          <Link href={locked ? "/upgrade" : `/guide/${draft.quoteId}`} className="mt-5 block rounded-3xl border border-line bg-paper p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-pine">Pick up where you left off</p>
            <p className="mt-1 font-serif text-3xl">{draft.description || "Unfinished price"}</p>
          </Link>
        ) : null}
        {waiting ? (
          <Link href={`/guide/${waiting.quoteId}`} className="mt-4 block rounded-3xl bg-[#f8f1df] p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-pine">What's next</p>
            <p className="mt-1 text-lg">Mark “{waiting.description || "this price"}” sold when you know.</p>
          </Link>
        ) : null}
        <ul className="mt-6 space-y-3">
          {quotes.slice(0, 8).map((quote) => (
            <li key={quote.quoteId}>
              <Link
                href={locked ? "/upgrade" : `/guide/${quote.quoteId}`}
                className="flex items-center justify-between gap-3 rounded-3xl border border-line bg-paper p-4"
              >
                <span>
                  <span className="block font-serif text-2xl">{quote.description || "Untitled"}</span>
                  <span className="text-sm text-muted">{quote.sample ? "Sample · " : ""}{statusLabel(quote)}</span>
                </span>
                <span className="font-serif text-2xl text-pine">
                  {quote.priceCents != null ? formatUsd(quote.priceCents) : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <aside className="h-fit rounded-3xl border border-line bg-paper p-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">Your plan</p>
        <p className="mt-1 font-serif text-4xl">{plan.name}</p>
        <p className="mt-3 text-base leading-relaxed">{planStatusLine(access)}</p>
        <Link href="/upgrade" className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-pine text-base font-semibold text-cream">
          {locked ? "Upgrade to keep your prices" : "See upgrade options"}
        </Link>
      </aside>
    </div>
  );
}
