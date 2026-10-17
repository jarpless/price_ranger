import { parseCsv } from "../csv";
import { marketPrice } from "../market";
import type { Unit } from "../types";
import { draftId, normalizeDraft, unitFromWord, type ContextDraft, type DraftLine, type DraftSection } from "./draft";
import type { ReadContext } from "./files";

const MONEY = /(?:\$|usd\s?)\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(?:\s?(k)\b)?|(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s?(?:dollars|bucks|usd)\b/gi;
const UNIT_PATTERN =
  "squares?|sq\\.?\\s?ft\\.?|sqft|square\\s(?:feet|foot)|sf|lin(?:ear)?\\.?\\s?(?:ft|feet|foot)|lf|rolls?|bundles?|hours?|hrs?|ea|each|pcs?|pieces?|units?";
const QTY_UNIT = new RegExp(`(?:^|\\s|x)(\\d+(?:\\.\\d+)?)\\s?(${UNIT_PATTERN})\\b`, "i");
const QTY_TIMES = /(?:^|\s)(\d+(?:\.\d+)?)\s?(?:x|×)\s+|\s(?:x|×)\s?(\d+(?:\.\d+)?)\b|\bqty:?\s?(\d+(?:\.\d+)?)/i;
const PER_UNIT = new RegExp(`(?:\\/|\\bper\\s|\\beach\\b|\\bea\\b|@|\\ba\\s)(\\s?(${UNIT_PATTERN}))?`, "i");
const TOTAL_WORDS = /^(?:sub\s?-?total|total|grand total|tax|sales tax|balance(?: due)?|amount due|deposit|estimate total|total due)\b/i;
const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, a: 1, an: 1 };

function moneyCents(whole: string, fraction: string | undefined, thousands?: string): number {
  const base = Number(whole.replace(/,/g, "")) * 100 + (fraction ? Number(fraction.padEnd(2, "0")) : 0);
  return Math.round(thousands ? base * 1000 : base);
}

function amounts(text: string): { cents: number; index: number; end: number }[] {
  const found: { cents: number; index: number; end: number }[] = [];
  for (const match of text.matchAll(MONEY)) {
    const cents = match[1] != null ? moneyCents(match[1], match[2], match[3]) : moneyCents(match[4], match[5]);
    if (cents > 0) found.push({ cents, index: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
  }
  return found;
}

function heading(line: string): string | null {
  const markdown = line.match(/^#{1,4}\s+(.+)$/);
  if (markdown) return markdown[1].replace(/[:*_]+$/g, "").trim();
  if (amounts(line).length) return null;
  const colon = line.match(/^([A-Za-z][\w &/'-]{1,40}):$/);
  if (colon) return colon[1].trim();
  if (/^[A-Z][A-Z &/'-]{2,40}$/.test(line) && !/\d/.test(line)) return line.charAt(0) + line.slice(1).toLowerCase();
  return null;
}

const LEAD_FILLER = /^(?:and|plus|also|then|for|so|of|we need|need|i need|it's|its|that's|thats|about|around|roughly)\s+/i;
const TRAIL_FILLER = /\s+(?:at|for|is|costs?|runs?|would be|will be|about|around|roughly|so|asking|selling for|price|priced at|obo)$/i;
const EDGE_PUNCT = /^[\s,;:.!?–—-]+|[\s,;:.!?–—-]+$/g;

function cleanName(text: string): string {
  let name = text.replace(/^\s*(?:[-*•▪◦]|\d{1,3}[.)])\s+/, "").replace(/\s+/g, " ").replace(EDGE_PUNCT, "");
  for (let pass = 0; pass < 3; pass += 1) name = name.replace(LEAD_FILLER, "").replace(TRAIL_FILLER, "").replace(EDGE_PUNCT, "");
  return name.trim();
}

function shortTitle(name: string): string {
  return name.split(/[.,;]\s|\s[-–—]\s|\s\(/)[0].trim().slice(0, 80);
}

export interface ParsedLine {
  name: string;
  quantity: number;
  unit: Unit;
  unitPriceCents: number | null;
  rangeCents: [number, number] | null;
  total: boolean;
}

/** Reads one free-text line like "3 x outlets @ $120 each" or "Tear-off 24 squares $85/sq". */
export function parseTextLine(raw: string): ParsedLine | null {
  const line = raw.replace(/\s+/g, " ").trim();
  if (line.length < 2 || line.length > 400) return null;
  const money = amounts(line);
  let text = line;
  let quantity = 1;
  let unit: Unit = "each";
  let explicitQty = false;

  const qtyUnit = text.match(QTY_UNIT);
  if (qtyUnit && !money.some((amount) => (qtyUnit.index ?? 0) >= amount.index && (qtyUnit.index ?? 0) < amount.end)) {
    quantity = Number(qtyUnit[1]);
    unit = unitFromWord(qtyUnit[2].replace(/\.$/, ""));
    explicitQty = true;
    text = text.replace(qtyUnit[0], " ");
  } else {
    const times = text.match(QTY_TIMES);
    if (times) {
      quantity = Number(times[1] || times[2] || times[3]);
      explicitQty = true;
      text = text.replace(times[0], " ");
    } else {
      const word = text.match(/^(?:[-*•]\s+)?(one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(?=[a-z])/i);
      if (word) {
        quantity = NUMBER_WORDS[word[1].toLowerCase()] ?? 1;
        explicitQty = quantity > 1;
        text = text.replace(word[0], " ");
      } else {
        const lead = text.match(/^(?:[-*•]\s+)?(\d{1,4})\s+(?=[a-z])/i);
        if (lead && money.length > 0 && !/^\d{1,4}\s+(?:gb|tb|mb|inch|in|"|mm|cm|year|yr|month|day)/i.test(text.slice((lead.index ?? 0) + lead[0].length - lead[1].length - 1))) {
          quantity = Number(lead[1]);
          explicitQty = true;
          text = text.replace(lead[0], " ");
        }
      }
    }
  }

  let phraseName = "";
  if (!explicitQty && money.length > 0) {
    const phrase = line.match(/(?:^|\s)(\d{1,4}(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+([a-z][a-z' -]{1,40}?)\s+(?:at|for|@)\s*(?=\$|\d)/i);
    if (phrase && !/^(?:gb|tb|mb|inch|in|mm|cm|years?|yrs?|months?|days?|weeks?)\b/i.test(phrase[2])) {
      const value = NUMBER_WORDS[phrase[1].toLowerCase()] ?? Number(phrase[1]);
      if (Number.isFinite(value) && value > 0) {
        quantity = value;
        explicitQty = value > 1;
        phraseName = phrase[2];
      }
    }
  }

  const name0 = phraseName || text;
  let unitPriceCents: number | null = null;
  let rangeCents: [number, number] | null = null;
  if (money.length > 0) {
    const first = money[0];
    const between = line.slice(first.end, money[1]?.index ?? first.end);
    if (money.length >= 2 && /^\s*(?:-|–|to)\s*$/.test(between)) {
      rangeCents = [Math.min(first.cents, money[1].cents), Math.max(first.cents, money[1].cents)];
      unitPriceCents = Math.round((rangeCents[0] + rangeCents[1]) / 2);
    } else {
      const after = line.slice(first.end, first.end + 24);
      const before = line.slice(Math.max(0, first.index - 6), first.index);
      const perUnit = PER_UNIT.exec(after.trimStart().slice(0, 18));
      const isUnitPrice = /@|\bat\s*$/i.test(before) || Boolean(perUnit && after.trimStart().search(PER_UNIT) === 0);
      if (perUnit?.[2] && !explicitQty) unit = unitFromWord(perUnit[2]);
      if (money.length >= 2 && explicitQty && quantity > 0 && Math.abs(first.cents * quantity - money[1].cents) <= 2) unitPriceCents = first.cents;
      else if (isUnitPrice || quantity <= 1) unitPriceCents = first.cents;
      else unitPriceCents = Math.round(first.cents / quantity);
    }
  }

  let name = name0;
  for (const amount of [...money].reverse()) {
    const segment = line.slice(amount.index, amount.end);
    name = name.replace(segment, " ");
  }
  name = name
    .replace(new RegExp(`(?:\\/|\\bper\\s)\\s?(?:${UNIT_PATTERN})\\b`, "gi"), " ")
    .replace(/\s(?:each|ea)\b\.?/gi, " ")
    .replace(/\s@\s?/g, " ")
    .replace(/\s(?:-|–|to)\s*$/i, " ")
    .replace(/\(\s*\)/g, " ");
  name = cleanName(name);
  if (!name || name.length < 2 || !/[a-z]/i.test(name)) return null;
  if (money.length === 0 && !explicitQty) return null;
  return {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    quantity: quantity > 0 ? quantity : 1,
    unit,
    unitPriceCents,
    rangeCents,
    total: TOTAL_WORDS.test(name),
  };
}

const HEADER = {
  name: /^(?:name|item|items|description|desc|product|service|task|work|line item|material|part)$/,
  quantity: /^(?:qty|qty\.|quantity|count|no\.?|#|units|amount of)$/,
  unit: /^(?:unit|uom|units of measure|measure)$/,
  price: /^(?:price|unit price|unit cost|rate|cost|each|price each|unit \$|\$\/unit|per unit)$/,
  total: /^(?:total|line total|amount|ext|extended|ext\. price|subtotal|sum)$/,
  section: /^(?:section|category|area|room|group|phase|trade)$/,
};

function splitRows(item: ReadContext): string[][] {
  if (item.kind === "sheet" || (item.text.includes("\t") && !item.text.split("\n")[0].includes(","))) {
    return item.text.split("\n").map((row) => row.split("\t").map((cell) => cell.trim()));
  }
  return parseCsv(item.text);
}

function cellCents(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : null;
}

/** Reads a table with a header row. Returns null when no usable header is found. */
export function parseTable(item: ReadContext): { sections: DraftSection[]; statedTotalCents: number | null } | null {
  const rows = splitRows(item).filter((row) => row.some(Boolean));
  for (let headerAt = 0; headerAt < Math.min(rows.length, 8); headerAt += 1) {
    const header = rows[headerAt].map((cell) => cell.toLowerCase().replace(/\s+/g, " ").trim());
    const find = (pattern: RegExp) => header.findIndex((cell) => pattern.test(cell));
    const col = { name: find(HEADER.name), quantity: find(HEADER.quantity), unit: find(HEADER.unit), price: find(HEADER.price), total: find(HEADER.total), section: find(HEADER.section) };
    if (col.name < 0 || (col.price < 0 && col.total < 0 && col.quantity < 0)) continue;
    const sections: DraftSection[] = [];
    let current: DraftSection | null = null;
    let statedTotalCents: number | null = null;
    rows.slice(headerAt + 1).forEach((cells, offset) => {
      const name = (cells[col.name] || "").trim();
      const quantityRaw = col.quantity >= 0 ? cells[col.quantity] || "" : "";
      const price = col.price >= 0 ? cellCents(cells[col.price] || "") : null;
      const total = col.total >= 0 ? cellCents(cells[col.total] || "") : null;
      const sectionName = col.section >= 0 ? (cells[col.section] || "").trim() : "";
      if (!name) {
        const label = cells.find((cell) => /[a-z]/i.test(cell)) || "";
        if (TOTAL_WORDS.test(label) && /^(?:grand )?total/i.test(label)) statedTotalCents = total ?? price ?? statedTotalCents;
        return;
      }
      if (TOTAL_WORDS.test(name)) {
        if (/^(?:grand )?total/i.test(name)) statedTotalCents = total ?? price ?? statedTotalCents;
        return;
      }
      const quantityValue = Number(quantityRaw.replace(/,/g, ""));
      const quantity = Number.isFinite(quantityValue) && quantityValue > 0 ? quantityValue : 1;
      if (price == null && total == null && !quantityRaw && !sectionName) {
        current = { id: draftId("s"), name: name.slice(0, 80), lines: [] };
        sections.push(current);
        return;
      }
      const wanted = sectionName || current?.name || "Items";
      if (!current || current.name !== wanted) {
        current = sections.find((section) => section.name === wanted) || null;
        if (!current) {
          current = { id: draftId("s"), name: wanted, lines: [] };
          sections.push(current);
        }
      }
      const unitPriceCents = price ?? (total != null ? Math.round(total / quantity) : null);
      current.lines.push({
        id: draftId("l"),
        name: name.slice(0, 120),
        quantity,
        unit: unitFromWord(col.unit >= 0 ? cells[col.unit] : ""),
        unitPriceCents,
        priceFrom: unitPriceCents == null ? "none" : "context",
        source: `${item.name} · row ${headerAt + offset + 2}`,
        evidence: cells.filter(Boolean).join(" · ").slice(0, 160),
      });
    });
    const kept = sections.filter((section) => section.lines.length > 0);
    if (kept.length) return { sections: kept, statedTotalCents };
  }
  return null;
}

function textLines(text: string, transcript: boolean): { text: string; number: number }[] {
  const out: { text: string; number: number }[] = [];
  text.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parts = transcript || trimmed.length > 140 ? trimmed.split(/(?<=[.!?;])\s+|,\s+(?:and|plus|then)\s+|\s+and then\s+/i) : [trimmed];
    for (const part of parts) if (part.trim()) out.push({ text: part.trim(), number: index + 1 });
  });
  return out;
}

function fileTitle(name: string): string {
  if (/^pasted /i.test(name)) return "";
  const stem = name.replace(/\s·\s.*$/, "").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!/[a-z]{3}/i.test(stem) || /^(?:img|dsc|scan|document|file)\s?\d*$/i.test(stem)) return "";
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

function firstTitle(inputs: ReadContext[]): string {
  for (const input of inputs) {
    if (input.tabular || input.kind === "transcript") continue;
    for (const raw of input.text.split("\n").slice(0, 12)) {
      const line = raw.replace(/^#+\s*/, "").trim();
      if (!line || line.length > 240 || !/[a-z]/i.test(line)) continue;
      if (/^(?:estimate|quote|invoice|bid|proposal)\s*#?\s*\d*$/i.test(line)) continue;
      if (/^[A-Za-z][\w ]{0,24}:\s*\S/.test(line)) continue;
      const parsed = parseTextLine(line);
      if (parsed && (parsed.unitPriceCents == null || parsed.total)) continue;
      if (parsed) {
        if (inputs.length > 1) continue;
        return shortTitle(parsed.name);
      }
      const title = shortTitle(line.replace(/[:.]+$/, ""));
      if (title.length <= 70) return title;
    }
  }
  for (const input of inputs) {
    const title = fileTitle(input.name);
    if (title) return title.slice(0, 80);
  }
  return "";
}

function customerFrom(inputs: ReadContext[]): string {
  for (const input of inputs) {
    const match = input.text.match(/^\s*(?:customer|client|bill to|prepared for|homeowner|for)\s*[:\-]\s*(.{2,60})$/im);
    if (match) return match[1].trim();
  }
  return "";
}

/** Builds a draft without an AI model. Only lines with a price or a quantity in the source become items. */
export function draftFromRules(inputs: ReadContext[], sourceNames: string[]): ContextDraft {
  const sections: DraftSection[] = [];
  let statedTotalCents: number | null = null;
  let range: [number, number] | null = null;
  const sectionFor = (name: string) => {
    const existing = sections.find((section) => section.name === name);
    if (existing) return existing;
    const created = { id: draftId("s"), name, lines: [] as DraftLine[] };
    sections.push(created);
    return created;
  };

  for (const input of inputs) {
    if (!input.text.trim()) continue;
    if (input.tabular) {
      const table = parseTable(input);
      if (table) {
        for (const section of table.sections) sectionFor(section.name).lines.push(...section.lines);
        statedTotalCents = statedTotalCents ?? table.statedTotalCents;
        continue;
      }
    }
    let current = inputs.length > 1 ? fileTitle(input.name) || (input.kind === "transcript" ? "From the call" : "Notes") : "Items";
    for (const line of textLines(input.text, input.kind === "transcript")) {
      const title = heading(line.text);
      if (title) {
        current = title.slice(0, 80);
        continue;
      }
      const parsed = parseTextLine(line.text);
      if (!parsed) continue;
      if (parsed.total) {
        if (/^(?:grand )?total|amount due|balance/i.test(parsed.name) && parsed.unitPriceCents != null) statedTotalCents = parsed.unitPriceCents;
        continue;
      }
      if (parsed.rangeCents && !range) range = parsed.rangeCents;
      sectionFor(current).lines.push({
        id: draftId("l"),
        name: parsed.name.slice(0, 120),
        quantity: parsed.quantity,
        unit: parsed.unit,
        unitPriceCents: parsed.unitPriceCents,
        priceFrom: parsed.unitPriceCents == null ? "none" : "context",
        source: `${input.name} · line ${line.number}`,
        evidence: line.text.slice(0, 160),
      });
    }
  }

  const kept = sections.filter((section) => section.lines.length > 0);
  const lines = kept.flatMap((section) => section.lines);
  const units = new Set(lines.map((line) => line.unit));
  const format = lines.length > 1 || kept.length > 1 || [...units].some((unit) => unit !== "each") ? "job" : "item";
  const title = firstTitle(inputs) || shortTitle(lines[0]?.name || "");
  const missing: string[] = [];
  const unpriced = lines.filter((line) => line.unitPriceCents == null).length;
  if (unpriced) missing.push(`${unpriced} ${unpriced === 1 ? "line has" : "lines have"} no price in what you added.`);

  let low = range?.[0] ?? null;
  let high = range?.[1] ?? null;
  let confidence: ContextDraft["confidence"] = lines.length && !unpriced ? "medium" : "low";
  if (format === "item" && title) {
    const market = marketPrice(title);
    if (market) {
      low = low ?? market.lowCents;
      high = high ?? market.highCents;
      if (lines.length === 0) {
        kept.push({
          id: draftId("s"),
          name: "Item",
          lines: [{ id: draftId("l"), name: title, quantity: 1, unit: "each", unitPriceCents: market.cents, priceFrom: "estimate", source: "Price Ranger sold listings", evidence: "" }],
        });
      }
      confidence = "medium";
    }
  }
  if (!kept.length && title && format === "item") {
    kept.push({ id: draftId("s"), name: "Item", lines: [{ id: draftId("l"), name: title, quantity: 1, unit: "each", unitPriceCents: null, priceFrom: "none", source: inputs[0]?.name || "", evidence: "" }] });
    missing.push("We couldn't find a price. Add one before you save.");
  }
  if (!kept.length) missing.push("We couldn't find any items or prices. Add lines below, or paste more detail.");
  const lineCount = kept.reduce((sum, section) => sum + section.lines.length, 0);
  const summary = lineCount
    ? `Found ${lineCount} ${lineCount === 1 ? "line" : "lines"}${kept.length > 1 ? ` in ${kept.length} sections` : ""} in ${sourceNames.length === 1 ? sourceNames[0] : `${sourceNames.length} sources`}.`
    : "";

  return normalizeDraft(
    {
      format,
      title,
      customerName: customerFrom(inputs),
      summary,
      confidence,
      lowCents: low,
      highCents: high,
      statedTotalCents,
      missing,
      sources: sourceNames,
      sections: kept,
      method: "rules",
    },
    sourceNames,
  );
}
