import { PendingLink as Link } from "@/components/pending-link";
import { notFound, redirect } from "next/navigation";

import {
  applyAdjustment,
  continueGuide,
  markOutcome,
  saveDescription,
  sendQuote,
} from "@/app/guide-actions";
import { GuideProgress, WhereCard } from "@/components/guide-ui";
import { Button } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { pathLabel, stepCopy } from "@/lib/guide/flow";
import { ensureGuideUser, getGuideQuote } from "@/lib/guide/store";
import { formatUsd } from "@/lib/money";

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
  const did = row.description ? `You added “${row.description}”.` : "You have not added it yet.";
  const price = row.priceCents != null ? formatUsd(row.priceCents) : "";
  const shareHref = row.shareToken ? `/p/${row.shareToken}` : "";

  return (
    <div data-guide-step={row.step} className="mx-auto flex w-full max-w-lg flex-col gap-5 lg:max-w-xl">
      <GuideProgress step={row.step} />
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">{pathLabel(row.path)}</p>
      <h1 className="font-serif text-5xl leading-tight">{copy.title}</h1>
      <WhereCard did={did} now={copy.now} next={copy.next} />
      {error ? (
        <p className="rounded-2xl bg-[#f8e8e4] px-4 py-3 text-base text-danger">
          {error === "share" ? "We could not send that yet. Try again." : "Add a few words, or a photo, then continue."}
        </p>
      ) : null}

      {row.step === "describe" ? (
        <form action={saveDescription} className="space-y-4">
          <input type="hidden" name="quoteId" value={row.quoteId} />
          <label className="block text-lg font-semibold">
            What is it?
            <textarea
              name="description"
              rows={4}
              defaultValue={row.description}
              placeholder="Oak table, or a roof on a small house"
              className="mt-2 w-full rounded-3xl border border-line bg-paper px-4 py-3 text-lg font-normal outline-none focus:border-pine"
            />
          </label>
          <label className="block text-base font-semibold">
            Add a photo if you have one
            <input name="photo" type="file" accept="image/*" className="mt-2 block w-full text-base font-normal" />
          </label>
          <Button type="submit" className="h-14 text-lg">
            {copy.primary}
          </Button>
        </form>
      ) : null}

      {row.step === "review" ? (
        <form action={continueGuide} className="space-y-4">
          <input type="hidden" name="quoteId" value={row.quoteId} />
          <p className="rounded-3xl bg-paper p-6">
            <span className="text-sm font-semibold uppercase tracking-wide text-muted">Your price</span>
            <span className="mt-1 block font-serif text-6xl text-pine">{price}</span>
            <span className="mt-3 block text-lg leading-relaxed">{row.note}</span>
          </p>
          <Button type="submit" className="h-14 text-lg">
            {copy.primary}
          </Button>
        </form>
      ) : null}

      {row.step === "adjust" ? (
        <div className="space-y-4">
          <p className="font-serif text-6xl text-pine">{price}</p>
          <form action={continueGuide}>
            <input type="hidden" name="quoteId" value={row.quoteId} />
            <Button type="submit" className="h-14 text-lg">
              {copy.primary}
            </Button>
          </form>
          <details className="rounded-3xl border border-line bg-paper p-4">
            <summary className="cursor-pointer text-lg font-semibold">Add more</summary>
            <div className="mt-4 space-y-4">
              <form action={applyAdjustment} className="space-y-2">
                <input type="hidden" name="quoteId" value={row.quoteId} />
                <input type="hidden" name="kind" value="discount" />
                <label className="block text-base font-semibold">
                  Discount percent
                  <input name="percent" inputMode="numeric" placeholder="10" className="mt-1 h-12 w-full rounded-2xl border border-line px-3 text-base font-normal" />
                </label>
                <Button type="submit" variant="secondary">
                  Take it off
                </Button>
              </form>
              <form action={applyAdjustment} className="space-y-2">
                <input type="hidden" name="quoteId" value={row.quoteId} />
                <input type="hidden" name="kind" value="fee" />
                <label className="block text-base font-semibold">
                  Fee
                  <input name="amount" inputMode="decimal" placeholder="25" className="mt-1 h-12 w-full rounded-2xl border border-line px-3 text-base font-normal" />
                </label>
                <Button type="submit" variant="secondary">
                  Add fee
                </Button>
              </form>
              <form action={applyAdjustment} className="space-y-2">
                <input type="hidden" name="quoteId" value={row.quoteId} />
                <input type="hidden" name="kind" value="line" />
                <label className="block text-base font-semibold">
                  Extra line
                  <input name="name" placeholder="Delivery" className="mt-1 h-12 w-full rounded-2xl border border-line px-3 text-base font-normal" />
                </label>
                <label className="block text-base font-semibold">
                  Amount
                  <input name="amount" inputMode="decimal" placeholder="15" className="mt-1 h-12 w-full rounded-2xl border border-line px-3 text-base font-normal" />
                </label>
                <Button type="submit" variant="secondary">
                  Add line
                </Button>
              </form>
              <div>
                <p className="text-base font-semibold">Where this price came from</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-muted">
                  {row.sources.map((source) => (
                    <li key={source}>{source}</li>
                  ))}
                </ul>
              </div>
            </div>
          </details>
        </div>
      ) : null}

      {row.step === "share" ? (
        <div className="space-y-4">
          <p className="font-serif text-6xl text-pine">{price}</p>
          {row.sharedAt && shareHref ? (
            <>
              <p className="rounded-3xl bg-paper p-5 text-lg leading-relaxed">
                Sent. Share this link:{" "}
                <Link href={shareHref} className="font-semibold text-pine underline">
                  {shareHref}
                </Link>
              </p>
              <section className="rounded-3xl bg-[#f8f1df] p-5">
                <h2 className="font-serif text-3xl">What's next</h2>
                <p className="mt-2 text-lg leading-relaxed">Mark it sold when you know. Your list stays easy to read.</p>
              </section>
              <form action={continueGuide}>
                <input type="hidden" name="quoteId" value={row.quoteId} />
                <Button type="submit" className="h-14 text-lg">
                  Did it sell?
                </Button>
              </form>
            </>
          ) : (
            <form action={sendQuote}>
              <input type="hidden" name="quoteId" value={row.quoteId} />
              <Button type="submit" className="h-14 text-lg">
                {copy.primary}
              </Button>
            </form>
          )}
        </div>
      ) : null}

      {row.step === "sold" ? (
        <div className="space-y-4">
          {row.outcome || done ? (
            <>
              <p className="text-lg leading-relaxed">
                {row.outcome === "sold" ? "Saved. Nice work." : "Saved. You can mark it sold later from home."}
              </p>
              <Link href="/" className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-pine text-lg font-semibold text-cream">
                Back home
              </Link>
            </>
          ) : (
            <>
              <form action={markOutcome}>
                <input type="hidden" name="quoteId" value={row.quoteId} />
                <input type="hidden" name="outcome" value="sold" />
                <Button type="submit" className="h-14 text-lg">
                  {copy.primary}
                </Button>
              </form>
              <form action={markOutcome}>
                <input type="hidden" name="quoteId" value={row.quoteId} />
                <input type="hidden" name="outcome" value="not_yet" />
                <button type="submit" className="h-12 w-full text-base font-semibold text-pine">
                  Not yet
                </button>
              </form>
            </>
          )}
        </div>
      ) : null}

      <p className="text-sm leading-relaxed text-muted">
        Want a hand? Open the ranger button and ask it to walk you through this step.
      </p>
    </div>
  );
}
