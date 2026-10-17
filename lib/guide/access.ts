import type { SessionUser } from "../types";
import { getData } from "../store";
import { accessLimits, type Variant } from "./flow";
import { isMissingSchema } from "./schema";
import { ensureGuideUser, listGuideQuotes, recordFunnel, type GuideQuote, type GuideUser } from "./store";

export interface PricingAccess {
  guide: GuideUser;
  quotes: GuideQuote[];
  limits: ReturnType<typeof accessLimits>;
  used: number;
  ok: boolean;
  reason: "ok" | "trial" | "limit";
  paid: boolean;
}

export async function pricingAccess(user: SessionUser): Promise<PricingAccess> {
  const [guide, quotes, all] = await Promise.all([
    ensureGuideUser(user.id),
    listGuideQuotes(user.id),
    getData()
      .then((data) => data.listQuotes(user.id))
      .catch((error: unknown) => {
        if (!isMissingSchema(error)) throw error;
        return [];
      }),
  ]);
  const limits = accessLimits(guide.variant, guide.trialStartedAt);
  const paid = user.plan !== "free";
  const sampleIds = new Set(quotes.filter((quote) => quote.sample).map((quote) => quote.quoteId));
  const used = all.filter((quote) => !sampleIds.has(quote.id)).length;
  if (paid) {
    return { guide, quotes, limits, used, ok: true, reason: "ok", paid };
  }
  if (limits.expired) {
    await recordFunnel(user.id, "trial_expiry", { variant: guide.variant });
    return { guide, quotes, limits, used, ok: false, reason: "trial", paid };
  }
  if (used >= limits.quoteLimit) {
    return { guide, quotes, limits, used, ok: false, reason: "limit", paid };
  }
  return { guide, quotes, limits, used, ok: true, reason: "ok", paid };
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
