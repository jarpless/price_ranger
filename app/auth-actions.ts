"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { adoptGuestAccount, LINK_COOKIE } from "@/lib/account/link";
import { getSessionUser, requireUser, setLocalSession } from "@/lib/auth";
import { authErrorPath, classifyAuthError } from "@/lib/auth-errors";
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
  if (!provider || dataBackend() !== "supabase") redirect("/signin?error=provider");
  const origin = siteOriginFromHeaders(await headers());
  const supabase = await createClient();
  const current = await getSessionUser();
  const options = { redirectTo: `${origin}/auth/callback`, skipBrowserRedirect: true };
  const result = current?.guest
    ? await supabase.auth.linkIdentity({ provider, options })
    : await supabase.auth.signInWithOAuth({ provider, options });
  if (result.error || !result.data?.url) redirect(authErrorPath(classifyAuthError(result.error || { code: "oauth_provider_not_supported", message: "Unsupported provider" })));
  redirect(result.data.url);
}

const linkCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

async function rememberGuest(guestId: string) {
  const cookieStore = await cookies();
  cookieStore.set(LINK_COOKIE, guestId, { ...linkCookie, maxAge: 60 * 60 });
}

async function consumeGuestLink(userId: string) {
  const cookieStore = await cookies();
  const guestId = cookieStore.get(LINK_COOKIE)?.value || "";
  if (guestId) cookieStore.set(LINK_COOKIE, "", { ...linkCookie, maxAge: 0 });
  if (guestId && guestId !== userId) await adoptGuestAccount(guestId, userId);
}

export async function signInWithPassword(formData: FormData) {
  const email = clip(formData.get("email"), 160).toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!isEmail(email)) redirect("/signin?error=email");
  if (password.length < 8) redirect("/signin?error=password");

  if (dataBackend() === "supabase") {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) redirect(authErrorPath(classifyAuthError(error), email));
    const { data } = await supabase.auth.getUser();
    if (data.user) await consumeGuestLink(data.user.id);
    redirect("/");
  }
  if (dataBackend() !== "local") redirect("/signin?error=provider");
  const user = await verifyLocalPassword(email, password);
  if (!user) redirect("/signin?error=signin");
  await finishLocalSignIn(user.id);
}

export async function createPasswordAccount(formData: FormData) {
  const email = clip(formData.get("email"), 160).toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!isEmail(email)) redirect("/signin?error=email");
  if (password.length < 8) redirect("/signin?error=password");

  if (dataBackend() === "supabase") {
    const supabase = await createClient();
    const current = await getSessionUser();
    const origin = siteOriginFromHeaders(await headers());
    if (current?.guest) {
      await rememberGuest(current.id);
      await supabase.auth.signOut();
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        data: current?.guest ? { link_guest: current.id } : undefined,
      },
    });
    if (error) redirect(authErrorPath(classifyAuthError(error), email));
    redirect(`/signin/sent?email=${encodeURIComponent(email)}`);
  }
  if (dataBackend() !== "local") redirect("/signin?error=provider");
  const created = await createLocalPasswordAccount(email, password);
  if (created === "taken") redirect("/signin?error=taken");
  if (created === "password") redirect("/signin?error=password");
  await finishLocalSignIn(created.id);
}

export async function verifyEmailCode(formData: FormData) {
  const cookieStore = await cookies();
  const email = (cookieStore.get(PENDING_EMAIL_COOKIE)?.value || clip(formData.get("email"), 160)).toLowerCase();
  const code = clip(formData.get("code"), 12).replace(/\s+/g, "");
  if (!isEmail(email) || code.length < 6) {
    redirect(`/signin/sent?error=code&email=${encodeURIComponent(email)}`);
  }
  if (dataBackend() === "supabase") {
    const supabase = await createClient();
    const types = ["signup", "email", "magiclink"] as const;
    let verified = false;
    for (const type of types) {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type });
      if (!error) {
        verified = true;
        break;
      }
    }
    if (!verified) redirect(authErrorPath(classifyAuthError({ code: "otp_expired", message: "Token has expired" }), email).replace("/signin?", "/signin/sent?"));
    const { data } = await supabase.auth.getUser();
    if (data.user) await consumeGuestLink(data.user.id);
    redirect("/");
  }
  if (dataBackend() !== "local") redirect("/signin?error=provider");
  const user = await consumeEmailCode(email, code);
  if (!user) redirect(`/signin/sent?error=code&email=${encodeURIComponent(email)}`);
  await finishLocalSignIn(user.id);
}

export async function resendVerification(formData: FormData) {
  const email = clip(formData.get("email"), 160).toLowerCase();
  if (!isEmail(email)) redirect("/signin?error=email");
  const cookieStore = await cookies();
  const last = Number(cookieStore.get("pr_resend_at")?.value || 0);
  if (Date.now() - last < 60_000) {
    redirect(authErrorPath({ code: "rate_limit", retryAfterSeconds: Math.ceil((60_000 - (Date.now() - last)) / 1000), message: "" }, email));
  }
  if (dataBackend() === "supabase") {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) redirect(authErrorPath(classifyAuthError(error), email));
  }
  cookieStore.set("pr_resend_at", String(Date.now()), { ...linkCookie, maxAge: 120 });
  redirect(`/signin/sent?email=${encodeURIComponent(email)}&notice=resent`);
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
