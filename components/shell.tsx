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
    <div data-app-shell="true" className="min-h-dvh max-w-full overflow-x-clip bg-cream text-ink lg:flex">
      <Sidebar quotesLabel={quotesLabel} account={guest ? "guest" : "member"} accountLabel={accountLabel} owner={owner} />
      <div className="shell-main ask-lane flex min-h-dvh min-w-0 max-w-full flex-1 flex-col">
        <header className="shell-header sticky top-0 z-[70] h-12 shrink-0 bg-pine text-cream lg:hidden">
          <div className="flex h-12 min-w-0 items-center gap-1 px-2">
            <BackButton />
            <Logo tone="light" width={28} height={28} className="h-7 w-7 shrink-0 object-contain" />
            <Link href="/" className="min-w-0 flex-1 truncate font-serif text-base leading-6 tracking-tight">
              Price Ranger
            </Link>
            <PhoneMenu account={guest ? "guest" : "member"} accountLabel={accountLabel} owner={owner} />
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
