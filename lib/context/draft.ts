import type { Confidence } from "../market-shared";
import type { Unit } from "../types";
import { isUnit } from "../units";

export type DraftFormat = "item" | "job";
export type PriceFrom = "context" | "estimate" | "none";

export interface DraftLine {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
  unitPriceCents: number | null;
  priceFrom: PriceFrom;
  source: string;
  evidence: string;
}

export interface DraftSection {
  id: string;
  name: string;
  lines: DraftLine[];
}

export interface ContextDraft {
  format: DraftFormat;
  title: string;
  customerName: string;
  summary: string;
  confidence: Confidence;
  lowCents: number | null;
  highCents: number | null;
  statedTotalCents: number | null;
  missing: string[];
  sources: string[];
  sections: DraftSection[];
  method: "ai" | "rules";
}

export const DRAFT_LIMITS = {
  sections: 12,
  linesPerSection: 60,
  name: 120,
  title: 80,
  evidence: 160,
  maxQuantity: 100_000,
  maxCents: 100_000_000,
} as const;

const UNIT_WORDS: Record<string, Unit> = {
  each: "each",
  ea: "each",
  pc: "each",
  pcs: "each",
  piece: "each",
  pieces: "each",
  unit: "each",
  units: "each",
  item: "each",
  items: "each",
  hour: "hour",
  hours: "hour",
  hr: "hour",
  hrs: "hour",
  h: "hour",
  sq_ft: "sq_ft",
  sqft: "sq_ft",
  "sq ft": "sq_ft",
  "sq. ft": "sq_ft",
  "sq. ft.": "sq_ft",
  "square feet": "sq_ft",
  "square foot": "sq_ft",
  sf: "sq_ft",
  linear_ft: "linear_ft",
  "linear ft": "linear_ft",
  "linear feet": "linear_ft",
  "linear foot": "linear_ft",
  "lin ft": "linear_ft",
  lf: "linear_ft",
  ft: "linear_ft",
  feet: "linear_ft",
  square: "square",
  squares: "square",
  sq: "square",
  roll: "roll",
  rolls: "roll",
  bundle: "bundle",
  bundles: "bundle",
};

export function unitFromWord(raw: string | null | undefined): Unit {
  const word = String(raw || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!word) return "each";
  if (isUnit(word)) return word;
  return UNIT_WORDS[word] || UNIT_WORDS[word.replace(/\.$/, "")] || "each";
}

function oneLine(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cents(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(String(value).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.min(DRAFT_LIMITS.maxCents, Math.round(number));
}

function quantity(value: unknown): number {
  const number = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(number) || number <= 0) return 1;
  return Math.min(DRAFT_LIMITS.maxQuantity, Math.round(number * 100) / 100);
}

function confidence(value: unknown): Confidence {
  return value === "high" || value === "medium" ? value : "low";
}

let counter = 0;
export function draftId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}

/** Cleans a draft from the model, the rules parser, or the browser. Prices are cents. */
export function normalizeDraft(raw: unknown, fallbackSources: string[] = []): ContextDraft {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rawSections = Array.isArray(input.sections) ? input.sections : [];
  const sections: DraftSection[] = [];
  for (const entry of rawSections.slice(0, DRAFT_LIMITS.sections)) {
    const section = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const rawLines = Array.isArray(section.lines) ? section.lines : [];
    const lines: DraftLine[] = [];
    for (const lineEntry of rawLines.slice(0, DRAFT_LIMITS.linesPerSection)) {
      const line = (lineEntry && typeof lineEntry === "object" ? lineEntry : {}) as Record<string, unknown>;
      const name = oneLine(line.name, DRAFT_LIMITS.name);
      if (!name) continue;
      const unitPriceCents = cents(line.unitPriceCents);
      const evidence = oneLine(line.evidence, DRAFT_LIMITS.evidence);
      let priceFrom: PriceFrom = line.priceFrom === "context" || line.priceFrom === "estimate" ? line.priceFrom : "none";
      if (unitPriceCents == null) priceFrom = "none";
      else if (priceFrom === "none") priceFrom = "estimate";
      if (priceFrom === "context" && !evidence) priceFrom = "estimate";
      lines.push({
        id: oneLine(line.id, 40) || draftId("l"),
        name,
        quantity: quantity(line.quantity),
        unit: unitFromWord(typeof line.unit === "string" ? line.unit : ""),
        unitPriceCents,
        priceFrom,
        source: oneLine(line.source, 80),
        evidence,
      });
    }
    if (lines.length === 0 && rawSections.length > 1) continue;
    sections.push({ id: oneLine(section.id, 40) || draftId("s"), name: oneLine(section.name, 80) || "Items", lines });
  }
  if (sections.length === 0) sections.push({ id: draftId("s"), name: "Items", lines: [] });

  const lineCount = sections.reduce((sum, section) => sum + section.lines.length, 0);
  const format: DraftFormat = input.format === "item" || input.format === "job" ? input.format : lineCount > 1 ? "job" : "item";
  let lowCents = cents(input.lowCents);
  let highCents = cents(input.highCents);
  if (lowCents != null && highCents != null && lowCents > highCents) [lowCents, highCents] = [highCents, lowCents];
  if (!lowCents || !highCents) {
    lowCents = null;
    highCents = null;
  }
  const sources = (Array.isArray(input.sources) ? input.sources : fallbackSources)
    .map((source) => oneLine(source, 80))
    .filter(Boolean)
    .slice(0, 12);
  const missing = (Array.isArray(input.missing) ? input.missing : [])
    .map((item) => oneLine(item, 140))
    .filter(Boolean)
    .slice(0, 6);
  const firstLine = sections[0]?.lines[0]?.name || "";
  return {
    format,
    title: oneLine(input.title, DRAFT_LIMITS.title) || firstLine.slice(0, DRAFT_LIMITS.title) || "New price",
    customerName: oneLine(input.customerName, 80),
    summary: oneLine(input.summary, 240),
    confidence: confidence(input.confidence),
    lowCents,
    highCents,
    statedTotalCents: cents(input.statedTotalCents),
    missing,
    sources,
    sections,
    method: input.method === "ai" ? "ai" : "rules",
  };
}

export function draftLines(draft: ContextDraft): DraftLine[] {
  return draft.sections.flatMap((section) => section.lines);
}

export function draftTotalCents(draft: ContextDraft): number {
  return draftLines(draft).reduce((sum, line) => sum + Math.round((line.unitPriceCents ?? 0) * line.quantity), 0);
}

/** Moves every line into one section with one line, for a single resale item. */
export function asSingleItem(draft: ContextDraft): ContextDraft {
  const lines = draftLines(draft);
  const first = lines[0];
  const total = draftTotalCents(draft);
  const line: DraftLine = first
    ? {
        ...first,
        name: draft.title || first.name,
        quantity: 1,
        unit: "each",
        unitPriceCents: lines.length > 1 ? total || null : first.unitPriceCents != null ? Math.round(first.unitPriceCents * first.quantity) : null,
      }
    : { id: draftId("l"), name: draft.title, quantity: 1, unit: "each", unitPriceCents: null, priceFrom: "none", source: "", evidence: "" };
  return { ...draft, format: "item", sections: [{ id: draft.sections[0]?.id || draftId("s"), name: "Item", lines: [line] }] };
}
