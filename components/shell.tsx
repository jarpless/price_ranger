import { PendingLink as Link } from "@/components/pending-link";

import { signOut } from "@/app/actions";

import { BackButton } from "./back-button";
import { Feel } from "./feel";
import { Logo } from "./logo";
import { BottomNav, Sidebar } from "./nav";
import { ScreenMotion } from "./screen-motion";
import { SubmitButton } from "./ui";

export function Shell({
  children,
  quotesLabel,
  guest,
}: {
  children: React.ReactNode;
  quotesLabel: string;
  guest: boolean;
}) {
  return (
    <div className="min-h-dvh bg-cream text-ink lg:flex">
      <Sidebar quotesLabel={quotesLabel} guest={guest} />
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 bg-pine text-cream lg:hidden">
          <div className="flex h-12 items-center gap-1 px-2">
            <BackButton />
            <Logo tone="light" width={28} height={28} className="h-7 w-7" />
            <Link href="/" className="min-w-0 truncate font-serif text-base tracking-tight">
              Price Ranger
            </Link>
            {guest ? (
              <Link href="/signin" className="ml-auto inline-flex h-11 items-center whitespace-nowrap rounded-xl bg-cream px-3 text-sm font-semibold text-pine">
                Sign in
              </Link>
            ) : (
              <form action={signOut} className="ml-auto">
                <SubmitButton pendingLabel="…" className="whitespace-nowrap px-2 text-sm font-medium text-cream/80">
                  Sign out
                </SubmitButton>
              </form>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[36rem] flex-1 px-4 pb-40 pt-6 lg:max-w-[60rem] lg:px-10 lg:pb-16 lg:pt-12">
          <div className="mb-4 hidden lg:block">
            <BackButton className="text-pine" />
          </div>
          <ScreenMotion>{children}</ScreenMotion>
        </main>
      </div>
      <BottomNav quotesLabel={quotesLabel} />
      <Feel />
    </div>
  );
}
