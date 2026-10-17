import { PendingLink as Link } from "@/components/pending-link";
import { notFound } from "next/navigation";

import { QuoteRows, SegTabs } from "@/components/quote-rows";
import { requireUser } from "@/lib/auth";
import { listGuideQuotes } from "@/lib/guide/store";
import { formatUsd } from "@/lib/money";
import { TRADE_VIEWS, isTradeView, quoteTrade, newPriceHref, tradeById, tradeHref, viewLabel } from "@/lib/trades";

export async function generateMetadata({ params }: { params: Promise<{ trade: string }> }) {
  const { trade } = await params;
  return { title: tradeById(trade)?.label ?? "Trade" };
}

export default async function TradePage({ params }: { params: Promise<{ trade: string; view?: string[] }> }) {
  const { trade: tradeId, view: segments } = await params;
  const trade = tradeById(tradeId);
  const view = segments?.[0];
  if (!trade || (segments && (segments.length > 1 || !isTradeView(view)))) notFound();
  const user = await requireUser();
  const mine = (await listGuideQuotes(user.id)).filter((quote) => quoteTrade(quote)?.trade.id === trade.id);
  const open = mine.filter((quote) => quote.outcome !== "sold");
  const sold = mine.filter((quote) => quote.outcome === "sold");
  const soldCents = sold.reduce((sum, quote) => sum + (quote.priceCents || 0), 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
      <h1 className="font-serif text-display text-balance">{trade.label}</h1>
      <SegTabs
        label={`${trade.label} views`}
        tabs={[
          { href: tradeHref(trade), label: "Price", active: !view },
          ...TRADE_VIEWS.map((key) => ({
            href: tradeHref(trade, key),
            label: viewLabel(trade, key),
            count: key === "quotes" ? open.length : key === "sold" ? sold.length : undefined,
            active: view === key,
          })),
        ]}
      />

      {!view ? (
        <>
          <p className="text-caption font-semibold uppercase tracking-[0.14em] text-muted">Tap what you&apos;re pricing</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {trade.subcategories.map((subcategory) => (
              <li key={subcategory.id}>
                <Link
                  href={newPriceHref(trade, subcategory)}
                  data-haptic=""
                  className="flex h-14 items-center rounded-xl border border-line bg-paper px-3 text-sm font-semibold leading-5 hover:border-pine lg:h-11"
                >
                  {subcategory.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-baseline justify-between">
            <p className="text-caption font-semibold uppercase tracking-[0.14em] text-muted">Recent</p>
            {open.length > 5 ? (
              <Link href={tradeHref(trade, "quotes")} className="text-sm font-semibold text-pine">
                All {open.length}
              </Link>
            ) : null}
          </div>
          <QuoteRows quotes={open.slice(0, 5)} empty="Nothing here yet. Tap a category above." showTrade={false} />
        </>
      ) : null}

      {view === "quotes" ? <QuoteRows quotes={open} empty={`No ${trade.quotesLabel.toLowerCase()} yet.`} showTrade={false} /> : null}

      {view === "sold" ? (
        <>
          {sold.length > 0 ? (
            <p className="text-body">
              Sold <span className="font-semibold tabular-nums">{formatUsd(soldCents)}</span> across {sold.length}
            </p>
          ) : null}
          <QuoteRows quotes={sold} empty="Nothing sold yet." showTrade={false} />
        </>
      ) : null}

      {view === "tools" ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {trade.tools.map((tool) => (
            <li key={tool.href}>
              <Link href={tool.href} className="block rounded-xl border border-line bg-paper px-3 py-2.5 hover:border-pine">
                <span className="block text-sm font-semibold">{tool.label}</span>
                <span className="block text-caption text-muted">{tool.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
