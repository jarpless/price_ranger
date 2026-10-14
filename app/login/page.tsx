import { LoginForm } from "@/components/login-form";
import { LogoLockup } from "@/components/logo";
import { PendingLink } from "@/components/pending-link";
import { RateLimitNotice } from "@/components/rate-limit-notice";
import { Notice } from "@/components/ui";
import { passkeyConfigured } from "@/lib/auth-providers";
import { dataBackend } from "@/lib/env";
import { guestErrorDetail } from "@/lib/form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string; detail?: string; notice?: string; email?: string; retry?: string }>;
}) {
  const { error, reason, detail, notice, email = "", retry } = await searchParams;
  const authDetail = detail ? guestErrorDetail(detail) : "";
  const local = dataBackend() === "local";
  const passkey = passkeyConfigured();
  const retrySeconds = Number(retry || 60);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-5 py-10 lg:max-w-xl">
      <LogoLockup />
      <p className="mt-3 text-center text-body leading-6 text-muted">
        Price what you&apos;re selling, then share the number.
      </p>
      {reason === "save" ? (
        <p className="mt-6 rounded-2xl bg-[#f8f1df] px-4 py-3 text-body leading-6 text-ink">
          Save this price on an account. Your draft stays on this device if the email never arrives.
        </p>
      ) : null}
      {notice === "deleted" ? (
        <p className="mt-6 rounded-2xl bg-[#f8f1df] px-4 py-3 text-body leading-6 text-ink">
          That account was deleted, and any subscription was canceled.
        </p>
      ) : null}
      {notice === "unavailable" ? (
        <p className="mt-6 rounded-2xl bg-[#f8f1df] px-4 py-3 text-body leading-6 text-ink">
          That account is no longer available. Sign in with a different email, or create a new one.
        </p>
      ) : null}
      {notice === "busy" ? (
        <p className="mt-6 rounded-2xl bg-[#f8f1df] px-4 py-3 text-body leading-6 text-ink">
          We&apos;re getting a lot of new visits right now. Sign in with email, or try again in a minute.
        </p>
      ) : null}
      {notice === "cookies" ? (
        <p className="mt-6 rounded-2xl bg-[#f8f1df] px-4 py-3 text-body leading-6 text-ink">
          This browser isn&apos;t keeping a sign-in. You can use email, or turn cookies on and open the app again.
        </p>
      ) : null}
      {error === "rate_limit" ? (
        <div className="mt-6">
          <RateLimitNotice seconds={Number.isFinite(retrySeconds) ? retrySeconds : 60} email={email} />
        </div>
      ) : notice !== "busy" && notice !== "cookies" && (authDetail || error) ? (
        <div className="mt-6">
          <Notice code={error} detail={authDetail} />
        </div>
      ) : null}
      <LoginForm email={email} error={error} showPasskey={passkey} local={local} />
      <PendingLink
        href="/auth/guest?next=/new"
        prefetch={false}
        className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl text-base font-semibold text-pine"
      >
        Try it first
      </PendingLink>
    </main>
  );
}
