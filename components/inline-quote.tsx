"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { saveInlineSheet } from "@/app/guide-actions";
import { useQuoteView } from "@/components/asking-price";
import { explainFormula, parseFormula, suggestFormula } from "@/lib/guide/formula";
import type { Adjustment } from "@/lib/guide/pricing";
import {
  amountColumn,
  blankRow,
  columnIdFor,
  formulaCellLabel,
  formulaHints,
  moveRow,
  sheetToMoneyLines,
  textColumn,
  type QuoteSheet,
  type SheetColumn,
  type SheetColumnType,
} from "@/lib/guide/sheet";
import { priceFarFromRange } from "@/lib/market";
import { formatUsd } from "@/lib/money";

export function InlineQuote({
  quoteId,
  initialSheet,
  adjustment,
  askingCents,
  lowCents,
  highCents,
  children,
}: {
  quoteId: string;
  initialSheet: QuoteSheet;
  adjustment: Adjustment;
  askingCents: number | null;
  lowCents: number | null;
  highCents: number | null;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState(initialSheet);
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;
  const [savedKey, setSavedKey] = useState(JSON.stringify(initialSheet));
  const incoming = JSON.stringify(initialSheet);
  if (incoming !== savedKey) {
    setSavedKey(incoming);
    setSheet(initialSheet);
  }
  const [sparkleId, setSparkleId] = useState<string | null>(null);
  const [formulaDraft, setFormulaDraft] = useState("");
  const [explanation, setExplanation] = useState("");
  const [formulaError, setFormulaError] = useState("");
  const [formulaSource, setFormulaSource] = useState("");
  const [columnName, setColumnName] = useState("");
  const [columnType, setColumnType] = useState<SheetColumnType>("number");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dirty = JSON.stringify(sheet) !== savedKey;
  const money = useMemo(() => sheetToMoneyLines(sheet), [sheet]);
  const view = useQuoteView(money, adjustment, dirty ? null : askingCents);
  const total = view.totalCents != null ? formatUsd(view.totalCents) : "—";
  const far = priceFarFromRange(view.totalCents, lowCents, highCents);
  const amount = amountColumn(sheet);
  const item = textColumn(sheet);

  async function persist(next: QuoteSheet) {
    setSheet(next);
    setSaving(true);
    setError("");
    const body = new FormData();
    body.set("quoteId", quoteId);
    body.set("sheet", JSON.stringify(next));
    try {
      await saveInlineSheet(body);
      router.refresh();
    } catch (caught) {
      if (typeof caught === "object" && caught && "digest" in caught) throw caught;
      setError("That line did not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function updateCell(rowId: string, columnId: string, value: string) {
    setSheet((current) => {
      const next = {
        ...current,
        rows: current.rows.map((row) => (row.id === rowId ? { ...row, cells: { ...row.cells, [columnId]: value } } : row)),
      };
      sheetRef.current = next;
      return next;
    });
  }

  async function openSparkle(column: SheetColumn) {
    const hints = formulaHints(sheet);
    const labels = Object.fromEntries(hints.map((hint) => [hint.id, hint.label]));
    const local = column.formula
      ? { formula: column.formula, explanation: explainFormula(column.formula, labels) }
      : suggestFormula(hints, column.id);
    setSparkleId(column.id);
    setFormulaDraft(local.formula);
    setExplanation(local.explanation);
    setFormulaError("");
    setFormulaSource("");
    try {
      const response = await fetch("/api/assistant/formula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: column.formula ? "explain" : "suggest",
          formula: column.formula || "",
          targetId: column.id,
          columns: hints,
        }),
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { formula?: string; explanation?: string; source?: string };
      if (payload.formula && parseFormula(payload.formula).ok) {
        setFormulaDraft(payload.formula);
        if (payload.explanation) setExplanation(payload.explanation);
        setFormulaSource(payload.source === "model" ? "Suggested from the assistant." : "");
      }
    } catch {
      setFormulaSource("");
    }
  }

  function applyFormula() {
    if (!sparkleId) return;
    const parsed = parseFormula(formulaDraft);
    if (!parsed.ok) {
      setFormulaError(parsed.error);
      return;
    }
    const next: QuoteSheet = {
      ...sheet,
      columns: sheet.columns.map((column) =>
        column.id === sparkleId ? { ...column, type: "formula", formula: formulaDraft.trim() } : column,
      ),
    };
    setSparkleId(null);
    void persist(next);
  }

  function addColumn() {
    const label = columnName.trim();
    if (!label) return;
    const id = columnIdFor(label, new Set(sheet.columns.map((column) => column.id)));
    const column: SheetColumn = { id, label: label.slice(0, 40), type: columnType };
    if (columnType === "formula") {
      column.formula = suggestFormula(formulaHints({ ...sheet, columns: [...sheet.columns, column] }), id).formula;
    }
    const next: QuoteSheet = {
      ...sheet,
      columns: [...sheet.columns, column],
      rows: sheet.rows.map((row) => ({ ...row, cells: { ...row.cells, [id]: id === "qty" ? "1" : "" } })),
    };
    setColumnName("");
    void persist(next);
  }

  function addRow() {
    void persist({ ...sheet, rows: [...sheet.rows, blankRow(sheet, sheet.rows.length)] });
  }

  let moneyIndex = 0;

  return (
    <div className="mt-3 min-w-0" data-spotlight="quote-lines">
      <p data-spotlight="asking-price" className="font-serif text-price text-pine tabular-nums lg:text-[3rem] lg:leading-[3.5rem]">
        {total}
      </p>
      {far && lowCents != null && highCents != null ? (
        <p role="status" className="mt-2 text-body leading-6 text-danger">
          That&apos;s far from the sold range of {formatUsd(lowCents)}–{formatUsd(highCents)}.
        </p>
      ) : null}
      {children}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[18rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-caption text-muted">
              <th className="w-14 px-0.5 py-1 font-semibold"> </th>
              {sheet.columns.map((column) => (
                <th key={column.id} className="px-1 py-1 font-semibold whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    {column.label}
                    {column.type === "formula" ? (
                      <button
                        type="button"
                        data-spotlight="quote-formula"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-pine"
                        aria-label={column.formula ? `Explain the ${column.label} formula` : `Suggest a formula for ${column.label}`}
                        onClick={() => void openSparkle(column)}
                      >
                        <SparkleIcon />
                      </button>
                    ) : null}
                  </span>
                </th>
              ))}
              <th className="w-8 px-0.5 py-1">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, index) => {
              const named = item ? Boolean((row.cells[item.id] || "").trim()) : false;
              const settled = named ? view.lines[moneyIndex++] : undefined;
              return (
                <tr key={row.id} className="border-b border-line">
                  <td className="px-0.5 py-0.5">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        className="h-6 w-8 rounded text-caption font-semibold text-pine disabled:opacity-30"
                        aria-label={`Move line ${index + 1} up`}
                        disabled={index === 0 || saving}
                        onClick={() => void persist(moveRow(sheet, index, -1))}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="h-6 w-8 rounded text-caption font-semibold text-pine disabled:opacity-30"
                        aria-label={`Move line ${index + 1} down`}
                        disabled={index === sheet.rows.length - 1 || saving}
                        onClick={() => void persist(moveRow(sheet, index, 1))}
                      >
                        Down
                      </button>
                    </div>
                  </td>
                  {sheet.columns.map((column) => (
                    <td key={column.id} className="px-1 py-0.5 align-middle">
                      {column.type === "formula" ? (
                        <span className="block min-w-[4.5rem] px-1 py-1 text-base font-semibold tabular-nums">
                          {column.id === amount?.id ? settled?.price || "—" : formulaCellLabel(sheet, row, column.id)}
                        </span>
                      ) : (
                        <input
                          aria-label={`${column.label} for line ${index + 1}`}
                          value={row.cells[column.id] || ""}
                          inputMode={column.type === "text" ? "text" : "decimal"}
                          onChange={(event) => updateCell(row.id, column.id, event.target.value)}
                          onBlur={() => {
                            if (JSON.stringify(sheetRef.current) !== savedKey) void persist(sheetRef.current);
                          }}
                          className="h-9 w-full min-w-[4.25rem] rounded-md border border-line bg-paper px-1.5 text-base"
                        />
                      )}
                    </td>
                  ))}
                  <td className="px-0.5 py-0.5">
                    <button
                      type="button"
                      className="h-9 w-8 rounded text-caption font-semibold text-muted"
                      aria-label={`Remove line ${index + 1}`}
                      disabled={saving}
                      onClick={() => void persist({ ...sheet, rows: sheet.rows.filter((itemRow) => itemRow.id !== row.id) })}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-line py-1">
        <span className="text-base font-semibold">Total</span>
        <span className="font-serif text-title text-pine tabular-nums">{total}</span>
      </div>
      {sparkleId ? (
        <div className="mt-2 rounded-xl border border-line bg-cream px-2 py-2">
          <p className="text-caption font-semibold text-pine">Formula</p>
          <p className="mt-1 text-caption leading-5 text-muted">{explanation}</p>
          {formulaSource ? <p className="mt-1 text-caption text-muted">{formulaSource}</p> : null}
          <label className="mt-2 block text-caption font-semibold">
            Edit formula
            <input
              value={formulaDraft}
              aria-label="Edit formula"
              onChange={(event) => {
                setFormulaDraft(event.target.value);
                setFormulaError("");
              }}
              className="mt-1 h-9 w-full rounded-md border border-line bg-paper px-2 text-base font-normal"
            />
          </label>
          {formulaError ? <p className="mt-1 text-caption text-danger">{formulaError}</p> : null}
          <button
            type="button"
            className="mt-2 inline-flex h-9 items-center rounded-xl bg-pine px-3 text-sm font-semibold text-cream"
            onClick={applyFormula}
          >
            Use this formula
          </button>
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <button
          type="button"
          data-spotlight="quote-add-line"
          className="inline-flex h-11 items-center rounded-2xl border border-line bg-paper px-3 text-base font-semibold"
          disabled={saving}
          onClick={addRow}
        >
          Add a line
        </button>
        <label className="block min-w-0 flex-1 text-caption font-semibold">
          Column
          <input
            value={columnName}
            aria-label="New column name"
            placeholder="Hours"
            onChange={(event) => setColumnName(event.target.value)}
            className="mt-1 h-11 w-full min-w-[6rem] rounded-2xl border border-line bg-paper px-3 text-base font-normal"
          />
        </label>
        <label className="block text-caption font-semibold">
          Type
          <select
            aria-label="New column type"
            value={columnType}
            onChange={(event) => setColumnType(event.target.value as SheetColumnType)}
            className="mt-1 h-11 rounded-2xl border border-line bg-paper px-2 text-base font-normal"
          >
            <option value="number">Number</option>
            <option value="money">Money</option>
            <option value="text">Text</option>
            <option value="formula">Calculated</option>
          </select>
        </label>
        <button
          type="button"
          className="inline-flex h-11 items-center rounded-2xl border border-line bg-paper px-3 text-base font-semibold"
          disabled={saving || !columnName.trim()}
          onClick={addColumn}
        >
          Add column
        </button>
      </div>
      {saving ? <p className="mt-1 text-caption text-muted">Saving…</p> : null}
      {error ? <p className="mt-1 text-caption text-danger">{error}</p> : null}
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5 13.9 8.1 19.5 10 13.9 11.9 12 17.5 10.1 11.9 4.5 10 10.1 8.1 12 2.5Z" fill="currentColor" />
      <path d="M18 14.2 18.8 16.6 21.2 17.4 18.8 18.2 18 20.6 17.2 18.2 14.8 17.4 17.2 16.6 18 14.2Z" fill="currentColor" />
    </svg>
  );
}
