import { formatUsd } from "@/lib/money";

export interface PriceLine {
  id: string;
  name: string;
  cents: number;
}

export interface PriceChoice {
  label: string;
  target: "total" | "line";
  lineId?: string;
}

function changeLine(name: string, fromCents: number, amountCents: number, totalCents: number): string {
  return `Change ${name} from ${formatUsd(fromCents)} to ${formatUsd(amountCents)} (total ${formatUsd(totalCents)})`;
}

/** Name the item that changes, and put the resulting total in parentheses. */
export function priceChoices(lines: PriceLine[], amountCents: number, currentTotal: number): { caption: string; choices: PriceChoice[] } {
  const amount = formatUsd(amountCents);
  if (lines.length === 0) {
    const now = formatUsd(currentTotal);
    return {
      caption: `Change this price from ${now} to ${amount} (total ${amount}).`,
      choices: [{ label: `Change this price to ${amount}`, target: "total" }],
    };
  }
  const choices = lines.map((line) => {
    const next = lines.reduce((sum, item) => sum + (item.id === line.id ? amountCents : item.cents), 0);
    return {
      label: changeLine(line.name, line.cents, amountCents, next),
      target: "line" as const,
      lineId: line.id,
    };
  });
  if (choices.length === 1) {
    return { caption: `${choices[0].label}.`, choices: [choices[0]] };
  }
  return {
    caption: `Which item should become ${amount}?`,
    choices,
  };
}
