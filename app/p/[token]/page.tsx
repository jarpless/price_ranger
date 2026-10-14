import { notFound } from "next/navigation";

import { forPublic, readSharedSheet } from "@/lib/share";

export const dynamic = "force-dynamic";

export const metadata = { title: "Price sheet" };

export default async function PublicSheetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const loaded = await readSharedSheet(token);
  if (!loaded) notFound();
  const sheet = forPublic(loaded);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-8">
      <p className="font-serif text-title text-pine">Price Ranger</p>
      <h1 className="mt-2 font-serif text-display text-balance lg:text-[2.5rem] lg:leading-[3rem]">{sheet.title}</h1>
      {sheet.date ? <p className="mt-2 text-caption text-muted">{sheet.date}</p> : null}
      {sheet.subtitle ? <p className="mt-2 text-body text-muted">{sheet.subtitle}</p> : null}
      {sheet.photo ? (
        // The buyer opens this without an account. The picture is part of the sheet they were sent.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sheet.photo} alt={sheet.title} className="mt-6 max-h-72 w-full rounded-2xl border border-line object-contain bg-paper" />
      ) : null}
      {sheet.note ? <p className="mt-4 text-body leading-6">{sheet.note}</p> : null}
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
      <a
        href={`/p/${token}/pdf`}
        className="mt-8 inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl bg-pine text-base font-semibold text-cream lg:w-auto lg:min-w-48 lg:px-6"
      >
        Download PDF
      </a>
    </main>
  );
}
