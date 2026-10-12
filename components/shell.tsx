import Image from "next/image";
import Link from "next/link";

import { signOut } from "@/app/actions";

import { BottomNav } from "./nav";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-cream text-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
        <header className="sticky top-0 z-20 bg-pine text-cream">
          <div className="flex h-14 items-center gap-2 px-4">
            <Image src="/images/logo-mark.png" alt="" width={32} height={32} className="h-8 w-8" />
            <Link href="/" className="font-serif text-lg tracking-tight">
              Price Ranger
            </Link>
            <form action={signOut} className="ml-auto">
              <button className="text-sm font-medium text-cream/80">Sign out</button>
            </form>
          </div>
        </header>
        <main className="flex-1 px-4 pb-28 pt-5">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
