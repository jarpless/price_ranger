import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { priceSpan } from "@/lib/money";
import { getData } from "@/lib/store";

export const metadata = { title: "Quotes" };

export default async function QuotesPage() {
  const user = await requireUser();
  const quotes = await (await getData()).listQuotes(user.id);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-serif text-4xl">Quotes</h1>
      </div>
      <Link
        href="/quotes/new"
        className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-pine text-base font-semibold text-cream"
      >
        New quote
      </Link>
      {quotes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-paper px-4 py-8 text-center">
          <p className="font-serif text-2xl">No quotes yet</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Add prices, group them into a plain-language description, then present a few options.
          </p>
          <Link href="/library" className="mt-4 inline-block text-sm font-semibold text-pine">
            Add prices
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {quotes.map((quote) => (
            <li key={quote.id}>
              <Link href={`/quotes/${quote.id}`} className="block rounded-3xl border border-line bg-paper p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-serif text-2xl">{quote.customerName}</h2>
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {quote.status === "presented" ? "Presented" : "Draft"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">{quote.title}</p>
                <p className="mt-3 font-serif text-3xl text-pine">{priceSpan(quote.totals)}</p>
                <p className="mt-1 text-sm text-muted">
                  {quote.tierCount === 1 ? "1 option" : `${quote.tierCount} options`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
