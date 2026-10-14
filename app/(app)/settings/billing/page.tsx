import { PendingLink as Link } from "@/components/pending-link";

import { cancelSubscription } from "@/app/guide-actions";
import { readBillingProfile } from "@/lib/account/billing-profile";
import { requireUser } from "@/lib/auth";
import { stripeTestKey } from "@/lib/billing";
import { PLANS, type PlanId } from "@/lib/plans";

export const metadata = { title: "Billing" };

function priceLine(planId: PlanId, interval: string | null): string {
  if (planId === "pass" || interval === "once") return "$2.99 for 30 days";
  if (planId === "plus" && interval === "year") return "$39 a year";
  if (planId === "plus") return "$4.99 a month";
  if (planId === "pro") return "$12 a month";
  return "$0";
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  const user = await requireUser();
  const profile = await readBillingProfile(user.id);
  const plan = PLANS[user.plan];
  const renews = profile.renewsAt
    ? new Date(profile.renewsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;
  const paid = user.plan === "plus" || user.plan === "pro" || user.plan === "pass";

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link href="/settings" className="text-base font-semibold text-pine">
        Settings
      </Link>
      <h1 className="font-serif text-display">Billing</h1>
      <section className="rounded-3xl border border-line bg-paper p-5">
        <p className="text-caption font-semibold text-muted">Current plan</p>
        <p className="mt-1 font-serif text-title">{plan.name}</p>
        <p className="mt-1 text-body text-muted">{priceLine(user.plan, profile.interval)}</p>
        {renews && profile.interval !== "once" && user.plan !== "pass" ? <p className="mt-2 text-body">Renews {renews}.</p> : null}
        {user.plan === "pass" || profile.interval === "once" ? <p className="mt-2 text-body">This pass does not renew.</p> : null}
      </section>
      {notice === "canceled" ? (
        <p className="rounded-2xl bg-[#f8f1df] px-4 py-3 text-body leading-6">The subscription is canceled. You're on the free plan.</p>
      ) : null}
      {notice === "unavailable" ? (
        <p className="rounded-2xl bg-[#f8e8e4] px-4 py-3 text-body leading-6 text-danger">
          Billing isn't available from this server yet. Test payments use a Stripe test key.
        </p>
      ) : null}
      {paid ? (
        <form action={cancelSubscription}>
          <button type="submit" className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl border border-line bg-paper px-4 text-base font-semibold text-danger sm:w-auto">
            Cancel subscription
          </button>
        </form>
      ) : (
        <Link href="/upgrade" className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-2xl bg-pine px-4 text-base font-semibold text-cream">
          See plans
        </Link>
      )}
      {stripeTestKey() ? null : <p className="text-caption text-muted">Payments stay in Stripe test mode when a test key is set.</p>}
    </div>
  );
}
