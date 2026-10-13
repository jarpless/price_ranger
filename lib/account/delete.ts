import { dataBackend } from "../env";
import { deleteGuideAccount } from "../guide/store";
import { signOutUser } from "../auth";
import { deleteLocalAccount } from "../store/local";

export interface DeleteResult {
  ok: boolean;
  message: string;
}

/**
 * Deletes the signed-in account. The service role key is read only inside this server module
 * and is never returned to the client.
 */
export async function deleteSignedInAccount(userId: string): Promise<DeleteResult> {
  if (dataBackend() === "local") {
    await deleteLocalAccount(userId);
    await deleteGuideAccount(userId);
    await signOutUser();
    return { ok: true, message: "Deleted." };
  }

  if (dataBackend() !== "supabase") {
    return { ok: false, message: "We could not delete the login from here. You are still signed in." };
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) {
    return { ok: false, message: "We could not delete the login from here. You are still signed in." };
  }

  const { createClient } = await import("@supabase/supabase-js");
  const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) {
    return { ok: false, message: "We could not delete the login from here. You are still signed in." };
  }
  await signOutUser();
  return { ok: true, message: "Deleted." };
}
