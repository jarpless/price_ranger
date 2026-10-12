import { notFound } from "next/navigation";

import { deleteLibraryItem, updateLibraryItem } from "@/app/actions";
import { BackLink, Button, Card, Notice, SelectField, TextField } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { priceSource } from "@/lib/connectors";
import { dollarsInputValue } from "@/lib/money";
import { getData } from "@/lib/store";
import { UNIT_OPTIONS } from "@/lib/units";

export const metadata = { title: "Edit price" };

export default async function EditItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const user = await requireUser();
  const item = await (await getData()).getLibraryItem(user.id, id);
  if (!item) notFound();

  return (
    <div className="space-y-4">
      <BackLink href="/library">Prices</BackLink>
      <h1 className="font-serif text-4xl">Edit price</h1>
      <p className="text-sm text-muted">{priceSource(item)}</p>
      <p className="text-sm leading-relaxed text-muted">
        Groups you already built keep the price they copied. Change those on the group.
      </p>
      <form action={updateLibraryItem} className="space-y-3">
        <input type="hidden" name="itemId" value={item.id} />
        <Notice code={error} />
        <TextField label="Name" name="name" defaultValue={item.name} required />
        <SelectField label="Unit" name="unit" defaultValue={item.unit}>
          {UNIT_OPTIONS.map((unit) => (
            <option key={unit.value} value={unit.value}>
              {unit.label}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Price"
          name="price"
          inputMode="decimal"
          defaultValue={dollarsInputValue(item.unitPriceCents)}
          required
        />
        <Button type="submit">Save price</Button>
      </form>
      <Card>
        <form action={deleteLibraryItem} className="space-y-3">
          <input type="hidden" name="itemId" value={item.id} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirm" className="h-5 w-5" />
            Delete this price
          </label>
          <Button type="submit" variant="danger">
            Delete price
          </Button>
        </form>
      </Card>
    </div>
  );
}
