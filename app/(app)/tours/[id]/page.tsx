import Link from "next/link";
import { notFound } from "next/navigation";

import { TourPlayer } from "@/components/tour-player";
import { requireUser } from "@/lib/auth";
import { getTour } from "@/lib/store/basecamp";

export const metadata = { title: "Guided tour" };

export default async function TourPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const tour = await getTour(user.id, id);
  if (!tour) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/" className="text-sm font-semibold text-pine">
        ← Quotes
      </Link>
      <h1 className="font-serif text-4xl">{tour.title}</h1>
      <p className="text-sm text-muted">{tour.prompt}</p>
      <TourPlayer steps={tour.steps} />
    </div>
  );
}
