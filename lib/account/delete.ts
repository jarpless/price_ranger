import { cancelActiveSubscriptions, findCustomerId, stripeTestKey } from "../billing";
import { dataBackend } from "../env";
import { deleteGuideAccount } from "../guide/store";
import { signOutUser } from "../auth";
import { deleteLocalAccount } from "../store/local";

export interface DeleteResult {
  ok: boolean;
  message: string;
}

/**
 * Server-only env var. Set it in Vercel for Production (and Preview, if you test delete there).
 * Do not prefix it with NEXT_PUBLIC_. It is never sent to the browser.
 */
export const SERVICE_ROLE_ENV = "SUPABASE_SERVICE_ROLE_KEY";

/**
 * Deletes the signed-in account. The service role key is read only inside this server module
 * and is never returned to the client.
 */
async function cancelStripeFor(userId: string, email: string): Promise<string> {
  if (!stripeTestKey()) return "";
  try {
    const { readBillingProfile } = await import("./billing-profile");
    const profile = await readBillingProfile(userId);
    const customerId = profile.customerId || (email ? await findCustomerId(email) : null);
    if (!customerId) return "No active subscription was on file.";
    const canceled = await cancelActiveSubscriptions(customerId);
    return canceled > 0
      ? `Canceled ${canceled} subscription${canceled === 1 ? "" : "s"}.`
      : "No active subscription was left to cancel.";
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Subscription cancel failed.");
    return "We could not reach Stripe to cancel a subscription.";
  }
}

export async function deleteSignedInAccount(userId: string, email = ""): Promise<DeleteResult> {
  const subscriptionNote = await cancelStripeFor(userId, email);
  if (dataBackend() === "local") {
    await deleteLocalAccount(userId);
    await deleteGuideAccount(userId);
    await signOutUser();
    return { ok: true, message: subscriptionNote || "Deleted." };
  }

  if (dataBackend() !== "supabase") {
    return { ok: false, message: "We could not delete the login from here. You are still signed in." };
  }

  const key = process.env[SERVICE_ROLE_ENV];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) {
    console.error(`Account deletion needs the server-only env var ${SERVICE_ROLE_ENV}.`);
    return { ok: false, message: "We could not delete the login from here. You are still signed in." };
  }

  const { createClient } = await import("@supabase/supabase-js");
  const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) {
    return { ok: false, message: "We could not delete the login from here. You are still signed in." };
  }
  await signOutUser();
  return { ok: true, message: subscriptionNote || "Deleted." };
}
