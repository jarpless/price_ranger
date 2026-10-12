/**
 * Single source of truth for plan entitlements.
 * Basecamp enforces the assistant message cap only.
 * Quote limits, branding, connector locks, agent-mode locks, and checkout
 * turn on in v2.2 Ridgeline. Do not duplicate these numbers elsewhere.
 */

export const PLAN_IDS = ["free", "pass", "plus", "pro"] as const;

export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanDefinition {
  id: PlanId;
  name: string;
  /** What a person pays. Billing is not collected in this version. */
  priceLabel: string;
  /** Active quotes allowed. Null means unlimited. Not enforced until Ridgeline. */
  activeQuotes: number | null;
  assistantMessagesPerMonth: number;
  /** Small Price Ranger mark on customer quotes. Not enforced until Ridgeline. */
  brandTag: boolean;
  /** Live connectors. Not enforced until Ridgeline. */
  connectors: boolean;
  /** Agent mode. Not enforced until Ridgeline so Basecamp can still demonstrate it. */
  agentMode: boolean;
  /** Days of access for the one-time pass. Null means no expiry. */
  durationDays: number | null;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    priceLabel: "$0",
    activeQuotes: 3,
    assistantMessagesPerMonth: 10,
    brandTag: true,
    connectors: false,
    agentMode: false,
    durationDays: null,
  },
  pass: {
    id: "pass",
    name: "Pass",
    priceLabel: "$2.99 for 30 days",
    activeQuotes: null,
    assistantMessagesPerMonth: 1000,
    brandTag: false,
    connectors: true,
    agentMode: true,
    durationDays: 30,
  },
  plus: {
    id: "plus",
    name: "Plus",
    priceLabel: "$4.99/mo or $39/yr",
    activeQuotes: null,
    assistantMessagesPerMonth: 100,
    brandTag: false,
    connectors: false,
    agentMode: false,
    durationDays: null,
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceLabel: "$12/mo",
    activeQuotes: null,
    assistantMessagesPerMonth: 1000,
    brandTag: false,
    connectors: true,
    agentMode: true,
    durationDays: null,
  },
};

/** Prices in cents for a future Stripe price map. Not charged in Basecamp. */
export const PLAN_PRICES_CENTS = {
  passOnce: 299,
  plusMonth: 499,
  plusYear: 3900,
  proMonth: 1200,
} as const;

export function isPlanId(value: string | null | undefined): value is PlanId {
  return Boolean(value && (PLAN_IDS as readonly string[]).includes(value));
}

export function assistantMessageCap(plan: PlanId): number {
  return PLANS[plan].assistantMessagesPerMonth;
}

export function effectivePlan(plan: PlanId, passExpiresAt: string | null): PlanId {
  if (plan !== "pass") return plan;
  if (!passExpiresAt) return "free";
  if (Date.parse(passExpiresAt) < Date.now()) return "free";
  return "pass";
}

export function assistantLimitMessage(plan: PlanId): string {
  const definition = PLANS[plan];
  return `The ${definition.name} plan includes ${definition.assistantMessagesPerMonth} assistant messages a month. Checkout arrives in v2.2 Ridgeline.`;
}

/** Rough USD per million tokens. Unknown models use the stronger rate so a guess does not undercount. */
const MODEL_RATES: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "claude-3-5-haiku-latest": { input: 0.8, output: 4 },
  "claude-3-5-sonnet-latest": { input: 3, output: 15 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rates = MODEL_RATES[model] || { input: 2.5, output: 10 };
  const cost = (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
