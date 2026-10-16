import { dataBackend } from "../env";
import { adoptLocalGuest } from "../store/local";

const LINK_COOKIE = "pr_link_guest";

export { LINK_COOKIE };

function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url || dataBackend() !== "supabase") return null;
  return { key, url };
}

/**
 * Moves a guest's prices onto the account they just verified, including the
 * terms they already accepted, then removes the anonymous user.
 * Needs the server-only service role key. No rows are dropped if that key is missing.
 */
export async function adoptGuestAccount(guestId: string, userId: string): Promise<void> {
  if (!guestId || !userId || guestId === userId) return;
  if (dataBackend() === "local") {
    await adoptLocalGuest(guestId, userId);
    const { reassignGuide } = await import("../guide/store");
    await reassignGuide(guestId, userId);
    return;
  }
  const config = serviceClient();
  if (!config) return;
  const { createClient } = await import("@supabase/supabase-js");
  const service = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const tables = ["quotes", "library_items", "line_item_groups", "connector_connections", "guide_quotes", "assistant_usage", "funnel_events"];
  for (const table of tables) {
    const { error } = await service.from(table).update({ user_id: userId }).eq("user_id", guestId);
    if (error && !/schema cache|does not exist|undefined_column/i.test(error.message)) {
      console.error(`Could not move ${table} off the guest account: ${error.message}`);
    }
  }
  const guest = await service.from("guide_users").select("*").eq("user_id", guestId).maybeSingle();
  const guestRow = guest.data as Record<string, unknown> | null;
  if (guestRow) {
    const existing = await service.from("guide_users").select("user_id, tos_accepted_at").eq("user_id", userId).maybeSingle();
    const current = existing.data as { tos_accepted_at?: string | null } | null;
    if (!current) {
      const { user_id: _ignored, ...rest } = guestRow;
      void _ignored;
      await service.from("guide_users").insert({ ...rest, user_id: userId });
    } else if (!current.tos_accepted_at && guestRow.tos_accepted_at) {
      await service.from("guide_users").update({
        tos_accepted_at: guestRow.tos_accepted_at,
        tos_version: guestRow.tos_version,
        intro_completed_at: guestRow.intro_completed_at,
        trial_started_at: guestRow.trial_started_at,
        variant: guestRow.variant,
      }).eq("user_id", userId);
    }
    await service.from("guide_users").delete().eq("user_id", guestId);
  }
  const { error } = await service.auth.admin.deleteUser(guestId);
  if (error) console.error(`Guest login was not removed: ${error.message}`);
}
