import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { deleteSignedInAccount } from "@/lib/account/delete";
import { getSessionUser } from "@/lib/auth";
import { dataBackend } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

function recentReauth(value: string | undefined): boolean {
  const at = Date.parse(value || "");
  return Number.isFinite(at) && Date.now() - at < 10 * 60 * 1000;
}

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
    if (dataBackend() === "supabase") {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) redirect("/signin?notice=unavailable");
      const identities = data.user.identities ?? [];
      const emailIdentity = identities.some((item) => item.provider === "email");
      if (emailIdentity || identities.length === 0) {
        if (password.length < 8) redirect("/settings/delete?error=password");
        const signedIn = await supabase.auth.signInWithPassword({ email: user.email, password });
        if (signedIn.error) redirect("/settings/delete?error=password");
      } else if (!recentReauth((await cookies()).get("pr_reauth")?.value)) {
        redirect("/settings/delete?error=reauth");
      }
    } else if (password.length < 8) {
      redirect("/settings/delete?error=password");
    }
  }
  const result = await deleteSignedInAccount(user.id, user.email);
  if (!result.ok) redirect("/settings/delete?error=failed");
  redirect("/signin?notice=deleted");
}
