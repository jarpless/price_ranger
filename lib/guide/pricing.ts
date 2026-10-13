import { formatUsd } from "../money";
import { applyDiscount } from "./flow";

export interface MoneyLine {
  name: string;
  quantity: number;
  unitPriceCents: number;
}

export interface Adjustment {
  percent: number;
  includeFees: boolean;
}

/** A camera filename is not a title a buyer should see. */
export function looksLikeFilename(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (/\.(jpe?g|png|gif|webp|heic|bmp|tiff?)$/i.test(text)) return true;
  if (/^(img|dsc|dscn|pict|photo|image)[_-]?\d+/i.test(text)) return true;
  return false;
}

/** Pass-through costs stay whole unless the seller asks to discount them. */
export function isPassThrough(name: string): boolean {
  return /\b(dumpster|haul|hauling|fee|fees|permit|disposal|tax|delivery)\b/i.test(name);
}

export function lineSettlement(
  line: MoneyLine,
  adjustment: Adjustment,
): { cents: number; detail: string } {
  const base = Math.round(line.quantity * line.unitPriceCents);
  const discounted = adjustment.percent > 0 && (adjustment.includeFees || !isPassThrough(line.name));
  const cents = discounted ? applyDiscount(base, adjustment.percent) : base;
  if (discounted) {
    return { cents, detail: `${formatUsd(base)} − ${adjustment.percent}% = ${formatUsd(cents)}` };
  }
  const qty = Number.isInteger(line.quantity) ? String(line.quantity) : String(line.quantity);
  return { cents, detail: `${qty} × ${formatUsd(line.unitPriceCents)}` };
}

export function settledTotal(lines: MoneyLine[], adjustment: Adjustment): number {
  return lines.reduce((sum, line) => sum + lineSettlement(line, adjustment).cents, 0);
}

const DISCOUNT = /^meta:discount=(\d{1,3})$/;

export function adjustmentFromSources(sources: string[]): Adjustment {
  let percent = 0;
  let includeFees = false;
  for (const source of sources) {
    const match = DISCOUNT.exec(source);
    if (match) percent = Math.min(100, Math.max(0, Number(match[1])));
    if (source === "meta:fees=all") includeFees = true;
  }
  if (percent <= 0) return { percent: 0, includeFees: false };
  return { percent, includeFees };
}

export function withAdjustment(sources: string[], adjustment: Adjustment): string[] {
  const kept = sources.filter((source) => !source.startsWith("meta:discount=") && source !== "meta:fees=all" && source !== "meta:fees=work");
  if (adjustment.percent <= 0) return kept;
  const percent = Math.min(100, Math.round(adjustment.percent));
  return [...kept, `meta:discount=${percent}`, adjustment.includeFees ? "meta:fees=all" : "meta:fees=work"];
}

export function visibleSources(sources: string[]): string[] {
  return sources.filter((source) => !source.startsWith("meta:"));
}

export function priceError(code: string | undefined): string | null {
  if (!code) return null;
  if (code === "share") return "We could not send that yet. Try again.";
  if (code === "percent") return "Enter a percent from 1 to 100.";
  if (code === "fee") return "Enter a fee like 75.";
  if (code === "line") return "Add a name and an amount, like Delivery and 15.";
  if (code === "photo") return "What is this? Add one line so we can price it.";
  if (code === "heic") return "That photo is a HEIC file. Add one line, or send a JPEG.";
  if (code === "large") return "That photo is too large. Try a smaller JPEG, or add one line.";
  if (code === "unread") return "We couldn't read that photo. Add one line, or try a smaller JPEG.";
  return "Add a few words, or a photo.";
}
