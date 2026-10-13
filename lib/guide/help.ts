import { formatUsd } from "../money";
import { isGuideStep, stepCopy, type GuidePath, type GuideStep } from "./flow";

const ORDER: GuideStep[] = ["describe", "review", "adjust", "share", "sold"];

function stepFromPath(pathname: string): GuideStep | null {
  const match = pathname.match(/[?&]step=(describe|review|adjust|share|sold)/);
  if (match && isGuideStep(match[1])) return match[1];
  if (pathname.startsWith("/welcome")) return "describe";
  if (pathname.startsWith("/new")) return "describe";
  return null;
}

/**
 * Plain walkthrough for the step the person is on.
 * Returned before any model call so it works with no API key.
 */
export function explainPrice(
  message: string,
  quote: { description: string; priceCents: number | null; note: string } | null,
): string | null {
  const text = message.trim().toLowerCase();
  if (!/why (this|the) price|what should i do next/.test(text)) return null;
  if (!quote || quote.priceCents == null) {
    return "Add a photo or a few words. You'll see a price and a sentence that explains it. Next, tap Send.";
  }
  const name = quote.description || "this";
  return `This is ${formatUsd(quote.priceCents)} for ${name}. ${quote.note} Next, tap Send to share the link.`;
}

export function guideAnswer(pathname: string, message: string): string | null {
  const text = message.trim().toLowerCase();
  if (!text) return null;
  const asking =
    /walk me|what now|what's next|whats next|help|this step|where am i|what do i do/.test(text);
  const named = ORDER.find((step) => text.includes(step) || (step === "sold" && text.includes("sell")));
  const step = named || (asking ? stepFromPath(pathname) : null);
  if (!step || (!asking && !named)) return null;
  const path: GuidePath = pathname.includes("job") ? "job" : "item";
  const copy = stepCopy(step, path);
  const index = ORDER.indexOf(step) + 1;
  const lines = [
    `You're on step ${index} of ${ORDER.length}: ${copy.title}.`,
    copy.now,
    `Next: ${copy.next}`,
    `When you're ready, tap “${copy.primary}”.`,
  ];
  if (step === "review" || step === "adjust") {
    lines.push("Discounts, fees, extra lines, and sources are under Change it. You can send without opening it.");
  }
  if (step === "share") {
    lines.push("After you send it, you'll see a reminder to mark it sold.");
  }
  lines.push("You can ask about another step by name: add, price, adjust, send, or sold.");
  return lines.join(" ");
}
