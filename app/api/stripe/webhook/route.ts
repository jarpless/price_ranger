import { applyStripeWebhook, logStripeMode, stripeMode, stripeSecretKey, stripeWebhookSecret, verifyStripeSignature } from "@/lib/billing";
import { claimStripeEvent, releaseStripeEvent } from "@/lib/stripe-events";

export const dynamic = "force-dynamic";

/**
 * Verifies Stripe-Signature with STRIPE_WEBHOOK_SECRET, then applies checkout and
 * subscription events when the event livemode matches the configured key.
 * Test mode is the default. A duplicate event id is acknowledged and not applied again.
 * Returns quietly when the secret or secret key is unset in test or off mode, so a deploy
 * does not depend on the Stripe dashboard. In live mode a missing secret is a 503, so Stripe
 * keeps retrying and the dashboard shows the endpoint failing instead of a silent success.
 */
export async function POST(request: Request) {
  logStripeMode("webhook");
  const secret = stripeWebhookSecret();
  const raw = await request.text();
  if (!secret || !stripeSecretKey()) {
    if (stripeMode() === "live") {
      console.error("Stripe webhook: STRIPE_WEBHOOK_SECRET is not set in live mode.");
      return new Response("webhook not configured", { status: 503 });
    }
    return Response.json({ received: false, mode: stripeMode() });
  }
  const header = request.headers.get("stripe-signature") || "";
  if (!verifyStripeSignature(raw, header, secret)) {
    return new Response("invalid signature", { status: 400 });
  }
  let event: { id?: string; type?: string; livemode?: boolean; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(raw) as { id?: string; type?: string; livemode?: boolean; data?: { object?: Record<string, unknown> } };
  } catch {
    return new Response("bad payload", { status: 400 });
  }
  if (!event.id) return new Response("missing event id", { status: 400 });
  try {
    const claim = await claimStripeEvent({ id: event.id, type: event.type, livemode: event.livemode === true });
    if (claim === "duplicate") return Response.json({ received: true, duplicate: true, mode: stripeMode() });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Stripe webhook claim failed.");
    return new Response("claim failed", { status: 500 });
  }
  try {
    await applyStripeWebhook(event);
  } catch (error) {
    await releaseStripeEvent(event.id).catch(() => undefined);
    console.error(error instanceof Error ? error.message : "Stripe webhook failed.");
    return new Response("apply failed", { status: 500 });
  }
  return Response.json({ received: true, mode: stripeMode() });
}
