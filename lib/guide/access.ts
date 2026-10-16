import type { SessionUser } from "../types";
import { getData } from "../store";
import { accessLimits, type Variant } from "./flow";
import { isMissingSchema } from "./schema";
import { ensureGuideUser, listGuideQuotes, recordFunnel, type GuideUser } from "./store";

export interface PricingAccess {
  guide: GuideUser;
  limits: ReturnType<typeof accessLimits>;
  used: number;
  ok: boolean;
  reason: "ok" | "trial" | "limit";
  paid: boolean;
}

export async function pricingAccess(user: SessionUser): Promise<PricingAccess> {
  const guide = await ensureGuideUser(user.id);
  const limits = accessLimits(guide.variant, guide.trialStartedAt);
  const paid = user.plan !== "free";
  const quotes = await listGuideQuotes(user.id);
  const sampleIds = new Set(quotes.filter((quote) => quote.sample).map((quote) => quote.quoteId));
  let used = 0;
  try {
    const all = await (await getData()).listQuotes(user.id);
    used = all.filter((quote) => !sampleIds.has(quote.id)).length;
  } catch (error) {
    if (!isMissingSchema(error)) throw error;
  }
  if (paid) {
    return { guide, limits, used, ok: true, reason: "ok", paid };
  }
  if (limits.expired) {
    await recordFunnel(user.id, "trial_expiry", { variant: guide.variant });
    return { guide, limits, used, ok: false, reason: "trial", paid };
  }
  if (used >= limits.quoteLimit) {
    return { guide, limits, used, ok: false, reason: "limit", paid };
  }
  return { guide, limits, used, ok: true, reason: "ok", paid };
}

export function planStatusLine(access: PricingAccess): string {
  if (access.paid) return "You have a paid plan. Your saved prices stay with you.";
  if (access.reason === "trial" || access.limits.expired) {
    return "Your free trial has ended. Upgrade to keep your saved prices and keep using Price Ranger.";
  }
  if (access.reason === "limit") {
    return `You've used all ${access.limits.quoteLimit} free prices. Upgrade to keep them and add more.`;
  }
  return `Free plan · ${access.used} of ${access.limits.quoteLimit} prices used`;
}

export function variantLabel(variant: Variant): string {
  return variant === "b" ? "B" : "A";
}
