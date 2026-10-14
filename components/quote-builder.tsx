"use client";

import { useMemo, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";

import { addTier, presentQuote, updateQuote, useGoodBetterBest } from "@/app/actions";
import { dropGroupOnTier, dropPriceOnGroup, patchGroupLine, quickCreateGroup } from "@/app/basecamp-actions";
import { dollarsInputValue, formatUsd } from "@/lib/money";
import { groupCents } from "@/lib/project";
import { customerSummary } from "@/lib/summary";
import type { ItemGroup, LibraryItem, QuoteRecord } from "@/lib/types";
import { SubmitButton } from "./ui";

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
  const [adding, startAdd] = useTransition();
  const [savingLine, startSaveLine] = useTransition();
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
    <div className="hidden min-h-0 flex-1 flex-col lg:flex">
      <form action={updateQuote} className="mb-2 flex shrink-0 flex-wrap items-end gap-2">
        <input type="hidden" name="quoteId" value={quote.id} />
        <label className="block min-w-40 flex-1 text-xs font-semibold text-muted">
          {customerLabel}
          <input name="customerName" defaultValue={quote.customerName} required className="mt-1 h-9 w-full rounded-lg border border-line bg-paper px-2 text-sm" />
        </label>
        <label className="block min-w-40 flex-1 text-xs font-semibold text-muted">
          {jobLabel}
          <input name="title" defaultValue={quote.title} required className="mt-1 h-9 w-full rounded-lg border border-line bg-paper px-2 text-sm" />
        </label>
        <SubmitButton
          pendingLabel="Saving…"
          className="h-9 rounded-lg border border-line bg-paper px-3 text-sm font-semibold hover:border-pine"
        >
          Save details
        </SubmitButton>
      </form>

      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)_18rem] gap-3">
        <section data-spotlight="quote-items" className="flex min-h-0 flex-col rounded-2xl border border-line bg-paper">
          <div className="border-b border-line p-2">
            <input
              data-shortcut="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search prices"
              className="h-9 w-full rounded-lg border border-line px-2 text-sm outline-none focus:border-pine"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <p className="px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">Prices</p>
            {visibleItems.length === 0 ? (
              <p className="px-2 py-2 text-sm text-muted">No prices yet. Add some on the Prices screen.</p>
            ) : (
              visibleItems.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("application/x-pr-price", item.id);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  className="flex h-10 cursor-grab items-center gap-2 border-b border-line px-2 text-sm active:cursor-grabbing"
                >
                  <span className="min-w-0 flex-1 truncate font-semibold">{item.name}</span>
                  <span className="shrink-0 text-right text-muted tabular-nums">{formatUsd(item.unitPriceCents)}</span>
                  <button
                    type="button"
                    className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-lg border border-line px-2 text-sm font-semibold"
                    onClick={() => {
                      const groupId = selected?.id || groups[0]?.id;
                      if (!groupId) return;
                      startAdd(async () => {
                        await dropPriceOnGroup(groupId, item.id);
                        setSelectedId(groupId);
                        router.refresh();
                      });
                    }}
                  >
                    Add
                  </button>
                </div>
              ))
            )}
            <p className="px-2 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">Groups</p>
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
                className={`flex h-10 w-full cursor-grab items-center justify-between gap-2 border-b border-line px-2 text-left text-sm ${selected?.id === group.id ? "bg-cream" : ""} ${over === group.id ? "ring-2 ring-gold" : ""}`}
              >
                <span className="min-w-0 truncate font-semibold">{group.name}</span>
                <span className="shrink-0 text-right tabular-nums text-muted">{formatUsd(groupCents(group))}</span>
              </button>
            ))}
            <form
              className="flex gap-2 p-2"
              onSubmit={(event) => {
                event.preventDefault();
                const name = groupName;
                startAdd(async () => {
                  const result = await quickCreateGroup(name);
                  if (result.ok) {
                    setGroupName("");
                    setSelectedId(result.id);
                    router.refresh();
                  }
                });
              }}
            >
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="New group"
                aria-label="New group"
                className="h-9 min-w-0 flex-1 rounded-lg border border-line px-2 text-sm"
              />
              <button
                disabled={adding}
                aria-busy={adding}
                className="h-9 whitespace-nowrap rounded-lg border border-line px-3 text-sm font-semibold disabled:opacity-60"
              >
                {adding ? "Adding…" : "Add"}
              </button>
            </form>
          </div>
        </section>

        <section
          data-spotlight="group-detail"
          className={`min-h-0 overflow-y-auto rounded-2xl border bg-paper ${over === "detail" ? "border-gold ring-2 ring-gold" : "border-line"}`}
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
            <div>
              <div className="sticky top-0 z-10 flex h-12 items-center justify-between gap-3 border-b border-line bg-paper px-3">
                <h2 className="min-w-0 truncate font-serif text-title">{selected.name}</h2>
                <p className="shrink-0 text-right font-serif text-title tabular-nums text-pine">{formatUsd(groupCents(selected))}</p>
              </div>
              <p className="px-3 py-1 text-xs text-muted">{customerSummary(selected)} Enter saves a line.</p>
              <ul>
                {selected.items.map((item) => (
                  <li key={item.id} className="border-b border-line last:border-b-0">
                    <form
                      className="grid h-10 grid-cols-[minmax(0,1fr)_4.25rem_5.25rem_4.25rem] items-center gap-2 px-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        startSaveLine(async () => {
                          await patchGroupLine({
                            itemId: item.id,
                            quantity: String(form.get("quantity") || ""),
                            price: String(form.get("price") || ""),
                          });
                          router.refresh();
                        });
                      }}
                    >
                      <span className="truncate text-sm font-semibold">{item.name}</span>
                      <input
                        name="quantity"
                        aria-label={`Quantity for ${item.name}`}
                        defaultValue={item.quantity}
                        className="h-8 rounded-lg border border-line px-2 text-right text-sm tabular-nums"
                      />
                      <input
                        name="price"
                        aria-label={`Price for ${item.name}`}
                        defaultValue={dollarsInputValue(item.unitPriceCents)}
                        className="h-8 rounded-lg border border-line px-2 text-right text-sm tabular-nums"
                      />
                      <button
                        disabled={savingLine}
                        aria-busy={savingLine}
                        className="h-8 whitespace-nowrap rounded-lg border border-line text-sm font-semibold disabled:opacity-60"
                      >
                        {savingLine ? "…" : "Save"}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted">
              Create a group, then press Add on a price. Enter in the new-group field adds it.
            </div>
          )}
        </section>

        <section data-spotlight="quote-options" className="flex min-h-0 flex-col gap-2 overflow-y-auto">
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
                className="rounded-2xl border border-line bg-paper px-3 py-1"
              >
                <div className="flex h-10 items-center justify-between gap-2">
                  <h3 className="min-w-0 truncate font-serif text-base">{tier.name}</h3>
                  <p className="shrink-0 text-right font-serif text-title tabular-nums text-pine">{formatUsd(total)}</p>
                </div>
                {tier.recommended ? (
                  <p className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-pine">Recommended</p>
                ) : null}
                <ul>
                  {included.length === 0 ? (
                    <li className="flex h-10 items-center text-sm text-muted">Drop a group here.</li>
                  ) : (
                    included.map((group) => (
                      <li key={group.id} className="flex h-10 items-center justify-between gap-2 border-t border-line text-sm">
                        <span className="min-w-0 truncate">{group.name}</span>
                        <span className="shrink-0 text-right tabular-nums">{formatUsd(groupCents(group))}</span>
                      </li>
                    ))
                  )}
                </ul>
              </article>
            );
          })}
          <form action={addTier}>
            <input type="hidden" name="quoteId" value={quote.id} />
            <SubmitButton
              pendingLabel="Adding…"
              className="h-10 w-full rounded-xl border border-line bg-paper text-sm font-semibold hover:border-pine"
            >
              Add option
            </SubmitButton>
          </form>
          <form action={useGoodBetterBest}>
            <input type="hidden" name="quoteId" value={quote.id} />
            <SubmitButton
              pendingLabel="Setting up…"
              className="h-10 w-full rounded-xl border border-line bg-paper text-sm font-semibold hover:border-pine"
            >
              Use Good, Better, Best
            </SubmitButton>
          </form>
          <form action={presentQuote}>
            <input type="hidden" name="quoteId" value={quote.id} />
            <SubmitButton
              data-spotlight="present-button"
              pendingLabel="Presenting…"
              className="h-12 w-full rounded-2xl bg-pine text-base font-semibold text-cream hover:bg-pine-deep"
            >
              {presentLabel}
            </SubmitButton>
          </form>
        </section>
      </div>
    </div>
  );
}
