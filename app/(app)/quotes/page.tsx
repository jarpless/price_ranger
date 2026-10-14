import { PendingLink as Link } from "@/components/pending-link";

import { requireUser } from "@/lib/auth";
import { listGuideQuotes } from "@/lib/guide/store";
import { formatUsd, priceSpan } from "@/lib/money";
import { getData } from "@/lib/store";
import { vocabulary } from "@/lib/vocabulary";

export const metadata = { title: "Quotes" };

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const user = await requireUser();
  const words = vocabulary(user.industry);
  const needle = q.trim().toLowerCase();
  const guideQuotes = await listGuideQuotes(user.id);
  const guideById = new Map(guideQuotes.map((quote) => [quote.quoteId, quote]));
  const quotes = (await (await getData()).listQuotes(user.id)).filter((quote) => {
    if (!needle) return true;
    return `${quote.customerName} ${quote.title}`.toLowerCase().includes(needle);
  });

  return (
    <div className="page-stack">
      <h1 className="font-serif text-4xl">{words.quotes}</h1>
      <form method="get" className="flex gap-2">
        <input
          data-shortcut="search"
          name="q"
          defaultValue={q}
          placeholder={`Search ${words.quotes.toLowerCase()}`}
          className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-paper px-4 text-base outline-none focus:border-pine"
        />
      </form>
      <Link
        href="/new"
        className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-pine text-base font-semibold text-cream lg:w-auto lg:px-6"
      >
        New price
      </Link>
      <Link href="/quotes/new" className="inline-flex h-12 items-center whitespace-nowrap text-base font-semibold text-pine">
        Build a detailed quote
      </Link>
      {quotes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-paper px-4 py-8 text-center">
          <p className="font-serif text-2xl">No {words.quotes.toLowerCase()} yet</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Price something from Home, or add prices and group them here.
          </p>
        </div>
      ) : (
        <ul className="card-grid card-grid-3">
          {quotes.map((quote) => {
            const guide = guideById.get(quote.id);
            const status = guide?.outcome === "sold"
              ? "Sold"
              : guide?.outcome === "not_yet"
                ? "Not yet"
                : guide?.sharedAt
                  ? "Sent"
                  : quote.status === "presented"
                    ? "Presented"
                    : "Draft";
            const amount = guide?.priceCents != null ? formatUsd(guide.priceCents) : priceSpan(quote.totals);
            return (
            <li key={quote.id}>
              <Link href={`/quotes/${quote.id}`} className="surface lift flex h-full flex-col">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="min-w-0 truncate font-serif text-title">{quote.customerName}</h2>
                  <span className={status === "Sold" ? "pill pill-sold" : "pill"}>{status}</span>
                </div>
                <p className="mt-1 text-body text-muted">{quote.title}</p>
                <p className="list-price mt-4">{amount}</p>
              </Link>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
