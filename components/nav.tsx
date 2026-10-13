"use client";

import { PendingLink as Link } from "@/components/pending-link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/actions";

import { SubmitButton } from "./ui";
import { Logo } from "./logo";

export function navItems(quotesLabel: string) {
  void quotesLabel;
  return [
    { href: "/", label: "Home", spot: "home" },
    { href: "/new", label: "Price something", spot: "price" },
    { href: "/menu", label: "Menu", spot: "menu" },
  ];
}

export function navCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/new") return pathname === "/new" || pathname.startsWith("/guide");
  if (href === "/library") {
    return pathname === "/library" || (/^\/library\/(?!groups(?:\/|$)).+/.test(pathname));
  }
  if (href === "/library/groups") return pathname.startsWith("/library/groups");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav({ quotesLabel }: { quotesLabel: string }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="grid grid-cols-3">
        {navItems(quotesLabel).map((item) => {
          const active = navCurrent(pathname, item.href);
          const primary = item.href === "/new";
          return (
            <li key={item.href} className="flex items-center justify-center">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  primary
                    ? "my-2 inline-flex h-12 items-center justify-center rounded-full bg-pine px-4 text-sm font-semibold text-cream"
                    : `flex h-16 items-center justify-center px-2 text-center text-sm font-semibold ${active ? "text-pine" : "text-muted"}`
                }
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Sidebar({ quotesLabel, guest }: { quotesLabel: string; guest: boolean }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-pine text-cream lg:flex">
      <div className="flex items-center gap-2 px-5 pb-2 pt-6">
        <Logo tone="light" width={36} height={36} className="h-9 w-9" />
        <div>
          <p className="font-serif text-lg leading-none">Price Ranger</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-gold">Ridgeline</p>
        </div>
      </div>
      <nav className="mt-6 flex-1 px-3">
        <ul className="space-y-1">
          {navItems(quotesLabel).map((item) => {
            const active = navCurrent(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  data-spotlight={`nav-${item.spot}`}
                  className={`flex items-center rounded-xl px-3 font-semibold transition ${item.href === "/new" ? "mb-2 h-12 bg-cream text-base text-pine" : `h-11 text-sm ${active ? "bg-cream text-pine" : "text-cream/80 hover:bg-white/10 hover:text-cream"}`}`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 px-3 text-[11px] leading-relaxed text-cream/55">
          N new price
          <br />
          / search
        </p>
      </nav>
      {guest ? (
        <Link href="/login?reason=save" className="mx-3 mb-5 flex h-10 items-center justify-center rounded-xl text-sm font-semibold text-gold hover:bg-white/10">
          Save account
        </Link>
      ) : (
        <form action={signOut} className="px-3 pb-5">
          <SubmitButton
            pendingLabel="Signing out…"
            className="h-10 w-full rounded-xl text-sm font-semibold text-cream/80 hover:bg-white/10 hover:text-cream"
          >
            Sign out
          </SubmitButton>
        </form>
      )}
    </aside>
  );
}
