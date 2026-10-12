import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteTier, setRecommended, toggleTierGroup, updateTier } from "@/app/actions";
import { BackLink, Button, Card, Notice, TextArea, TextField } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatUsd } from "@/lib/money";
import { groupCents } from "@/lib/project";
import { customerSummary } from "@/lib/summary";
import { getData } from "@/lib/store";

export const metadata = { title: "Option" };

export default async function TierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; tierId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, tierId } = await params;
  const { error } = await searchParams;
  const user = await requireUser();
  const data = await getData();
  const quote = await data.getQuote(user.id, id);
  if (!quote) notFound();
  const tier = quote.tiers.find((item) => item.id === tierId);
  if (!tier) notFound();
  const groups = await data.listGroups(user.id);
  const selected = new Set(tier.groupIds);
  const total = groups
    .filter((group) => selected.has(group.id))
    .reduce((sum, group) => sum + groupCents(group), 0);

  return (
    <div className="space-y-4">
      <BackLink href={`/quotes/${quote.id}`}>{quote.customerName}</BackLink>
      <h1 className="font-serif text-4xl">{tier.name}</h1>
      <p className="font-serif text-4xl text-pine">{formatUsd(total)}</p>
      <form action={updateTier} className="space-y-3">
        <input type="hidden" name="quoteId" value={quote.id} />
        <input type="hidden" name="tierId" value={tier.id} />
        <Notice code={error} />
        <TextField label="Option name" name="name" defaultValue={tier.name} required />
        <TextArea
          label="Note for the customer"
          name="note"
          defaultValue={tier.note}
          placeholder="Optional. Our most popular roof."
        />
        <Button type="submit" variant="secondary">
          Save option
        </Button>
      </form>
      <form action={setRecommended}>
        <input type="hidden" name="quoteId" value={quote.id} />
        <input type="hidden" name="tierId" value={tier.id} />
        <input type="hidden" name="recommended" value={tier.recommended ? "no" : "yes"} />
        <Button type="submit" variant="secondary">
          {tier.recommended ? "Clear recommended" : "Mark recommended"}
        </Button>
      </form>

      <h2 className="font-serif text-2xl">Groups on this option</h2>
      {groups.length === 0 ? (
        <Card>
          <p className="text-sm leading-relaxed text-muted">
            You do not have any groups yet. Group line items first, then add them here.
          </p>
          <Link href="/library/groups/new" className="mt-3 inline-block text-sm font-semibold text-pine">
            Create a group
          </Link>
        </Card>
      ) : (
        <ul className="space-y-3">
          {groups.map((group) => {
            const on = selected.has(group.id);
            return (
              <li key={group.id} className="rounded-3xl border border-line bg-paper p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{group.name}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{customerSummary(group)}</p>
                    <p className="mt-2 font-serif text-xl">{formatUsd(groupCents(group))}</p>
                  </div>
                </div>
                <form action={toggleTierGroup} className="mt-3">
                  <input type="hidden" name="quoteId" value={quote.id} />
                  <input type="hidden" name="tierId" value={tier.id} />
                  <input type="hidden" name="groupId" value={group.id} />
                  <Button type="submit" variant={on ? "primary" : "secondary"}>
                    {on ? "Remove from option" : "Add to option"}
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      <Card>
        <form action={deleteTier} className="space-y-3">
          <input type="hidden" name="quoteId" value={quote.id} />
          <input type="hidden" name="tierId" value={tier.id} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirm" className="h-5 w-5" />
            Delete this option
          </label>
          <Button type="submit" variant="danger">
            Delete option
          </Button>
        </form>
      </Card>
    </div>
  );
}
