import { PendingLink as Link } from "@/components/pending-link";

import { cancelSubscription, startPortal } from "@/app/guide-actions";
import { readBillingProfile } from "@/lib/account/billing-profile";
import { requireUser } from "@/lib/auth";
import { readBillingDetails, stripeModeLabel, stripeSecretKey } from "@/lib/billing";
import { formatUsd } from "@/lib/money";
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
  const details = await readBillingDetails(profile.customerId);

  return (
    <div className="page-stack max-w-3xl">
      <Link href="/settings" className="text-base font-semibold text-pine">
        Settings
      </Link>
      <h1 className="font-serif text-display">Billing</h1>
      <p className="text-caption text-muted">{stripeModeLabel()}</p>
      <section className="surface">
        <p className="text-caption font-semibold text-muted">Current plan</p>
        <p className="mt-1 font-serif text-title">{plan.name}</p>
        <p className="mt-1 text-body text-muted">{priceLine(user.plan, profile.interval)}</p>
        {renews && profile.interval !== "once" && user.plan !== "pass" ? <p className="mt-2 text-body">Renews {renews}.</p> : null}
        {user.plan === "pass" || profile.interval === "once" ? <p className="mt-2 text-body">This pass does not renew.</p> : null}
      </section>
      <section className="surface">
        <h2 className="font-serif text-title">Payment method</h2>
        {details.card ? (
          <p className="mt-2 text-body capitalize">{details.card.brand} ···· {details.card.last4}</p>
        ) : (
          <p className="mt-2 text-body leading-6 text-muted">No card is on file for this account.</p>
        )}
      </section>
      <section className="surface">
        <h2 className="font-serif text-title">Invoices</h2>
        {details.invoices.length > 0 ? (
          <ul className="mt-3 divide-y divide-line">
            {details.invoices.map((invoice) => (
              <li key={invoice.id} className="line-row">
                <span className="list-copy">
                  <span className="list-title">{invoice.number}</span>
                  <span className="list-meta">
                    <span className="pill">{invoice.date}</span>
                    <span className="pill">{invoice.status}</span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="list-price">{formatUsd(invoice.amountCents)}</span>
                  {invoice.url ? (
                    <a href={invoice.url} className="text-caption font-semibold text-pine" target="_blank" rel="noreferrer">
                      View
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-body leading-6 text-muted">No invoices yet.</p>
        )}
      </section>
      {notice === "canceled" ? (
        <p className="rounded-2xl bg-[#f8f1df] px-4 py-3 text-body leading-6">The subscription is canceled. You're on the free plan.</p>
      ) : null}
      {notice === "unavailable" ? (
        <p className="rounded-2xl bg-[#f8e8e4] px-4 py-3 text-body leading-6 text-danger">
          Billing isn't available from this server yet. Add a Stripe test key to take test payments. Live mode starts only when a live key is set.
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        {stripeSecretKey() ? (
          <form action={startPortal}>
            <button type="submit" className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl bg-pine px-4 text-base font-semibold text-cream sm:w-auto">
              Manage billing
            </button>
          </form>
        ) : null}
        {paid ? (
          <form action={cancelSubscription}>
            <button type="submit" className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl border border-line bg-paper px-4 text-base font-semibold text-danger sm:w-auto">
              Cancel subscription
            </button>
          </form>
        ) : (
          <Link href="/upgrade" className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-2xl border border-line bg-paper px-4 text-base font-semibold">
            See plans
          </Link>
        )}
      </div>
      {stripeSecretKey() ? null : <p className="text-caption text-muted">Payments stay off until a Stripe test key is set. A live key is used only when you set one.</p>}
    </div>
  );
}
