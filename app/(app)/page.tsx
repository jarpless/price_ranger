import { PendingLink as Link } from "@/components/pending-link";
import { redirect } from "next/navigation";

import { startSample } from "@/app/guide-actions";
import { GuideSetupNotice } from "@/components/guide-setup-notice";
import { PrimaryDock } from "@/components/primary-dock";
import { SubmitButton } from "@/components/ui";
import { Landing } from "@/components/landing";
import { getSessionUser } from "@/lib/auth";
import { planStatusLine, pricingAccess } from "@/lib/guide/access";
import { ensureGuideUser, listGuideQuotes, type GuideQuote } from "@/lib/guide/store";
import { formatUsd } from "@/lib/money";
import { PLANS } from "@/lib/plans";
import { vocabulary } from "@/lib/vocabulary";

export const metadata = { title: "Home" };

function statusLabel(quote: GuideQuote): string {
  if (quote.outcome === "sold") return "Sold";
  if (quote.outcome === "not_yet") return "Not yet";
  if (quote.sharedAt) return "Link ready";
  if (!quote.finishedAt) return "Resume";
  return "Draft";
}

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) return <Landing />;
  const guide = await ensureGuideUser(user.id);
  if (!guide.tosAcceptedAt) redirect("/welcome");
  const quotes = await listGuideQuotes(user.id);
  const access = await pricingAccess(user);
  const locked = !access.ok;
  const plan = PLANS[user.plan];
  const industry = user.industry ? vocabulary(user.industry).label : null;
  const primaryHref = locked ? "/upgrade" : "/new";
  const primaryLabel = locked ? "Upgrade" : "New price";

  if (quotes.length === 0) {
    return (
      <div>
        <GuideSetupNotice />
        <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-10 lg:py-4">
          <div>
            <h1 className="font-serif text-display text-balance lg:text-[2.5rem] lg:leading-[3rem]">You&apos;re set.</h1>
            <p className="mt-3 max-w-xl text-body leading-6 text-muted">
              {industry ? `Pricing as ${industry}. ` : ""}
              Add a photo or a few words, check the price, then send the link.
            </p>
            {industry ? (
              <p className="mt-3 text-body font-semibold">{industry}</p>
            ) : (
              <Link href="/start" className="mt-4 inline-flex h-12 items-center whitespace-nowrap text-base font-semibold text-pine">
                What are you pricing?
              </Link>
            )}
            <form action={startSample} className="mt-4">
              <SubmitButton className="h-12 whitespace-nowrap text-base font-semibold text-pine">
                Try a sample
              </SubmitButton>
            </form>
            <PrimaryDock>
              <Link
                href={primaryHref}
                data-haptic=""
                className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl bg-pine text-base font-semibold text-cream lg:w-auto lg:min-w-48 lg:px-6"
              >
                {primaryLabel}
              </Link>
            </PrimaryDock>
          </div>
          <ol className="mt-8 space-y-4 lg:mt-0">
            {[
              ["1", "Add a photo"],
              ["2", "Check the price"],
              ["3", "Send the link"],
            ].map(([step, label]) => (
              <li key={step}>
                <Link href="/new" className="block rounded-2xl border border-line bg-paper p-4 shadow-card">
                  <p className="text-caption font-semibold text-pine">{step}</p>
                  <p className="mt-1 text-base font-semibold">{label}</p>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  const soldCents = quotes.filter((quote) => quote.outcome === "sold").reduce((sum, quote) => sum + (quote.priceCents || 0), 0);
  const soldRounded = Math.round(soldCents / 100) * 100;

  return (
    <div>
      <GuideSetupNotice />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-10">
        <div>
          <h1 className="font-serif text-display lg:text-[2.5rem] lg:leading-[3rem]">Your prices</h1>
          {soldRounded > 0 ? <p className="mt-2 text-body">Sold {formatUsd(soldRounded)}</p> : null}
          <p className="mt-2 text-body text-muted">
            {industry ? `${industry}. ` : ""}
            Pick up a draft, or start a new one.
          </p>
          {!industry ? (
            <Link href="/start" className="mt-3 inline-flex h-12 items-center whitespace-nowrap text-base font-semibold text-pine">
              What are you pricing?
            </Link>
          ) : null}
          <ul className="mt-6 overflow-hidden rounded-2xl border border-line bg-paper shadow-card">
            {quotes.slice(0, 12).map((quote) => (
              <li key={quote.quoteId} className="border-b border-line last:border-b-0">
                <Link href={`/guide/${quote.quoteId}`} className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 lg:h-10 lg:min-h-10 lg:py-0">
                  <span className="min-w-0">
                    <span className="block truncate text-base font-semibold">{quote.description || "Untitled"}</span>
                    <span className="text-caption text-muted">
                      {quote.sample ? "Sample · " : ""}
                      {statusLabel(quote)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-serif text-title tabular-nums text-pine lg:text-base">
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
          <Link href="/upgrade" className="mt-4 inline-flex h-12 items-center whitespace-nowrap text-base font-semibold text-pine">
            See plans
          </Link>
        </aside>
      </div>
      <PrimaryDock>
        <Link
          href={primaryHref}
          data-haptic=""
          className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl bg-pine text-base font-semibold text-cream lg:w-auto lg:min-w-48 lg:px-6"
        >
          {primaryLabel}
        </Link>
      </PrimaryDock>
    </div>
  );
}
