"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { adoptGuestAccount, LINK_COOKIE } from "@/lib/account/link";
import { getSessionUser, requireUser, safeNext, setLocalSession } from "@/lib/auth";
import { authErrorPath, classifyAuthError, isNextRedirect } from "@/lib/auth-errors";
import { enabledOAuthButtons, type OAuthProvider } from "@/lib/auth-providers";
import { isCompleteEmailCode, normalizeEmailCode } from "@/lib/auth-code";
import { dataBackend, siteOriginFromHeaders } from "@/lib/env";
import { clip, isEmail } from "@/lib/form";
import { DEV_CODE_COOKIE, DEV_LINK_COOKIE, PENDING_EMAIL_COOKIE } from "@/lib/session";
import { getData } from "@/lib/store";
import { reassignBasecamp } from "@/lib/store/basecamp";
import {
  adoptLocalGuest,
  consumeEmailCode,
  createLocalPasswordAccount,
  issueEmailCode,
  issueMagicLink,
  setLocalIndustry,
  verifyLocalPassword,
} from "@/lib/store/local";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/types";
import { isIndustryId, VOCABULARIES } from "@/lib/vocabulary";

const linkCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

async function keepEmail(email: string) {
  if (!isEmail(email)) return;
  const store = await cookies();
  store.set(PENDING_EMAIL_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
    secure: process.env.NODE_ENV === "production",
  });
}

async function rememberLocalChallenge(email: string) {
  await keepEmail(email);
  if (dataBackend() !== "local") return;
  const token = await issueMagicLink(email);
  const code = await issueEmailCode(email);
  if (process.env.NODE_ENV === "production") return;
  const origin = siteOriginFromHeaders(await headers());
  const cookieStore = await cookies();
  const devCookie = { ...linkCookie, secure: false, maxAge: 60 * 15 };
  cookieStore.set(DEV_LINK_COOKIE, `${origin}/auth/verify?token=${encodeURIComponent(token)}`, devCookie);
  cookieStore.set(DEV_CODE_COOKIE, code, devCookie);
}

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
  const next = clip(formData.get("next"), 200);
  if (next) {
    const cookieStore = await cookies();
    cookieStore.set("pr_oauth_next", safeNext(next), { ...linkCookie, maxAge: 60 * 10 });
  }
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

async function rememberGuest(guestId: string) {
  const cookieStore = await cookies();
  cookieStore.set(LINK_COOKIE, guestId, { ...linkCookie, maxAge: 60 * 60 });
}

async function consumeGuestLink(userId: string) {
  const cookieStore = await cookies();
  const guestId = cookieStore.get(LINK_COOKIE)?.value || "";
  if (guestId) cookieStore.set(LINK_COOKIE, "", { ...linkCookie, maxAge: 0 });
  if (!guestId || guestId === userId) return;
  try {
    await adoptGuestAccount(guestId, userId);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Could not move the guest prices.");
  }
}

export async function signInWithPassword(formData: FormData) {
  const email = clip(formData.get("email"), 160).toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!isEmail(email)) redirect("/signin?error=email");
  if (password.length < 8) redirect("/signin?error=password");

  if (dataBackend() === "supabase") {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const classified = classifyAuthError(error);
        await keepEmail(email);
        if (classified.code === "unverified") redirect("/signin/sent?notice=unverified");
        redirect(authErrorPath(classified));
      }
      const { data } = await supabase.auth.getUser();
      if (!data.user) redirect("/signin?notice=unavailable");
      await consumeGuestLink(data.user.id);
    } catch (error) {
      if (isNextRedirect(error)) throw error;
      redirect("/signin?notice=unavailable");
    }
    redirect("/");
  }
  if (dataBackend() !== "local") redirect("/signin?error=provider");
  const user = await verifyLocalPassword(email, password);
  if (user === "unverified") {
    await rememberLocalChallenge(email);
    redirect("/signin/sent?notice=unverified");
  }
  if (!user) {
    await keepEmail(email);
    redirect("/signin?error=signin");
  }
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
    if (error) {
      await keepEmail(email);
      redirect(authErrorPath(classifyAuthError(error)));
    }
    await keepEmail(email);
    redirect("/signin/sent");
  }
  if (dataBackend() !== "local") redirect("/signin?error=provider");
  const created = await createLocalPasswordAccount(email, password);
  if (created === "taken") redirect("/signin?error=taken");
  if (created === "password") redirect("/signin?error=password");
  await rememberLocalChallenge(email);
  redirect("/signin/sent");
}

export async function verifyEmailCode(formData: FormData) {
  const cookieStore = await cookies();
  const email = (cookieStore.get(PENDING_EMAIL_COOKIE)?.value || clip(formData.get("email"), 160)).toLowerCase();
  const code = normalizeEmailCode(clip(formData.get("code"), 16));
  if (!isEmail(email) || !isCompleteEmailCode(code)) {
    redirect("/signin/sent?error=incomplete");
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
    if (!verified) redirect("/signin/sent?error=code");
    const { data } = await supabase.auth.getUser();
    if (data.user) await consumeGuestLink(data.user.id);
    redirect("/");
  }
  if (dataBackend() !== "local") redirect("/signin?error=provider");
  const user = await consumeEmailCode(email, code);
  if (!user) redirect("/signin/sent?error=code");
  await finishLocalSignIn(user.id);
}

export async function resendVerification(formData: FormData) {
  const email = clip(formData.get("email"), 160).toLowerCase();
  if (!isEmail(email)) redirect("/signin?error=email");
  const cookieStore = await cookies();
  const last = Number(cookieStore.get("pr_resend_at")?.value || 0);
  if (Date.now() - last < 60_000) {
    redirect(authErrorPath({ code: "rate_limit", retryAfterSeconds: Math.ceil((60_000 - (Date.now() - last)) / 1000), message: "" }));
  }
  if (dataBackend() === "supabase") {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) {
      await keepEmail(email);
      redirect(authErrorPath(classifyAuthError(error)));
    }
  }
  await keepEmail(email);
  cookieStore.set("pr_resend_at", String(Date.now()), { ...linkCookie, maxAge: 120 });
  redirect("/signin/sent?notice=resent");
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
