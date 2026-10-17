import { LandingStage } from "@/components/landing-stage";
import { PendingLink as Link } from "@/components/pending-link";

import { Logo } from "./logo";

export function Landing() {
  return (
    <main className="landing-ground min-h-dvh text-ink">
      <div className="page-frame flex min-h-dvh flex-col">
        <header className="flex h-16 w-full items-center gap-2">
          <div className="inline-flex min-w-0 items-center gap-2 rounded-2xl bg-paper/95 px-1.5 py-1 shadow-card ring-1 ring-line">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pine">
              <Logo tone="light" width={28} height={28} className="h-7 w-7" alt="" />
            </span>
            <p className="truncate pr-1.5 font-serif text-base leading-6 text-ink lg:text-title lg:leading-8">Price Ranger</p>
          </div>
          <Link
            href="/feedback/new"
            data-feedback-label="true"
            className="ml-auto inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-xl px-2 text-sm font-semibold text-pine"
          >
            Feedback
          </Link>
          <Link href="/signin" className="inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-2xl px-3 text-base font-semibold text-pine">
            Sign in
          </Link>
        </header>
        <div className="grid w-full items-center gap-10 pb-16 pt-8 lg:grid-cols-2 lg:items-center lg:gap-16 lg:pt-16">
          <div className="min-w-0">
            <h1 className="font-serif text-display text-balance lg:text-[3rem] lg:leading-[3.4rem]">See a fair price before you list it.</h1>
            <p className="mt-4 max-w-xl text-body leading-6 text-muted">
              Snap a photo or tap an item. Price Ranger shows a sold-listing range, a condition, and a price you can share.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/auth/guest?next=/new" className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-2xl bg-pine px-6 text-base font-semibold text-cream">
                Try it first
              </Link>
              <Link href="/signin" className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-2xl border border-line bg-paper px-6 text-base font-semibold">
                Sign in
              </Link>
            </div>
          </div>
          <div className="min-w-0">
            <LandingStage />
          </div>
        </div>
      </div>
    </main>
  );
}
