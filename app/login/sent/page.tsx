import { cookies } from "next/headers";
import { PendingLink as Link } from "@/components/pending-link";

import { verifyEmailCode } from "@/app/auth-actions";
import { Logo } from "@/components/logo";
import { OtpInput } from "@/components/otp-input";
import { RateLimitNotice } from "@/components/rate-limit-notice";
import { Button, Notice } from "@/components/ui";
import { DEV_CODE_COOKIE, DEV_LINK_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SentPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string; notice?: string; retry?: string }>;
}) {
  const { email, error, notice, retry } = await searchParams;
  const cookieStore = await cookies();
  const devLink = cookieStore.get(DEV_LINK_COOKIE)?.value;
  const devCode = cookieStore.get(DEV_CODE_COOKIE)?.value;

  return (
    <main className="page-frame page-frame-pad flex min-h-dvh flex-col justify-center">
      <div className="mx-auto w-full max-w-lg">
      <Logo tone="ink" width={64} height={64} className="mb-6 h-16 w-16" />
      <h1 className="font-serif text-3xl">Check your email</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        {email
          ? `If ${email} can receive mail, it has a 6-digit code and a link to verify your account.`
          : "Your email has a 6-digit code and a link to verify your account."}
        {notice === "resent" ? " We sent another one." : ""}
      </p>
      <p className="mt-3 text-body leading-6">If this inbox cannot receive mail, your draft is still on this device.</p>
      <Link
        href="/"
        className="mt-4 inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl border border-line text-base font-semibold text-pine"
      >
        Back to your draft
      </Link>
      {error === "rate_limit" ? (
        <div className="mt-6">
          <RateLimitNotice seconds={Number(retry || 60)} email={email || ""} />
        </div>
      ) : null}
      <form action={verifyEmailCode} className="mt-6 space-y-3">
        {error && error !== "rate_limit" ? <Notice code={error} /> : null}
        <input type="hidden" name="email" value={email || ""} />
        <OtpInput />
        <Button type="submit" pendingLabel="Checking the code…">Use the code</Button>
      </form>
      {devLink || devCode ? (
        <div className="mt-6 rounded-3xl border border-dashed border-gold bg-paper p-4">
          <p className="text-sm font-semibold text-pine">Local development</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Email is not configured here. Use the code {devCode ? <strong>{devCode}</strong> : "from the screen"} or open the link.
          </p>
          {devLink ? (
            <a
              href={devLink}
              className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-2xl border border-line font-semibold text-pine"
            >
              Open sign-in link
            </a>
          ) : null}
        </div>
      ) : null}
      <Link href="/signin" className="mt-6 text-center text-sm font-semibold text-pine">
        Use a different email
      </Link>
      </div>
    </main>
  );
}
