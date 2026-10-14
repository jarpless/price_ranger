import { PlansPicker } from "@/components/plans-picker";
import { InfoTip } from "@/components/info-tip";
import { requireUser } from "@/lib/auth";
import { stripeTestKey } from "@/lib/billing";
import { FORM_ERRORS } from "@/lib/form";
import { planStatusLine, pricingAccess } from "@/lib/guide/access";
import { recordFunnel } from "@/lib/guide/store";

export const metadata = { title: "Plans" };

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; canceled?: string }>;
}) {
  const { canceled, error } = await searchParams;
  const user = await requireUser();
  const access = await pricingAccess(user);
  await recordFunnel(user.id, "upgrade_viewed", { variant: access.guide.variant, source: "page" });
  const ready = Boolean(stripeTestKey());

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-1">
        <h1 className="font-serif text-display text-balance lg:text-[2.5rem] lg:leading-[3rem]">Plans</h1>
        <InfoTip id="plans" />
      </div>
      <p className="mt-3 text-body leading-6">{planStatusLine(access)}</p>
      <p className="mt-3 max-w-xl text-body leading-6 text-muted">
        Free covers a few prices. A pass, Plus, or Pro keeps every price you save and raises the assistant limit.
      </p>
      {canceled ? <p className="mt-4 text-body">Checkout was canceled. Your prices are still here.</p> : null}
      {error && FORM_ERRORS[error] ? <p className="mt-4 rounded-2xl bg-[#f8e8e4] px-4 py-3 text-body text-danger">{FORM_ERRORS[error]}</p> : null}
      <PlansPicker current={user.plan} ready={ready} quoteLimit={access.limits.quoteLimit} />
    </div>
  );
}
