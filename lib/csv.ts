import { parseDollarsToCents } from "./money";
import type { Unit } from "./types";
import { isUnit } from "./units";

export interface PriceCsvRow {
  name: string;
  unit: Unit;
  unitPriceCents: number;
  sku: string | null;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const pushCell = () => {
    row.push(cell.trim());
    cell = "";
  };
  const pushRow = () => {
    if (row.some((value) => value.length > 0)) rows.push(row);
    row = [];
  };

  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      pushCell();
      continue;
    }
    if (char === "\n") {
      pushCell();
      pushRow();
      continue;
    }
    if (char === "\r") continue;
    cell += char;
  }
  pushCell();
  pushRow();
  return rows;
}

const UNIT_ALIASES: Record<string, Unit> = {
  square: "square",
  squares: "square",
  sq: "square",
  sqft: "sq_ft",
  "sq ft": "sq_ft",
  sq_ft: "sq_ft",
  "square feet": "sq_ft",
  "lin ft": "linear_ft",
  lnft: "linear_ft",
  linear_ft: "linear_ft",
  "linear feet": "linear_ft",
  roll: "roll",
  rolls: "roll",
  bundle: "bundle",
  bundles: "bundle",
  each: "each",
  ea: "each",
  hour: "hour",
  hours: "hour",
  hr: "hour",
};

export function parsePriceCsv(text: string): { rows: PriceCsvRow[]; errors: string[] } {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], errors: ["The file is empty."] };

  const header = table[0].map((cell) => cell.toLowerCase().replace(/\s+/g, " "));
  const indexOf = (...names: string[]) => header.findIndex((cell) => names.includes(cell));
  const nameIndex = indexOf("name", "item", "description");
  const unitIndex = indexOf("unit");
  const priceIndex = indexOf("price", "unit price", "amount");
  const skuIndex = indexOf("sku", "sku code", "code");

  if (nameIndex < 0 || unitIndex < 0 || priceIndex < 0) {
    return {
      rows: [],
      errors: ["Use a header row with name, unit, and price. sku is optional."],
    };
  }

  const rows: PriceCsvRow[] = [];
  const errors: string[] = [];
  table.slice(1).forEach((cells, offset) => {
    const line = offset + 2;
    const name = (cells[nameIndex] || "").trim();
    const unitRaw = (cells[unitIndex] || "").trim().toLowerCase();
    const priceRaw = (cells[priceIndex] || "").trim();
    const sku = skuIndex >= 0 ? (cells[skuIndex] || "").trim() : "";
    if (!name && !priceRaw && !unitRaw) return;
    const unit = UNIT_ALIASES[unitRaw] || (isUnit(unitRaw) ? unitRaw : null);
    const unitPriceCents = parseDollarsToCents(priceRaw);
    if (!name) {
      errors.push(`Line ${line}: add a name.`);
      return;
    }
    if (!unit) {
      errors.push(`Line ${line}: unit should be square, sq ft, lin ft, roll, bundle, each, or hour.`);
      return;
    }
    if (unitPriceCents == null) {
      errors.push(`Line ${line}: price should look like 85 or 12.50.`);
      return;
    }
    rows.push({ name: name.slice(0, 120), unit, unitPriceCents, sku: sku || null });
  });

  return { rows, errors };
}

export const PRICE_CSV_TEMPLATE = "name,unit,price,sku\nTear-off and haul,square,85,\nGAF Timberline HDZ,square,135,GAF-THDZ\n";
