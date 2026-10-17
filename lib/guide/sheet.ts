import { dollarsInputValue, formatUsd, parseDollarsToCents } from "../money";
import { linesAtAsking, lineSettlement, settledTotal, type Adjustment, type MoneyLine } from "./pricing";
import { evaluateFormula, formulaRefs, parseFormula, type FormulaColumnHint } from "./formula";

export type SheetColumnType = "text" | "number" | "money" | "formula";

export interface SheetColumn {
  id: string;
  label: string;
  type: SheetColumnType;
  formula?: string;
  /** Extra calculated columns add into the line total only when this is true. Amount always counts. */
  countsInTotal?: boolean;
}

export interface SheetRow {
  id: string;
  cells: Record<string, string>;
  /**
   * A formula for one cell. It overrides the column formula.
   * An empty string means the typed cell value wins and the column formula is skipped.
   */
  formulas?: Record<string, string>;
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
    const countsInTotal = (entry as { countsInTotal?: unknown }).countsInTotal === true;
    const rawFormula = typeof column.formula === "string" ? column.formula.trim().slice(0, 180) : "";
    if (type === "formula" || rawFormula) {
      const formula = rawFormula;
      const parsed = parseFormula(formula);
      if (!parsed.ok) return null;
      columns.push({
        id,
        label,
        type,
        formula,
        ...(countsInTotal ? { countsInTotal: true } : {}),
      });
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
    const formulas: Record<string, string> = {};
    const rawFormulas =
      (entry as { formulas?: unknown }).formulas && typeof (entry as { formulas?: unknown }).formulas === "object"
        ? ((entry as { formulas?: unknown }).formulas as Record<string, unknown>)
        : {};
    for (const column of columns) {
      if (!Object.prototype.hasOwnProperty.call(rawFormulas, column.id)) continue;
      const value = rawFormulas[column.id];
      if (typeof value !== "string") continue;
      const formula = value.trim().slice(0, 180);
      if (!formula) {
        formulas[column.id] = "";
        continue;
      }
      if (!parseFormula(formula).ok) continue;
      formulas[column.id] = formula;
    }
    rows.push({ id, cells, ...(Object.keys(formulas).length > 0 ? { formulas } : {}) });
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
  return moveRowTo(sheet, index, index + direction);
}

export function moveRowTo(sheet: QuoteSheet, from: number, to: number): QuoteSheet {
  const rows = reorder(sheet.rows, from, to);
  return rows === sheet.rows ? sheet : { ...sheet, rows };
}

export function moveColumn(sheet: QuoteSheet, index: number, direction: -1 | 1): QuoteSheet {
  return moveColumnTo(sheet, index, index + direction);
}

export function moveColumnTo(sheet: QuoteSheet, from: number, to: number): QuoteSheet {
  const columns = reorder(sheet.columns, from, to);
  return columns === sheet.columns ? sheet : { ...sheet, columns };
}

function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
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
    return {
      id: prev?.id ?? `row-${index + 1}`,
      cells,
      ...(prev?.formulas ? { formulas: { ...prev.formulas } } : {}),
    };
  });
  const extras = sheet.rows.slice(lines.length).filter((row) => {
    const name = item ? row.cells[item.id] || "" : "";
    return !name.trim();
  });
  return { ...sheet, rows: [...rows, ...extras] };
}

export function sheetToMoneyLines(sheet: QuoteSheet): MoneyLine[] {
  return projectLines(sheet, true);
}

export function sheetTotalCents(sheet: QuoteSheet, adjustment: Adjustment, askingCents: number | null = null): number {
  const lines = linesAtAsking(sheetToMoneyLines(sheet), askingCents, adjustment);
  return lines.length ? settledTotal(lines, adjustment) : 0;
}

/** Buyer-facing cells. The amount column is the settled line amount, so the share page matches. */
export function sheetDisplay(sheet: QuoteSheet, adjustment: Adjustment, askingCents: number | null = null): SheetGrid {
  const base = projectLines(sheet, false);
  const fullTotal = sheetTotalCents(sheet, adjustment, null);
  const askingAdjustsBase = askingCents != null && askingCents !== fullTotal;
  const money = linesAtAsking(base, askingAdjustsBase ? askingCents : null, adjustment);
  const settled = money.map((line) => lineSettlement(line, adjustment));
  const named = namedRows(sheet);
  const amount = amountColumn(sheet);
  return {
    columns: sheet.columns.map((column) => column.label),
    rows: named.map((row, index) => {
      const solved = solveRow(sheet, row);
      return sheet.columns.map((column) => {
        if (amount && column.id === amount.id) return settled[index] ? formatUsd(settled[index].cents) : "";
        if (effectiveFormula(column, row) || column.type === "formula") {
          if (solved.errors[column.id]) return "—";
          const value = solved.scope[column.id];
          return Number.isFinite(value) ? formatUsd(Math.round(value * 100)) : "";
        }
        return row.cells[column.id] || "";
      });
    }),
  };
}

export interface SolvedRow {
  scope: Record<string, number>;
  errors: Record<string, string>;
}

/** The formula that applies to one cell. A cell formula wins; otherwise the column formula. */
export function effectiveFormula(column: SheetColumn, row: SheetRow): string {
  if (row.formulas && Object.prototype.hasOwnProperty.call(row.formulas, column.id)) {
    return row.formulas[column.id].trim();
  }
  if (column.type === "text") return "";
  return (column.formula || "").trim();
}

export function solveRow(sheet: QuoteSheet, row: SheetRow): SolvedRow {
  const scope: Record<string, number> = {};
  const errors: Record<string, string> = {};
  const formulas = new Map<string, string>();
  for (const column of sheet.columns) {
    if (column.type === "text") continue;
    const formula = effectiveFormula(column, row);
    if (formula) formulas.set(column.id, formula);
    else if (column.type === "money") scope[column.id] = moneyCents(row.cells[column.id] || "") / 100;
    else scope[column.id] = numberValue(row.cells[column.id] || "");
  }
  const state = new Map<string, "visiting" | "done">();

  function solve(id: string, stack: string[]): number {
    if (state.get(id) === "done") return scope[id] ?? Number.NaN;
    if (state.get(id) === "visiting" || stack.includes(id)) {
      errors[id] = "This formula refers to itself.";
      scope[id] = Number.NaN;
      state.set(id, "done");
      return Number.NaN;
    }
    const formula = formulas.get(id);
    if (!formula) return scope[id] ?? Number.NaN;
    state.set(id, "visiting");
    const nextStack = [...stack, id];
    for (const ref of formulaRefs(formula)) {
      if (formulas.has(ref)) solve(ref, nextStack);
    }
    if (errors[id] || nextStack.some((item) => errors[item] === "This formula refers to itself.")) {
      errors[id] = "This formula refers to itself.";
      scope[id] = Number.NaN;
      state.set(id, "done");
      return Number.NaN;
    }
    const result = evaluateFormula(formula, scope);
    if (!result.ok) {
      errors[id] = result.error;
      scope[id] = Number.NaN;
    } else {
      scope[id] = result.value;
    }
    state.set(id, "done");
    return scope[id];
  }

  for (const id of formulas.keys()) solve(id, []);
  return { scope, errors };
}

export function cellFormulaError(sheet: QuoteSheet, row: SheetRow, columnId: string): string {
  return solveRow(sheet, row).errors[columnId] || "";
}

export function formulaCellLabel(sheet: QuoteSheet, row: SheetRow, columnId: string): string {
  const column = sheet.columns.find((item) => item.id === columnId);
  if (!column) return "—";
  const formula = effectiveFormula(column, row);
  if (!formula && column.type !== "formula") return "—";
  const solved = solveRow(sheet, row);
  if (solved.errors[columnId]) return "—";
  const value = solved.scope[columnId];
  if (!Number.isFinite(value)) return "—";
  return formatUsd(Math.round(value * 100));
}

export function formulaHints(sheet: QuoteSheet): FormulaColumnHint[] {
  return sheet.columns.map((column) => ({ id: column.id, label: column.label, type: column.type }));
}

function namedRows(sheet: QuoteSheet): SheetRow[] {
  const item = textColumn(sheet);
  return sheet.rows.filter((row) => (item ? Boolean((row.cells[item.id] || "").trim()) : false));
}

function projectLines(sheet: QuoteSheet, includeExtras: boolean): MoneyLine[] {
  const item = textColumn(sheet);
  const amount = amountColumn(sheet);
  const lines: MoneyLine[] = [];
  for (const row of namedRows(sheet)) {
    const name = (item ? row.cells[item.id] : "").trim();
    const solved = solveRow(sheet, row);
    const hasQty = sheet.columns.some((column) => column.id === "qty");
    const qtyValue = solved.scope.qty;
    const qty = hasQty ? (Number.isFinite(qtyValue) && qtyValue > 0 ? qtyValue : 0) : 1;
    const rateCents = Math.round((Number.isFinite(solved.scope.rate) ? solved.scope.rate : 0) * 100);
    if (qty <= 0) {
      lines.push({ name, quantity: 1, unitPriceCents: 0 });
      continue;
    }
    const amountFormula = amount ? effectiveFormula(amount, row) : "";
    const classicFormula = amountFormula.replace(/\s+/g, "") === "qty*rate";
    const amountCents =
      amount && !solved.errors[amount.id] && Number.isFinite(solved.scope[amount.id])
        ? Math.round(solved.scope[amount.id] * 100)
        : null;
    const extra = includeExtras ? extraCents(sheet, row, solved, amount?.id) : 0;
    const classicCents = Math.round(qty * rateCents);
    if (
      classicFormula &&
      extra === 0 &&
      amountCents != null &&
      Math.abs(amountCents - classicCents) <= 1 &&
      !solved.errors.qty &&
      !solved.errors.rate
    ) {
      lines.push({ name, quantity: qty, unitPriceCents: rateCents });
    } else {
      const base = amountCents == null || (amount && solved.errors[amount.id]) ? 0 : amountCents;
      lines.push({ name, quantity: 1, unitPriceCents: base + extra });
    }
  }
  return lines;
}

function extraCents(sheet: QuoteSheet, row: SheetRow, solved: SolvedRow, amountId: string | undefined): number {
  let extra = 0;
  for (const column of sheet.columns) {
    if (amountId && column.id === amountId) continue;
    if (column.countsInTotal !== true) continue;
    if (!effectiveFormula(column, row) || solved.errors[column.id]) continue;
    const value = solved.scope[column.id];
    if (!Number.isFinite(value)) continue;
    extra += Math.round(value * 100);
  }
  return extra;
}

function formatQuantity(quantity: number): string {
  if (Number.isInteger(quantity)) return String(quantity);
  return String(Math.round(quantity * 100) / 100);
}

function moneyCents(value: string): number {
  const parsed = parseDollarsToCents(value.replace(/[$,\s]/g, ""));
  return parsed == null ? 0 : parsed;
}

function numberValue(value: string): number {
  const cleaned = value.replace(/[,\s]/g, "");
  if (!cleaned) return 0;
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return Number.NaN;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : Number.NaN;
}
