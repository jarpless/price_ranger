"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { importPriceCsv, patchLibraryItem } from "@/app/basecamp-actions";
import { PRICE_CSV_TEMPLATE } from "@/lib/csv";
import { dollarsInputValue, formatUsd } from "@/lib/money";
import type { LibraryItem } from "@/lib/types";
import { UNIT_OPTIONS, unitWord } from "@/lib/units";

type SortKey = "name" | "unit" | "price" | "source";

function sourceLabel(item: LibraryItem) {
  if (item.samplePrice) return "Sample";
  if (item.source === "custom") return "Yours";
  return item.source === "connector" ? "Catalog" : "Catalog";
}

export function PriceTable({ items }: { items: LibraryItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "yours" | "sample">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", unit: "each", price: "" });
  const [message, setMessage] = useState("");
  const [saving, startSave] = useTransition();
  const [importing, startImport] = useTransition();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (filter === "sample" && !item.samplePrice) return false;
      if (filter === "yours" && item.samplePrice) return false;
      if (!needle) return true;
      return item.name.toLowerCase().includes(needle);
    });
    const direction = sort.dir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      if (sort.key === "price") return (a.unitPriceCents - b.unitPriceCents) * direction;
      const left = sort.key === "source" ? sourceLabel(a) : sort.key === "unit" ? a.unit : a.name;
      const right = sort.key === "source" ? sourceLabel(b) : sort.key === "unit" ? b.unit : b.name;
      return left.localeCompare(right) * direction;
    });
  }, [items, query, filter, sort]);

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  function save(id: string) {
    const next = { ...draft };
    startSave(async () => {
      const result = await patchLibraryItem({ id, ...next });
      setMessage(result.ok ? "Saved." : result.error);
      if (result.ok) {
        setEditing(null);
        router.refresh();
      }
    });
  }

  function onFile(file: File) {
    startImport(async () => {
      const text = await file.text();
      const result = await importPriceCsv(text);
      setMessage(
        result.ok
          ? `Imported ${result.added} price${result.added === 1 ? "" : "s"}${result.errors.length ? `. ${result.errors[0]}` : "."}`
          : result.errors[0] || "Could not import that file.",
      );
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          data-shortcut="search"
          data-spotlight="price-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search prices"
          className="h-11 min-w-0 flex-1 rounded-2xl border border-line bg-paper px-4 text-base outline-none focus:border-pine"
        />
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as typeof filter)}
          className="h-11 rounded-2xl border border-line bg-paper px-3 text-sm"
          aria-label="Filter prices"
        >
          <option value="all">All</option>
          <option value="yours">Your prices</option>
          <option value="sample">Samples</option>
        </select>
        <label
          data-spotlight="price-import"
          className="inline-flex h-11 cursor-pointer items-center justify-center rounded-2xl border border-line bg-paper px-4 text-sm font-semibold hover:border-pine"
        >
          {importing ? "Importing…" : "Import CSV"}
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
              event.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          className="h-11 rounded-2xl px-3 text-sm font-semibold text-pine hover:bg-paper"
          onClick={() => {
            const blob = new Blob([PRICE_CSV_TEMPLATE], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "prices-template.csv";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          Template
        </button>
      </div>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
      <div className="scroll-x rounded-2xl border border-line bg-paper">
        <table data-spotlight="price-table" className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              {([
                ["name", "Name"],
                ["unit", "Unit"],
                ["price", "Price"],
                ["source", "Source"],
              ] as const).map(([key, label]) => (
                <th key={key} className={`px-5 py-4 font-semibold ${key === "price" ? "text-right" : ""}`}>
                  <button type="button" className="hover:text-pine" onClick={() => toggleSort(key)}>
                    {label}
                    {sort.key === key ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-muted">
                  No prices match. Add one above, import a CSV, or connect a sample catalog.
                </td>
              </tr>
            ) : (
              rows.map((item) => {
                const open = editing === item.id;
                return (
                  <tr key={item.id} data-spotlight={`price-${item.id}`} className="border-t border-line hover:bg-cream/60">
                    <td className="px-5 py-4">
                      {open ? (
                        <input
                          value={draft.name}
                          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                          className="h-10 w-full rounded-xl border border-line px-2"
                        />
                      ) : (
                        <button
                          type="button"
                          className="text-left font-semibold hover:text-pine"
                          onClick={() => {
                            setEditing(item.id);
                            setDraft({
                              name: item.name,
                              unit: item.unit,
                              price: dollarsInputValue(item.unitPriceCents),
                            });
                          }}
                        >
                          {item.name}
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {open ? (
                        <select
                          value={draft.unit}
                          onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
                          className="h-10 rounded-xl border border-line px-2"
                        >
                          {UNIT_OPTIONS.map((unit) => (
                            <option key={unit.value} value={unit.value}>
                              {unit.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        unitWord(item.unit, 2) || "each"
                      )}
                    </td>
                    <td className="list-price px-5 py-4 text-right">
                      {open ? (
                        <input
                          value={draft.price}
                          onChange={(event) => setDraft({ ...draft, price: event.target.value })}
                          className="h-10 w-28 rounded-xl border border-line px-2"
                          inputMode="decimal"
                        />
                      ) : (
                        formatUsd(item.unitPriceCents)
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {open ? (
                        <span className="flex gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            aria-busy={saving}
                            className="font-semibold text-pine disabled:opacity-60"
                            onClick={() => save(item.id)}
                          >
                            {saving ? "Saving…" : "Save"}
                          </button>
                          <button type="button" className="text-muted" onClick={() => setEditing(null)}>
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{sourceLabel(item)}</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
