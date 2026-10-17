import { dollarsInputValue, formatUsd, parseDollarsToCents } from "../money";
import { linesAtAsking, lineSettlement, settledTotal, type Adjustment, type MoneyLine } from "./pricing";
import { evaluateFormula, formulaRefs, parseFormula, type FormulaColumnHint } from "./formula";

export type SheetColumnType = "text" | "number" | "money" | "formula";

export interface SheetColumn {
  id: string;
  label: string;
  type: SheetColumnType;
  formula?: string;
}

export interface SheetRow {
  id: string;
  cells: Record<string, string>;
}

export interface QuoteSheet {
  version: 1;
  columns: SheetColumn[];
  rows: SheetRow[];
}

export interface SheetGrid {
  columns: string[];
  rows: string[][];
}

const SHEET_PREFIX = "meta:sheet=";
const MAX_COLUMNS = 12;
const MAX_ROWS = 40;

export function defaultColumns(): SheetColumn[] {
  return [
    { id: "item", label: "Item", type: "text" },
    { id: "qty", label: "Qty", type: "number" },
    { id: "rate", label: "Rate", type: "money" },
    { id: "amount", label: "Amount", type: "formula", formula: "qty * rate" },
  ];
}

export function sheetFromLines(lines: MoneyLine[]): QuoteSheet {
  return {
    version: 1,
    columns: defaultColumns(),
    rows: lines.map((line, index) => ({
      id: `row-${index + 1}`,
      cells: {
        item: line.name,
        qty: formatQuantity(line.quantity),
        rate: dollarsInputValue(line.unitPriceCents),
      },
    })),
  };
}

export function columnIdFor(label: string, taken: Set<string>): string {
  const stem = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  let base = /^[a-z]/.test(stem) ? stem : `col_${stem || "field"}`;
  base = base.slice(0, 28);
  let id = base;
  let n = 2;
  while (taken.has(id)) {
    id = `${base}_${n}`;
    n += 1;
  }
  return id;
}

export function isClassicAmount(sheet: QuoteSheet): boolean {
  const amount = amountColumn(sheet);
  if (!amount || amount.type !== "formula") return false;
  return (amount.formula || "").replace(/\s+/g, "") === "qty*rate";
}

export function amountColumn(sheet: QuoteSheet): SheetColumn | undefined {
  return (
    sheet.columns.find((column) => column.id === "amount" && column.type === "formula") ||
    sheet.columns.find((column) => column.type === "formula")
  );
}

export function textColumn(sheet: QuoteSheet): SheetColumn | undefined {
  return sheet.columns.find((column) => column.type === "text");
}

/** Existing quotes become a qty × rate sheet. Invalid stored JSON is ignored. */
export function normalizeSheet(value: unknown): QuoteSheet | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { columns?: unknown; rows?: unknown };
  if (!Array.isArray(record.columns) || !Array.isArray(record.rows)) return null;
  if (record.columns.length === 0 || record.columns.length > MAX_COLUMNS || record.rows.length > MAX_ROWS) return null;
  const columns: SheetColumn[] = [];
  const ids = new Set<string>();
  for (const entry of record.columns) {
    if (!entry || typeof entry !== "object") return null;
    const column = entry as { id?: unknown; label?: unknown; type?: unknown; formula?: unknown };
    const type = column.type;
    if (type !== "text" && type !== "number" && type !== "money" && type !== "formula") return null;
    const id = typeof column.id === "string" ? column.id : "";
    const label = typeof column.label === "string" ? column.label.trim().slice(0, 40) : "";
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(id) || id.length > 32 || !label || ids.has(id)) return null;
    ids.add(id);
    if (type === "formula") {
      const formula = typeof column.formula === "string" ? column.formula.trim().slice(0, 180) : "";
      const parsed = parseFormula(formula);
      if (!parsed.ok) return null;
      columns.push({ id, label, type, formula });
    } else {
      columns.push({ id, label, type });
    }
  }
  if (!columns.some((column) => column.type === "text")) return null;
  const rows: SheetRow[] = [];
  record.rows.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const row = entry as { id?: unknown; cells?: unknown };
    const cells: Record<string, string> = {};
    const raw = row.cells && typeof row.cells === "object" ? (row.cells as Record<string, unknown>) : {};
    for (const column of columns) {
      const value = raw[column.id];
      cells[column.id] = typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 80) : "";
    }
    const id = typeof row.id === "string" && row.id.length > 0 && row.id.length < 40 ? row.id : `row-${index + 1}`;
    rows.push({ id, cells });
  });
  return { version: 1, columns, rows };
}

export function sheetFromSources(sources: string[]): QuoteSheet | null {
  const found = sources.find((source) => source.startsWith(SHEET_PREFIX));
  if (!found) return null;
  try {
    return normalizeSheet(JSON.parse(decodeURIComponent(found.slice(SHEET_PREFIX.length))));
  } catch {
    return null;
  }
}

export function sourcesWithSheet(sources: string[], sheet: QuoteSheet): string[] {
  const kept = sources.filter((source) => !source.startsWith(SHEET_PREFIX));
  return [...kept, SHEET_PREFIX + encodeURIComponent(JSON.stringify(sheet))];
}

export function moveRow(sheet: QuoteSheet, index: number, direction: -1 | 1): QuoteSheet {
  const next = index + direction;
  if (index < 0 || next < 0 || index >= sheet.rows.length || next >= sheet.rows.length) return sheet;
  const rows = sheet.rows.slice();
  const [row] = rows.splice(index, 1);
  rows.splice(next, 0, row);
  return { ...sheet, rows };
}

export function blankRow(sheet: QuoteSheet, index: number): SheetRow {
  const cells: Record<string, string> = {};
  for (const column of sheet.columns) {
    cells[column.id] = column.id === "qty" ? "1" : "";
  }
  return { id: `row-${index + 1}-${Math.random().toString(36).slice(2, 8)}`, cells };
}

/**
 * Keeps custom columns when a preset, a nudge, or Your price rewrites the stored lines.
 * A classic qty × rate sheet copies the new rate. A custom formula keeps its other cells.
 */
export function alignSheet(sheet: QuoteSheet, lines: MoneyLine[]): QuoteSheet {
  const classic = isClassicAmount(sheet);
  const item = textColumn(sheet);
  const rows = lines.map((line, index) => {
    const prev = sheet.rows[index];
    const cells = { ...(prev?.cells ?? {}) };
    if (item) cells[item.id] = line.name;
    if (classic || !prev) {
      if (sheet.columns.some((column) => column.id === "qty")) cells.qty = formatQuantity(line.quantity);
      if (sheet.columns.some((column) => column.id === "rate")) cells.rate = dollarsInputValue(line.unitPriceCents);
    }
    for (const column of sheet.columns) cells[column.id] ??= "";
    return { id: prev?.id ?? `row-${index + 1}`, cells };
  });
  const extras = sheet.rows.slice(lines.length).filter((row) => {
    const name = item ? row.cells[item.id] || "" : "";
    return !name.trim();
  });
  return { ...sheet, rows: [...rows, ...extras] };
}

export function sheetToMoneyLines(sheet: QuoteSheet): MoneyLine[] {
  const item = textColumn(sheet);
  const amount = amountColumn(sheet);
  const lines: MoneyLine[] = [];
  for (const row of sheet.rows) {
    const name = (item ? row.cells[item.id] : "").trim();
    if (!name) continue;
    const scope = rowScope(sheet, row);
    const qty = numericCell(sheet, row, "qty", scope) || 1;
    const rateCents = moneyCents(row.cells.rate || "");
    const computed = amount ? formulaCents(amount, scope) : null;
    const classicCents = Math.round(qty * rateCents);
    if (computed == null || Math.abs(computed - classicCents) <= 1) {
      lines.push({ name, quantity: qty, unitPriceCents: rateCents });
    } else {
      lines.push({ name, quantity: 1, unitPriceCents: computed });
    }
  }
  return lines;
}

export function sheetTotalCents(sheet: QuoteSheet, adjustment: Adjustment, askingCents: number | null = null): number {
  const lines = linesAtAsking(sheetToMoneyLines(sheet), askingCents, adjustment);
  return lines.length ? settledTotal(lines, adjustment) : 0;
}

/** Buyer-facing cells. The amount column is the settled price, so the share page matches. */
export function sheetDisplay(sheet: QuoteSheet, adjustment: Adjustment, askingCents: number | null = null): SheetGrid {
  const money = linesAtAsking(sheetToMoneyLines(sheet), askingCents, adjustment);
  const settled = money.map((line) => lineSettlement(line, adjustment));
  const named = sheet.rows.filter((row) => {
    const item = textColumn(sheet);
    return item ? Boolean((row.cells[item.id] || "").trim()) : false;
  });
  const amount = amountColumn(sheet);
  return {
    columns: sheet.columns.map((column) => column.label),
    rows: named.map((row, index) =>
      sheet.columns.map((column) => {
        if (amount && column.id === amount.id) return settled[index] ? formatUsd(settled[index].cents) : "";
        if (column.type === "formula") {
          const scope = rowScope(sheet, row);
          const cents = formulaCents(column, scope);
          return cents == null ? "" : formatUsd(cents);
        }
        return row.cells[column.id] || "";
      }),
    ),
  };
}

export function formulaHints(sheet: QuoteSheet): FormulaColumnHint[] {
  return sheet.columns.map((column) => ({ id: column.id, label: column.label, type: column.type }));
}

function formatQuantity(quantity: number): string {
  if (Number.isInteger(quantity)) return String(quantity);
  return String(Math.round(quantity * 100) / 100);
}

function moneyCents(value: string): number {
  const parsed = parseDollarsToCents(value.replace(/[$,\s]/g, ""));
  return parsed == null ? 0 : parsed;
}

function numericCell(sheet: QuoteSheet, row: SheetRow, id: string, scope: Record<string, number>): number {
  const column = sheet.columns.find((item) => item.id === id);
  if (!column) return 0;
  if (column.type === "money") return moneyCents(row.cells[id] || "") / 100;
  if (column.type === "number") return scope[id] ?? 0;
  return 0;
}

function formulaCents(column: SheetColumn, scope: Record<string, number>): number | null {
  if (column.type !== "formula" || !column.formula) return null;
  const result = evaluateFormula(column.formula, scope);
  if (!result.ok) return null;
  return Math.round(result.value * 100);
}

function rowScope(sheet: QuoteSheet, row: SheetRow): Record<string, number> {
  const scope: Record<string, number> = {};
  const pending = sheet.columns.filter((column) => column.type === "formula");
  for (const column of sheet.columns) {
    if (column.type === "money") scope[column.id] = moneyCents(row.cells[column.id] || "") / 100;
    else if (column.type === "number") scope[column.id] = numberValue(row.cells[column.id] || "");
  }
  const seen = new Set<string>();
  function solve(column: SheetColumn, stack: string[]): number {
    if (Object.prototype.hasOwnProperty.call(scope, column.id)) return scope[column.id];
    if (stack.includes(column.id)) return Number.NaN;
    if (!column.formula) return Number.NaN;
    const refs = formulaRefs(column.formula);
    for (const ref of refs) {
      const next = pending.find((item) => item.id === ref);
      if (next && !seen.has(next.id)) solve(next, [...stack, column.id]);
    }
    const result = evaluateFormula(column.formula, scope);
    const value = result.ok ? result.value : Number.NaN;
    scope[column.id] = value;
    seen.add(column.id);
    return value;
  }
  for (const column of pending) solve(column, []);
  return scope;
}

function numberValue(value: string): number {
  const cleaned = value.replace(/[,\s]/g, "");
  if (!cleaned) return 0;
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return Number.NaN;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : Number.NaN;
}
