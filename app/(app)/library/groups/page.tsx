import Link from "next/link";

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
      <h1 className="font-serif text-4xl">Prices</h1>
      <div className="grid grid-cols-2 rounded-2xl border border-line bg-paper p-1">
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
          A group is a bundle the customer can understand, like “Architectural roof” or “Tear-off”.
          Price Ranger writes the description for you.
        </p>
      ) : (
        <ul className="space-y-3">
          {groups.map((group) => (
            <li key={group.id}>
              <Link href={`/library/groups/${group.id}`} className="block rounded-3xl border border-line bg-paper p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-serif text-2xl">{group.name}</h2>
                  <span className="font-serif text-xl">{formatUsd(groupCents(group))}</span>
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
