import { redirect } from "next/navigation";

import { deleteSignedInAccount } from "@/lib/account/delete";
import { getSessionUser } from "@/lib/auth";
import { dataBackend } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Server-only. Reads SUPABASE_SERVICE_ROLE_KEY inside deleteSignedInAccount.
 * Never expose that variable to the client or prefix it with NEXT_PUBLIC_.
 * Requires a typed DELETE confirmation and a matching email before anything is removed.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  const form = await request.formData();
  const phrase = String(form.get("phrase") || "").trim();
  const confirmEmail = String(form.get("confirmEmail") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const understand = form.get("understand") === "on";
  if (phrase !== "DELETE" || !understand) redirect("/settings/delete?error=confirm");
  if (!user.guest) {
    if (!user.email || confirmEmail !== user.email.toLowerCase()) redirect("/settings/delete?error=email");
    const passkeyOnly = form.get("oauth") === "on";
    if (password.length >= 8 && dataBackend() === "supabase") {
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
      if (error) redirect("/settings/delete?error=password");
    } else if (!passkeyOnly) {
      redirect("/settings/delete?error=password");
    }
  }
  const result = await deleteSignedInAccount(user.id, user.email);
  if (!result.ok) redirect("/settings/delete?error=failed");
  redirect("/signin?notice=deleted");
}
