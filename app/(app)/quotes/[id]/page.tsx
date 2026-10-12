import { PendingLink as Link } from "@/components/pending-link";

import {
  addTier,
  deleteQuote,
  presentQuote,
  updateQuote,
  useGoodBetterBest,
} from "@/app/actions";
import { QuoteBuilder } from "@/components/quote-builder";
import { BackLink, Button, Card, Notice, TextField } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatUsd, priceSpan } from "@/lib/money";
import { customerSummary } from "@/lib/summary";
import { groupCents, presentationDrifted } from "@/lib/project";
import { getData } from "@/lib/store";
import { vocabulary } from "@/lib/vocabulary";
import { notFound } from "next/navigation";

export const metadata = { title: "Quote" };

export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const user = await requireUser();
  const words = vocabulary(user.industry);
  const data = await getData();
  const quote = await data.getQuote(user.id, id);
  if (!quote) notFound();
  const groups = await data.listGroups(user.id);
  const library = await data.listLibrary(user.id);
  const byId = new Map(groups.map((group) => [group.id, group]));
  const drifted = presentationDrifted(quote, groups);

  return (
    <div className="space-y-4">
      <div className="hidden lg:block">
        <BackLink href="/">{words.quotes}</BackLink>
        <h1 className="mb-4 font-serif text-4xl">{quote.customerName}</h1>
        {drifted ? (
          <p className="mb-4 rounded-2xl bg-[#f8f1df] px-4 py-3 text-sm leading-relaxed text-ink">
            Prices changed after you last presented. Present again to update the customer copy.
          </p>
        ) : null}
        <QuoteBuilder
          quote={quote}
          groups={groups}
          library={library}
          labels={{ customer: words.customer, job: words.job, present: words.present }}
        />
      </div>
      <div className="space-y-4 lg:hidden">
      <BackLink href="/">{words.quotes}</BackLink>
      <h1 className="font-serif text-4xl">{quote.customerName}</h1>
      <form action={updateQuote} className="space-y-3">
        <input type="hidden" name="quoteId" value={quote.id} />
        <Notice code={error} />
        <TextField label={words.customer} name="customerName" defaultValue={quote.customerName} required />
        <TextField label={words.job} name="title" defaultValue={quote.title} required />
        <Button type="submit" variant="secondary">
          Save details
        </Button>
      </form>

      {drifted ? (
        <p className="rounded-2xl bg-[#f8f1df] px-4 py-3 text-sm leading-relaxed text-ink">
          Prices changed after you last presented. Present again to update the customer copy.
        </p>
      ) : null}

      <div className="flex items-baseline justify-between" data-spotlight="quote-options">
        <h2 className="font-serif text-2xl">Options</h2>
        <p className="font-serif text-xl text-pine">
          {priceSpan(
            quote.tiers.map((tier) =>
              tier.groupIds.reduce((sum, groupId) => {
                const group = byId.get(groupId);
                return sum + (group ? groupCents(group) : 0);
              }, 0),
            ),
          )}
        </p>
      </div>

      <ul className="space-y-3">
        {quote.tiers.map((tier) => {
          const included = tier.groupIds
            .map((groupId) => byId.get(groupId))
            .filter((group) => Boolean(group));
          const total = included.reduce((sum, group) => sum + groupCents(group!), 0);
          return (
            <li key={tier.id}>
              <Link href={`/quotes/${quote.id}/tiers/${tier.id}`} className="block rounded-3xl border border-line bg-paper p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-serif text-2xl">{tier.name}</h3>
                  {tier.recommended ? (
                    <span className="rounded-full bg-pine px-2 py-1 text-xs font-semibold text-cream">
                      Recommended
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 font-serif text-3xl text-pine">{formatUsd(total)}</p>
                {included.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">No groups yet. Tap to add some.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {included.map((group) => (
                      <li key={group!.id} className="text-sm leading-relaxed text-muted">
                        <span className="font-semibold text-ink">{group!.name}. </span>
                        {customerSummary(group!)}
                      </li>
                    ))}
                  </ul>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <form action={addTier}>
        <input type="hidden" name="quoteId" value={quote.id} />
        <Button type="submit" variant="secondary">
          Add option
        </Button>
      </form>
      <form action={useGoodBetterBest}>
        <input type="hidden" name="quoteId" value={quote.id} />
        <Button type="submit" variant="secondary">
          Use Good, Better, Best
        </Button>
      </form>

      <form action={presentQuote}>
        <input type="hidden" name="quoteId" value={quote.id} />
        <Button type="submit" data-spotlight="present-button">
          {words.present}
        </Button>
      </form>
      {user.industry === "yard" ? (
        <Link href={`/quotes/${quote.id}/sheet`} className="inline-flex text-sm font-semibold text-pine">
          Print price sheet
        </Link>
      ) : null}
      <p className="text-sm leading-relaxed text-muted">
        Presenting saves a copy. Later edits stay off that copy until you present again.
      </p>

      <Card>
        <form action={deleteQuote} className="space-y-3">
          <input type="hidden" name="quoteId" value={quote.id} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirm" className="h-5 w-5" />
            Delete this quote
          </label>
          <Button type="submit" variant="danger">
            Delete quote
          </Button>
        </form>
      </Card>
      </div>
    </div>
  );
}
