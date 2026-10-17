import { PendingLink as Link } from "@/components/pending-link";

import { GLOSSARY } from "@/lib/glossary";
import { ITEM_STATUS_LABEL, ITEM_STATUSES, type ItemStatus } from "@/lib/trades";

export const metadata = { title: "Help" };

const STATUS_HELP: Record<ItemStatus, string> = {
  drafts: "Started, but the price is not checked yet. Finish it from Home.",
  priced: "Has a price you checked. Nothing has been sent.",
  shared: "The link or PDF is out. Mark it sold when it goes.",
  sold: "Marked sold. It counts toward your Sold total.",
};

export default function HelpPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
      <h1 className="font-serif text-display">Help</h1>
      <section aria-labelledby="help-status">
        <h2 id="help-status" className="mb-1.5 text-caption font-semibold uppercase tracking-[0.14em] text-muted">
          Item status
        </h2>
        <dl className="rounded-2xl border border-line bg-paper px-3">
          {ITEM_STATUSES.map((status) => (
            <div key={status} className="flex gap-3 py-2 [&+&]:border-t [&+&]:border-line">
              <dt className="w-20 shrink-0 text-sm font-semibold">
                <Link href={`/items/${status}`} className="text-pine">
                  {ITEM_STATUS_LABEL[status]}
                </Link>
              </dt>
              <dd className="text-sm leading-5 text-muted">{STATUS_HELP[status]}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="help-glossary">
        <h2 id="help-glossary" className="mb-1.5 text-caption font-semibold uppercase tracking-[0.14em] text-muted">
          Glossary
        </h2>
        <dl className="rounded-2xl border border-line bg-paper px-3">
          {Object.entries(GLOSSARY).map(([id, entry]) => (
            <div key={id} id={id} className="py-2 [&+&]:border-t [&+&]:border-line lg:flex lg:gap-3">
              <dt className="text-sm font-semibold lg:w-40 lg:shrink-0">{entry.term}</dt>
              <dd className="text-sm leading-5 text-muted">{entry.body}</dd>
            </div>
          ))}
        </dl>
      </section>
      <p className="text-sm text-muted">
        Still stuck?{" "}
        <Link href="/feedback/new" className="font-semibold text-pine">
          Send feedback
        </Link>
      </p>
    </div>
  );
}
