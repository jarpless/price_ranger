"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionUser, requireUser, setLocalSession } from "@/lib/auth";
import { enabledOAuthButtons, type OAuthProvider } from "@/lib/auth-providers";
import { dataBackend, siteOriginFromHeaders } from "@/lib/env";
import { clip, isEmail } from "@/lib/form";
import { PENDING_EMAIL_COOKIE } from "@/lib/session";
import { getData } from "@/lib/store";
import { reassignBasecamp } from "@/lib/store/basecamp";
import {
  adoptLocalGuest,
  consumeEmailCode,
  createLocalPasswordAccount,
  setLocalIndustry,
  verifyLocalPassword,
} from "@/lib/store/local";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/types";
import { isIndustryId, VOCABULARIES } from "@/lib/vocabulary";

async function finishLocalSignIn(userId: string) {
  const current = await getSessionUser();
  if (current?.guest && current.id !== userId) {
    await adoptLocalGuest(current.id, userId);
    await reassignBasecamp(current.id, userId);
  }
  await setLocalSession(userId, "user");
  revalidatePath("/", "layout");
  redirect("/");
}

function providerId(value: string): OAuthProvider | null {
  return enabledOAuthButtons().some((button) => button.id === value) ? (value as OAuthProvider) : null;
}

export async function startOAuth(formData: FormData) {
  const provider = providerId(clip(formData.get("provider"), 20));
  if (!provider || dataBackend() !== "supabase") redirect("/login?error=provider");
  const origin = siteOriginFromHeaders(await headers());
  const supabase = await createClient();
  const current = await getSessionUser();
  const options = { redirectTo: `${origin}/auth/callback`, skipBrowserRedirect: true };
  const result = current?.guest
    ? await supabase.auth.linkIdentity({ provider, options })
    : await supabase.auth.signInWithOAuth({ provider, options });
  if (result.error || !result.data?.url) redirect("/login?error=provider");
  redirect(result.data.url);
}

export async function signInWithPassword(formData: FormData) {
  const email = clip(formData.get("email"), 160).toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!isEmail(email)) redirect("/login?error=email");
  if (password.length < 8) redirect("/login?error=password");

  if (dataBackend() === "supabase") {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) redirect("/login?error=signin");
    redirect("/");
  }
  if (dataBackend() !== "local") redirect("/login?error=provider");
  const user = await verifyLocalPassword(email, password);
  if (!user) redirect("/login?error=signin");
  await finishLocalSignIn(user.id);
}

export async function createPasswordAccount(formData: FormData) {
  const email = clip(formData.get("email"), 160).toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!isEmail(email)) redirect("/login?error=email");
  if (password.length < 8) redirect("/login?error=password");

  if (dataBackend() === "supabase") {
    const supabase = await createClient();
    const current = await getSessionUser();
    if (current?.guest) {
      const { error } = await supabase.auth.updateUser({ email, password });
      if (error) redirect("/login?error=taken");
      redirect(`/login/sent?email=${encodeURIComponent(email)}`);
    }
    const origin = siteOriginFromHeaders(await headers());
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    if (error) redirect("/login?error=taken");
    redirect(`/login/sent?email=${encodeURIComponent(email)}`);
  }
  if (dataBackend() !== "local") redirect("/login?error=provider");
  const created = await createLocalPasswordAccount(email, password);
  if (created === "taken") redirect("/login?error=taken");
  if (created === "password") redirect("/login?error=password");
  await finishLocalSignIn(created.id);
}

export async function verifyEmailCode(formData: FormData) {
  const cookieStore = await cookies();
  const email = (cookieStore.get(PENDING_EMAIL_COOKIE)?.value || clip(formData.get("email"), 160)).toLowerCase();
  const code = clip(formData.get("code"), 12).replace(/\s+/g, "");
  if (!isEmail(email) || code.length < 6) {
    redirect(`/login/sent?error=code&email=${encodeURIComponent(email)}`);
  }
  if (dataBackend() === "supabase") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (error) redirect(`/login/sent?error=code&email=${encodeURIComponent(email)}`);
    redirect("/");
  }
  if (dataBackend() !== "local") redirect("/login?error=provider");
  const user = await consumeEmailCode(email, code);
  if (!user) redirect(`/login/sent?error=code&email=${encodeURIComponent(email)}`);
  await finishLocalSignIn(user.id);
}

export async function chooseIndustry(formData: FormData) {
  const user: SessionUser = await requireUser();
  const industry = clip(formData.get("industry"), 20);
  if (!isIndustryId(industry)) redirect("/start?error=missing");
  if (dataBackend() === "local") {
    await setLocalIndustry(user.id, industry);
  } else if (dataBackend() === "supabase") {
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ industry }).eq("id", user.id);
    if (error) throw new Error(error.message);
  } else {
    redirect("/setup");
  }
  const data = await getData();
  const library = await data.listLibrary(user.id);
  const names = new Set(library.map((item) => item.name));
  const missing = VOCABULARIES[industry].starters.filter((item) => !names.has(item.name));
  if (missing.length > 0) {
    await data.importLibraryRows(
      user.id,
      missing.map((item) => ({
        name: item.name,
        unit: item.unit,
        unitPriceCents: item.unitPriceCents,
      })),
    );
  }
  revalidatePath("/", "layout");
  redirect("/");
}
