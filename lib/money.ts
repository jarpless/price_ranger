export function formatUsd(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  const body = dollars.toLocaleString("en-US");
  if (rem === 0) return `${sign}$${body}`;
  return `${sign}$${body}.${String(rem).padStart(2, "0")}`;
}

export function dollarsInputValue(cents: number): string {
  if (cents % 100 === 0) return String(cents / 100);
  return (cents / 100).toFixed(2);
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
