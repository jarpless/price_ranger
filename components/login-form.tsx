"use client";

import { useState } from "react";

import { sendMagicLink } from "@/app/actions";
import { createPasswordAccount, resendVerification, signInWithPassword, startOAuth } from "@/app/auth-actions";
import { PasskeyButton } from "@/components/passkey-button";
import { Notice } from "@/components/ui";

import { IconApple, IconGoogle, IconPasskey } from "./icons";

type Account = "signin" | "create";

export function LoginForm({
  email = "",
  error,
  notice,
  showPasskey,
  local,
  emailKind = "signin",
}: {
  email?: string;
  error?: string;
  notice?: string;
  showPasskey: boolean;
  local: boolean;
  emailKind?: "signin" | "signup";
}) {
  const [account, setAccount] = useState<Account>(emailKind === "signup" ? "create" : "signin");
  const [value, setValue] = useState(email);
  const [banner, setBanner] = useState(error || "");
  const action = account === "create" ? createPasswordAccount : signInWithPassword;
  const linkLabel = local ? "Email me a code" : "Email me a link";
  const primary = account === "create" ? "Create account" : "Sign in";

  const heading = notice === "deleted" && account === "signin" ? "Account deleted" : account === "create" ? "Create account" : "Sign in";

  return (
    <div className="mt-8 space-y-3">
      <h1 className="text-center font-serif text-display leading-tight">{heading}</h1>
      <form action={startOAuth}>
        <input type="hidden" name="provider" value="apple" />
        <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-base font-semibold text-cream">
          <IconApple className="h-5 w-5" />
          Continue with Apple
        </button>
      </form>
      <form action={startOAuth}>
        <input type="hidden" name="provider" value="google" />
        <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-paper text-base font-semibold text-ink">
          <IconGoogle />
          Continue with Google
        </button>
      </form>
      {showPasskey ? <PasskeyButton icon={<IconPasskey className="h-5 w-5" />} /> : null}
      {local ? <p className="text-center text-caption text-muted">Apple, Google, and passkeys need the live sign-in project.</p> : null}

      <form action={action} className="space-y-3 pt-2">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-line p-1" role="tablist" aria-label="Sign in or create account">
          {([
            ["signin", "Sign in"],
            ["create", "Create account"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={account === id}
              onClick={() => {
                setAccount(id);
                setBanner("");
              }}
              className={`h-11 rounded-xl text-base font-semibold ${account === id ? "bg-paper text-ink shadow-card" : "text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="block" htmlFor="email">
          <span className="mb-1.5 block text-sm font-medium">Email</span>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="you@example.com"
            className="h-12 w-full rounded-2xl border border-line bg-paper px-4 text-base outline-none focus:border-pine"
          />
        </label>

        <label className="block" htmlFor="password">
          <span className="mb-1.5 block text-sm font-medium">Password</span>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={account === "create" ? "new-password" : "current-password"}
            required
            minLength={8}
            className="h-12 w-full rounded-2xl border border-line bg-paper px-4 text-base outline-none focus:border-pine"
          />
        </label>

        {banner && banner !== "rate_limit" ? <Notice code={banner} /> : null}
        <button type="submit" className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-pine text-base font-semibold text-cream">
          {primary}
        </button>
      </form>
      <form action={sendMagicLink}>
        <input type="hidden" name="email" value={value} />
        <button type="submit" className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-line bg-paper text-base font-semibold text-pine">
          {linkLabel}
        </button>
      </form>

      {error === "unverified" ? (
        <form action={resendVerification}>
          <input type="hidden" name="email" value={value} />
          <button type="submit" className="h-12 w-full rounded-2xl border border-line bg-paper text-base font-semibold text-ink">
            Resend the email
          </button>
        </form>
      ) : null}
    </div>
  );
}
