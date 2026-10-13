import { PendingLink as Link } from "@/components/pending-link";
import { redirect } from "next/navigation";

import { startSample } from "@/app/guide-actions";
import { GuideSetupNotice } from "@/components/guide-setup-notice";
import { PrimaryDock } from "@/components/primary-dock";
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
      <div>
        <GuideSetupNotice />
        <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-16">
        <div>
        <h1 className="font-serif text-display text-balance lg:text-[2.5rem] lg:leading-[3rem]">{copy.welcomeTitle}</h1>
        <p className="mt-3 max-w-xl text-body leading-6 text-muted">{copy.welcomeBody}</p>
        {draft ? (
          <Link href={`/guide/${draft.quoteId}`} className="mt-6 inline-flex h-12 items-center whitespace-nowrap text-base font-semibold text-pine">
            Continue draft
          </Link>
        ) : (
          <form action={startSample} className="mt-6">
            <SubmitButton className="h-12 whitespace-nowrap text-base font-semibold text-pine">
              Try a sample
            </SubmitButton>
          </form>
        )}
        <PrimaryDock>
          <Link
            href={locked ? "/upgrade" : "/new"}
            data-haptic=""
            className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl bg-pine text-base font-semibold text-cream lg:w-auto lg:min-w-48 lg:px-6"
          >
            New price
          </Link>
        </PrimaryDock>
        </div>
        <ol className="mt-8 hidden space-y-4 lg:block">
          <li className="rounded-2xl border border-line bg-paper p-4 shadow-card">
            <p className="text-caption font-semibold text-pine">1</p>
            <p className="mt-1 text-base font-semibold">Add a photo</p>
          </li>
          <li className="rounded-2xl border border-line bg-paper p-4 shadow-card">
            <p className="text-caption font-semibold text-pine">2</p>
            <p className="mt-1 text-base font-semibold">Check the price</p>
          </li>
          <li className="rounded-2xl border border-line bg-paper p-4 shadow-card">
            <p className="text-caption font-semibold text-pine">3</p>
            <p className="mt-1 text-base font-semibold">Send the link</p>
          </li>
        </ol>
        </div>
      </div>
    );
  }

  const draft = quotes.find((quote) => !quote.finishedAt);
  const waiting = quotes.find((quote) => quote.sharedAt && !quote.outcome);
  const plan = PLANS[user.plan];

  return (
    <div>
      <GuideSetupNotice />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-10">
        <div>
          <h1 className="font-serif text-display lg:text-[2.5rem] lg:leading-[3rem]">Your prices</h1>
          <p className="mt-2 text-body text-muted">Pick up a draft, or start a new one.</p>
          {draft ? (
            <Link href={locked ? "/upgrade" : `/guide/${draft.quoteId}`} className="mt-6 block rounded-2xl border border-line bg-paper p-4 shadow-card">
              <p className="text-caption font-semibold text-pine">Continue</p>
              <p className="mt-1 truncate font-serif text-title">{draft.description || "Unfinished price"}</p>
            </Link>
          ) : null}
          {waiting ? (
            <Link href={`/guide/${waiting.quoteId}`} className="mt-3 block rounded-2xl bg-paper p-4 shadow-card">
              <p className="text-caption font-semibold text-pine">What's next</p>
              <p className="mt-1 text-body">Mark “{waiting.description || "this price"}” sold when you know.</p>
            </Link>
          ) : null}
          <ul className="mt-6 overflow-hidden rounded-2xl border border-line bg-paper shadow-card">
            {quotes.slice(0, 8).map((quote) => (
              <li key={quote.quoteId} className="border-b border-line last:border-b-0">
                <Link
                  href={locked ? "/upgrade" : `/guide/${quote.quoteId}`}
                  className="flex h-16 items-center justify-between gap-3 px-4"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-base font-semibold">{quote.description || "Untitled"}</span>
                    <span className="text-caption text-muted">{quote.sample ? "Sample · " : ""}{statusLabel(quote)}</span>
                  </span>
                  <span className="shrink-0 font-serif text-title text-pine tabular-nums">
                    {quote.priceCents != null ? formatUsd(quote.priceCents) : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <aside className="mt-6 h-fit rounded-2xl border border-line bg-paper p-5 shadow-card lg:mt-0">
          <p className="text-caption font-semibold text-muted">Your plan</p>
          <p className="mt-1 font-serif text-title">{plan.name}</p>
          <p className="mt-3 text-body leading-6">{planStatusLine(access)}</p>
          <Link href="/upgrade" data-haptic="" className="mt-5 inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl bg-pine px-4 text-base font-semibold text-cream">
            Upgrade
          </Link>
        </aside>
      </div>
      <PrimaryDock>
        <Link
          href={locked ? "/upgrade" : "/new"}
          data-haptic=""
          className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl bg-pine text-base font-semibold text-cream lg:w-auto lg:min-w-48 lg:px-6"
        >
          New price
        </Link>
      </PrimaryDock>
    </div>
  );
}
