import { PendingLink as Link } from "@/components/pending-link";
import { notFound } from "next/navigation";

import {
  addGroupItem,
  deleteGroup,
  removeGroupItem,
  resetGroupSummary,
  saveGroupSummary,
  updateGroupItem,
  updateGroupName,
} from "@/app/actions";
import { BackLink, Button, Card, Notice, TextArea, TextField } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { dollarsInputValue, formatUsd, lineTotalCents } from "@/lib/money";
import { customerSummary } from "@/lib/summary";
import { groupCents } from "@/lib/project";
import { getData } from "@/lib/store";
import { unitWord } from "@/lib/units";

export const metadata = { title: "Group" };

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const user = await requireUser();
  const data = await getData();
  const group = await data.getGroup(user.id, id);
  if (!group) notFound();
  const library = await data.listLibrary(user.id);
  const used = new Set(group.items.map((item) => item.libraryItemId).filter(Boolean));
  const available = library.filter((item) => !used.has(item.id));
  const summary = customerSummary(group);

  return (
    <div className="space-y-4">
      <BackLink href="/library/groups">Groups</BackLink>
      <form action={updateGroupName} className="space-y-3">
        <input type="hidden" name="groupId" value={group.id} />
        <Notice code={error} />
        <TextField label="Group name" name="name" defaultValue={group.name} required />
        <Button type="submit" variant="secondary">
          Save name
        </Button>
      </form>

      <Card className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Customer will see</p>
        <p className="font-serif text-xl leading-snug">{summary}</p>
        <p className="font-serif text-3xl text-pine">{formatUsd(groupCents(group))}</p>
        <form action={saveGroupSummary} className="space-y-3">
          <input type="hidden" name="groupId" value={group.id} />
          <TextArea label="Description" name="summary" defaultValue={summary} />
          <Button type="submit" variant="secondary">
            Save description
          </Button>
        </form>
        {group.summaryEdited ? (
          <form action={resetGroupSummary}>
            <input type="hidden" name="groupId" value={group.id} />
            <Button type="submit" variant="ghost">
              Use the automatic description
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted">This description updates when the line items change.</p>
        )}
      </Card>

      <h2 className="font-serif text-2xl">Line items</h2>
      {group.items.length === 0 ? (
        <p className="text-sm text-muted">Add prices from your library. The description fills in on its own.</p>
      ) : (
        <ul className="space-y-3">
          {group.items.map((item) => (
            <li key={item.id} className="rounded-3xl border border-line bg-paper p-4">
              <h3 className="font-semibold">{item.name}</h3>
              <form action={updateGroupItem} className="mt-3 space-y-3">
                <input type="hidden" name="groupId" value={group.id} />
                <input type="hidden" name="itemId" value={item.id} />
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label={`Qty (${unitWord(item.unit, item.quantity) || "each"})`}
                    name="quantity"
                    inputMode="decimal"
                    defaultValue={String(item.quantity)}
                    required
                  />
                  <TextField
                    label="Price"
                    name="price"
                    inputMode="decimal"
                    defaultValue={dollarsInputValue(item.unitPriceCents)}
                    required
                  />
                </div>
                <p className="font-serif text-2xl">{formatUsd(lineTotalCents(item.quantity, item.unitPriceCents))}</p>
                <Button type="submit" variant="secondary">
                  Update line
                </Button>
              </form>
              <form action={removeGroupItem} className="mt-2">
                <input type="hidden" name="groupId" value={group.id} />
                <input type="hidden" name="itemId" value={item.id} />
                <Button type="submit" variant="ghost">
                  Remove
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <Card>
        {available.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted">
            {library.length === 0
              ? "Add prices first, then come back and drop them into this group."
              : "Every price is already in this group."}
          </p>
        ) : (
          <form action={addGroupItem} className="space-y-3">
            <input type="hidden" name="groupId" value={group.id} />
            <label className="block text-sm font-medium" htmlFor="libraryItemId">
              Add a price
            </label>
            <select
              id="libraryItemId"
              name="libraryItemId"
              className="h-12 w-full rounded-2xl border border-line bg-paper px-4 text-base"
              defaultValue={available[0]?.id}
            >
              {available.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <Button type="submit">Add to group</Button>
          </form>
        )}
        {library.length === 0 ? (
          <Link href="/library" className="mt-3 inline-block text-sm font-semibold text-pine">
            Add prices
          </Link>
        ) : null}
      </Card>

      <Card>
        <form action={deleteGroup} className="space-y-3">
          <input type="hidden" name="groupId" value={group.id} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirm" className="h-5 w-5" />
            Delete this group
          </label>
          <Button type="submit" variant="danger">
            Delete group
          </Button>
        </form>
      </Card>
    </div>
  );
}
