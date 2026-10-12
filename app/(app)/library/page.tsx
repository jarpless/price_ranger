import Link from "next/link";

import { addCatalogSku, createCustomItem } from "@/app/actions";
import { Button, Notice, SelectField, TextField } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { priceSource } from "@/lib/connectors";
import { formatUsd } from "@/lib/money";
import { getData } from "@/lib/store";
import { UNIT_OPTIONS, unitWord } from "@/lib/units";

export const metadata = { title: "Prices" };

function Segment({ current }: { current: "items" | "groups" }) {
  const link = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`flex h-10 items-center justify-center rounded-xl text-sm font-semibold ${on ? "bg-pine text-cream" : "text-muted"}`}
    >
      {label}
    </Link>
  );
  return (
    <div className="grid grid-cols-2 rounded-2xl border border-line bg-paper p-1">
      {link("/library", "Items", current === "items")}
      {link("/library/groups", "Groups", current === "groups")}
    </div>
  );
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; q?: string; notice?: string }>;
}) {
  const { error, q = "", notice } = await searchParams;
  const user = await requireUser();
  const data = await getData();
  const items = await data.listLibrary(user.id);
  const hits = q.trim() ? await data.searchCatalog(q) : [];
  const owned = new Set(items.map((item) => item.skuId).filter(Boolean));

  return (
    <div className="space-y-5">
      <h1 className="font-serif text-4xl">Prices</h1>
      <Segment current="items" />
      <Notice code={error} />
      {notice === "added" ? (
        <p className="rounded-2xl bg-[#e7f0ea] px-4 py-3 text-sm">Added to your prices.</p>
      ) : null}
      {notice === "exists" ? (
        <p className="rounded-2xl bg-[#f8f1df] px-4 py-3 text-sm">That product is already in your prices.</p>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Add your own</h2>
        <form action={createCustomItem} className="space-y-3">
          <TextField label="Name" name="name" required placeholder="Tear-off and haul" />
          <SelectField label="Unit" name="unit" defaultValue="square">
            {UNIT_OPTIONS.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </SelectField>
          <TextField label="Price" name="price" inputMode="decimal" required placeholder="85" />
          <Button type="submit">Add price</Button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Search the catalog</h2>
        <form action="/library" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Shingles, siding..."
            className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-paper px-4 text-base outline-none focus:border-pine"
          />
          <Button type="submit" size="sm" className="px-4">
            Search
          </Button>
        </form>
        <ul className="space-y-3">
          {hits.map((hit) => (
            <li key={hit.id} className="rounded-3xl border border-line bg-paper p-4">
              <p className="font-semibold">{hit.name}</p>
              <p className="mt-1 text-sm text-muted">
                {[hit.brandName, hit.variation, hit.category].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-2 font-serif text-2xl">
                {hit.listPriceCents == null ? "No sample price" : formatUsd(hit.listPriceCents)}
                <span className="ml-2 font-sans text-sm text-muted">
                  sample / {unitWord(hit.unit, 2) || "each"}
                </span>
              </p>
              {owned.has(hit.id) ? (
                <p className="mt-3 text-sm font-semibold text-pine">Already in your prices</p>
              ) : (
                <form action={addCatalogSku} className="mt-3">
                  <input type="hidden" name="skuId" value={hit.id} />
                  <input type="hidden" name="q" value={q} />
                  <Button type="submit" variant="secondary">
                    Add sample price
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Your items</h2>
        {items.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted">
            Nothing here yet. Add your own price, search the catalog, or open Catalogs to pull in a sample list.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id}>
                <Link href={`/library/${item.id}`} className="block rounded-3xl border border-line bg-paper p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold">{item.name}</h3>
                    <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">
                      {priceSource(item)}
                    </span>
                  </div>
                  <p className="mt-2 font-serif text-2xl">
                    {formatUsd(item.unitPriceCents)}
                    <span className="ml-2 font-sans text-sm text-muted">
                      / {unitWord(item.unit, 2) || "each"}
                    </span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
