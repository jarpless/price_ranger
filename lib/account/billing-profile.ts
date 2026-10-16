import { dataBackend } from "../env";

export interface BillingProfile {
  customerId: string | null;
  subscriptionId: string | null;
  renewsAt: string | null;
  interval: string | null;
}

const EMPTY: BillingProfile = { customerId: null, subscriptionId: null, renewsAt: null, interval: null };

function service() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url || dataBackend() !== "supabase") return null;
  return { key, url };
}

export async function readBillingProfile(userId: string): Promise<BillingProfile> {
  const config = service();
  if (!config) return EMPTY;
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.admin.getUserById(userId);
  if (error || !data.user) return EMPTY;
  const meta = (data.user.app_metadata || {}) as Record<string, unknown>;
  return {
    customerId: typeof meta.stripe_customer_id === "string" ? meta.stripe_customer_id : null,
    subscriptionId: typeof meta.stripe_subscription_id === "string" ? meta.stripe_subscription_id : null,
    renewsAt: typeof meta.renews_at === "string" ? meta.renews_at : null,
    interval: typeof meta.plan_interval === "string" ? meta.plan_interval : null,
  };
}

export async function saveBillingProfile(userId: string, profile: BillingProfile): Promise<void> {
  const config = service();
  if (!config) return;
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await client.auth.admin.getUserById(userId);
  const current = (data.user?.app_metadata || {}) as Record<string, unknown>;
  await client.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...current,
      stripe_customer_id: profile.customerId,
      stripe_subscription_id: profile.subscriptionId,
      renews_at: profile.renewsAt,
      plan_interval: profile.interval,
    },
  });
}
