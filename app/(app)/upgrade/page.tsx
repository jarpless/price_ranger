import { startCheckout } from "@/app/guide-actions";
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
    <div className="mx-auto w-full max-w-lg lg:max-w-xl">
      <h1 className="font-serif text-5xl leading-tight">Keep your prices</h1>
      <p className="mt-4 text-lg leading-relaxed">{planStatusLine(access)}</p>
      <p className="mt-3 text-lg leading-relaxed text-muted">
        Plus keeps the prices you already saved and lets you keep pricing new ones.
      </p>
      {canceled ? <p className="mt-4 text-base">Checkout was canceled. Your prices are still here.</p> : null}
      {error ? <p className="mt-4 text-base text-danger">{error}</p> : null}
      <section className="mt-6 rounded-3xl border border-line bg-paper p-5">
        <p className="font-serif text-3xl">{PLANS.plus.name}</p>
        <p className="mt-1 text-lg">{PLANS.plus.priceLabel}</p>
        <form action={startCheckout} className="mt-4">
          <Button type="submit" className="h-14 text-lg">
            Upgrade to keep access
          </Button>
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
