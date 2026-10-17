import { PendingLink as Link } from "@/components/pending-link";
import { redirect } from "next/navigation";

import { chooseIndustry } from "@/app/auth-actions";
import { Logo } from "@/components/logo";
import { Notice, SubmitButton } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
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
    <main className="page-frame page-frame-pad flex min-h-dvh flex-col lg:justify-center">
      <Link href="/" className="inline-flex h-12 w-12 items-center justify-center" aria-label="Back">
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none">
          <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      <div className="mt-4 flex items-center gap-3">
        <Logo tone="dark" width={48} height={48} className="h-12 w-12 shrink-0" alt="" />
        <span className="font-serif text-title leading-8 text-ink">Price Ranger</span>
      </div>
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
              <SubmitButton
                pendingLabel="Setting up…"
                className="flex h-full min-h-32 w-full flex-col items-start rounded-3xl border border-line bg-paper p-5 text-left font-normal hover:border-pine"
              >
                <span className="font-serif text-2xl text-ink">{words.label}</span>
                <span className="mt-2 text-sm leading-relaxed text-muted">{words.blurb}</span>
              </SubmitButton>
            </form>
          );
        })}
      </div>
    </main>
  );
}
