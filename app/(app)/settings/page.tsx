import { PendingLink as Link } from "@/components/pending-link";

import { signOut } from "@/app/actions";
import { setDoNotSell } from "@/app/guide-actions";
import { PasskeyOffer } from "@/components/passkey-button";
import { InfoTip } from "@/components/info-tip";
import { SubmitButton } from "@/components/ui";
import { readBillingProfile } from "@/lib/account/billing-profile";
import { requireUser } from "@/lib/auth";
import { passkeyConfigured } from "@/lib/auth-providers";
import { ensureGuideUser } from "@/lib/guide/store";
import { isOwnerEmail } from "@/lib/owner";
import { PLANS, type PlanId } from "@/lib/plans";
import { assistantAllowance } from "@/lib/usage";
import { VERSION_LABEL } from "@/lib/version";

export const metadata = { title: "Settings" };

function planPrice(planId: PlanId, interval: string | null): string {
  if (planId === "pass" || interval === "once") return "$2.99 for 30 days";
  if (planId === "plus" && interval === "year") return "$39/yr";
  if (planId === "plus") return "$4.99/mo";
  if (planId === "pro") return "$12/mo";
  return "$0";
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ privacy?: string; billing?: string }>;
}) {
  const { privacy, billing } = await searchParams;
  const user = await requireUser();
  const owner = isOwnerEmail(user.email);
  const allowance = await assistantAllowance(user);
  const plan = PLANS[user.plan];
  const guide = await ensureGuideUser(user.id);
  const profile = await readBillingProfile(user.id);
  const renews = profile.renewsAt
    ? new Date(profile.renewsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;
  const nearLimit = allowance.remaining <= 2;

  return (
    <div className="page-stack mx-auto w-full max-w-3xl">
      <h1 className="font-serif text-display">Settings</h1>
      <section className="surface">
        <div className="flex items-center gap-1">
          <h2 className="font-serif text-title">Plan</h2>
          <InfoTip id="plans" />
        </div>
        <p className="mt-2 text-body font-semibold">{plan.name}</p>
        <p className="text-body text-muted">{planPrice(user.plan, profile.interval)}</p>
        {renews && profile.interval !== "once" ? <p className="mt-2 text-body">Renews {renews}.</p> : null}
        {profile.interval === "once" || user.plan === "pass" ? <p className="mt-2 text-body">30-day pass. It does not renew.</p> : null}
        <p className="mt-3 text-body leading-6">
          {allowance.used} of {allowance.cap} assistant messages used this month.
          {nearLimit ? " Upgrade to keep asking." : ""}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link href="/upgrade" className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-2xl bg-pine px-4 text-base font-semibold text-cream">
            See plans
          </Link>
          <Link href="/settings/billing" className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-2xl border border-line bg-paper px-4 text-base font-semibold">
            Manage billing
          </Link>
        </div>
        {billing === "unavailable" ? <p className="mt-3 text-body text-danger">Billing isn't available from this server yet.</p> : null}
      </section>
      {passkeyConfigured() && !user.guest ? <PasskeyOffer /> : null}
      <section className="surface">
        <h2 className="font-serif text-title">Privacy</h2>
        <p className="mt-2 text-body leading-6 text-muted">
          Anonymized prices are part of the terms you accept. This control is for personal information.
        </p>
        <p className="mt-2 text-body">
          <Link href="/terms" className="font-semibold text-pine">Terms</Link>
          {" · "}
          <Link href="/privacy" className="font-semibold text-pine">Privacy Policy</Link>
        </p>
        {privacy === "saved" ? <p className="mt-3 text-body">Privacy choice saved.</p> : null}
        <form action={setDoNotSell} className="mt-4 space-y-3">
          <label className="flex min-h-12 items-center gap-3 text-body leading-6">
            <input type="checkbox" name="doNotSell" defaultChecked={guide.ccpaDoNotSell} className="h-6 w-6 shrink-0" />
            Opt out of the sale or sharing of my personal information
          </label>
          <SubmitButton className="inline-flex h-12 items-center whitespace-nowrap text-base font-semibold text-pine">Save privacy choice</SubmitButton>
        </form>
        <Link href="/settings/delete" className="mt-4 inline-flex h-12 items-center whitespace-nowrap text-base font-semibold text-danger">
          Delete account
        </Link>
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
      <p className="text-caption text-muted">{VERSION_LABEL}</p>
    </div>
  );
}
