import { redirect } from "next/navigation";

import { deleteSignedInAccount } from "@/lib/account/delete";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Server-only. Reads SUPABASE_SERVICE_ROLE_KEY inside deleteSignedInAccount.
 * Never expose that variable to the client or prefix it with NEXT_PUBLIC_.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const result = await deleteSignedInAccount(user.id);
  if (!result.ok) redirect("/settings?privacy=delete-failed");
  redirect("/login?notice=deleted");
}
