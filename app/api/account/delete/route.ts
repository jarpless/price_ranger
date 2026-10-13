import { redirect } from "next/navigation";

import { deleteSignedInAccount } from "@/lib/account/delete";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Server-only. The service role key never leaves this route. */
export async function POST() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const result = await deleteSignedInAccount(user.id);
  if (!result.ok) redirect("/settings?privacy=delete-failed");
  redirect("/login?notice=deleted");
}
