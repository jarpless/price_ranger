"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/actions";

export function navItems(quotesLabel: string) {
  return [
    { href: "/", label: quotesLabel, spot: "quotes" },
    { href: "/library", label: "Prices", spot: "prices" },
    { href: "/catalogs", label: "Catalog", spot: "catalog" },
    { href: "/library/groups", label: "Groups", spot: "groups" },
    { href: "/settings", label: "Settings", spot: "settings" },
  ];
}

export function navCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/quotes");
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
      <ul className="grid grid-cols-5">
        {navItems(quotesLabel).map((item) => {
          const active = navCurrent(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 items-center justify-center px-1 text-center text-[11px] font-semibold leading-tight ${active ? "text-pine" : "text-muted"}`}
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
        <Image src="/images/logo-mark.png" alt="" width={36} height={36} className="h-9 w-9" />
        <div>
          <p className="font-serif text-lg leading-none">Price Ranger</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-gold">Basecamp</p>
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
                  className={`flex h-11 items-center rounded-xl px-3 text-sm font-semibold transition ${active ? "bg-cream text-pine" : "text-cream/80 hover:bg-white/10 hover:text-cream"}`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 px-3 text-[11px] leading-relaxed text-cream/55">
          N new quote
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
          <button className="h-10 w-full rounded-xl text-sm font-semibold text-cream/80 hover:bg-white/10 hover:text-cream">
            Sign out
          </button>
        </form>
      )}
    </aside>
  );
}
