import { PendingLink as Link } from "@/components/pending-link";

import { requireUser } from "@/lib/auth";
import { listGuideQuotes } from "@/lib/guide/store";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const quotes = await listGuideQuotes(user.id);
  const drafts = quotes.filter((quote) => !quote.finishedAt).length;
  const sent = quotes.filter((quote) => quote.sharedAt && !quote.outcome).length;
  const sold = quotes.filter((quote) => quote.outcome === "sold").length;
  const cards = [
    { label: "In progress", value: drafts },
    { label: "Sent", value: sent },
    { label: "Sold", value: sold },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">Secondary</p>
      <h1 className="mt-1 font-serif text-5xl">Dashboard</h1>
      <p className="mt-3 text-lg text-muted">A quiet summary. Pricing still starts from Home.</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <li key={card.label} className="rounded-3xl border border-line bg-paper p-5">
            <p className="text-sm font-semibold text-muted">{card.label}</p>
            <p className="font-serif text-5xl">{card.value}</p>
          </li>
        ))}
      </ul>
      <Link href="/" className="mt-6 inline-flex h-12 items-center font-semibold text-pine">
        Back home
      </Link>
    </div>
  );
}
