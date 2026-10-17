import { PendingLink as Link } from "@/components/pending-link";

import { requireUser } from "@/lib/auth";
import { formatUsd } from "@/lib/money";
import { groupCents } from "@/lib/project";
import { customerSummary } from "@/lib/summary";
import { getData } from "@/lib/store";

export const metadata = { title: "Groups" };

export default async function GroupsPage() {
  const user = await requireUser();
  const groups = await (await getData()).listGroups(user.id);

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">Groups</h1>
      <div className="grid grid-cols-2 rounded-2xl border border-line bg-paper p-1 lg:hidden">
        <Link href="/library" className="flex h-10 items-center justify-center rounded-xl text-sm font-semibold text-muted">
          Items
        </Link>
        <Link
          href="/library/groups"
          aria-current="page"
          className="flex h-10 items-center justify-center rounded-xl bg-pine text-sm font-semibold text-cream"
        >
          Groups
        </Link>
      </div>
      <Link
        href="/library/groups/new"
        className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-pine text-base font-semibold text-cream"
      >
        New group
      </Link>
      {groups.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">
          A group is a bundle the customer can understand, like “Bathroom refresh” or “Service call”.
          Price Ranger writes the description for you.
        </p>
      ) : (
        <ul data-spotlight="group-list" className="card-grid">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                href={`/library/groups/${group.id}`}
                data-spotlight={`group-${group.id}`}
                className="lift surface flex h-full flex-col"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="min-w-0 truncate font-serif text-title">{group.name}</h2>
                  <span className="list-price">{formatUsd(groupCents(group))}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted">{customerSummary(group)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
