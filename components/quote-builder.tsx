"use client";

import { useMemo, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";

import { addTier, presentQuote, updateQuote, useGoodBetterBest } from "@/app/actions";
import { dropGroupOnTier, dropPriceOnGroup, patchGroupLine, quickCreateGroup } from "@/app/basecamp-actions";
import { dollarsInputValue, formatUsd } from "@/lib/money";
import { groupCents } from "@/lib/project";
import { customerSummary } from "@/lib/summary";
import type { ItemGroup, LibraryItem, QuoteRecord } from "@/lib/types";
import { unitWord } from "@/lib/units";

export function QuoteBuilder({
  quote,
  groups,
  library,
  labels,
}: {
  quote: QuoteRecord;
  groups: ItemGroup[];
  library: LibraryItem[];
  labels?: { customer: string; job: string; present: string };
}) {
  const customerLabel = labels?.customer || "Customer";
  const jobLabel = labels?.job || "Job";
  const presentLabel = labels?.present || "Present to customer";
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(groups[0]?.id || "");
  const [query, setQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [over, setOver] = useState<string | null>(null);
  const selected = groups.find((group) => group.id === selectedId) || groups[0] || null;

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return library;
    return library.filter((item) => item.name.toLowerCase().includes(needle));
  }, [library, query]);

  async function onDropPrice(groupId: string, event: DragEvent) {
    event.preventDefault();
    setOver(null);
    const libraryItemId = event.dataTransfer.getData("application/x-pr-price");
    if (!libraryItemId) return;
    setSelectedId(groupId);
    await dropPriceOnGroup(groupId, libraryItemId);
    router.refresh();
  }

  async function onDropGroup(tierId: string, event: DragEvent) {
    event.preventDefault();
    const groupId = event.dataTransfer.getData("application/x-pr-group");
    if (!groupId) return;
    await dropGroupOnTier(tierId, groupId);
    router.refresh();
  }

  return (
    <div className="hidden lg:block">
      <form action={updateQuote} className="mb-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="quoteId" value={quote.id} />
        <label className="block min-w-48 flex-1 text-sm font-medium">
          {customerLabel}
          <input name="customerName" defaultValue={quote.customerName} required className="mt-1 h-11 w-full rounded-2xl border border-line bg-paper px-3" />
        </label>
        <label className="block min-w-48 flex-1 text-sm font-medium">
          {jobLabel}
          <input name="title" defaultValue={quote.title} required className="mt-1 h-11 w-full rounded-2xl border border-line bg-paper px-3" />
        </label>
        <button className="h-11 rounded-2xl border border-line bg-paper px-4 text-sm font-semibold hover:border-pine">
          Save details
        </button>
      </form>

      <div className="grid h-[calc(100dvh-10rem)] grid-cols-[280px_minmax(0,1fr)_320px] gap-4">
        <section data-spotlight="quote-items" className="flex min-h-0 flex-col rounded-3xl border border-line bg-paper">
          <div className="border-b border-line p-3">
            <input
              data-shortcut="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search prices"
              className="h-10 w-full rounded-xl border border-line px-3 text-sm outline-none focus:border-pine"
            />
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Prices</p>
            {visibleItems.length === 0 ? (
              <p className="text-sm text-muted">No prices yet. Add some on the Prices screen.</p>
            ) : (
              visibleItems.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("application/x-pr-price", item.id);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  className="cursor-grab rounded-2xl border border-line px-3 py-2 text-sm hover:border-pine active:cursor-grabbing"
                >
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-muted">
                    {formatUsd(item.unitPriceCents)} / {unitWord(item.unit, 2) || "each"}
                  </p>
                </div>
              ))
            )}
            <p className="pt-3 text-xs font-semibold uppercase tracking-wide text-muted">Groups</p>
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                draggable
                data-spotlight={`group-${group.id}`}
                onDragStart={(event) => {
                  event.dataTransfer.setData("application/x-pr-group", group.id);
                  event.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => setSelectedId(group.id)}
                onDragOver={(event) => {
                  event.preventDefault();
                  setOver(group.id);
                }}
                onDragLeave={() => setOver((current) => (current === group.id ? null : current))}
                onDrop={(event) => void onDropPrice(group.id, event)}
                className={`block w-full cursor-grab rounded-2xl border px-3 py-2 text-left text-sm ${selected?.id === group.id ? "border-pine bg-cream" : "border-line"} ${over === group.id ? "ring-2 ring-gold" : ""}`}
              >
                <span className="font-semibold">{group.name}</span>
                <span className="mt-1 block text-muted">{formatUsd(groupCents(group))}</span>
              </button>
            ))}
            <form
              className="flex gap-2 pt-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const result = await quickCreateGroup(groupName);
                if (result.ok) {
                  setGroupName("");
                  setSelectedId(result.id);
                  router.refresh();
                }
              }}
            >
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="New group"
                className="h-10 min-w-0 flex-1 rounded-xl border border-line px-3 text-sm"
              />
              <button className="h-10 rounded-xl bg-pine px-3 text-sm font-semibold text-cream">Add</button>
            </form>
          </div>
        </section>

        <section
          data-spotlight="group-detail"
          className={`min-h-0 overflow-y-auto rounded-3xl border bg-paper p-5 ${over === "detail" ? "border-gold ring-2 ring-gold" : "border-line"}`}
          onDragOver={(event) => {
            event.preventDefault();
            setOver("detail");
          }}
          onDragLeave={() => setOver((current) => (current === "detail" ? null : current))}
          onDrop={(event) => {
            if (selected) void onDropPrice(selected.id, event);
          }}
        >
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Selected group</p>
                <h2 className="font-serif text-3xl">{selected.name}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{customerSummary(selected)}</p>
                <p className="mt-3 font-serif text-4xl text-pine">{formatUsd(groupCents(selected))}</p>
              </div>
              <p className="text-sm text-muted">Drag a price here. Quantities stay editable.</p>
              <ul className="space-y-3">
                {selected.items.map((item) => (
                  <li key={item.id} className="rounded-2xl border border-line p-3">
                    <p className="font-semibold">{item.name}</p>
                    <form
                      className="mt-2 flex flex-wrap items-end gap-2"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        await patchGroupLine({
                          itemId: item.id,
                          quantity: String(form.get("quantity") || ""),
                          price: String(form.get("price") || ""),
                        });
                        router.refresh();
                      }}
                    >
                      <label className="text-xs font-medium">
                        Qty
                        <input name="quantity" defaultValue={item.quantity} className="mt-1 block h-10 w-20 rounded-xl border border-line px-2" />
                      </label>
                      <label className="text-xs font-medium">
                        Price
                        <input name="price" defaultValue={dollarsInputValue(item.unitPriceCents)} className="mt-1 block h-10 w-24 rounded-xl border border-line px-2" />
                      </label>
                      <button className="h-10 rounded-xl bg-pine px-3 text-sm font-semibold text-cream">Save</button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-center text-sm text-muted">
              Create a group, then drag prices onto it.
            </div>
          )}
        </section>

        <section data-spotlight="quote-options" className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          {quote.tiers.map((tier) => {
            const included = tier.groupIds
              .map((id) => groups.find((group) => group.id === id))
              .filter((group): group is ItemGroup => Boolean(group));
            const total = included.reduce((sum, group) => sum + groupCents(group), 0);
            return (
              <article
                key={tier.id}
                data-spotlight={`tier-${tier.id}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => void onDropGroup(tier.id, event)}
                className="rounded-3xl border border-line bg-paper p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-serif text-2xl">{tier.name}</h3>
                  {tier.recommended ? (
                    <span className="rounded-full bg-pine px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-cream">
                      Recommended
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 font-serif text-3xl text-pine">{formatUsd(total)}</p>
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {included.length === 0 ? <li>Drop a group here.</li> : included.map((group) => <li key={group.id}>{group.name}</li>)}
                </ul>
              </article>
            );
          })}
          <form action={addTier}>
            <input type="hidden" name="quoteId" value={quote.id} />
            <button className="h-11 w-full rounded-2xl border border-line bg-paper text-sm font-semibold hover:border-pine">
              Add option
            </button>
          </form>
          <form action={useGoodBetterBest}>
            <input type="hidden" name="quoteId" value={quote.id} />
            <button className="h-11 w-full rounded-2xl border border-line bg-paper text-sm font-semibold hover:border-pine">
              Use Good, Better, Best
            </button>
          </form>
          <form action={presentQuote}>
            <input type="hidden" name="quoteId" value={quote.id} />
            <button data-spotlight="present-button" className="h-12 w-full rounded-2xl bg-pine text-base font-semibold text-cream hover:bg-pine-deep">
              {presentLabel}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
