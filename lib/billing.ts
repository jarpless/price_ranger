import { createHmac, timingSafeEqual } from "node:crypto";

import { PLAN_PRICES_CENTS, isPlanId, type PlanId } from "./plans";

export type CheckoutPlan = "pass" | "plus" | "pro";
export type CheckoutInterval = "month" | "year" | "once";

export interface CheckoutChoice {
  plan: CheckoutPlan;
  interval: CheckoutInterval;
}

export interface StripeSession {
  id: string;
  livemode?: boolean;
  status?: string;
  payment_status?: string;
  mode?: string;
  customer?: string | { id?: string } | null;
  subscription?: string | { id?: string } | null;
  client_reference_id?: string | null;
  amount_total?: number | null;
  metadata?: { userId?: string; plan?: string; interval?: string };
}

export interface ConfirmedCheckout {
  status: "paid" | "pending" | "canceled" | "failed";
  plan: PlanId;
  interval: CheckoutInterval;
  amountCents: number;
  customerId: string | null;
  subscriptionId: string | null;
  renewsAt: string | null;
}

export function stripeTestKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim() || "";
  if (!key.startsWith("sk_test_")) return null;
  return key;
}

export function parseCheckoutChoice(plan: string, interval: string): CheckoutChoice | null {
  if (plan === "pass") return { plan: "pass", interval: "once" };
  if (plan === "plus" && (interval === "year" || interval === "month")) return { plan: "plus", interval };
  if (plan === "pro") return { plan: "pro", interval: "month" };
  return null;
}

function priceEnv(choice: CheckoutChoice): string {
  if (choice.plan === "pass") return process.env.STRIPE_PRICE_PASS?.trim() || "";
  if (choice.plan === "plus" && choice.interval === "year") return process.env.STRIPE_PRICE_PLUS_YEAR?.trim() || "";
  if (choice.plan === "plus") return process.env.STRIPE_PRICE_PLUS_MONTH?.trim() || "";
  return process.env.STRIPE_PRICE_PRO_MONTH?.trim() || "";
}

function amountFor(choice: CheckoutChoice): number {
  if (choice.plan === "pass") return PLAN_PRICES_CENTS.passOnce;
  if (choice.plan === "plus" && choice.interval === "year") return PLAN_PRICES_CENTS.plusYear;
  if (choice.plan === "plus") return PLAN_PRICES_CENTS.plusMonth;
  return PLAN_PRICES_CENTS.proMonth;
}

function productName(choice: CheckoutChoice): string {
  if (choice.plan === "pass") return "Price Ranger 30-day pass";
  if (choice.plan === "plus" && choice.interval === "year") return "Price Ranger Plus yearly";
  if (choice.plan === "plus") return "Price Ranger Plus";
  return "Price Ranger Pro";
}

async function stripeFetch(path: string, init?: { method?: string; body?: URLSearchParams }): Promise<Response> {
  const key = stripeTestKey();
  if (!key) throw new Error("Payments are coming soon.");
  return fetch(`https://api.stripe.com/v1/${path}`, {
    method: init?.method || (init?.body ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${key}`,
      ...(init?.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: init?.body,
  });
}

function idOf(value: string | { id?: string } | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id || null;
}

export async function createCheckout(input: {
  userId: string;
  email: string;
  origin: string;
  choice: CheckoutChoice;
}): Promise<string> {
  const choice = input.choice;
  const body = new URLSearchParams();
  body.set("mode", choice.interval === "once" ? "payment" : "subscription");
  body.set("success_url", `${input.origin}/upgrade/done?session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", `${input.origin}/upgrade?canceled=1`);
  body.set("client_reference_id", input.userId);
  body.set("metadata[userId]", input.userId);
  body.set("metadata[plan]", choice.plan);
  body.set("metadata[interval]", choice.interval);
  if (choice.interval !== "once") {
    body.set("subscription_data[metadata][userId]", input.userId);
    body.set("subscription_data[metadata][plan]", choice.plan);
  }
  if (input.email) body.set("customer_email", input.email);
  const price = priceEnv(choice);
  if (price) {
    body.set("line_items[0][price]", price);
  } else if (choice.interval === "once") {
    body.set("line_items[0][price_data][currency]", "usd");
    body.set("line_items[0][price_data][unit_amount]", String(amountFor(choice)));
    body.set("line_items[0][price_data][product_data][name]", productName(choice));
  } else {
    body.set("line_items[0][price_data][currency]", "usd");
    body.set("line_items[0][price_data][unit_amount]", String(amountFor(choice)));
    body.set("line_items[0][price_data][recurring][interval]", choice.interval);
    body.set("line_items[0][price_data][product_data][name]", productName(choice));
  }
  body.set("line_items[0][quantity]", "1");
  const response = await stripeFetch("checkout/sessions", { body });
  const payload = (await response.json()) as { url?: string; error?: { message?: string } };
  if (!response.ok || !payload.url) {
    throw new Error(payload.error?.message || "Stripe could not start the test checkout.");
  }
  return payload.url;
}

/** Kept for older call sites. Plus monthly. */
export async function createPlusCheckout(input: { userId: string; email: string; origin: string }): Promise<string> {
  return createCheckout({ ...input, choice: { plan: "plus", interval: "month" } });
}

async function subscriptionRenews(subscriptionId: string | null): Promise<string | null> {
  if (!subscriptionId) return null;
  const response = await stripeFetch(`subscriptions/${encodeURIComponent(subscriptionId)}`);
  if (!response.ok) return null;
  const payload = (await response.json()) as { current_period_end?: number };
  if (!payload.current_period_end) return null;
  return new Date(payload.current_period_end * 1000).toISOString();
}

export async function readCheckout(sessionId: string, userId: string): Promise<ConfirmedCheckout | null> {
  const key = stripeTestKey();
  if (!key || !sessionId.startsWith("cs_")) return null;
  const response = await stripeFetch(`checkout/sessions/${encodeURIComponent(sessionId)}`);
  if (!response.ok) return null;
  const session = (await response.json()) as StripeSession;
  if (session.livemode) return null;
  const owner = session.metadata?.userId || session.client_reference_id;
  if (owner !== userId) return null;
  const plan = session.metadata?.plan === "pass" || session.metadata?.plan === "pro" || session.metadata?.plan === "plus"
    ? session.metadata.plan
    : "plus";
  const interval: CheckoutInterval = session.metadata?.interval === "year" || session.metadata?.interval === "once" ? session.metadata.interval : "month";
  const customerId = idOf(session.customer);
  const subscriptionId = idOf(session.subscription);
  if (session.status === "expired") {
    return { status: "canceled", plan, interval, amountCents: session.amount_total || amountFor({ plan, interval }), customerId, subscriptionId, renewsAt: null };
  }
  const paid = session.status === "complete" || session.payment_status === "paid" || session.payment_status === "no_payment_required";
  if (!paid) {
    return { status: session.status === "open" ? "pending" : "failed", plan, interval, amountCents: session.amount_total || 0, customerId, subscriptionId, renewsAt: null };
  }
  const renewsAt = await subscriptionRenews(subscriptionId);
  return {
    status: "paid",
    plan,
    interval,
    amountCents: session.amount_total || amountFor({ plan, interval }),
    customerId,
    subscriptionId,
    renewsAt,
  };
}

export async function confirmPlusCheckout(sessionId: string, userId: string): Promise<boolean> {
  const result = await readCheckout(sessionId, userId);
  return result?.status === "paid" && result.plan === "plus";
}

export async function createPortal(input: { customerId: string; origin: string }): Promise<string> {
  const body = new URLSearchParams();
  body.set("customer", input.customerId);
  body.set("return_url", `${input.origin}/settings`);
  const response = await stripeFetch("billing_portal/sessions", { body });
  const payload = (await response.json()) as { url?: string; error?: { message?: string } };
  if (!response.ok || !payload.url) {
    throw new Error(payload.error?.message || "The billing portal is not available in this test account yet.");
  }
  return payload.url;
}

export async function findCustomerId(email: string): Promise<string | null> {
  if (!email || !email.includes("@")) return null;
  const response = await stripeFetch(`customers?email=${encodeURIComponent(email)}&limit=1`);
  if (!response.ok) return null;
  const payload = (await response.json()) as { data?: { id?: string }[] };
  return payload.data?.[0]?.id || null;
}

export interface BillingCard {
  brand: string;
  last4: string;
}

export interface BillingInvoice {
  id: string;
  number: string;
  amountCents: number;
  status: string;
  url: string | null;
  date: string;
}

export async function readBillingDetails(customerId: string | null): Promise<{ card: BillingCard | null; invoices: BillingInvoice[] }> {
  if (!customerId || !stripeTestKey()) return { card: null, invoices: [] };
  const [cards, invoices] = await Promise.all([
    stripeFetch(`payment_methods?customer=${encodeURIComponent(customerId)}&type=card&limit=1`).catch(() => null),
    stripeFetch(`invoices?customer=${encodeURIComponent(customerId)}&limit=6`).catch(() => null),
  ]);
  let card: BillingCard | null = null;
  if (cards?.ok) {
    const payload = (await cards.json()) as { data?: { card?: { brand?: string; last4?: string } }[] };
    const row = payload.data?.[0]?.card;
    if (row?.last4) card = { brand: row.brand || "Card", last4: row.last4 };
  }
  const list: BillingInvoice[] = [];
  if (invoices?.ok) {
    const payload = (await invoices.json()) as {
      data?: { id?: string; number?: string | null; amount_paid?: number; status?: string; hosted_invoice_url?: string | null; created?: number }[];
    };
    for (const row of payload.data || []) {
      if (!row.id) continue;
      list.push({
        id: row.id,
        number: row.number || row.id,
        amountCents: row.amount_paid || 0,
        status: row.status || "",
        url: row.hosted_invoice_url || null,
        date: row.created ? new Date(row.created * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
      });
    }
  }
  return { card, invoices: list };
}

/** Cancels every active or trialing test-mode subscription for this customer. */
export async function cancelActiveSubscriptions(customerId: string): Promise<number> {
  const response = await stripeFetch(`subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=20`);
  if (!response.ok) return 0;
  const payload = (await response.json()) as { data?: { id?: string; status?: string }[] };
  let canceled = 0;
  for (const subscription of payload.data || []) {
    if (!subscription.id) continue;
    if (subscription.status !== "active" && subscription.status !== "trialing" && subscription.status !== "past_due") continue;
    const removed = await stripeFetch(`subscriptions/${encodeURIComponent(subscription.id)}`, { method: "DELETE" });
    if (removed.ok) canceled += 1;
  }
  return canceled;
}

/** Stripe-Signature: t=unix,v1=hex HMAC-SHA256 of `${t}.${rawBody}`. */
export function verifyStripeSignature(rawBody: string, header: string, secret: string): boolean {
  if (!rawBody || !header || !secret) return false;
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") timestamp = value;
    if (key === "v1" && value) signatures.push(value);
  }
  const issued = Number(timestamp);
  if (!timestamp || !Number.isFinite(issued) || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - issued) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected);
  return signatures.some((signature) => {
    const actual = Buffer.from(signature);
    return actual.length === expectedBuf.length && timingSafeEqual(actual, expectedBuf);
  });
}

function eventMeta(object: Record<string, unknown>, key: string): string {
  const metadata = object.metadata;
  if (!metadata || typeof metadata !== "object") return "";
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

async function setWebhookPlan(userId: string, plan: PlanId, passExpires: string | null): Promise<void> {
  const { dataBackend } = await import("./env");
  if (dataBackend() === "local") {
    const { setLocalPlan } = await import("./store/local");
    await setLocalPlan(userId, plan, passExpires);
    return;
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return;
  const { createClient } = await import("@supabase/supabase-js");
  const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const patch: { plan: PlanId; pass_expires_at?: string | null } = { plan };
  if (plan === "pass") patch.pass_expires_at = passExpires;
  if (plan === "free") patch.pass_expires_at = null;
  const { error } = await service.from("profiles").update(patch).eq("id", userId);
  if (error && /pass_expires_at|schema cache|does not exist/i.test(error.message)) {
    await service.from("profiles").update({ plan }).eq("id", userId);
  }
}

/** Applies a verified test-mode Stripe event. Live-mode events are ignored. */
export async function applyStripeWebhook(event: { type?: string; data?: { object?: Record<string, unknown> } }): Promise<void> {
  const object = event.data?.object;
  if (!object || object.livemode === true) return;
  const userId = eventMeta(object, "userId");
  if (!userId) return;
  const { saveBillingProfile, readBillingProfile } = await import("./account/billing-profile");

  if (event.type === "checkout.session.completed") {
    const plan = eventMeta(object, "plan");
    if (!isPlanId(plan) || plan === "free") return;
    const paid = object.payment_status === "paid" || object.payment_status === "no_payment_required" || object.status === "complete";
    if (!paid) return;
    const interval = eventMeta(object, "interval") || "month";
    const passExpires = plan === "pass" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;
    await setWebhookPlan(userId, plan, passExpires);
    const customerId = idOf(object.customer as string | { id?: string } | null);
    const subscriptionId = idOf(object.subscription as string | { id?: string } | null);
    const renewsAt = await subscriptionRenews(subscriptionId);
    await saveBillingProfile(userId, { customerId, subscriptionId, renewsAt, interval }).catch(() => undefined);
    return;
  }

  if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") {
    const status = typeof object.status === "string" ? object.status : "";
    const ended = event.type === "customer.subscription.deleted" || status === "canceled" || status === "unpaid" || status === "incomplete_expired";
    if (ended) {
      await setWebhookPlan(userId, "free", null);
      const profile = await readBillingProfile(userId);
      await saveBillingProfile(userId, { ...profile, subscriptionId: null, renewsAt: null }).catch(() => undefined);
      return;
    }
    const periodEnd = typeof object.current_period_end === "number" ? new Date(object.current_period_end * 1000).toISOString() : null;
    const profile = await readBillingProfile(userId);
    const subscriptionId = typeof object.id === "string" ? object.id : profile.subscriptionId;
    await saveBillingProfile(userId, { ...profile, subscriptionId, renewsAt: periodEnd || profile.renewsAt }).catch(() => undefined);
  }
}
