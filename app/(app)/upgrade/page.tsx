import { startCheckout } from "@/app/guide-actions";
import { PrimaryDock } from "@/components/primary-dock";
import { Button } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { stripeTestKey } from "@/lib/billing";
import { planStatusLine, pricingAccess } from "@/lib/guide/access";
import { recordFunnel } from "@/lib/guide/store";
import { PLANS } from "@/lib/plans";

export const metadata = { title: "Upgrade" };

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; canceled?: string }>;
}) {
  const { error, canceled } = await searchParams;
  const user = await requireUser();
  const access = await pricingAccess(user);
  await recordFunnel(user.id, "upgrade_viewed", { variant: access.guide.variant, source: "page" });
  const ready = Boolean(stripeTestKey());

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10">
      <div>
      <h1 className="font-serif text-display text-balance lg:text-[2.5rem] lg:leading-[3rem]">Keep your prices</h1>
      <p className="mt-3 text-body leading-6">{planStatusLine(access)}</p>
      <p className="mt-3 max-w-xl text-body leading-6 text-muted">
        Plus keeps the prices you already saved and lets you price new ones.
      </p>
      {canceled ? <p className="mt-4 text-body">Checkout was canceled. Your prices are still here.</p> : null}
      {error ? <p className="mt-4 text-body text-danger">{error}</p> : null}
      </div>
      <section className="mt-6 rounded-2xl border border-line bg-paper p-5 shadow-card lg:mt-0">
        <p className="font-serif text-title">{PLANS.plus.name}</p>
        <p className="mt-1 text-body">{PLANS.plus.priceLabel}</p>
        <form action={startCheckout} className="mt-4">
          <PrimaryDock>
            <Button type="submit">Upgrade</Button>
          </PrimaryDock>
        </form>
        {ready ? (
          <p className="mt-3 text-sm leading-relaxed text-muted">Checkout stays in Stripe test mode. No live charges.</p>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Stripe test checkout needs STRIPE_SECRET_KEY set to a key that starts with sk_test_.
          </p>
        )}
      </section>
    </div>
  );
}
