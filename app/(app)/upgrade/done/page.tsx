import { PendingLink as Link } from "@/components/pending-link";

import { finishCheckout } from "@/app/guide-actions";
import { requireUser } from "@/lib/auth";
import { formatUsd } from "@/lib/money";
import { PLANS, type PlanId } from "@/lib/plans";

export const metadata = { title: "Upgrade complete" };

function planName(plan: string): string {
  if (plan === "pass") return "30-day pass";
  if (plan === "plus" || plan === "pro" || plan === "free") return PLANS[plan as PlanId].name;
  return "Plus";
}

export default async function UpgradeDonePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId = "" } = await searchParams;
  await requireUser();
  const result = sessionId ? await finishCheckout(sessionId) : null;
  const status = result?.status ?? "failed";
  const name = planName(result?.plan || "plus");
  const renews = result?.renewsAt ? new Date(result.renewsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;

  const title =
    status === "paid"
      ? `You're on ${name}`
      : status === "pending"
        ? "Confirming your payment"
        : status === "canceled"
          ? "Checkout canceled"
          : "Payment not confirmed";

  const body =
    status === "paid"
      ? result?.interval === "once"
        ? `${name} is active. Your saved prices stay with you.`
        : `${name} is active${renews ? ` and renews on ${renews}` : ""}. Your saved prices stay with you.`
      : status === "pending"
        ? "Stripe accepted the checkout. This page checks again in a few seconds while the plan updates."
        : status === "canceled"
          ? "No charge was completed. Your prices are still saved."
          : "This checkout did not finish. Your prices are still saved.";

  return (
    <div className="mx-auto max-w-[40rem] lg:py-16">
      {status === "pending" ? <meta httpEquiv="refresh" content="4" /> : null}
      <h1 className="font-serif text-display text-balance lg:text-[2.5rem] lg:leading-[3rem]">{title}</h1>
      <p className="mt-3 text-body leading-6 text-muted">{body}</p>
      {status === "paid" && result?.amountCents ? (
        <p className="mt-3 font-serif text-title tabular-nums">{formatUsd(result.amountCents)}</p>
      ) : null}
      <Link href="/" data-haptic="" className="mt-8 inline-flex h-12 items-center justify-center whitespace-nowrap rounded-2xl bg-pine px-6 text-base font-semibold text-cream">
        Home
      </Link>
    </div>
  );
}
