import { PendingLink as Link } from "@/components/pending-link";

import { requireUser } from "@/lib/auth";
import { priceSpan } from "@/lib/money";
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
  const quotes = (await (await getData()).listQuotes(user.id)).filter((quote) => {
    if (!needle) return true;
    return `${quote.customerName} ${quote.title}`.toLowerCase().includes(needle);
  });

  return (
    <div className="space-y-4">
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
      <Link href="/quotes/new" className="block text-sm font-semibold text-pine">
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
        <ul className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 xl:grid-cols-3">
          {quotes.map((quote) => (
            <li key={quote.id}>
              <Link href={`/quotes/${quote.id}`} className="lift block h-full rounded-3xl border border-line bg-paper p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-serif text-2xl">{quote.customerName}</h2>
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {quote.status === "presented" ? "Presented" : "Draft"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">{quote.title}</p>
                <p className="mt-3 font-serif text-3xl text-pine">{priceSpan(quote.totals)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
