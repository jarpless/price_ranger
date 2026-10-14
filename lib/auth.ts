import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { LINK_COOKIE } from "./account/link";
import { classifyAuthError, type ClassifiedAuthError } from "./auth-errors";
import { dataBackend } from "./env";
import { effectivePlan, isPlanId, type PlanId } from "./plans";
import {
  createSessionValue,
  KIND_COOKIE,
  readSessionValue,
  SESSION_COOKIE,
  sessionSecret,
} from "./session";
import { getLocalUser, issueEmailCode, issueMagicLink } from "./store/local";
import { createClient } from "./supabase/server";
import type { SessionUser } from "./types";
import { isIndustryId } from "./vocabulary";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

function accountFromRow(user: {
  id: string;
  email: string;
  guest?: boolean;
  industry?: string | null;
  plan?: string | null;
  passExpiresAt?: string | null;
}): SessionUser {
  const plan: PlanId = isPlanId(user.plan) ? user.plan : "free";
  return {
    id: user.id,
    email: user.guest ? "" : user.email,
    guest: Boolean(user.guest),
    industry: isIndustryId(user.industry) ? user.industry : null,
    plan: effectivePlan(plan, user.passExpiresAt ?? null),
  };
}

export const getSessionUser = cache(async function getSessionUser(): Promise<SessionUser | null> {
  const backend = dataBackend();
  if (backend === "supabase") {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const authUser = data.user;
    if (!authUser?.id) return null;
    const guest = Boolean(authUser.is_anonymous) || !authUser.email;
    let industry: string | null = null;
    let plan: string | null = "free";
    let passExpiresAt: string | null = null;
    const profile = await supabase
      .from("profiles")
      .select("industry, plan, pass_expires_at")
      .eq("id", authUser.id)
      .maybeSingle();
    if (!profile.error && profile.data) {
      const row = profile.data as { industry?: string | null; plan?: string | null; pass_expires_at?: string | null };
      industry = row.industry ?? null;
      plan = row.plan ?? "free";
      passExpiresAt = row.pass_expires_at ?? null;
    }
    return accountFromRow({
      id: authUser.id,
      email: authUser.email || "",
      guest,
      industry,
      plan,
      passExpiresAt,
    });
  }
  if (backend !== "local") return null;

  const cookieStore = await cookies();
  const userId = await readSessionValue(cookieStore.get(SESSION_COOKIE)?.value, sessionSecret());
  if (!userId) return null;
  const user = await getLocalUser(userId);
  if (!user) return null;
  return accountFromRow(user);
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/auth/guest");
  return user;
}

export async function setLocalSession(userId: string, kind: "guest" | "user") {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await createSessionValue(userId, sessionSecret()), {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 30,
  });
  cookieStore.set(KIND_COOKIE, kind, { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
}

export async function requestMagicLink(
  email: string,
  origin: string,
): Promise<{ devLink?: string; devCode?: string; error?: ClassifiedAuthError }> {
  const backend = dataBackend();
  if (backend === "supabase") {
    const supabase = await createClient();
    const current = await getSessionUser();
    if (current?.guest) {
      const cookieStore = await cookies();
      cookieStore.set(LINK_COOKIE, current.id, { ...cookieOptions, maxAge: 60 * 60 });
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) return { error: classifyAuthError(signOutError) };
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    if (error) return { error: classifyAuthError(error) };
    return {};
  }
  if (backend !== "local") return { error: classifyAuthError({ code: "signup_disabled", message: "Sign-in is not configured." }) };

  const token = await issueMagicLink(email);
  const code = await issueEmailCode(email);
  if (process.env.NODE_ENV === "production") return {};
  return {
    devLink: `${origin}/auth/verify?token=${encodeURIComponent(token)}`,
    devCode: code,
  };
}

export async function signOutUser() {
  if (dataBackend() === "supabase") {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return;
  }
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  cookieStore.set(KIND_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}

export function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/auth")) return "/";
  return value.slice(0, 200);
}
