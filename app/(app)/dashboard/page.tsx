import { PendingLink as Link } from "@/components/pending-link";

import { requireUser } from "@/lib/auth";
import { listGuideQuotes } from "@/lib/guide/store";
import { formatUsd } from "@/lib/money";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const quotes = await listGuideQuotes(user.id);
  const drafts = quotes.filter((quote) => !quote.finishedAt).length;
  const sent = quotes.filter((quote) => quote.sharedAt && !quote.outcome).length;
  const soldQuotes = quotes.filter((quote) => quote.outcome === "sold");
  const soldCents = soldQuotes.reduce((sum, quote) => sum + (quote.priceCents || 0), 0);
  const cards = [
    { label: "In progress", value: String(drafts) },
    { label: "Sent", value: String(sent) },
    { label: "Sold", value: formatUsd(soldCents) },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="font-serif text-display lg:text-[2.5rem] lg:leading-[3rem]">Dashboard</h1>
      <p className="mt-2 text-body text-muted">A quiet summary. Pricing still starts from Home.</p>
      <ul className="card-grid card-grid-3 mt-4">
        {cards.map((card) => (
          <li key={card.label} className="surface">
            <p className="text-caption font-semibold text-muted">{card.label}</p>
            <p className="font-serif text-price tabular-nums">{card.value}</p>
            {card.label === "Sold" ? <p className="mt-1 text-caption text-muted">{soldQuotes.length} sold</p> : null}
          </li>
        ))}
      </ul>
      <Link href="/" className="mt-6 inline-flex h-12 items-center font-semibold text-pine">
        Back home
      </Link>
    </div>
  );
}
