import { sendMagicLink } from "@/app/actions";
import { createPasswordAccount, signInWithPassword, startOAuth } from "@/app/auth-actions";
import { Logo } from "@/components/logo";
import { PasskeyButton } from "@/components/passkey-button";
import { PendingLink } from "@/components/pending-link";
import { Button, Notice, TextField } from "@/components/ui";
import { enabledOAuthButtons, passkeyConfigured } from "@/lib/auth-providers";
import { dataBackend } from "@/lib/env";
import { guestErrorDetail } from "@/lib/form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string; next?: string; detail?: string; notice?: string }>;
}) {
  const { error, reason, detail, notice } = await searchParams;
  const authDetail = detail ? guestErrorDetail(detail) : "";
  const local = dataBackend() === "local";
  const providers = enabledOAuthButtons();
  const passkey = passkeyConfigured();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-5 py-10 lg:max-w-xl">
      <Logo
        variant="full"
        tone="ink"
        alt="Price Ranger"
        width={512}
        height={512}
        priority
        className="mx-auto mb-6 h-auto w-44"
      />
      <h1 className="text-center font-serif text-3xl leading-tight lg:text-4xl">
        Price it. Show the options.
      </h1>
      <p className="mt-3 text-center text-base leading-relaxed text-muted">
        A simple way to price work, a sale, or a service and show a few clear choices.
      </p>
      {reason === "save" ? (
        <p className="mt-6 rounded-2xl bg-[#f8f1df] px-4 py-3 text-body leading-6 text-ink">
          Your draft stays on this device if the email never arrives. You can go back and keep pricing.
        </p>
      ) : null}
      {notice === "deleted" ? (
        <p className="mt-6 rounded-2xl bg-[#f8f1df] px-4 py-3 text-body leading-6 text-ink">
          That account was deleted.
        </p>
      ) : null}
      {notice === "busy" ? (
        <p className="mt-6 rounded-2xl bg-[#f8f1df] px-4 py-3 text-sm leading-relaxed text-ink">
          We&apos;re getting a lot of new visits right now. Sign in with email, or try again in a minute.
        </p>
      ) : null}
      {notice === "cookies" ? (
        <p className="mt-6 rounded-2xl bg-[#f8f1df] px-4 py-3 text-sm leading-relaxed text-ink">
          This browser isn&apos;t keeping a sign-in. You can use email, or turn cookies on and open the app again.
        </p>
      ) : null}
      {notice !== "busy" && notice !== "cookies" && (authDetail || error) ? (
        <div className="mt-6">
          <Notice code={error} detail={authDetail} />
        </div>
      ) : null}

      {providers.length > 0 ? (
        <div className="mt-8 space-y-3">
          {providers.map((provider) => (
            <form key={provider.id} action={startOAuth}>
              <input type="hidden" name="provider" value={provider.id} />
              <Button type="submit" variant="secondary">
                {provider.label}
              </Button>
            </form>
          ))}
        </div>
      ) : null}
      {passkey && reason !== "save" ? <PasskeyButton /> : null}

      <form action={sendMagicLink} className="mt-8 space-y-4">
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          placeholder="you@example.com"
          required
        />
        <Button type="submit">Email me a sign-in link</Button>
      </form>
      <p className="mt-3 text-center text-sm leading-relaxed text-muted">
        You can also enter the 6-digit code from that email.
      </p>

      <details open={reason === "save"} className="mt-6 rounded-3xl border border-line bg-paper p-4">
        <summary className="cursor-pointer text-sm font-semibold text-pine">Use a password instead</summary>
        <form action={signInWithPassword} className="mt-4 space-y-3">
          <TextField label="Email" name="email" type="email" autoComplete="username" required />
          <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
          <Button type="submit" variant="secondary">
            Sign in
          </Button>
        </form>
        <form action={createPasswordAccount} className="mt-4 space-y-3 border-t border-line pt-4">
          <TextField label="Email" name="email" type="email" autoComplete="username" required />
          <TextField label="New password" name="password" type="password" autoComplete="new-password" required />
          <Button type="submit" variant="secondary">
            Create account
          </Button>
        </form>
      </details>

      <PendingLink
        href="/auth/guest"
        prefetch={false}
        className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl text-base font-semibold text-pine"
      >
        Continue without an account
      </PendingLink>
      {local ? (
        <p className="mt-4 text-center text-sm leading-relaxed text-muted">
          Local mode: the sign-in link and the code stay on this device. No email is sent.
        </p>
      ) : null}
    </main>
  );
}
