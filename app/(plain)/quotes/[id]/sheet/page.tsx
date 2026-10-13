import { PendingLink as Link } from "@/components/pending-link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { requireUser } from "@/lib/auth";
import { siteOriginFromHeaders } from "@/lib/env";
import { buildSheet, publishSheet } from "@/lib/share";
import { getData } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata = { title: "Price sheet" };

export default async function SheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const data = await getData();
  const quote = await data.getQuote(user.id, id);
  if (!quote) notFound();
  const groups = await data.listGroups(user.id);
  const sheet = buildSheet(quote, groups);
  const token = await publishSheet(user.id, id, sheet);
  const origin = siteOriginFromHeaders(await headers());
  const publicUrl = token ? `${origin}/p/${token}` : "";
  const qr = publicUrl ? await QRCode.toDataURL(publicUrl, { margin: 1, width: 280 }) : "";

  return (
    <main className="mx-auto min-h-dvh max-w-3xl bg-white px-6 py-8 text-ink print:max-w-none">
      <style>{`@media print { .no-print { display: none } body { background: white } }`}</style>
      <div className="no-print mb-6 flex items-center justify-between gap-3">
        <Link href={`/quotes/${id}`} className="text-sm font-semibold text-pine">
          Back
        </Link>
        <p className="text-sm text-muted">Print this page. The QR opens the same sheet.</p>
      </div>
      <header className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Price sheet</p>
          <h1 className="mt-1 font-serif text-4xl">{sheet.title}</h1>
          <p className="mt-1 text-lg text-muted">{sheet.subtitle}</p>
        </div>
        {qr ? (
          // Data URLs are not a next/image source.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR code for this price sheet" width={140} height={140} className="h-36 w-36" />
        ) : null}
      </header>
      {sheet.options.map((option) => (
        <section key={option.name} className="mt-8">
          <h2 className="font-serif text-2xl">{option.name}</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {option.lines.length === 0 ? (
              <li className="py-3 text-sm text-muted">Nothing on this option yet.</li>
            ) : (
              option.lines.map((line) => (
                <li key={`${option.name}-${line.name}`} className="flex items-baseline justify-between gap-4 py-3">
                  <div>
                    <p className="font-semibold">{line.name}</p>
                    <p className="text-sm text-muted">{line.detail}</p>
                  </div>
                  <p className="font-serif text-xl">{line.price}</p>
                </li>
              ))
            )}
          </ul>
          <p className="mt-3 text-right font-serif text-3xl">{option.total}</p>
        </section>
      ))}
      {publicUrl ? <p className="mt-8 break-all text-xs text-muted">{publicUrl}</p> : null}
    </main>
  );
}
