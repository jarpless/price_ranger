import { redirect } from "next/navigation";

import { CaptureForm } from "@/components/capture-form";
import { requireUser } from "@/lib/auth";
import { captureFromQuery } from "@/lib/capture-state";
import { newPriceHref } from "@/lib/landing-categories";
import { pricingAccess } from "@/lib/guide/access";
import { priceError } from "@/lib/guide/pricing";
import { ensureGuideUser } from "@/lib/guide/store";
import { CATEGORIES } from "@/lib/market";

export const metadata = { title: "New price" };

export default async function NewPricePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; q?: string; cat?: string }>;
}) {
  const { error, q, cat } = await searchParams;
  const capture = captureFromQuery(q, cat, CATEGORIES);
  const user = await requireUser();
  const guide = await ensureGuideUser(user.id);
  if (!guide.tosAcceptedAt) redirect(`/welcome?next=${encodeURIComponent(newPriceHref(capture.description, capture.category))}`);
  const access = await pricingAccess(user);
  if (!access.ok) redirect("/upgrade");

  return (
    <div className="content-split">
      <div>
        <h1 className="font-serif text-display text-balance lg:text-[2.5rem] lg:leading-[3rem]">New price</h1>
        <p className="mt-2 text-body text-muted">Take a photo or tap an item. Nothing is selected until you do.</p>
        {error === "photo" || error === "heic" || error === "large" || error === "unread" ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-2xl bg-[#f8e8e4] px-4 py-3 text-body text-danger">{priceError(error)}</p>
            {error === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/new/photo" alt="The photo you added" className="max-h-64 w-full rounded-2xl border border-line object-contain bg-paper" />
            ) : null}
          </div>
        ) : error ? (
          <p className="mt-4 rounded-2xl bg-[#f8e8e4] px-4 py-3 text-body text-danger">{priceError(error)}</p>
        ) : null}
        <div className="mt-6">
          <CaptureForm initial={capture.description} initialCategory={capture.category} />
        </div>
      </div>
      <aside className="content-aside min-w-0">
        <p className="font-serif text-title">Three taps</p>
        <ol className="page-stack mt-4">
          <li className="surface">
            <p className="text-caption font-semibold text-pine">1</p>
            <p className="mt-1 text-base font-semibold">New price</p>
          </li>
          <li className="surface">
            <p className="text-caption font-semibold text-pine">2</p>
            <p className="mt-1 text-base font-semibold">Add a photo</p>
          </li>
          <li className="surface">
            <p className="text-caption font-semibold text-pine">3</p>
            <p className="mt-1 text-base font-semibold">Send</p>
          </li>
        </ol>
      </aside>
    </div>
  );
}
