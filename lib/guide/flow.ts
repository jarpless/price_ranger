import {
  experimentExtraFreeQuotes,
  experimentExtraTrialDays,
  freeQuoteLimit,
  trialDays,
} from "./config";

export const VARIANTS = ["a", "b"] as const;
export type Variant = (typeof VARIANTS)[number];

export const PATHS = ["item", "job", "check"] as const;
export type GuidePath = (typeof PATHS)[number];

export const GUIDE_STEPS = ["describe", "review", "adjust", "share", "sold"] as const;
export type GuideStep = (typeof GUIDE_STEPS)[number];

export const FUNNEL_EVENTS = [
  "landing",
  "signup",
  "terms_accepted",
  "path_chosen",
  "first_price_generated",
  "first_share",
  "first_mark_sold",
  "trial_expiry",
  "upgrade_viewed",
  "checkout_completed",
] as const;

export type FunnelEventName = (typeof FUNNEL_EVENTS)[number];

export function isVariant(value: string | null | undefined): value is Variant {
  return value === "a" || value === "b";
}

export function isGuidePath(value: string | null | undefined): value is GuidePath {
  return value === "item" || value === "job" || value === "check";
}

export function isGuideStep(value: string | null | undefined): value is GuideStep {
  return Boolean(value && (GUIDE_STEPS as readonly string[]).includes(value));
}

export function isFunnelEvent(value: string | null | undefined): value is FunnelEventName {
  return Boolean(value && (FUNNEL_EVENTS as readonly string[]).includes(value));
}

/** Stable 50/50 split. The same account always gets the same group. */
export function variantForUser(userId: string): Variant {
  let hash = 2166136261;
  for (let i = 0; i < userId.length; i += 1) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2 === 0 ? "a" : "b";
}

export interface OnboardingCopy {
  welcomeTitle: string;
  welcomeBody: string;
  stepsTitle: string;
  stepsBody: string;
  termsTitle: string;
  termsBody: string;
}

export function onboardingCopy(variant: Variant): OnboardingCopy {
  if (variant === "b") {
    return {
      welcomeTitle: "See a fair price in a few taps.",
      welcomeBody: "Tell us what you're pricing. We'll suggest a number you can send.",
      stepsTitle: "We'll walk with you.",
      stepsBody: "Add a photo or a few words, check the price, then send it. You can change it before you send.",
      termsTitle: "One quick agreement.",
      termsBody: "Then you can try a sample or price something of your own.",
    };
  }
  return {
    welcomeTitle: "Price something without the guesswork.",
    welcomeBody: "A short path for an item, a job, or a price you want to check.",
    stepsTitle: "Three short steps.",
    stepsBody: "Add a photo or a few words, check the price, then send it. You can change it before you send.",
    termsTitle: "Agree to the terms to start.",
    termsBody: "Your prices stay on your account. You can try a sample next.",
  };
}

export function pathLabel(path: GuidePath): string {
  if (path === "item") return "Selling an item";
  if (path === "job") return "Quoting a job";
  return "Checking a price";
}

export interface StepCopy {
  title: string;
  now: string;
  next: string;
  primary: string;
}

const STEP_COPY: Record<GuideStep, StepCopy> = {
  describe: {
    title: "Add a photo",
    now: "A photo or a few words is enough.",
    next: "We'll suggest a price.",
    primary: "See price",
  },
  review: {
    title: "Your price",
    now: "This is the price we suggest.",
    next: "Send it, or change it first.",
    primary: "Send",
  },
  adjust: {
    title: "Change it",
    now: "Optional. The price updates as you go.",
    next: "Send it when it looks right.",
    primary: "Send",
  },
  share: {
    title: "Send it",
    now: "Send a link the other person can open.",
    next: "Then tell us if it sold.",
    primary: "Send",
  },
  sold: {
    title: "Did it sell?",
    now: "A quick note so you remember the outcome.",
    next: "You're done with this one.",
    primary: "Yes, sold",
  },
};

/**
 * In-app taps for someone who already accepted the terms.
 * The system photo picker and the typing itself are not taps.
 * Photo before: New price, choose a path, Add photo, See your price, Continue, Looks good, Send it.
 * Photo after: New price, Add photo (the form submits itself), Send.
 * Typed after: New price, See price, Send.
 * Sample before: Try a sample, Continue, Looks good, Send it.
 * Sample after: Try a sample, Send.
 * Intro stays four taps because the terms checkbox is required.
 */
export const TAP_AUDIT = {
  photoToShareablePrice: { before: 7, after: 3 },
  typedToShareablePrice: { before: 7, after: 3 },
  sampleToShareablePrice: { before: 4, after: 2 },
  introAgreement: { before: 4, after: 4 },
} as const;

export function stepCopy(step: GuideStep, path: GuidePath): StepCopy {
  const copy = STEP_COPY[step];
  if (step === "sold" && path === "job") {
    return { ...copy, title: "Did you get it?", primary: "Yes, got it" };
  }
  if (step === "sold" && path === "check") {
    return { ...copy, title: "Did you use it?", primary: "Yes, used it" };
  }
  return copy;
}

export function stepIndex(step: GuideStep): number {
  return GUIDE_STEPS.indexOf(step);
}

export function nextStep(step: GuideStep): GuideStep | null {
  const index = stepIndex(step);
  return GUIDE_STEPS[index + 1] ?? null;
}

export interface PriceSuggestion {
  cents: number;
  note: string;
  sources: string[];
}

const PRICE_RULES: { test: RegExp; cents: number; note: string }[] = [
  { test: /mixer|kitchenaid/, cents: 18000, note: "A common resale price for a used stand mixer." },
  { test: /lawn|mow/, cents: 4500, note: "A typical visit for a small lawn." },
  { test: /table/, cents: 18000, note: "A fair price for a solid wood table in good shape." },
  { test: /bike|bicycle/, cents: 12000, note: "A common resale price for a used bike that still rides well." },
  { test: /hour|consult/, cents: 9500, note: "A typical hourly rate to start from." },
];

export function suggestPrice(description: string, path: GuidePath): PriceSuggestion {
  const text = description.toLowerCase();
  if (/roof|shingle/.test(text)) {
    const repair = /\b(small|repair|patch|leak|fix)\b/.test(text);
    const full = /\b(replac|full|reroof|tear-?off|new roof)\b/.test(text);
    if (repair && !full) {
      return {
        cents: 85000,
        note: "A small roof repair, not a full replacement.",
        sources: ["Similar small repairs in Price Ranger", "Not priced as a full roof"],
      };
    }
    return {
      cents: 850000,
      note: "Most full roof jobs like this land around this price.",
      sources: ["Similar prices in Price Ranger", "A typical range for this kind of job"],
    };
  }
  const match = PRICE_RULES.find((rule) => rule.test.test(text));
  const fallback =
    path === "job" ? 35000 : path === "check" ? 2500 : 4000;
  const cents = match?.cents ?? fallback;
  const note = match?.note ?? "A starting price from similar things people price here.";
  return {
    cents,
    note,
    sources: ["Similar prices in Price Ranger", "A typical range for this kind of " + (path === "job" ? "job" : "sale")],
  };
}

export function applyDiscount(cents: number, percent: number): number {
  const clean = Math.min(100, Math.max(0, percent));
  return Math.max(0, Math.round((cents * (100 - clean)) / 100));
}

export function applyFee(cents: number, feeCents: number): number {
  return Math.max(0, cents + Math.max(0, feeCents));
}

export interface AccessLimits {
  trialDays: number;
  quoteLimit: number;
  endsAt: string | null;
  expired: boolean;
  daysLeft: number;
}

export function accessLimits(variant: Variant, trialStartedAt: string | null, now = Date.now()): AccessLimits {
  const days = trialDays() + (variant === "b" ? experimentExtraTrialDays() : 0);
  const quoteLimit = freeQuoteLimit() + (variant === "b" ? experimentExtraFreeQuotes() : 0);
  if (!trialStartedAt) {
    return { trialDays: days, quoteLimit, endsAt: null, expired: false, daysLeft: days };
  }
  const ends = Date.parse(trialStartedAt) + days * 24 * 60 * 60 * 1000;
  const expired = now > ends;
  const daysLeft = expired ? 0 : Math.max(0, Math.ceil((ends - now) / (24 * 60 * 60 * 1000)));
  return {
    trialDays: days,
    quoteLimit,
    endsAt: new Date(ends).toISOString(),
    expired,
    daysLeft,
  };
}

/** Events we store once per account so refreshes do not inflate the funnel. */
export function recordOnce(name: FunnelEventName): boolean {
  return name !== "path_chosen" && name !== "upgrade_viewed";
}
