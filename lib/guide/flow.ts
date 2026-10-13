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
    stepsTitle: "Five short steps.",
    stepsBody: "Add it, review the price, adjust if you want, send it, and mark it sold.",
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
    title: "Add a photo or a few words",
    now: "Tell us what you are pricing.",
    next: "We'll suggest your price.",
    primary: "See your price",
  },
  review: {
    title: "Your price",
    now: "This is the price we suggest.",
    next: "You can change it, or send it as it is.",
    primary: "Continue",
  },
  adjust: {
    title: "Change anything?",
    now: "This step is optional.",
    next: "Next you'll send it.",
    primary: "Looks good",
  },
  share: {
    title: "Send it",
    now: "Send a link the other person can open.",
    next: "Then tell us if it sold.",
    primary: "Send it",
  },
  sold: {
    title: "Did it sell?",
    now: "A quick note so you remember the outcome.",
    next: "You're done with this one.",
    primary: "Yes, it sold",
  },
};

export function stepCopy(step: GuideStep, path: GuidePath): StepCopy {
  const copy = STEP_COPY[step];
  if (step === "sold" && path === "job") {
    return { ...copy, title: "Did you get the job?", primary: "Yes, I got it" };
  }
  if (step === "sold" && path === "check") {
    return { ...copy, title: "Did you use this price?", primary: "Yes, I used it" };
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
  { test: /roof|shingle/, cents: 850000, note: "Most full roof jobs like this land around this price." },
  { test: /lawn|mow/, cents: 4500, note: "A typical visit for a small lawn." },
  { test: /table/, cents: 18000, note: "A fair price for a solid wood table in good shape." },
  { test: /bike|bicycle/, cents: 12000, note: "A common resale price for a used bike that still rides well." },
  { test: /hour|consult/, cents: 9500, note: "A typical hourly rate to start from." },
];

export function suggestPrice(description: string, path: GuidePath): PriceSuggestion {
  const text = description.toLowerCase();
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
