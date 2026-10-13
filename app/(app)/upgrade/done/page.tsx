import { PendingLink as Link } from "@/components/pending-link";

import { finishCheckout } from "@/app/guide-actions";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Upgrade complete" };

export default async function UpgradeDonePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId = "" } = await searchParams;
  await requireUser();
  const paid = sessionId ? await finishCheckout(sessionId) : false;

  return (
    <div className="mx-auto max-w-[40rem] lg:py-16">
      <h1 className="font-serif text-display text-balance lg:text-[2.5rem] lg:leading-[3rem]">{paid ? "You're on Plus" : "Payment not confirmed"}</h1>
      <p className="mt-3 text-body leading-6 text-muted">
        {paid
          ? "Your saved prices stay with you. You can keep pricing new ones."
          : "If you paid in Stripe test mode, the session did not match this account. Your prices are still saved."}
      </p>
      <Link href="/" data-haptic="" className="mt-8 inline-flex h-12 items-center justify-center whitespace-nowrap rounded-2xl bg-pine px-6 text-base font-semibold text-cream">
        Home
      </Link>
    </div>
  );
}
