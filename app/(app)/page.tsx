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
      <div className="page-stack">
        <GuideSetupNotice />
        <div className="content-split">
          <div className="page-stack">
            <h1 className="font-serif text-display text-balance lg:text-[2.5rem] lg:leading-[3rem]">You&apos;re set.</h1>
            <p className="max-w-xl text-body leading-6 text-muted">
              {industry ? `Pricing as ${industry}. ` : ""}
              Add a photo or a few words, check the price, then send the link.
            </p>
            {industry ? (
              <p className="text-body font-semibold">{industry}</p>
            ) : (
              <Link href="/start" className="inline-flex h-12 items-center whitespace-nowrap text-base font-semibold text-pine">
                What are you pricing?
              </Link>
            )}
            <form action={startSample}>
              <SubmitButton className="h-12 whitespace-nowrap text-base font-semibold text-pine">
                Try a sample
              </SubmitButton>
            </form>
          </div>
          <ol className="page-stack">
            {[
              ["1", "Add a photo"],
              ["2", "Check the price"],
              ["3", "Send the link"],
            ].map(([step, label]) => (
              <li key={step}>
                <Link href="/new" className="surface block">
                  <p className="text-caption font-semibold text-pine">{step}</p>
                  <p className="mt-1 text-base font-semibold">{label}</p>
                </Link>
              </li>
            ))}
          </ol>
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

  const soldCents = quotes.filter((quote) => quote.outcome === "sold").reduce((sum, quote) => sum + (quote.priceCents || 0), 0);
  const soldRounded = Math.round(soldCents / 100) * 100;

  return (
    <div className="page-stack">
      <GuideSetupNotice />
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
      </div>
      <div className="content-split">
        <ul className="list-card">
          {quotes.slice(0, 12).map((quote) => (
            <li key={quote.quoteId}>
              <Link href={`/guide/${quote.quoteId}`} className="list-row">
                <span className="list-copy">
                  <span className="list-title">{quote.description || "Untitled"}</span>
                  <span className="list-meta">
                    {quote.sample ? <span className="pill">Sample</span> : null}
                    <span className={quote.outcome === "sold" ? "pill pill-sold" : "pill"}>{statusLabel(quote)}</span>
                  </span>
                </span>
                <span className="list-price">{quote.priceCents != null ? formatUsd(quote.priceCents) : ""}</span>
              </Link>
            </li>
          ))}
        </ul>
        <aside className="surface">
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
