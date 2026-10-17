import { PendingLink as Link } from "@/components/pending-link";

import type { GuideQuote } from "@/lib/guide/store";
import { formatUsd } from "@/lib/money";
import { ITEM_STATUS_LABEL, classifyQuote, itemStatus } from "@/lib/trades";

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (!Number.isFinite(minutes)) return "";
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** One dense row per quote: the register-tape view. */
export function QuoteRows({ quotes, empty, showTrade = true }: { quotes: GuideQuote[]; empty: React.ReactNode; showTrade?: boolean }) {
  if (quotes.length === 0) {
    return <div className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-body text-muted">{empty}</div>;
  }
  return (
    <ul className="overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_1px_2px_rgba(28,25,21,0.06)]" data-quote-rows="">
      {quotes.map((quote) => {
        const status = itemStatus(quote);
        const filed = showTrade ? classifyQuote(quote) : null;
        return (
          <li key={quote.quoteId} className="border-line [&+&]:border-t">
            <Link
              href={`/guide/${quote.quoteId}`}
              className="flex min-h-14 items-center gap-3 px-3 py-2 hover:bg-cream/60 lg:min-h-10 lg:py-1.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold leading-5 lg:text-sm">{quote.description || "Untitled"}</span>
                <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption leading-4 text-muted lg:hidden">
                  <StatusPill status={status} />
                  {quote.sample ? <span className="pill">Sample</span> : null}
                  {filed ? <span className="truncate">{filed.subcategory?.label ?? filed.trade.short}</span> : null}
                  <span className="ml-auto shrink-0 tabular-nums">{timeAgo(quote.updatedAt)}</span>
                </span>
              </span>
              <span className="hidden w-20 shrink-0 lg:block">
                <StatusPill status={status} />
              </span>
              {showTrade ? <span className="hidden w-36 shrink-0 truncate text-caption text-muted lg:block">{filed ? filed.subcategory?.label ?? filed.trade.short : "—"}</span> : null}
              <span className="hidden w-12 shrink-0 text-right text-caption tabular-nums text-muted lg:block">{timeAgo(quote.updatedAt)}</span>
              <span className="w-20 shrink-0 text-right font-serif text-lg font-medium tabular-nums text-pine lg:text-base">
                {quote.priceCents != null ? formatUsd(quote.priceCents) : ""}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const PILL_LABEL: Record<ReturnType<typeof itemStatus>, string> = { ...ITEM_STATUS_LABEL, drafts: "Draft" };

export function StatusPill({ status }: { status: ReturnType<typeof itemStatus> }) {
  return <span className={status === "sold" ? "pill pill-sold" : "pill"}>{PILL_LABEL[status]}</span>;
}

export function SegTabs({ tabs, label }: { tabs: { href: string; label: string; count?: number; active: boolean }[]; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex w-max gap-1 rounded-xl bg-paper p-1 shadow-[inset_0_0_0_1px_var(--color-line)]">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={`flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-semibold lg:h-8 ${
                tab.active ? "bg-pine text-cream" : "text-ink hover:bg-cream"
              }`}
            >
              {tab.label}
              {tab.count != null ? <span className={`tabular-nums ${tab.active ? "text-cream/75" : "text-muted"}`}>{tab.count}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
