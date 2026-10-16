"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { importPriceCsv, setCatalogPrice } from "@/app/basecamp-actions";
import { PRICE_CSV_TEMPLATE } from "@/lib/csv";
import { dollarsInputValue, formatUsd } from "@/lib/money";
import type { CatalogHit, LibraryItem } from "@/lib/types";
import { unitWord } from "@/lib/units";

type SortKey = "name" | "brand" | "category" | "price";

export function CatalogTable({ hits, library }: { hits: CatalogHit[]; library: LibraryItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("all");
  const [category, setCategory] = useState("all");
  const [connector, setConnector] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [editing, setEditing] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [saving, startSave] = useTransition();
  const [importing, startImport] = useTransition();

  const brands = [...new Set(hits.map((hit) => hit.brandName).filter(Boolean))].sort();
  const categories = [...new Set(hits.map((hit) => hit.category).filter(Boolean))].sort();
  const connectors = [...new Set(hits.map((hit) => hit.connectorSlug))].sort();
  const owned = new Map(library.filter((item) => item.skuId).map((item) => [item.skuId as string, item]));

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = hits.filter((hit) => {
      if (brand !== "all" && hit.brandName !== brand) return false;
      if (category !== "all" && hit.category !== category) return false;
      if (connector !== "all" && hit.connectorSlug !== connector) return false;
      if (!needle) return true;
      return [hit.name, hit.brandName, hit.variation, hit.skuCode, hit.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    const direction = sort.dir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      if (sort.key === "price") return ((a.listPriceCents || 0) - (b.listPriceCents || 0)) * direction;
      const left = sort.key === "brand" ? a.brandName : sort.key === "category" ? a.category : a.name;
      const right = sort.key === "brand" ? b.brandName : sort.key === "category" ? b.category : b.name;
      return left.localeCompare(right) * direction;
    });
  }, [hits, query, brand, category, connector, sort]);

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  function save(skuId: string) {
    const next = price;
    startSave(async () => {
      const result = await setCatalogPrice(skuId, next);
      setMessage(result.ok ? "Saved to your prices." : result.error);
      if (result.ok) {
        setEditing(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-4">
        <input
          data-shortcut="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the catalog"
          className="h-11 rounded-2xl border border-line bg-paper px-4 text-base outline-none focus:border-pine md:col-span-1"
        />
        <select value={brand} onChange={(event) => setBrand(event.target.value)} className="h-11 rounded-2xl border border-line bg-paper px-3 text-sm" aria-label="Brand">
          <option value="all">All brands</option>
          {brands.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 rounded-2xl border border-line bg-paper px-3 text-sm" aria-label="Category">
          <option value="all">All categories</option>
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select value={connector} onChange={(event) => setConnector(event.target.value)} className="h-11 rounded-2xl border border-line bg-paper px-3 text-sm" aria-label="Connector">
          <option value="all">All sources</option>
          {connectors.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="inline-flex h-10 cursor-pointer items-center rounded-2xl border border-line bg-paper px-3 font-semibold hover:border-pine">
          {importing ? "Importing…" : "Import CSV into prices"}
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              startImport(async () => {
                const result = await importPriceCsv(await file.text());
                setMessage(result.ok ? `Imported ${result.added}.` : result.errors[0] || "Import failed.");
                if (result.ok) router.refresh();
              });
            }}
          />
        </label>
        <button
          type="button"
          className="font-semibold text-pine"
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
          Download template
        </button>
        {message ? <span className="text-muted">{message}</span> : null}
      </div>
      <div className="scroll-x rounded-2xl border border-line bg-paper">
        <table data-spotlight="catalog-table" className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              {([
                ["name", "Name"],
                ["brand", "Brand"],
                ["category", "Category"],
                ["price", "Sample"],
              ] as const).map(([key, label]) => (
                <th key={key} className="px-4 py-3 font-semibold">
                  <button type="button" className="hover:text-pine" onClick={() => toggleSort(key)}>
                    {label}
                    {sort.key === key ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 font-semibold">Your price</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((hit) => {
              const mine = owned.get(hit.id);
              const open = editing === hit.id;
              return (
                <tr key={hit.id} data-spotlight={`sku-${hit.id}`} className="border-t border-line hover:bg-cream/60">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{hit.name}</p>
                    <p className="text-xs text-muted">{[hit.variation, hit.skuCode].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className="px-4 py-3">{hit.brandName}</td>
                  <td className="px-4 py-3">{hit.category}</td>
                  <td className="px-4 py-3">
                    {hit.listPriceCents == null ? "—" : formatUsd(hit.listPriceCents)}
                    <span className="ml-1 text-xs text-muted">/ {unitWord(hit.unit, 2) || "each"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {open ? (
                      <span className="flex items-center gap-2">
                        <input
                          value={price}
                          onChange={(event) => setPrice(event.target.value)}
                          className="h-10 w-24 rounded-xl border border-line px-2"
                          inputMode="decimal"
                        />
                        <button
                          type="button"
                          disabled={saving}
                          aria-busy={saving}
                          className="font-semibold text-pine disabled:opacity-60"
                          onClick={() => save(hit.id)}
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="font-semibold text-pine hover:underline"
                        onClick={() => {
                          setEditing(hit.id);
                          setPrice(mine ? dollarsInputValue(mine.unitPriceCents) : hit.listPriceCents ? dollarsInputValue(hit.listPriceCents) : "");
                        }}
                      >
                        {mine ? formatUsd(mine.unitPriceCents) : "Set your price"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
