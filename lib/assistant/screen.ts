import { formatUsd } from "../money";

export interface ScreenQuote {
  description: string;
  priceCents: number | null;
  step: string;
  note: string;
  condition: string;
  range: string;
  /** The Adjust chip that is on, like "ship8" or "off10". */
  preset?: string | null;
}

export interface ScreenContext {
  pathname: string;
  planName: string;
  quote: ScreenQuote | null;
}

function clean(message: string): string {
  return message.trim().toLowerCase().replace(/\s+/g, " ");
}

function onGuide(ctx: ScreenContext): boolean {
  return ctx.pathname.startsWith("/guide/");
}

function shareHelp(ctx: ScreenContext): string {
  if (onGuide(ctx) && ctx.quote?.step === "share") {
    return `This link is ready for ${ctx.quote.description || "this price"}. Tap Share, Copy link, or Download PDF. Share sends it from this phone. Copy link puts the address on your clipboard. I can leave this page on screen while you do that.`;
  }
  if (onGuide(ctx)) {
    return "Tap Send on this price. The next screen has Share, Copy link, and Download PDF. Nothing is emailed until you share it yourself.";
  }
  return "Open a price from Home, then tap Send. After that, Share, Copy link, and Download PDF are on the link screen. [Home](/)";
}

function priceHelp(ctx: ScreenContext): string {
  const item = ctx.quote?.description ? ` for ${ctx.quote.description}` : "";
  if (onGuide(ctx)) {
    return `Change this price${item} with a condition chip, a preset like -10% or Ship $8, or the nudge slider. You can also type Your price and tap Save price. Then tap Send when you want a link.`;
  }
  return "Open the price, then tap a condition chip, a preset, or the nudge slider. Your price is there if you want to type a number.";
}

const SHIP_CHIPS: Record<string, { label: string; cents: number }> = {
  ship8: { label: "Ship $8", cents: 800 },
  ship15: { label: "Ship $15", cents: 1500 },
};
/** Ship chips add or update one Shipping line. Add a line always adds another. */
function shippingHelp(ctx: ScreenContext): string {
  const addLine = "For another amount, use **Add a line**: type Shipping, enter the Amount, and tap **Add line**.";
  if (!onGuide(ctx) || !ctx.quote) {
    return `Open the price from Home, or start a New price. Under **Adjust**, tap **Ship $8** or **Ship $15** to add a Shipping line to the Total. ${addLine} [Home](/)`;
  }
  const item = ctx.quote.description || "this item";
  if (ctx.quote.step === "sold") {
    return `${item} is already marked sold, so shipping won't change anything a buyer sees. Start a New price for the next item. [New price](/new)`;
  }
  const lead = ctx.quote.step === "share" ? "Tap **Edit price** first. Then, under **Adjust**," : "Under **Adjust**,";
  const on = SHIP_CHIPS[ctx.quote.preset || ""];
  if (on) {
    const other = on.cents === 800 ? "Ship $15" : "Ship $8";
    return `${on.label} is already on, so the Total for ${item} includes ${formatUsd(on.cents)} shipping. ${lead} tap **${other}** to switch it.`;
  }
  const total = ctx.quote.priceCents != null ? `, on top of the ${formatUsd(ctx.quote.priceCents)} Total` : "";
  return `${lead} tap **Ship $8** or **Ship $15**. That adds a Shipping line to ${item}${total}. ${addLine} Then tap **Send** when it looks right.`;
}

function soldHelp(ctx: ScreenContext): string {
  if (onGuide(ctx) && ctx.quote?.step === "sold") {
    return `Enter what you got for ${ctx.quote.description || "it"} under Sold for, then tap Yes, sold. Not yet leaves it on Home.`;
  }
  if (onGuide(ctx) && ctx.quote?.step === "share") {
    return "Tap Mark sold, enter the amount you got, then tap Yes, sold.";
  }
  return "Open the price, send the link if you have not yet, then tap Mark sold and enter the amount.";
}

function planHelp(ctx: ScreenContext): string {
  return [
    `You're on **${ctx.planName}**.`,
    "",
    "You can choose:",
    "- Free",
    "- The 30-day pass",
    "- Plus",
    "- Pro",
    "",
    "Settings, then Manage billing, is where you see renewal and cancel.",
    "[Plans](/upgrade)",
    "[Billing](/settings/billing)",
  ].join("\n");
}

function photoHelp(): string {
  return "Tap New price, then take a photo or tap an item. Nothing is selected until you do. [New price](/new)";
}

function deleteHelp(): string {
  return "Open Menu, then Settings, then Delete account. Type DELETE, enter your password, and submit. Apple or Google needs a fresh confirm on that page first. [Delete account](/settings/delete)";
}

function billingHelp(ctx: ScreenContext): string {
  return `You're on ${ctx.planName}. Open Settings, then Manage billing, to see the card on file, invoices, and Cancel subscription. [Billing](/settings/billing)`;
}

/**
 * Answers a how-to from the screen the person is on.
 * Uses the labels on that screen. Does not recite a step number.
 */
export function screenAnswer(message: string, ctx: ScreenContext): string | null {
  const text = clean(message);
  if (!text) return null;
  const asking = /^(how|what|where|when|why|can|could|should)\b|\bhow do i\b|\bwhere (do|can) i\b|\bwhat do i\b|\bwalk me\b/.test(text);
  if (!asking) return null;

  if (/delet|close my account|remove my account/.test(text)) return deleteHelp();
  if (/cancel|billing|subscription|invoice|payment method|card on file/.test(text)) return billingHelp(ctx);
  if (/\bship(ping)?\b|postage|delivery (cost|fee|charge)/.test(text)) return shippingHelp(ctx);
  if (/plan|upgrade|plus|pro\b|free plan/.test(text)) return planHelp(ctx);
  if (/photo|camera|picture|new price|add an item/.test(text)) return photoHelp();
  if (/mark (it |this |that )?sold|did it sell|sold for/.test(text)) return soldHelp(ctx);
  if (/share|copy link|download pdf|send (it|the link|a link|this)/.test(text)) return shareHelp(ctx);
  if (/change (the |my )?price|adjust|nudge|condition|slider|chip/.test(text)) return priceHelp(ctx);
  if (/walk me|this step|what now|where am i|what do i do/.test(text)) {
    if (ctx.quote?.step === "share") return shareHelp(ctx);
    if (ctx.quote?.step === "sold") return soldHelp(ctx);
    if (onGuide(ctx)) return priceHelp(ctx);
    return `${photoHelp()} You're on ${ctx.planName}.`;
  }
  if (/worth|how much|what is this|price/.test(text) && ctx.quote) {
    const range = ctx.quote.range ? ` The range is ${ctx.quote.range}.` : "";
    const condition = ctx.quote.condition ? ` Condition is ${ctx.quote.condition}.` : "";
    const amount = ctx.quote.priceCents != null ? ` The price on screen is $${(ctx.quote.priceCents / 100).toFixed(0)}.` : "";
    return `${ctx.quote.description || "This item"}.${amount}${condition}${range} ${ctx.quote.note}`.trim();
  }
  return null;
}
