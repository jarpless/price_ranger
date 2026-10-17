import { PendingLink as Link } from "@/components/pending-link";
import { redirect } from "next/navigation";

import { startSample } from "@/app/guide-actions";
import { GuideSetupNotice } from "@/components/guide-setup-notice";
import { IconCamera } from "@/components/icons";
import { PrimaryDock } from "@/components/primary-dock";
import { SubmitButton } from "@/components/ui";
import { Landing } from "@/components/landing";
import { QuoteRows, timeAgo } from "@/components/quote-rows";
import { getSessionUser } from "@/lib/auth";
import { planStatusLine, pricingAccess } from "@/lib/guide/access";
import { ensureGuideUser, listGuideQuotes } from "@/lib/guide/store";
import { formatUsd } from "@/lib/money";
import { itemStatus, type ItemStatus } from "@/lib/trades";
import { vocabulary } from "@/lib/vocabulary";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) return <Landing />;
  const guide = await ensureGuideUser(user.id);
  if (!guide.tosAcceptedAt) redirect("/welcome");
  const quotes = await listGuideQuotes(user.id);
  const access = await pricingAccess(user);
  const locked = !access.ok;
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

  const counts = { drafts: 0, priced: 0, shared: 0, sold: 0 } as Record<ItemStatus, number>;
  for (const quote of quotes) counts[itemStatus(quote)] += 1;
  const soldCents = quotes.filter((quote) => quote.outcome === "sold").reduce((sum, quote) => sum + (quote.priceCents || 0), 0);
  const firstDraft = quotes.find((quote) => itemStatus(quote) === "drafts");
  const actions = [
    { key: "drafts", label: "Finish", value: String(counts.drafts), href: counts.drafts === 1 && firstDraft ? `/guide/${firstDraft.quoteId}` : "/items/drafts", hot: counts.drafts > 0 },
    { key: "priced", label: "Send", value: String(counts.priced), href: "/items/priced", hot: counts.priced > 0 },
    { key: "shared", label: "Mark sold", value: String(counts.shared), href: "/items/shared", hot: counts.shared > 0 },
    { key: "sold", label: "Sold", value: formatUsd(Math.round(soldCents / 100) * 100), href: "/items/sold", hot: false },
  ];
  const activity = quotes
    .flatMap((quote) => {
      const name = quote.description || "Untitled";
      const events: { at: string; verb: string; name: string; id: string }[] = [];
      if (quote.outcome === "sold") events.push({ at: quote.updatedAt, verb: "Sold", name, id: quote.quoteId });
      if (quote.sharedAt) events.push({ at: quote.sharedAt, verb: "Sent", name, id: quote.quoteId });
      if (quote.finishedAt) events.push({ at: quote.finishedAt, verb: "Priced", name, id: quote.quoteId });
      if (events.length === 0) events.push({ at: quote.updatedAt, verb: "Started", name, id: quote.quoteId });
      return events;
    })
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);
  const newPrice = (
    <Link
      href={primaryHref}
      data-haptic=""
      className="inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-pine text-base font-semibold text-cream lg:h-10 lg:w-auto lg:rounded-xl lg:px-5"
    >
      <IconCamera className="h-5 w-5" />
      {primaryLabel}
    </Link>
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3" data-home="dashboard">
      <GuideSetupNotice />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-display">Home</h1>
          {industry ? (
            <p className="truncate text-caption text-muted">{industry}</p>
          ) : (
            <Link href="/start" className="text-caption font-semibold text-pine">
              What are you pricing?
            </Link>
          )}
        </div>
        <div className="hidden lg:block">{newPrice}</div>
      </div>
      <div className="lg:hidden">{newPrice}</div>

      <ul className="grid grid-cols-4 gap-2" aria-label="Next actions">
        {actions.map((action) => (
          <li key={action.key}>
            <Link
              href={action.href}
              className={`flex h-16 flex-col justify-center rounded-xl border px-2 lg:h-14 lg:px-3 ${action.hot ? "border-pine bg-paper" : "border-line bg-paper/60"}`}
            >
              <span className={`truncate font-serif text-xl font-medium leading-6 tabular-nums ${action.hot ? "text-pine" : "text-ink"}`}>{action.value}</span>
              <span className="truncate text-caption font-semibold text-muted">{action.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <section className="min-w-0" aria-labelledby="home-recent">
          <div className="mb-1.5 flex items-baseline justify-between">
            <h2 id="home-recent" className="text-caption font-semibold uppercase tracking-[0.14em] text-muted">
              Recent quotes
            </h2>
            <Link href="/items" className="text-sm font-semibold text-pine">
              All {quotes.length}
            </Link>
          </div>
          <QuoteRows quotes={quotes.slice(0, 8)} empty="Nothing yet." />
        </section>
        <aside className="flex min-w-0 flex-col gap-3">
          <section aria-labelledby="home-activity">
            <h2 id="home-activity" className="mb-1.5 text-caption font-semibold uppercase tracking-[0.14em] text-muted">
              Activity
            </h2>
            <ol className="rounded-2xl border border-line bg-paper px-3 py-1">
              {activity.map((event) => (
                <li key={`${event.id}-${event.verb}`} className="flex items-center gap-2 py-1.5 text-sm [&+&]:border-t [&+&]:border-line">
                  <span className={`w-14 shrink-0 font-semibold ${event.verb === "Sold" ? "text-pine" : "text-ink"}`}>{event.verb}</span>
                  <Link href={`/guide/${event.id}`} className="min-w-0 flex-1 truncate text-muted hover:text-ink">
                    {event.name}
                  </Link>
                  <span className="shrink-0 text-caption tabular-nums text-muted">{timeAgo(event.at)}</span>
                </li>
              ))}
            </ol>
          </section>
          <section className="rounded-2xl border border-line bg-paper px-3 py-2.5">
            <p className="text-caption font-semibold text-muted">Your plan</p>
            <p className="mt-0.5 text-sm leading-5">{planStatusLine(access)}</p>
            <Link href="/upgrade" className="mt-1 inline-flex h-8 items-center text-sm font-semibold text-pine">
              See plans
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
