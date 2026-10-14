import { PendingLink as Link } from "@/components/pending-link";

import { BackButton } from "./back-button";
import { Feel } from "./feel";
import { Logo } from "./logo";
import { PhoneMenu, Sidebar } from "./nav";
import { ScreenMotion } from "./screen-motion";

export function Shell({
  children,
  quotesLabel,
  guest,
  accountLabel = null,
  owner = false,
}: {
  children: React.ReactNode;
  quotesLabel: string;
  guest: boolean;
  accountLabel?: string | null;
  owner?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-cream text-ink lg:flex">
      <Sidebar quotesLabel={quotesLabel} guest={guest} accountLabel={accountLabel} owner={owner} />
      <div className="shell-main flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[70] bg-pine text-cream lg:hidden">
          <div className="flex h-12 items-center gap-1 px-2">
            <BackButton />
            <Logo tone="light" width={28} height={28} className="h-7 w-7" />
            <Link href="/" className="min-w-0 truncate font-serif text-base tracking-tight">
              Price Ranger
            </Link>
            <PhoneMenu guest={guest} accountLabel={accountLabel} owner={owner} />
          </div>
        </header>
        <main className="app-main">
          <div className="mb-1 hidden lg:block">
            <BackButton className="text-pine" />
          </div>
          <ScreenMotion>{children}</ScreenMotion>
        </main>
      </div>
      <div id="assistant-dock" className="assistant-dock" />
      <Feel />
    </div>
  );
}
