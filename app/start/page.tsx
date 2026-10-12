import Image from "next/image";
import { redirect } from "next/navigation";

import { chooseIndustry } from "@/app/auth-actions";
import { getSessionUser } from "@/lib/auth";
import { Notice } from "@/components/ui";
import { INDUSTRY_IDS, VOCABULARIES } from "@/lib/vocabulary";

export const dynamic = "force-dynamic";

export const metadata = { title: "What are you pricing?" };

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/guest?next=/start");
  if (user.industry) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 py-8 lg:justify-center lg:py-12">
      <Image src="/images/logo-mark.png" alt="" width={48} height={48} className="h-12 w-12" />
      <h1 className="mt-6 font-serif text-4xl leading-tight lg:text-5xl">What are you pricing?</h1>
      <p className="mt-3 max-w-xl text-base leading-relaxed text-muted">
        This picks a few starter prices and the words on the screen. You can still add anything you sell.
      </p>
      <div className="mt-4">
        <Notice code={error} />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {INDUSTRY_IDS.map((id) => {
          const words = VOCABULARIES[id];
          return (
            <form key={id} action={chooseIndustry}>
              <input type="hidden" name="industry" value={id} />
              <button className="flex h-full min-h-32 w-full flex-col items-start rounded-3xl border border-line bg-paper p-5 text-left hover:border-pine">
                <span className="font-serif text-2xl text-ink">{words.label}</span>
                <span className="mt-2 text-sm leading-relaxed text-muted">{words.blurb}</span>
              </button>
            </form>
          );
        })}
      </div>
    </main>
  );
}
