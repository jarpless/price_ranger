import { PendingLink as Link } from "@/components/pending-link";

import { requireUser } from "@/lib/auth";

export const metadata = { title: "Delete account" };

const ERRORS: Record<string, string> = {
  confirm: "Type DELETE and check the box before this account can be removed.",
  email: "That email does not match this account.",
  password: "Enter the password for this account, or confirm you sign in with Apple, Google, or a passkey.",
  failed: "We could not delete the account from here. You are still signed in.",
};

export default async function DeleteAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link href="/settings" className="text-base font-semibold text-pine">
        Settings
      </Link>
      <h1 className="font-serif text-display">Delete account</h1>
      <p className="text-body leading-6 text-muted">
        This removes your prices and signs you out. An active subscription is canceled. This cannot be undone, and no email is sent.
      </p>
      {error && ERRORS[error] ? <p className="rounded-2xl bg-[#f8e8e4] px-4 py-3 text-body text-danger">{ERRORS[error]}</p> : null}
      <form action="/api/account/delete" method="post" className="space-y-4 rounded-2xl border border-line bg-paper p-5">
        <label className="flex items-start gap-3 text-body leading-6">
          <input type="checkbox" name="understand" className="mt-1 h-6 w-6 shrink-0" />
          I understand this permanently deletes my account and cancels any subscription.
        </label>
        <label className="block text-base font-semibold">
          Type DELETE
          <input name="phrase" autoComplete="off" className="mt-1 h-12 w-full rounded-2xl border border-line px-3 text-base font-normal" />
        </label>
        {user.guest ? null : (
          <>
            <label className="block text-base font-semibold">
              Email
              <input name="confirmEmail" type="email" autoComplete="email" defaultValue="" placeholder={user.email} className="mt-1 h-12 w-full rounded-2xl border border-line px-3 text-base font-normal" />
            </label>
            <label className="block text-base font-semibold">
              Password
              <input name="password" type="password" autoComplete="current-password" className="mt-1 h-12 w-full rounded-2xl border border-line px-3 text-base font-normal" />
            </label>
            <label className="flex items-start gap-3 text-body leading-6">
              <input type="checkbox" name="oauth" className="mt-1 h-6 w-6 shrink-0" />
              I sign in with Apple, Google, or a passkey and do not have a password.
            </label>
          </>
        )}
        <button type="submit" className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl bg-[#8d3b32] px-4 text-base font-semibold text-cream">
          Delete my account
        </button>
      </form>
    </div>
  );
}
