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
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-lg flex-col justify-center lg:max-w-xl">
      <h1 className="font-serif text-5xl leading-tight">{paid ? "You're on Plus" : "We could not confirm that payment"}</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        {paid
          ? "Your saved prices stay with you. You can keep pricing new ones."
          : "If you paid in Stripe test mode, the session did not match this account. Your prices are still saved."}
      </p>
      <Link href="/" className="mt-8 inline-flex h-14 items-center justify-center rounded-2xl bg-pine text-lg font-semibold text-cream">
        Back home
      </Link>
    </div>
  );
}
