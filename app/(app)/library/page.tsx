import { PendingLink as Link } from "@/components/pending-link";

import { createCustomItem } from "@/app/actions";
import { PriceTable } from "@/components/price-table";
import { Button, Notice, SelectField, TextField } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getData } from "@/lib/store";
import { UNIT_OPTIONS } from "@/lib/units";

export const metadata = { title: "Prices" };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await requireUser();
  const items = await (await getData()).listLibrary(user.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-4xl">Prices</h1>
        <Link href="/catalogs" className="text-sm font-semibold text-pine hover:underline">
          Browse the catalog
        </Link>
      </div>
      <div className="grid grid-cols-2 rounded-2xl border border-line bg-paper p-1 lg:hidden">
        <Link href="/library" aria-current="page" className="flex h-10 items-center justify-center rounded-xl bg-pine text-sm font-semibold text-cream">
          Items
        </Link>
        <Link href="/library/groups" className="flex h-10 items-center justify-center rounded-xl text-sm font-semibold text-muted">
          Groups
        </Link>
      </div>
      <Notice code={error} />
      <section data-spotlight="price-add" className="surface page-stack">
        <h2 className="font-serif text-title">Add your own</h2>
        <form action={createCustomItem} className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_10rem_9rem_auto] lg:items-end">
          <TextField label="Name" name="name" required placeholder="Service call" />
          <SelectField label="Unit" name="unit" defaultValue="each">
            {UNIT_OPTIONS.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </SelectField>
          <TextField label="Price" name="price" inputMode="decimal" required placeholder="85" />
          <Button type="submit" className="lg:w-auto">
            Add price
          </Button>
        </form>
      </section>
      <PriceTable items={items} />
    </div>
  );
}
