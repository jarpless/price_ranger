import { PendingLink as Link } from "@/components/pending-link";

import { Logo } from "./logo";

export function Landing() {
  return (
    <main className="min-h-dvh bg-cream text-ink">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-5">
        <Logo tone="ink" width={32} height={32} className="h-8 w-8" />
        <p className="font-serif text-title">Price Ranger</p>
        <Link href="/signin" className="ml-auto inline-flex h-12 items-center whitespace-nowrap rounded-2xl px-4 text-base font-semibold text-pine">
          Sign in
        </Link>
      </header>
      <div className="mx-auto grid w-full max-w-5xl items-center gap-10 px-5 pb-16 pt-8 lg:grid-cols-2 lg:pt-16">
        <div>
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
        <div className="rounded-3xl border border-line bg-paper p-6 shadow-card">
          <p className="text-caption font-semibold text-muted">Sold range · Good</p>
          <p className="mt-2 font-serif text-price text-pine tabular-nums">$175</p>
          <p className="mt-1 text-body text-muted">$150–$200 · Nintendo Switch with dock</p>
          <p className="mt-4 text-caption font-semibold text-pine">High confidence</p>
        </div>
      </div>
    </main>
  );
}
