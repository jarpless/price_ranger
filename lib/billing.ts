import { PLAN_PRICES_CENTS } from "./plans";

export function stripeTestKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim() || "";
  if (!key.startsWith("sk_test_")) return null;
  return key;
}

export async function createPlusCheckout(input: {
  userId: string;
  email: string;
  origin: string;
}): Promise<string> {
  const key = stripeTestKey();
  if (!key) {
    throw new Error("Payments are coming soon.");
  }
  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("success_url", `${input.origin}/upgrade/done?session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", `${input.origin}/upgrade?canceled=1`);
  body.set("client_reference_id", input.userId);
  body.set("metadata[userId]", input.userId);
  body.set("metadata[plan]", "plus");
  if (input.email) body.set("customer_email", input.email);
  const price = process.env.STRIPE_PRICE_PLUS_MONTH?.trim();
  if (price) {
    body.set("line_items[0][price]", price);
  } else {
    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price_data][currency]", "usd");
    body.set("line_items[0][price_data][unit_amount]", String(PLAN_PRICES_CENTS.plusMonth));
    body.set("line_items[0][price_data][recurring][interval]", "month");
    body.set("line_items[0][price_data][product_data][name]", "Price Ranger Plus");
  }
  body.set("line_items[0][quantity]", "1");
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = (await response.json()) as { url?: string; error?: { message?: string } };
  if (!response.ok || !payload.url) {
    throw new Error(payload.error?.message || "Stripe could not start the test checkout.");
  }
  return payload.url;
}

export async function confirmPlusCheckout(sessionId: string, userId: string): Promise<boolean> {
  const key = stripeTestKey();
  if (!key || !sessionId.startsWith("cs_")) return false;
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!response.ok) return false;
  const session = (await response.json()) as {
    livemode?: boolean;
    status?: string;
    client_reference_id?: string | null;
    metadata?: { userId?: string; plan?: string };
  };
  if (session.livemode) return false;
  if (session.status !== "complete") return false;
  const owner = session.metadata?.userId || session.client_reference_id;
  return owner === userId && session.metadata?.plan === "plus";
}
