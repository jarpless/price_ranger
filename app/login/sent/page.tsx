import { cookies } from "next/headers";
import { PendingLink as Link } from "@/components/pending-link";

import { verifyEmailCode } from "@/app/auth-actions";
import { Logo } from "@/components/logo";
import { Button, Notice, TextField } from "@/components/ui";
import { DEV_CODE_COOKIE, DEV_LINK_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SentPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const { email, error } = await searchParams;
  const cookieStore = await cookies();
  const devLink = cookieStore.get(DEV_LINK_COOKIE)?.value;
  const devCode = cookieStore.get(DEV_CODE_COOKIE)?.value;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-5 py-10">
      <Logo tone="ink" width={64} height={64} className="mb-6 h-16 w-16" />
      <h1 className="font-serif text-3xl">Check your email</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        {email
          ? `If ${email} can receive mail, a sign-in link and a 6-digit code are on the way. They expire in 15 minutes.`
          : "A sign-in link and a 6-digit code are on the way. They expire in 15 minutes."}
      </p>
      <p className="mt-3 text-body leading-6">If this inbox cannot receive mail, your draft is still on this device.</p>
      <Link
        href="/"
        className="mt-4 inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl border border-line text-base font-semibold text-pine"
      >
        Back to your draft
      </Link>
      <form action={verifyEmailCode} className="mt-6 space-y-3">
        <Notice code={error} />
        <input type="hidden" name="email" value={email || ""} />
        <TextField label="6-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" required />
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
      <Link href="/login" className="mt-6 text-center text-sm font-semibold text-pine">
        Use a different email
      </Link>
    </main>
  );
}
