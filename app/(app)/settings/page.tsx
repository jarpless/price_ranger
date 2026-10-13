import { PendingLink as Link } from "@/components/pending-link";

import { signOut } from "@/app/actions";
import { setDoNotSell } from "@/app/guide-actions";
import { SubmitButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { buildStamp, stampText } from "@/lib/build-info";
import { llmProvider } from "@/lib/assistant/llm";
import { isOwnerEmail } from "@/lib/owner";
import { ensureGuideUser } from "@/lib/guide/store";
import { PLANS } from "@/lib/plans";
import { assistantAllowance } from "@/lib/usage";
import { passkeyConfigured } from "@/lib/auth-providers";
import { PasskeyOffer } from "@/components/passkey-button";
import { RELEASES, VERSION_LABEL } from "@/lib/version";

export const metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ privacy?: string }>;
}) {
  const { privacy } = await searchParams;
  const user = await requireUser();
  const owner = isOwnerEmail(user.email);
  const stamp = buildStamp();
  const provider = llmProvider();
  const allowance = await assistantAllowance(user);
  const plan = PLANS[user.plan];
  const guide = await ensureGuideUser(user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-serif text-4xl">Settings</h1>
      <section data-spotlight="settings-feedback" className="rounded-3xl border border-line bg-paper p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">This build</p>
        <p className="mt-1 font-serif text-3xl">{stampText(stamp)}</p>
        <p className="mt-2 text-body text-muted">This is the version running now.</p>
      </section>
      <section className="rounded-3xl border border-line bg-paper p-5">
        <h2 className="font-serif text-2xl">Releases</h2>
        <ul className="mt-3 space-y-3">
          {RELEASES.map((release) => (
            <li key={release.version} className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{release.label}</p>
                <p className="text-sm text-muted">{release.summary}</p>
              </div>
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">{release.state}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">Shipping now: {VERSION_LABEL}.</p>
      </section>
      <section className="rounded-3xl border border-line bg-paper p-5">
        <h2 className="font-serif text-2xl">Assistant</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {plan.name} includes {plan.assistantMessagesPerMonth} assistant messages a month. {allowance.used} used so far this month.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {provider
            ? `Using ${provider === "openai" ? "OpenAI" : "Anthropic"} on the server. Ask mode uses the cheaper model. Agent mode uses the stronger one. Names, emails, phones, and addresses are stripped before a question leaves this app.`
            : "No model key is set. Ask mode answers from your account on this machine. Agent mode can still run a few plain in-app actions, and those do not count toward the monthly cap."}
        </p>
        <Link href="/settings/usage" className="mt-3 inline-block text-sm font-semibold text-pine">
          Usage
        </Link>
      </section>
      {passkeyConfigured() && !user.guest ? <PasskeyOffer /> : null}
      <section className="rounded-3xl border border-line bg-paper p-5">
        <h2 className="font-serif text-title">Feedback</h2>
        <p className="mt-2 text-body leading-6 text-muted">
          On a computer, the Feedback button lets you drag any region. On a phone, use Send feedback or shake the phone. Both attach a screenshot.
        </p>
        <Link href="/feedback" className="mt-3 inline-flex h-12 items-center whitespace-nowrap text-base font-semibold text-pine">
          My feedback
        </Link>
      </section>
      <section className="rounded-3xl border border-line bg-paper p-5">
        <h2 className="font-serif text-2xl">Privacy</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Anonymized, de-identified pricing and outcome data is part of the terms you accept. This control is for personal information.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/terms" className="font-semibold text-pine">Terms</Link>
          {" · "}
          <Link href="/privacy" className="font-semibold text-pine">Privacy Policy</Link>
        </p>
        {privacy === "delete-failed" ? (
          <p className="mt-3 text-body text-danger">We could not delete the login from here. You are still signed in.</p>
        ) : null}
        {privacy === "saved" ? <p className="mt-3 text-body">Privacy choice saved.</p> : null}
        <form action="/api/account/delete" method="post" className="mt-3">
          <button type="submit" className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl border border-line bg-paper px-4 text-base font-semibold text-danger lg:w-auto">
            Delete my account
          </button>
        </form>
        <form action={setDoNotSell} className="mt-4 space-y-3">
          <label className="flex min-h-12 items-center gap-3 text-body leading-6">
            <input type="checkbox" name="doNotSell" defaultChecked={guide.ccpaDoNotSell} className="h-12 w-12 shrink-0" />
            Opt out of the sale or sharing of my personal information
          </label>
          <SubmitButton className="inline-flex h-12 items-center whitespace-nowrap text-base font-semibold text-pine">Save privacy choice</SubmitButton>
        </form>
      </section>
      <form action={signOut}>
        <SubmitButton pendingLabel="Signing out…" className="inline-flex h-12 items-center whitespace-nowrap text-base font-semibold text-pine">
          Sign out
        </SubmitButton>
      </form>
      {owner ? (
        <p className="text-body">
          <Link href="/admin/feedback" className="font-semibold text-pine">
            Feedback backlog
          </Link>
        </p>
      ) : null}
    </div>
  );
}
