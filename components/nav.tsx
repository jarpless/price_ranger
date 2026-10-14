"use client";

import { PendingLink as Link } from "@/components/pending-link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/actions";

import { IconChat, NavIcon } from "./icons";
import { SubmitButton } from "./ui";
import { Logo } from "./logo";
import { APP_CODENAME } from "@/lib/version";

export function navItems(quotesLabel: string) {
  void quotesLabel;
  return [
    { href: "/", label: "Home", short: "Home", spot: "home" },
    { href: "/new", label: "New price", short: "Price", spot: "price" },
    { href: "/menu", label: "Menu", short: "Menu", spot: "menu" },
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

function openAsk() {
  window.dispatchEvent(new Event("pr-ask"));
}

export function BottomNav({ quotesLabel }: { quotesLabel: string }) {
  const pathname = usePathname();
  const items = navItems(quotesLabel);
  const before = items.slice(0, 2);
  const after = items.slice(2);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[60] border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="grid h-16 grid-cols-4">
        {before.map((item) => {
          const active = navCurrent(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center whitespace-nowrap text-sm font-semibold ${active ? "text-pine" : "text-muted"}`}
              >
                <NavIcon name={item.spot as "home" | "price" | "menu"} className="mb-0.5 h-6 w-6" />
                {item.short}
              </Link>
            </li>
          );
        })}
        <li>
          <button type="button" onClick={openAsk} className="flex h-16 w-full flex-col items-center justify-center whitespace-nowrap text-sm font-semibold text-muted">
            <IconChat className="mb-0.5 h-6 w-6" />
            Ask
          </button>
        </li>
        {after.map((item) => {
          const active = navCurrent(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center whitespace-nowrap text-sm font-semibold ${active ? "text-pine" : "text-muted"}`}
              >
                <NavIcon name={item.spot as "home" | "price" | "menu"} className="mb-0.5 h-6 w-6" />
                {item.short}
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
    <aside className="sticky top-0 hidden min-h-dvh w-60 shrink-0 flex-col self-stretch border-r border-pine-deep bg-pine text-cream lg:flex">
      <div className="flex items-center gap-3 px-5 pb-2 pt-8">
        <Logo tone="light" width={32} height={32} className="h-8 w-8" />
        <div>
          <p className="font-serif text-title leading-8">Price Ranger</p>
          <p className="text-caption uppercase tracking-[0.14em] text-cream/70">{APP_CODENAME}</p>
        </div>
      </div>
      <nav className="mt-8 flex-1 px-3">
        <ul className="space-y-1">
          {navItems(quotesLabel).map((item) => {
            const active = navCurrent(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  data-spotlight={`nav-${item.spot}`}
                  className={`flex h-12 items-center gap-3 whitespace-nowrap rounded-xl px-3 text-base font-semibold ${active ? "bg-white/15 text-cream" : "text-cream/80 hover:bg-white/10 hover:text-cream"}`}
                >
                  <NavIcon name={item.spot as "home" | "price" | "menu"} className="h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mx-3 mb-2 space-y-1">
        <button type="button" onClick={openAsk} className="flex h-12 w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 text-base font-semibold text-cream/80 hover:bg-white/10 hover:text-cream">
          <IconChat className="h-5 w-5" />
          Ask
        </button>
        <Link
          href="/feedback/new"
          data-feedback-label="true"
          className="flex h-12 w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 text-base font-semibold text-cream/80 hover:bg-white/10 hover:text-cream"
        >
          Feedback
        </Link>
      </div>
      {guest ? (
        <div className="mx-3 mb-6 space-y-1">
          <Link href="/signin" className="flex h-12 items-center whitespace-nowrap rounded-xl bg-cream px-3 text-base font-semibold text-pine">
            Sign in
          </Link>
          <Link href="/signin?reason=save" className="flex h-12 items-center whitespace-nowrap rounded-xl px-3 text-base font-semibold text-cream hover:bg-white/10">
            Save account
          </Link>
        </div>
      ) : (
        <form action={signOut} className="px-3 pb-6">
          <SubmitButton
            pendingLabel="Signing out…"
            className="h-12 w-full whitespace-nowrap rounded-xl text-base font-semibold text-cream/80 hover:bg-white/10 hover:text-cream"
          >
            Sign out
          </SubmitButton>
        </form>
      )}
    </aside>
  );
}
