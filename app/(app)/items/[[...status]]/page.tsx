import { notFound } from "next/navigation";

import { QuoteRows, SegTabs } from "@/components/quote-rows";
import { requireUser } from "@/lib/auth";
import { listGuideQuotes } from "@/lib/guide/store";
import { formatUsd } from "@/lib/money";
import { ITEM_STATUSES, ITEM_STATUS_LABEL, isItemStatus, itemStatus } from "@/lib/trades";

export const metadata = { title: "My items" };

const EMPTY: Record<string, string> = {
  all: "Nothing priced yet. Tap New price to start.",
  drafts: "No drafts. Everything you started has a price.",
  priced: "Nothing waiting to send.",
  shared: "No open links. Send a price to see it here.",
  sold: "Nothing sold yet. Mark a shared price sold when it goes.",
};

export default async function ItemsPage({ params }: { params: Promise<{ status?: string[] }> }) {
  const { status: segments } = await params;
  const first = segments?.[0];
  if (segments && (segments.length > 1 || !isItemStatus(first))) notFound();
  const status = isItemStatus(first) ? first : undefined;
  const user = await requireUser();
  const quotes = await listGuideQuotes(user.id);
  const counts = Object.fromEntries(ITEM_STATUSES.map((key) => [key, quotes.filter((quote) => itemStatus(quote) === key).length]));
  const shown = status ? quotes.filter((quote) => itemStatus(quote) === status) : quotes;
  const total = shown.reduce((sum, quote) => sum + (quote.priceCents || 0), 0);
  const title = status ? ITEM_STATUS_LABEL[status] : "My items";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-serif text-display">{title}</h1>
        {shown.length > 0 ? (
          <p className="text-caption tabular-nums text-muted">
            {shown.length} · {formatUsd(total)}
          </p>
        ) : null}
      </div>
      <SegTabs
        label="Filter items"
        tabs={[
          { href: "/items", label: "All", count: quotes.length, active: !status },
          ...ITEM_STATUSES.map((key) => ({ href: `/items/${key}`, label: ITEM_STATUS_LABEL[key], count: counts[key], active: status === key })),
        ]}
      />
      <QuoteRows quotes={shown} empty={EMPTY[status ?? "all"]} />
    </div>
  );
}
