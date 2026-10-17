"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { saveInlineSheet } from "@/app/guide-actions";
import { publishSheetTotal, useQuoteView } from "@/components/asking-price";
import { explainFormula, parseFormula, suggestFormula } from "@/lib/guide/formula";
import type { Adjustment } from "@/lib/guide/pricing";
import {
  amountColumn,
  blankRow,
  cellFormulaError,
  columnIdFor,
  effectiveFormula,
  formulaCellLabel,
  formulaHints,
  moveColumnTo,
  moveRowTo,
  sheetDisplay,
  sheetToMoneyLines,
  textColumn,
  type QuoteSheet,
  type SheetColumn,
  type SheetColumnType,
  type SheetRow,
} from "@/lib/guide/sheet";
import { priceFarFromRange } from "@/lib/market-shared";
import { formatUsd } from "@/lib/money";

const TYPES: { value: SheetColumnType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "money", label: "Money" },
  { value: "formula", label: "Calculated" },
];

type Axis = "row" | "col";

type Popover =
  | { kind: "type"; columnId: string; top: number; left: number }
  | { kind: "move"; axis: Axis; index: number; top: number; left: number }
  | { kind: "formula"; columnId: string; rowId: string | null; top: number; left: number };

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
  const pendingRef = useRef<QuoteSheet | null>(null);
  const flushing = useRef(false);
  const incoming = JSON.stringify(initialSheet);
  if (incoming !== savedKey && JSON.stringify(sheet) === savedKey && !pendingRef.current && !flushing.current) {
    setSavedKey(incoming);
    setSheet(initialSheet);
  }
  const formulaTouched = useRef(false);
  const [popover, setPopover] = useState<Popover | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [formulaDraft, setFormulaDraft] = useState("");
  const [explanation, setExplanation] = useState("");
  const [formulaError, setFormulaError] = useState("");
  const [formulaSource, setFormulaSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [drop, setDrop] = useState<{ axis: Axis; index: number } | null>(null);
  const drag = useRef<{ axis: Axis; from: number; over: number; x: number; y: number; moved: boolean } | null>(null);

  const dirty = JSON.stringify(sheet) !== savedKey;
  const money = useMemo(() => sheetToMoneyLines(sheet), [sheet]);
  const view = useQuoteView(money, adjustment, dirty ? null : askingCents);
  const total = view.totalCents != null ? formatUsd(view.totalCents) : "—";
  const far = priceFarFromRange(view.totalCents, lowCents, highCents);
  const amount = amountColumn(sheet);
  const item = textColumn(sheet);
  const grid = useMemo(
    () => sheetDisplay(sheet, adjustment, dirty ? null : askingCents),
    [sheet, adjustment, dirty, askingCents],
  );
  const quiet = sheet.columns.filter(
    (column) => column.type === "formula" && column.id !== amount?.id && column.countsInTotal !== true,
  );

  useEffect(() => {
    publishSheetTotal(view.totalCents);
  }, [view.totalCents]);

  useEffect(() => {
    function close(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-sheet-popover], [data-sheet-trigger]")) return;
      setPopover(null);
    }
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, []);

  async function flush() {
    if (flushing.current) return;
    flushing.current = true;
    setSaving(true);
    try {
      while (pendingRef.current) {
        const next = pendingRef.current;
        pendingRef.current = null;
        const body = new FormData();
        body.set("quoteId", quoteId);
        body.set("sheet", JSON.stringify(next));
        await saveInlineSheet(body);
        if (!pendingRef.current && JSON.stringify(sheetRef.current) === JSON.stringify(next)) {
          setSavedKey(JSON.stringify(next));
        }
        router.refresh();
      }
    } catch (caught) {
      if (typeof caught === "object" && caught && "digest" in caught) throw caught;
      setError("That line did not save. Try again.");
    } finally {
      flushing.current = false;
      if (pendingRef.current) void flush();
      else setSaving(false);
    }
  }

  function persist(next: QuoteSheet) {
    setSheet(next);
    sheetRef.current = next;
    pendingRef.current = next;
    setError("");
    void flush();
  }

  function updateCell(rowId: string, columnId: string, value: string) {
    setSheet((current) => {
      const next = {
        ...current,
        rows: current.rows.map((row) =>
          row.id === rowId ? { ...row, cells: { ...row.cells, [columnId]: value } } : row,
        ),
      };
      sheetRef.current = next;
      return next;
    });
  }

  function commitCell(rowId: string, columnId: string, value: string) {
    const current = sheetRef.current;
    const row = current.rows.find((itemRow) => itemRow.id === rowId);
    const column = current.columns.find((itemColumn) => itemColumn.id === columnId);
    if (!row || !column) return;
    const trimmed = value.trim();
    const calculated = column.type === "formula" || Boolean(effectiveFormula(column, row)) || Boolean(row.formulas && columnId in row.formulas);
    if (calculated) {
      const parsed = parseFormula(trimmed);
      if (trimmed && !parsed.ok) {
        setError(parsed.error);
        return;
      }
      const formulas = { ...(row.formulas ?? {}) };
      if (!trimmed || trimmed === (column.formula || "")) delete formulas[column.id];
      else formulas[column.id] = trimmed;
      const next = {
        ...current,
        rows: current.rows.map((itemRow) =>
          itemRow.id === row.id
            ? { ...itemRow, formulas: Object.keys(formulas).length ? formulas : undefined }
            : itemRow,
        ),
      };
      if (JSON.stringify(next) !== savedKey) persist(next);
      return;
    }
    if (JSON.stringify(current) !== savedKey) persist(current);
  }

  function place(target: HTMLElement, width: number) {
    const rect = target.getBoundingClientRect();
    return {
      top: Math.min(rect.bottom + 4, window.innerHeight - 12),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    };
  }

  function openFormula(column: SheetColumn, row: SheetRow | null, target: HTMLElement) {
    const formula = row ? effectiveFormula(column, row) : column.formula || "";
    const hints = formulaHints(sheetRef.current);
    const labels = Object.fromEntries(hints.map((hint) => [hint.id, hint.label]));
    formulaTouched.current = false;
    setFormulaDraft(formula);
    setFormulaError("");
    setFormulaSource("");
    setExplanation(formula ? explainFormula(formula, labels) : "Suggest a formula from the column name and the other columns.");
    setPopover({ kind: "formula", columnId: column.id, rowId: row?.id ?? null, ...place(target, 272) });
    if (!formula) void runSuggest(column.id);
    else void runExplain(column.id, formula);
  }

  async function runSuggest(columnId: string) {
    const hints = formulaHints(sheetRef.current);
    const local = suggestFormula(hints, columnId);
    formulaTouched.current = false;
    setFormulaDraft(local.formula);
    setExplanation(local.explanation);
    setFormulaSource("");
    try {
      const response = await fetch("/api/assistant/formula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "suggest", formula: "", targetId: columnId, columns: hints }),
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { formula?: string; explanation?: string; source?: string };
      if (!formulaTouched.current && payload.formula && parseFormula(payload.formula).ok) {
        setFormulaDraft(payload.formula);
        if (payload.explanation) setExplanation(payload.explanation);
        setFormulaSource(payload.source === "model" ? "Suggested from the assistant." : "");
      }
    } catch {
      setFormulaSource("");
    }
  }

  async function runExplain(columnId: string, formula: string) {
    const hints = formulaHints(sheetRef.current);
    try {
      const response = await fetch("/api/assistant/formula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "explain", formula, targetId: columnId, columns: hints }),
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { explanation?: string; source?: string };
      if (!formulaTouched.current && payload.explanation) setExplanation(payload.explanation);
    } catch {
      setFormulaSource("");
    }
  }

  function applyFormula(scope: "cell" | "column") {
    if (!popover || popover.kind !== "formula") return;
    const parsed = parseFormula(formulaDraft);
    if (!parsed.ok) {
      setFormulaError(parsed.error);
      return;
    }
    const current = sheetRef.current;
    const formula = formulaDraft.trim();
    if (scope === "cell" && popover.rowId) {
      persist({
        ...current,
        rows: current.rows.map((row) => {
          if (row.id !== popover.rowId) return row;
          return { ...row, formulas: { ...(row.formulas ?? {}), [popover.columnId]: formula } };
        }),
      });
    } else {
      persist({
        ...current,
        columns: current.columns.map((column) =>
          column.id === popover.columnId
            ? {
                ...column,
                type: "formula",
                formula,
                ...(column.id === amount?.id || column.countsInTotal ? { countsInTotal: column.countsInTotal } : { countsInTotal: true }),
              }
            : column,
        ),
      });
    }
    setPopover(null);
  }

  function addColumn() {
    const current = sheetRef.current;
    const taken = new Set(current.columns.map((column) => column.id));
    const used = current.columns.filter((column) => /^Column( \d+)?$/.test(column.label)).length;
    const label = used === 0 ? "Column" : `Column ${used + 1}`;
    const id = columnIdFor(label, taken);
    const column: SheetColumn = { id, label, type: "number" };
    persist({
      ...current,
      columns: [...current.columns, column],
      rows: current.rows.map((row) => ({ ...row, cells: { ...row.cells, [id]: "" } })),
    });
    setRenamingId(id);
    setPopover(null);
  }

  function addRow() {
    const current = sheetRef.current;
    persist({ ...current, rows: [...current.rows, blankRow(current, current.rows.length)] });
  }

  function rename(columnId: string, label: string) {
    const nextLabel = label.replace(/\s+/g, " ").slice(0, 40);
    setSheet((current) => {
      const next = {
        ...current,
        columns: current.columns.map((column) => (column.id === columnId ? { ...column, label: nextLabel || column.label } : column)),
      };
      sheetRef.current = next;
      return next;
    });
  }

  function setType(column: SheetColumn, type: SheetColumnType) {
    const current = sheetRef.current;
    const nextColumn: SheetColumn = { ...column, type };
    if (type === "formula") {
      nextColumn.formula = column.formula || suggestFormula(formulaHints(current), column.id).formula;
      if (column.id !== amount?.id) nextColumn.countsInTotal = column.countsInTotal ?? true;
    } else {
      delete nextColumn.formula;
      delete nextColumn.countsInTotal;
    }
    persist({
      ...current,
      columns: current.columns.map((itemColumn) => (itemColumn.id === column.id ? nextColumn : itemColumn)),
    });
    setPopover(null);
  }

  function toggleCounts(column: SheetColumn) {
    const current = sheetRef.current;
    persist({
      ...current,
      columns: current.columns.map((itemColumn) =>
        itemColumn.id === column.id ? { ...itemColumn, countsInTotal: itemColumn.countsInTotal !== true } : itemColumn,
      ),
    });
  }

  function removeAt(axis: Axis, index: number) {
    const current = sheetRef.current;
    if (axis === "row") {
      persist({ ...current, rows: current.rows.filter((_, rowIndex) => rowIndex !== index) });
      return;
    }
    const column = current.columns[index];
    if (!column) return;
    if (column.type === "text" && current.columns.filter((itemColumn) => itemColumn.type === "text").length === 1) return;
    if (column.id === amount?.id) return;
    persist({
      ...current,
      columns: current.columns.filter((itemColumn) => itemColumn.id !== column.id),
      rows: current.rows.map((row) => {
        const cells = { ...row.cells };
        const formulas = { ...(row.formulas ?? {}) };
        delete cells[column.id];
        delete formulas[column.id];
        return { ...row, cells, formulas: Object.keys(formulas).length ? formulas : undefined };
      }),
    });
  }

  function move(axis: Axis, from: number, to: number) {
    const current = sheetRef.current;
    persist(axis === "row" ? moveRowTo(current, from, to) : moveColumnTo(current, from, to));
  }

  function onGripDown(axis: Axis, index: number, event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { axis, from: index, over: index, x: event.clientX, y: event.clientY, moved: false };
  }

  function onGripMove(event: React.PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current) return;
    if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6) return;
    current.moved = true;
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const attr = current.axis === "row" ? "data-row-index" : "data-col-index";
    const node = hit?.closest(`[${attr}]`);
    if (!(node instanceof HTMLElement)) return;
    const over = Number(node.dataset[current.axis === "row" ? "rowIndex" : "colIndex"]);
    if (!Number.isInteger(over)) return;
    current.over = over;
    setDrop({ axis: current.axis, index: over });
  }

  function onGripUp(event: React.PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    drag.current = null;
    setDrop(null);
    if (!current) return;
    if (current.moved) {
      if (current.from !== current.over) move(current.axis, current.from, current.over);
      return;
    }
    const spot = place(event.currentTarget, 176);
    setPopover({ kind: "move", axis: current.axis, index: current.from, ...spot });
  }

  function onCellKey(event: React.KeyboardEvent<HTMLElement>, rowIndex: number, colIndex: number) {
    if (event.key !== "Tab" && event.key !== "Enter") return;
    if (event.key === "Enter" && (event.target instanceof HTMLTextAreaElement)) return;
    event.preventDefault();
    let row = rowIndex;
    let col = colIndex;
    if (event.key === "Enter") row += event.shiftKey ? -1 : 1;
    else col += event.shiftKey ? -1 : 1;
    if (col >= sheet.columns.length) {
      col = 0;
      row += 1;
    }
    if (col < 0) {
      col = sheet.columns.length - 1;
      row -= 1;
    }
    const next = document.querySelector<HTMLElement>(`[data-cell="${row}-${col}"]`);
    next?.focus();
  }

  function onMenuKey(event: React.KeyboardEvent<HTMLButtonElement>, axis: Axis, index: number, count: number) {
    const key = event.key;
    if (key === "ArrowUp" && axis === "row" && index > 0) {
      event.preventDefault();
      move("row", index, index - 1);
    } else if (key === "ArrowDown" && axis === "row" && index < count - 1) {
      event.preventDefault();
      move("row", index, index + 1);
    } else if (key === "ArrowLeft" && axis === "col" && index > 0) {
      event.preventDefault();
      move("col", index, index - 1);
    } else if (key === "ArrowRight" && axis === "col" && index < count - 1) {
      event.preventDefault();
      move("col", index, index + 1);
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      setPopover({ kind: "move", axis, index, ...place(event.currentTarget, 176) });
    }
  }

  let namedIndex = -1;

  return (
    <div className="mt-3 min-w-0 max-w-full" data-spotlight="quote-lines">
      <p data-spotlight="asking-price" className="font-serif text-price text-pine tabular-nums lg:text-[3rem] lg:leading-[3.5rem]">
        {total}
      </p>
      {far && lowCents != null && highCents != null ? (
        <p role="status" className="mt-2 text-body leading-6 text-danger">
          That&apos;s far from the sold range of {formatUsd(lowCents)}–{formatUsd(highCents)}.
        </p>
      ) : null}
      {children}
      <div data-sheet-scroll="" className="mt-3 max-w-full overflow-x-auto overscroll-x-contain">
        <table className="w-max min-w-full border-collapse text-left sm:w-full sm:table-fixed">
          <thead>
            <tr className="border-b border-line text-caption text-muted">
              <th className="sticky left-0 z-20 w-11 bg-paper p-0 sm:w-8" />
              {sheet.columns.map((column, index) => (
                <th
                  key={column.id}
                  data-col-index={index}
                  className={`bg-paper p-0 font-semibold ${stickyClass(column, index, sheet)} ${drop?.axis === "col" && drop.index === index ? "bg-cream" : ""}`}
                >
                  <div className="flex h-11 min-w-0 items-center sm:h-9">
                    <button
                      type="button"
                      data-sheet-trigger=""
                      draggable={false}
                      aria-label={`Reorder ${column.label} column`}
                      aria-haspopup="menu"
                      className="grid h-11 w-6 shrink-0 touch-none place-items-center text-muted sm:h-9"
                      onPointerDown={(event) => onGripDown("col", index, event)}
                      onPointerMove={onGripMove}
                      onPointerUp={onGripUp}
                      onKeyDown={(event) => onMenuKey(event, "col", index, sheet.columns.length)}
                    >
                      <GripIcon />
                    </button>
                    {renamingId === column.id ? (
                      <input
                        aria-label={`${column.label} column name`}
                        value={column.label}
                        autoFocus
                        onChange={(event) => rename(column.id, event.target.value)}
                        onBlur={() => {
                          setRenamingId(null);
                          if (JSON.stringify(sheetRef.current) !== savedKey) persist(sheetRef.current);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                        }}
                        className="h-9 min-w-0 flex-1 bg-transparent px-0.5 text-base font-semibold text-ink outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        data-sheet-trigger=""
                        aria-label={`${column.label} column name`}
                        className="h-11 min-w-0 flex-1 truncate px-0.5 text-left text-caption font-semibold sm:h-9"
                        onClick={(event) => {
                          setRenamingId(column.id);
                          setPopover({ kind: "type", columnId: column.id, ...place(event.currentTarget, 200) });
                        }}
                      >
                        {column.label}
                      </button>
                    )}
                    {column.type === "formula" || column.formula ? (
                      <button
                        type="button"
                        data-sheet-trigger=""
                        data-spotlight="quote-formula"
                        aria-label={`Formula for ${column.label}`}
                        className="grid h-11 w-6 shrink-0 place-items-center text-pine sm:h-9"
                        onClick={(event) => openFormula(column, null, event.currentTarget)}
                      >
                        <SparkleIcon />
                      </button>
                    ) : null}
                  </div>
                </th>
              ))}
              <th className="bg-paper p-0">
                <button
                  type="button"
                  className="h-11 whitespace-nowrap px-2 text-sm font-semibold text-pine sm:h-9"
                  onClick={addColumn}
                >
                  + Column
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, rowIndex) => {
              const named = item ? Boolean((row.cells[item.id] || "").trim()) : false;
              if (named) namedIndex += 1;
              const gridRow = named ? grid.rows[namedIndex] : undefined;
              return (
                <tr
                  key={row.id}
                  data-row-index={rowIndex}
                  className={`border-b border-line ${drop?.axis === "row" && drop.index === rowIndex ? "bg-cream" : ""}`}
                >
                  <td className="sticky left-0 z-20 bg-paper p-0">
                    <button
                      type="button"
                      data-sheet-trigger=""
                      draggable={false}
                      aria-label={`Reorder line ${rowIndex + 1}`}
                      aria-haspopup="menu"
                      className="grid h-11 w-11 touch-none place-items-center text-muted sm:h-9 sm:w-8"
                      onPointerDown={(event) => onGripDown("row", rowIndex, event)}
                      onPointerMove={onGripMove}
                      onPointerUp={onGripUp}
                      onKeyDown={(event) => onMenuKey(event, "row", rowIndex, sheet.rows.length)}
                    >
                      <GripIcon />
                    </button>
                  </td>
                  {sheet.columns.map((column, colIndex) => {
                    const formula = effectiveFormula(column, row);
                    const calculated = column.type === "formula" || Boolean(formula);
                    const shown = calculated ? gridRow?.[colIndex] || formulaCellLabel(sheet, row, column.id) : row.cells[column.id] || "";
                    const key = `${row.id}:${column.id}`;
                    return (
                      <td
                        key={column.id}
                        data-col-index={colIndex}
                        className={`p-0 ${stickyClass(column, colIndex, sheet)} ${column.type === "text" ? "text-left" : "text-right"}`}
                      >
                        <SheetCell
                          label={`${column.label} for line ${rowIndex + 1}`}
                          cellKey={`${rowIndex}-${colIndex}`}
                          column={column}
                          formula={formula}
                          shown={shown}
                          cellText={row.cells[column.id] || ""}
                          calculated={calculated}
                          active={activeKey === key}
                          error={cellFormulaError(sheet, row, column.id)}
                          onActivate={() => setActiveKey(key)}
                          onEditText={(value) => updateCell(row.id, column.id, value)}
                          onEditFormula={(value) => updateCellFormula(setSheet, sheetRef, row.id, { ...(row.formulas ?? {}), [column.id]: value })}
                          onCommit={(value) => {
                            setActiveKey((current) => (current === key ? null : current));
                            commitCell(row.id, column.id, value);
                          }}
                          onKey={(event) => onCellKey(event, rowIndex, colIndex)}
                          onSparkle={(target) => openFormula(column, row, target)}
                        />
                      </td>
                    );
                  })}
                  <td />
                </tr>
              );
            })}
            <tr className="border-t border-line">
              <td className="sticky left-0 z-20 bg-paper" />
              {sheet.columns.map((column, index) => (
                <td key={column.id} className={`px-1.5 py-1 text-base font-semibold tabular-nums ${stickyClass(column, index, sheet)} ${column.type === "text" ? "text-left" : "text-right"}`}>
                  {column.id === amount?.id ? total : column.type === "text" && index === sheet.columns.findIndex((itemColumn) => itemColumn.type === "text") ? "Total" : ""}
                </td>
              ))}
              <td />
            </tr>
            <tr>
              <td className="sticky left-0 z-20 bg-paper p-0" />
              <td colSpan={sheet.columns.length + 1} className="p-0">
                <button
                  type="button"
                  data-spotlight="quote-add-line"
                  className="h-11 px-2 text-left text-sm font-semibold text-pine sm:h-9"
                  onClick={addRow}
                >
                  + Row
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {quiet.length > 0 ? (
        <p className="mt-1 text-caption text-muted">
          {quiet.map((column) => column.label).join(", ")} {quiet.length === 1 ? "is" : "are"} not in the total. Open the column type to count it.
        </p>
      ) : null}
      {saving ? <p className="mt-1 text-caption text-muted">Saving…</p> : null}
      {error ? <p className="mt-1 text-caption text-danger">{error}</p> : null}
      {popover?.kind === "type" ? (
        <TypeMenu
          popover={popover}
          column={sheet.columns.find((column) => column.id === popover.columnId) ?? null}
          isAmount={popover.columnId === amount?.id}
          onType={setType}
          onToggle={toggleCounts}
        />
      ) : null}
      {popover?.kind === "move" ? (
        <MoveMenu
          popover={popover}
          count={popover.axis === "row" ? sheet.rows.length : sheet.columns.length}
          onMove={(direction) => {
            move(popover.axis, popover.index, popover.index + direction);
            setPopover(null);
          }}
          onRemove={() => {
            removeAt(popover.axis, popover.index);
            setPopover(null);
          }}
        />
      ) : null}
      {popover?.kind === "formula" ? (
        <div data-sheet-popover="" className="fixed z-50 w-[17rem] rounded-xl border border-line bg-paper p-2 shadow-card" style={{ top: popover.top, left: popover.left }}>
          <p className="text-caption font-semibold text-pine">Formula</p>
          <p className="mt-1 text-caption leading-5 text-muted">{explanation}</p>
          {formulaSource ? <p className="mt-1 text-caption text-muted">{formulaSource}</p> : null}
          <label className="mt-2 block text-caption font-semibold">
            Edit formula
            <input
              value={formulaDraft}
              aria-label="Edit formula"
              onChange={(event) => {
                formulaTouched.current = true;
                setFormulaDraft(event.target.value);
                setFormulaError("");
              }}
              className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-2 text-base font-normal sm:h-9"
            />
          </label>
          {formulaError ? <p className="mt-1 text-caption text-danger">{formulaError}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="inline-flex h-11 items-center rounded-xl border border-line px-3 text-sm font-semibold" onClick={() => void runSuggest(popover.columnId)}>
              Suggest a formula
            </button>
            <button type="button" className="inline-flex h-11 items-center rounded-xl bg-pine px-3 text-sm font-semibold text-cream" onClick={() => applyFormula(popover.rowId ? "cell" : "column")}>
              Use this formula
            </button>
          </div>
          {popover.rowId ? (
            <button type="button" className="mt-2 inline-flex h-11 items-center text-sm font-semibold text-pine" onClick={() => applyFormula("column")}>
              Use for every row
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function updateCellFormula(setSheet: (value: QuoteSheet | ((current: QuoteSheet) => QuoteSheet)) => void, sheetRef: { current: QuoteSheet }, rowId: string, formulas: Record<string, string>) {
  setSheet((current) => {
    const next = {
      ...current,
      rows: current.rows.map((row) => (row.id === rowId ? { ...row, formulas } : row)),
    };
    sheetRef.current = next;
    return next;
  });
}

function SheetCell({
  label,
  cellKey,
  column,
  formula,
  shown,
  cellText,
  calculated,
  active,
  error,
  onActivate,
  onEditText,
  onEditFormula,
  onCommit,
  onKey,
  onSparkle,
}: {
  label: string;
  cellKey: string;
  column: SheetColumn;
  formula: string;
  shown: string;
  cellText: string;
  calculated: boolean;
  active: boolean;
  error: string;
  onActivate: () => void;
  onEditText: (value: string) => void;
  onEditFormula: (value: string) => void;
  onCommit: (value: string) => void;
  onKey: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onSparkle: (target: HTMLButtonElement) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const numeric = column.type !== "text";
  const value = draft != null ? draft : calculated ? shown : cellText;
  return (
    <div className="group relative" data-active={active ? "true" : "false"}>
      <input
        data-cell={cellKey}
        aria-label={label}
        inputMode={column.type === "text" ? "text" : "decimal"}
        value={value}
        onFocus={() => {
          onActivate();
          if (calculated) setDraft(formula);
        }}
        onChange={(event) => {
          const next = event.target.value;
          if (calculated || draft != null) {
            setDraft(next);
            onEditFormula(next);
            return;
          }
          onEditText(next);
        }}
        onBlur={(event) => {
          const next = event.currentTarget.value;
          setDraft(null);
          onCommit(next);
        }}
        onKeyDown={onKey}
        className={`h-11 w-full min-w-0 bg-transparent px-1.5 text-base tabular-nums outline-none focus:bg-cream sm:h-9 ${numeric ? "text-right" : "text-left"} ${formula ? "pl-4" : ""}`}
      />
      {column.type !== "text" ? (
        <button
          type="button"
          data-sheet-trigger=""
          aria-label={`Sparkle ${column.label} row ${label.split(" ").slice(-1)[0]}`}
          className={`absolute right-0 top-0 grid h-11 w-6 place-items-center text-pine sm:h-9 ${active ? "opacity-100" : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => onSparkle(event.currentTarget)}
        >
          <SparkleIcon />
        </button>
      ) : null}
      {formula ? (
        <span className="pointer-events-none absolute bottom-0 left-1 top-0 flex items-center text-[10px] font-semibold text-pine">fx</span>
      ) : null}
      {error ? <span className="block px-1.5 pb-1 text-left text-caption text-danger">{error}</span> : null}
    </div>
  );
}

function stickyClass(column: SheetColumn, index: number, sheet: QuoteSheet): string {
  const firstText = sheet.columns.findIndex((item) => item.type === "text");
  if (index === firstText) return "sticky left-11 z-10 w-20 min-w-20 max-w-20 bg-paper sm:left-8 sm:w-auto sm:min-w-[9rem] sm:max-w-none";
  if (column.id === "amount") return "sticky right-0 z-10 w-[4.75rem] min-w-[4.75rem] max-w-[4.75rem] bg-paper shadow-[-8px_0_8px_-8px_rgba(30,70,54,0.18)] sm:w-auto sm:min-w-[6.5rem] sm:max-w-none";
  if (column.id === "qty") return "w-[3.25rem] min-w-[3.25rem] max-w-[3.25rem] sm:w-16 sm:max-w-none";
  if (column.type === "number") return "w-14 min-w-14 max-w-14 sm:w-16 sm:max-w-none";
  return "w-[3.75rem] min-w-[3.75rem] max-w-[3.75rem] bg-paper sm:w-24 sm:max-w-none";
}

function TypeMenu({
  popover,
  column,
  isAmount,
  onType,
  onToggle,
}: {
  popover: { top: number; left: number };
  column: SheetColumn | null;
  isAmount: boolean;
  onType: (column: SheetColumn, type: SheetColumnType) => void;
  onToggle: (column: SheetColumn) => void;
}) {
  if (!column) return null;
  return (
    <div data-sheet-popover="" role="menu" className="fixed z-50 w-[12.5rem] rounded-xl border border-line bg-paper p-1 shadow-card" style={{ top: popover.top, left: popover.left }}>
      {TYPES.map((type) => (
        <button
          key={type.value}
          type="button"
          role="menuitemradio"
          aria-checked={column.type === type.value}
          className={`flex h-11 w-full items-center rounded-lg px-2 text-left text-sm font-semibold ${column.type === type.value ? "bg-cream text-pine" : ""}`}
          onClick={() => onType(column, type.value)}
        >
          {type.label}
        </button>
      ))}
      {column.type === "formula" ? (
        isAmount ? (
          <p className="px-2 py-2 text-caption leading-5 text-muted">This column is the line amount, so it counts toward the total.</p>
        ) : (
          <label className="flex min-h-11 items-center gap-2 px-2 text-sm font-semibold">
            <input type="checkbox" checked={column.countsInTotal === true} onChange={() => onToggle(column)} />
            Counts toward total
          </label>
        )
      ) : null}
    </div>
  );
}

function MoveMenu({
  popover,
  count,
  onMove,
  onRemove,
}: {
  popover: { axis: Axis; index: number; top: number; left: number };
  count: number;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const backward = popover.axis === "row" ? "Move up" : "Move left";
  const forward = popover.axis === "row" ? "Move down" : "Move right";
  return (
    <div data-sheet-popover="" role="menu" className="fixed z-50 w-44 rounded-xl border border-line bg-paper p-1 shadow-card" style={{ top: popover.top, left: popover.left }}>
      <button type="button" role="menuitem" className="flex h-11 w-full items-center rounded-lg px-2 text-left text-sm font-semibold disabled:opacity-40" disabled={popover.index === 0} onClick={() => onMove(-1)}>
        {backward}
      </button>
      <button type="button" role="menuitem" className="flex h-11 w-full items-center rounded-lg px-2 text-left text-sm font-semibold disabled:opacity-40" disabled={popover.index >= count - 1} onClick={() => onMove(1)}>
        {forward}
      </button>
      <button type="button" role="menuitem" className="flex h-11 w-full items-center rounded-lg px-2 text-left text-sm font-semibold text-danger" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}

function GripIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
      <circle cx="2" cy="2" r="1.2" fill="currentColor" />
      <circle cx="8" cy="2" r="1.2" fill="currentColor" />
      <circle cx="2" cy="8" r="1.2" fill="currentColor" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
      <circle cx="2" cy="14" r="1.2" fill="currentColor" />
      <circle cx="8" cy="14" r="1.2" fill="currentColor" />
    </svg>
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
