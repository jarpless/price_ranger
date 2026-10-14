import { PendingLink as Link } from "@/components/pending-link";
import { notFound, redirect } from "next/navigation";

import {
  continueGuide,
  markOutcome,
  saveDescription,
  sendQuote,
} from "@/app/guide-actions";
import { GuideProgress } from "@/components/guide-ui";
import { MarketCard } from "@/components/market-card";
import { PathSwitch } from "@/components/path-switch";
import { PhotoField } from "@/components/photo-field";
import { PrimaryDock } from "@/components/primary-dock";
import { ShareActions } from "@/components/share-actions";
import { InfoTip } from "@/components/info-tip";
import { MoneyField } from "@/components/money-field";
import { Button } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { stepCopy } from "@/lib/guide/flow";
import { ensureGuideUser, getGuideQuote } from "@/lib/guide/store";
import { adjustmentFromSources, lineSettlement, settledTotal, priceError } from "@/lib/guide/pricing";
import { dollarsInputValue, formatUsd } from "@/lib/money";
import { getData } from "@/lib/store";

export const metadata = { title: "Your price" };

export default async function GuidePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { id } = await params;
  const { error, done } = await searchParams;
  const user = await requireUser();
  const data = await getData();
  const [guide, row, quote] = await Promise.all([
    ensureGuideUser(user.id),
    getGuideQuote(user.id, id),
    data.getQuote(user.id, id),
  ]);
  if (!guide.tosAcceptedAt) redirect("/welcome");
  if (!row) notFound();
  const groupIds = [...new Set(quote?.tiers.flatMap((tier) => tier.groupIds) ?? [])];
  const groups = (await Promise.all(groupIds.map((groupId) => data.getGroup(user.id, groupId)))).filter(
    (group): group is NonNullable<typeof group> => Boolean(group),
  );
  const copy = stepCopy(row.step, row.path);
  const sent = Boolean(row.step === "share" && row.sharedAt);
  const title =
    sent ? "Link ready" : row.outcome === "sold" ? "Sold" : row.outcome === "not_yet" ? "Not yet" : copy.title;
  const now = sent ? "The link is ready. Share it yourself. Nothing else is emailed." : row.outcome === "sold" ? "The sold price is saved." : row.outcome === "not_yet" ? "You can mark it sold later from home." : copy.now;
  const adjustment = adjustmentFromSources(row.sources);
  const byId = new Map(groups.map((group) => [group.id, group]));
  const money = (quote?.tiers[0]?.groupIds ?? []).flatMap((groupId) => byId.get(groupId)?.items ?? []).map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
  }));
  const lineTotal = money.length ? settledTotal(money, adjustment) : null;
  const headlineCents = lineTotal ?? row.priceCents;
  const price = headlineCents != null ? formatUsd(headlineCents) : "";
  const shareHref = row.shareToken ? `/p/${row.shareToken}` : "";
  const showPrice = row.step === "review" || row.step === "adjust" || (row.step === "share" && !row.sharedAt);
  const lines = money.map((item) => {
    const settled = lineSettlement(item, adjustment);
    return { name: item.name, detail: settled.detail, price: formatUsd(settled.cents) };
  });
  return (
    <div data-guide-step={row.step} className="mx-auto w-full max-w-[40rem] lg:mx-0 lg:max-w-none">
      <GuideProgress step={row.step} />
      <h1 className="mt-6 font-serif text-display text-balance lg:text-[2.5rem] lg:leading-[3rem]">{title}</h1>
      <p className="mt-2 text-body text-muted">{now}</p>
      {priceError(error) ? (
        <p className="mt-4 rounded-2xl bg-[#f8e8e4] px-4 py-3 text-body text-danger">{priceError(error)}</p>
      ) : null}
      {row.photoName ? (
        // The photo route is the seller's copy of the picture they added.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/guide/${id}/photo`} alt={row.description} className="mt-6 max-h-64 w-full rounded-2xl border border-line object-contain bg-paper" />
      ) : null}

      {row.step === "describe" ? (
        <form action={saveDescription} className="mt-6 space-y-4">
          <input type="hidden" name="quoteId" value={row.quoteId} />
          <PathSwitch defaultValue={row.path} />
          <label className="block text-base font-semibold">
            What is it?
            <textarea
              name="description"
              rows={4}
              defaultValue={row.description}
              placeholder="Oak table, or a small roof"
              className="mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base font-normal leading-6 outline-none focus:border-pine"
            />
          </label>
          <PhotoField />
          <PrimaryDock>
            <Button type="submit">{copy.primary}</Button>
          </PrimaryDock>
        </form>
      ) : null}

      {showPrice ? (
        <div className="content-split">
          <MarketCard
            quoteId={row.quoteId}
            description={row.description}
            priceCents={row.priceCents}
            note={row.note}
            sources={row.sources}
            extras={lines}
            totalCents={headlineCents}
          />
          <div className="lg:sticky lg:top-4">
            <div className="mt-4 flex items-center gap-1 lg:mt-6">
              <p className="text-caption text-muted">Send creates a link and a PDF. You share them yourself.</p>
              <InfoTip id="share" />
            </div>
            <form action={sendQuote}>
              <input type="hidden" name="quoteId" value={row.quoteId} />
              <PrimaryDock>
                <Button type="submit">Send</Button>
              </PrimaryDock>
            </form>
          </div>
        </div>
      ) : null}

      {row.step === "share" && row.sharedAt && shareHref ? (
        <div className="mt-6 space-y-4">
          <p className="font-serif text-price text-pine tabular-nums">{price}</p>
          {lines.length > 0 ? (
            <ul className="surface">
              {lines.map((line) => (
                <li key={`${line.name}-${line.detail}`} className="line-row">
                  <span className="list-copy">
                    <span className="list-title">{line.name}</span>
                    <span className="text-caption text-muted">{line.detail}</span>
                  </span>
                  <span className="list-price">{line.price}</span>
                </li>
              ))}
              <li className="line-row">
                <span className="list-title">Total</span>
                <span className="list-price">{price}</span>
              </li>
            </ul>
          ) : null}
          <ShareActions href={shareHref} title={row.description || "Price Ranger"} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={`${shareHref}/pdf`}
              className="inline-flex h-12 flex-1 items-center justify-center whitespace-nowrap rounded-2xl border border-line bg-paper text-base font-semibold text-ink"
            >
              Download PDF
            </a>
            <form action={continueGuide} className="flex-1">
              <input type="hidden" name="quoteId" value={row.quoteId} />
              <button type="submit" data-spotlight="mark-sold" className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl border border-line bg-paper text-base font-semibold text-ink">
                Mark sold
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {row.step === "sold" ? (
        <div className="mt-6">
          {row.outcome || done ? (
            <div className="space-y-4">
              <p className="text-body leading-6">
                {row.outcome === "sold" ? "Saved. Nice work." : "Saved. You can mark it sold later from home."}
              </p>
              <PrimaryDock>
                <Link
                  href="/"
                  data-haptic=""
                  className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl bg-pine text-base font-semibold text-cream lg:w-auto lg:min-w-48 lg:px-6"
                >
                  Home
                </Link>
              </PrimaryDock>
            </div>
          ) : (
            <div className="space-y-2">
              <form action={markOutcome} className="space-y-3">
                <input type="hidden" name="quoteId" value={row.quoteId} />
                <input type="hidden" name="outcome" value="sold" />
                <MoneyField
                  name="amount"
                  label="Sold for"
                  defaultValue={headlineCents != null ? dollarsInputValue(headlineCents) : ""}
                />
                <PrimaryDock>
                  <Button type="submit">{copy.primary}</Button>
                </PrimaryDock>
              </form>
              <form action={markOutcome}>
                <input type="hidden" name="quoteId" value={row.quoteId} />
                <input type="hidden" name="outcome" value="not_yet" />
                <button type="submit" className="h-12 w-full whitespace-nowrap text-base font-semibold text-pine lg:w-auto">
                  Not yet
                </button>
              </form>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
