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

/** "Change the price" means the total on screen, unless the seller picks one line. */
export function priceChoices(lines: PriceLine[], amountCents: number, currentTotal: number): { caption: string; choices: PriceChoice[] } {
  const amount = formatUsd(amountCents);
  const now = formatUsd(currentTotal);
  const total = { label: `Set the quote total to ${amount}`, target: "total" as const };
  if (lines.length <= 1) {
    const name = lines[0]?.name;
    return {
      caption: name
        ? `Set the quote total to ${amount}? It's ${now} now, from ${name}.`
        : `Set the quote total to ${amount}? It's ${now} now.`,
      choices: [total],
    };
  }
  return {
    caption: `Which price should become ${amount}? The quote total is ${now} now.`,
    choices: [
      total,
      ...lines.map((line) => ({
        label: `Set ${line.name} to ${amount}`,
        target: "line" as const,
        lineId: line.id,
      })),
    ],
  };
}
