import type { Unit } from "./types";
import { formatQuantity, unitWord } from "./units";

export interface SummaryLine {
  name: string;
  quantity: number;
  unit: Unit;
}

export function linePhrase(line: SummaryLine): string {
  const quantity = formatQuantity(line.quantity);
  const unit = unitWord(line.unit, line.quantity);
  if (!unit) {
    return line.quantity === 1 ? line.name : `${quantity} ${line.name}`;
  }
  return `${quantity} ${unit} of ${line.name}`;
}

export function autoSummary(lines: SummaryLine[]): string {
  if (lines.length === 0) {
    return "Add line items and a short description will appear here.";
  }

  const phrases = lines.map(linePhrase);
  const shown = phrases.slice(0, 3);
  const extra = phrases.length - shown.length;

  let list: string;
  if (shown.length === 1) {
    list = shown[0];
  } else if (shown.length === 2 && extra === 0) {
    list = `${shown[0]} and ${shown[1]}`;
  } else {
    const head = shown.slice(0, -1).join(", ");
    const tail = shown[shown.length - 1];
    list =
      extra > 0 ? `${head}, ${tail}, and ${extra} more` : `${head}, and ${tail}`;
  }

  return `Includes ${list}.`;
}

export function customerSummary(group: {
  summary: string;
  summaryEdited: boolean;
  items: SummaryLine[];
}): string {
  if (group.summaryEdited && group.summary.trim()) return group.summary.trim();
  return autoSummary(group.items);
}
