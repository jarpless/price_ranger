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
import { Button } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { stepCopy } from "@/lib/guide/flow";
import { ensureGuideUser, getGuideQuote } from "@/lib/guide/store";
import { adjustmentFromSources, lineSettlement, priceError, visibleSources } from "@/lib/guide/pricing";
import { formatUsd } from "@/lib/money";
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
  const guide = await ensureGuideUser(user.id);
  if (!guide.tosAcceptedAt) redirect("/welcome");
  const row = await getGuideQuote(user.id, id);
  if (!row) notFound();
  const copy = stepCopy(row.step, row.path);
  const sent = Boolean(row.step === "share" && row.sharedAt);
  const title = sent ? "Sent" : copy.title;
  const now = sent ? "The link is ready. Share it yourself. Nothing else is emailed." : copy.now;
  const price = row.priceCents != null ? formatUsd(row.priceCents) : "";
  const shareHref = row.shareToken ? `/p/${row.shareToken}` : "";
  const showPrice = row.step === "review" || row.step === "adjust" || (row.step === "share" && !row.sharedAt);
  const data = await getData();
  const quote = await data.getQuote(user.id, id);
  const groups = await data.listGroups(user.id);
  const adjustment = adjustmentFromSources(row.sources);
  const byId = new Map(groups.map((group) => [group.id, group]));
  const lines = (quote?.tiers[0]?.groupIds ?? []).flatMap((groupId) => byId.get(groupId)?.items ?? []).map((item) => {
    const settled = lineSettlement(
      { name: item.name, quantity: item.quantity, unitPriceCents: item.unitPriceCents },
      adjustment,
    );
    return { name: item.name, detail: settled.detail, price: formatUsd(settled.cents) };
  });
  const sources = visibleSources(row.sources);

  return (
    <div data-guide-step={row.step} className="mx-auto max-w-[40rem]">
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
        <div>
          <MarketCard
            quoteId={row.quoteId}
            description={row.description}
            priceCents={row.priceCents}
            note={row.note}
            sources={row.sources}
            extras={lines}
          />
          {sources.length > 0 ? (
            <p className="mt-3 text-caption text-muted">{sources[0]}</p>
          ) : null}
          <div className="mt-4 flex items-center gap-1">
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
      ) : null}

      {row.step === "share" && row.sharedAt && shareHref ? (
        <div className="mt-6 space-y-4">
          <p className="font-serif text-price text-pine tabular-nums">{price}</p>
          {lines.length > 0 ? (
            <ul className="rounded-2xl border border-line bg-paper p-4 shadow-card">
              {lines.map((line) => (
                <li key={`${line.name}-${line.detail}`} className="flex items-baseline justify-between gap-3 py-2">
                  <span>
                    <span className="block text-base font-semibold">{line.name}</span>
                    <span className="text-caption text-muted">{line.detail}</span>
                  </span>
                  <span className="font-serif text-title tabular-nums">{line.price}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <ShareActions href={shareHref} title={row.description || "Price Ranger"} />
          <Link
            href={shareHref}
            className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl border border-line bg-paper text-base font-semibold text-ink lg:w-auto lg:min-w-48 lg:px-6"
          >
            Open the link
          </Link>
          <a
            href={`${shareHref}/pdf`}
            className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl border border-line bg-paper text-base font-semibold text-ink lg:w-auto lg:min-w-48 lg:px-6"
          >
            Download PDF
          </a>
          <form action={continueGuide}>
            <input type="hidden" name="quoteId" value={row.quoteId} />
            <PrimaryDock>
              <Button type="submit">Mark sold</Button>
            </PrimaryDock>
          </form>
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
              <form action={markOutcome}>
                <input type="hidden" name="quoteId" value={row.quoteId} />
                <input type="hidden" name="outcome" value="sold" />
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
