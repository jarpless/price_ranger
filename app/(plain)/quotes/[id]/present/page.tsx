import Link from "next/link";
import { notFound } from "next/navigation";

import { Presentation } from "@/components/presentation";
import { requireUser } from "@/lib/auth";
import { getData } from "@/lib/store";

export const metadata = { title: "Presentation" };

export default async function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const quote = await (await getData()).getQuote(user.id, id);
  if (!quote) notFound();
  const snapshot = quote.presentedSnapshot;

  if (!snapshot) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center bg-pine-deep px-6 text-cream lg:max-w-xl">
        <h1 className="font-serif text-3xl">Nothing to present yet</h1>
        <p className="mt-3 text-sm leading-relaxed text-cream/80">
          Open the quote and tap Present to save a customer copy.
        </p>
        <Link href={`/quotes/${id}`} className="mt-6 font-semibold text-gold">
          Back to quote
        </Link>
      </main>
    );
  }

  return <Presentation quoteId={id} snapshot={snapshot} />;
}
