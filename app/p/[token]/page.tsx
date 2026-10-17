import { notFound } from "next/navigation";

import { contactAboutPrice } from "@/app/share-contact";
import { Logo } from "@/components/logo";
import { formatUsd } from "@/lib/money";
import { conditionLabel, marketPrice, pictureFor } from "@/lib/market";
import { forPublic, readSharedSheet } from "@/lib/share";
import { shareGrowthOffer } from "@/lib/share-growth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Price sheet" };

export default async function PublicSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { token } = await params;
  const { sent } = await searchParams;
  const loaded = await readSharedSheet(token);
  if (!loaded) notFound();
  const sheet = forPublic(loaded);
  const live = marketPrice(sheet.title);
  const range = sheet.range || (live ? `${formatUsd(live.lowCents)}–${formatUsd(live.highCents)}` : "");
  const condition = sheet.condition || (live ? conditionLabel(live.condition) : "");
  const photo = sheet.photo || live?.comparables[0]?.thumbnail || pictureFor(sheet.title);
  const offer = shareGrowthOffer(token);

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-5 py-10 lg:py-16">
      <div className="flex items-center gap-3 rounded-3xl bg-pine px-4 py-3 text-cream">
        <Logo tone="light" width={56} height={56} className="h-14 w-14 shrink-0" alt="" />
        <div className="min-w-0">
          <p className="truncate font-serif text-title leading-8">Price Ranger</p>
          <p className="text-caption text-cream/80">priceranger.app</p>
        </div>
      </div>
      <h1 className="mt-6 text-center font-serif text-display text-balance lg:text-[2.5rem] lg:leading-[3rem]">{sheet.title}</h1>
      {condition || range ? (
        <p className="mt-3 text-center text-body text-muted" data-share-range="">
          {[condition, range].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {sheet.date ? <p className="mt-2 text-center text-caption text-muted">{sheet.date}</p> : null}
      {sheet.subtitle ? <p className="mt-2 text-center text-body text-muted">{sheet.subtitle}</p> : null}
      {photo ? (
        // The buyer opens this without an account. The picture is part of the sheet they were sent.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={sheet.title} data-share-photo="" className="mt-6 max-h-72 w-full rounded-2xl border border-line object-contain bg-paper" />
      ) : null}
      {sheet.note ? <p className="mt-4 text-center text-body leading-6">{sheet.note}</p> : null}
      {sheet.options.map((option) => (
        <section key={option.name} className="mt-8">
          <h2 className="font-serif text-title">{option.name}</h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-paper px-4">
            {option.lines.map((line) => (
              <li key={`${option.name}-${line.name}-${line.detail}`} className="flex items-baseline justify-between gap-4 py-3">
                <div>
                  <p className="text-base font-semibold">{line.name}</p>
                  <p className="text-caption text-muted">{line.detail}</p>
                </div>
                <p className="font-serif text-title tabular-nums">{line.price}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-right font-serif text-price text-pine tabular-nums">{option.total}</p>
        </section>
      ))}
      <p className="mt-6 text-center text-body leading-6 text-muted">The seller&apos;s email stays off this page.</p>
      {sent === "sent" ? (
        <p className="mt-4 rounded-2xl bg-[#f8f1df] px-4 py-3 text-center text-body leading-6">Sent. Their address stays private.</p>
      ) : null}
      {sent === "held" ? (
        <p className="mt-4 rounded-2xl bg-[#f8f1df] px-4 py-3 text-center text-body leading-6">
          Saved on this page. Mail isn&apos;t set up to deliver it, and no address is shown.
        </p>
      ) : null}
      <form action={contactAboutPrice} className="mt-4 space-y-3 rounded-3xl border border-line bg-paper p-4">
        <input type="hidden" name="token" value={token} />
        <label className="block text-base font-semibold">
          Your name
          <input name="name" className="mt-1 h-12 w-full rounded-2xl border border-line px-3 text-base font-normal" />
        </label>
        <label className="block text-base font-semibold">
          Message
          <textarea name="message" required rows={3} className="mt-1 w-full rounded-2xl border border-line px-3 py-2 text-base font-normal" />
        </label>
        <button
          type="submit"
          className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl border border-line bg-paper text-base font-semibold text-pine"
        >
          Contact
        </button>
      </form>
      <div className="mt-6 flex justify-center">
        <a
          href={`/p/${token}/pdf`}
          className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl bg-pine text-base font-semibold text-cream lg:w-auto lg:min-w-48 lg:px-6"
        >
          Download PDF
        </a>
      </div>
      <aside className="mt-8 rounded-3xl border border-line bg-paper px-5 py-5 text-center">
        <p className="font-serif text-title leading-8">Keep this price</p>
        <p className="mt-2 text-body leading-6 text-muted">{offer.detail}</p>
        <a
          href={offer.href}
          className="mt-4 inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl bg-pine px-4 text-base font-semibold text-cream"
        >
          {offer.label}
        </a>
      </aside>
    </main>
  );
}
