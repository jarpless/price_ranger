import Link from "next/link";

import { signOut } from "@/app/actions";

import { Logo } from "./logo";
import { BottomNav, Sidebar } from "./nav";

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
          <div className="flex h-14 items-center gap-2 px-4">
            <Logo tone="light" width={32} height={32} className="h-8 w-8" />
            <Link href="/" className="font-serif text-lg tracking-tight">
              Price Ranger
            </Link>
            {guest ? (
              <Link href="/login?reason=save" className="ml-auto text-sm font-semibold text-gold">
                Save account
              </Link>
            ) : (
              <form action={signOut} className="ml-auto">
                <button className="text-sm font-medium text-cream/80">Sign out</button>
              </form>
            )}
          </div>
        </header>
        {guest ? (
          <p className="bg-[#f8f1df] px-4 py-2 text-sm leading-relaxed text-ink lg:px-8">
            This draft stays on this device. Create an account when you want to save or share it.
          </p>
        ) : null}
        <main className="flex-1 px-4 pb-28 pt-5 lg:px-8 lg:pb-16 lg:pt-8">{children}</main>
      </div>
      <BottomNav quotesLabel={quotesLabel} />
    </div>
  );
}
