import { redirect } from "next/navigation";

import { getSessionUser, safeNext, setLocalSession } from "@/lib/auth";
import { dataBackend } from "@/lib/env";
import { createGuestUser } from "@/lib/store/local";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const existing = await getSessionUser();
  if (existing) redirect(existing.industry ? next : "/start");

  if (dataBackend() === "supabase") {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInAnonymously();
    if (error) redirect("/login?error=guest");
    redirect("/start");
  }
  if (dataBackend() !== "local") redirect("/setup");

  const user = await createGuestUser();
  await setLocalSession(user.id, "guest");
  redirect("/start");
}
