import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { dataBackend } from "./env";
import { readSessionValue, SESSION_COOKIE, sessionSecret } from "./session";
import { getLocalUser, issueMagicLink } from "./store/local";
import { createClient } from "./supabase/server";
import type { SessionUser } from "./types";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const backend = dataBackend();
  if (backend === "supabase") {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user?.id || !data.user.email) return null;
    return { id: data.user.id, email: data.user.email };
  }
  if (backend !== "local") return null;

  const cookieStore = await cookies();
  const userId = await readSessionValue(
    cookieStore.get(SESSION_COOKIE)?.value,
    sessionSecret(),
  );
  if (!userId) return null;
  const user = await getLocalUser(userId);
  if (!user) return null;
  return { id: user.id, email: user.email };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requestMagicLink(
  email: string,
  origin: string,
): Promise<{ devLink?: string }> {
  const backend = dataBackend();
  if (backend === "supabase") {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    if (error) throw new Error(error.message);
    return {};
  }
  if (backend !== "local") throw new Error("Sign-in is not configured.");

  const token = await issueMagicLink(email);
  if (process.env.NODE_ENV === "production") return {};
  return { devLink: `${origin}/auth/verify?token=${encodeURIComponent(token)}` };
}

export async function signOutUser() {
  if (dataBackend() === "supabase") {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return;
  }
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}
