import { startCheckout } from "@/app/guide-actions";
import { PrimaryDock } from "@/components/primary-dock";
import { Button } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { stripeTestKey } from "@/lib/billing";
import { planStatusLine, pricingAccess } from "@/lib/guide/access";
import { listGuideQuotes, recordFunnel } from "@/lib/guide/store";
import { formatUsd } from "@/lib/money";
import { PLANS } from "@/lib/plans";

export const metadata = { title: "Upgrade" };

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; canceled?: string }>;
}) {
  const { canceled } = await searchParams;
  const user = await requireUser();
  const access = await pricingAccess(user);
  await recordFunnel(user.id, "upgrade_viewed", { variant: access.guide.variant, source: "page" });
  const ready = Boolean(stripeTestKey());
  const quotes = await listGuideQuotes(user.id);

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10">
      <div>
      <h1 className="font-serif text-display text-balance lg:text-[2.5rem] lg:leading-[3rem]">Keep your prices</h1>
      <p className="mt-3 text-body leading-6">{planStatusLine(access)}</p>
      <p className="mt-3 max-w-xl text-body leading-6 text-muted">
        Plus keeps the prices you already saved and lets you price new ones.
      </p>
      {canceled ? <p className="mt-4 text-body">Checkout was canceled. Your prices are still here.</p> : null}
      {quotes.length > 0 ? (
        <ul className="mt-6 overflow-hidden rounded-2xl border border-line bg-paper shadow-card">
          {quotes.map((quote) => (
            <li key={quote.quoteId} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
              <span className="truncate text-base font-semibold">{quote.description || "Untitled"}</span>
              <span className="shrink-0 font-serif text-title tabular-nums">{quote.priceCents != null ? formatUsd(quote.priceCents) : ""}</span>
            </li>
          ))}
        </ul>
      ) : null}
      </div>
      <section className="mt-6 rounded-2xl border border-line bg-paper p-5 shadow-card lg:mt-0">
        <p className="font-serif text-title">{PLANS.plus.name}</p>
        <p className="mt-1 text-body">{PLANS.plus.priceLabel}</p>
        {ready ? (
          <form action={startCheckout} className="mt-4">
            <PrimaryDock>
              <Button type="submit">Upgrade</Button>
            </PrimaryDock>
          </form>
        ) : (
          <p className="mt-4 text-body leading-6">Payments are coming soon.</p>
        )}
      </section>
    </div>
  );
}
