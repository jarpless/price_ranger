import { applyStripeWebhook, stripeTestKey, verifyStripeSignature } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * Optional. Verifies Stripe-Signature with STRIPE_WEBHOOK_SECRET and applies
 * test-mode checkout and subscription events. Returns quietly when the secret
 * is unset so a deploy does not depend on the Stripe dashboard.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";
  const raw = await request.text();
  if (!secret || !stripeTestKey()) {
    return Response.json({ received: false });
  }
  const header = request.headers.get("stripe-signature") || "";
  if (!verifyStripeSignature(raw, header, secret)) {
    return new Response("invalid signature", { status: 400 });
  }
  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(raw) as { type?: string; data?: { object?: Record<string, unknown> } };
  } catch {
    return new Response("bad payload", { status: 400 });
  }
  try {
    await applyStripeWebhook(event);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Stripe webhook failed.");
    return new Response("apply failed", { status: 500 });
  }
  return Response.json({ received: true });
}
