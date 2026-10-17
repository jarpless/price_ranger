export function formatUsd(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  const body = dollars.toLocaleString("en-US");
  if (rem === 0) return `${sign}$${body}`;
  return `${sign}$${body}.${String(rem).padStart(2, "0")}`;
}

/** Digits for the field while it is focused. "$1,250" becomes "1250", so a new number replaces it. */
export function editingMoney(value: string): string {
  const cents = parseDollarsToCents(value);
  if (cents == null) return value.replace(/[$,\s]/g, "");
  return dollarsInputValue(cents);
}

export function dollarsInputValue(cents: number): string {
  if (cents % 100 === 0) return String(cents / 100);
  return (cents / 100).toFixed(2);
}

/** The dollars string a price field posts. "$1,250" and "1250" both become "1250". */
export function postedDollars(text: string): string {
  const cents = parseDollarsToCents(text);
  return cents == null ? "" : dollarsInputValue(cents);
}

/**
 * The first keystroke after focus replaces the suggestion.
 * A click that leaves the caret at the end would otherwise turn $180 into $180,1250.
 */
export function replacedMoney(previous: string, typed: string, armed: boolean): { text: string; armed: boolean } {
  const next = typed.replace(/[$,]/g, "");
  if (!armed) return { text: next, armed: false };
  const prior = editingMoney(previous);
  if (prior && next.startsWith(prior) && next.length > prior.length) {
    return { text: next.slice(prior.length), armed: false };
  }
  return { text: next, armed: false };
}

export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [dollars, fraction = ""] = cleaned.split(".");
  const cents =
    Number(dollars) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
  if (!Number.isInteger(cents) || cents > 100_000_000_00) return null;
  return cents;
}

export function parseQuantity(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const quantity = Math.round(Number(cleaned) * 100) / 100;
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) {
    return null;
  }
  return quantity;
}

export function lineTotalCents(quantity: number, unitPriceCents: number): number {
  return Math.round(quantity * unitPriceCents);
}

export function sumCents(
  lines: { quantity: number; unitPriceCents: number }[],
): number {
  return lines.reduce(
    (sum, line) => sum + lineTotalCents(line.quantity, line.unitPriceCents),
    0,
  );
}

export function priceSpan(totals: number[]): string {
  if (totals.length === 0) return "No price yet";
  const min = Math.min(...totals);
  const max = Math.max(...totals);
  if (min === max) return formatUsd(min);
  return `${formatUsd(min)} – ${formatUsd(max)}`;
}
