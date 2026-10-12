import { notFound } from "next/navigation";

import { readSharedSheet } from "@/lib/share";

export const dynamic = "force-dynamic";

export const metadata = { title: "Price sheet" };

export default async function PublicSheetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sheet = await readSharedSheet(token);
  if (!sheet) notFound();

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Price sheet</p>
      <h1 className="mt-1 font-serif text-4xl">{sheet.title}</h1>
      <p className="mt-1 text-lg text-muted">{sheet.subtitle}</p>
      {sheet.options.map((option) => (
        <section key={option.name} className="mt-8">
          <h2 className="font-serif text-2xl">{option.name}</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {option.lines.map((line) => (
              <li key={`${option.name}-${line.name}`} className="flex items-baseline justify-between gap-4 py-3">
                <div>
                  <p className="font-semibold">{line.name}</p>
                  <p className="text-sm text-muted">{line.detail}</p>
                </div>
                <p className="font-serif text-xl">{line.price}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-right font-serif text-3xl">{option.total}</p>
        </section>
      ))}
    </main>
  );
}
