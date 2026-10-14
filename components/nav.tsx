"use client";

import { PendingLink as Link } from "@/components/pending-link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { signOut } from "@/app/actions";

import { IconCamera, IconCard, IconChat, IconHome, IconInfo, IconPhone, IconSettings, NavIcon } from "./icons";
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
  if (href === "/feedback/new") return pathname === "/feedback" || pathname.startsWith("/feedback/");
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
                data-spotlight={`nav-${item.spot}`}
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
                data-spotlight={item.href === "/menu" ? "nav-plans" : `nav-${item.spot}`}
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

const workLinks = [
  { href: "/new", label: "New price", icon: IconCamera, spot: "nav-price" },
  { href: "/", label: "Your prices", icon: IconHome, spot: "nav-home" },
  { href: "/upgrade", label: "Plans", icon: IconCard, spot: "nav-plans" },
] as const;

const helpLinks = [
  { href: "/settings", label: "Settings", icon: IconSettings, spot: "nav-settings" },
  { href: "/install", label: "Get the app", icon: IconPhone, spot: "nav-install" },
] as const;

function sideClass(active: boolean) {
  return `flex h-12 w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 text-left text-base font-semibold ${active ? "bg-cream text-pine shadow-[inset_3px_0_0_#132e24]" : "text-cream/80 hover:bg-white/10 hover:text-cream"}`;
}

export function Sidebar({
  quotesLabel,
  guest,
  accountLabel,
}: {
  quotesLabel: string;
  guest: boolean;
  accountLabel: string | null;
}) {
  void quotesLabel;
  const pathname = usePathname();
  const [askOpen, setAskOpen] = useState(false);
  useEffect(() => {
    const read = () => setAskOpen(document.body.dataset.ask === "open");
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-ask"] });
    return () => observer.disconnect();
  }, []);
  const askActive = askOpen || pathname === "/ask";
  const signInActive = pathname === "/signin" || pathname.startsWith("/signin/");

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col self-stretch overflow-y-auto border-r border-pine-deep bg-pine text-cream lg:flex">
      <Link href="/" className="flex items-center gap-3 px-5 pb-2 pt-8">
        <Logo tone="light" width={32} height={32} className="h-8 w-8" />
        <span>
          <span className="block font-serif text-title leading-8">Price Ranger</span>
          <span className="block text-caption uppercase tracking-[0.14em] text-cream/70">{APP_CODENAME}</span>
        </span>
      </Link>
      <nav className="mt-6 flex flex-1 flex-col px-3" aria-label="Workspace">
        <ul className="space-y-1">
          {workLinks.map((item) => {
            const Icon = item.icon;
            const active = navCurrent(pathname, item.href);
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={active ? "page" : undefined} data-spotlight={item.spot} className={sideClass(active)}>
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <ul className="mt-4 space-y-1 border-t border-white/15 pt-4">
          {helpLinks.map((item) => {
            const Icon = item.icon;
            const active = navCurrent(pathname, item.href);
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={active ? "page" : undefined} data-spotlight={item.spot} className={sideClass(active)}>
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={openAsk} aria-pressed={askActive} className={sideClass(askActive)}>
              <IconChat className="h-5 w-5" />
              Ask
            </button>
          </li>
          <li>
            <Link
              href="/feedback/new"
              data-feedback-label="true"
              data-spotlight="nav-feedback"
              aria-current={navCurrent(pathname, "/feedback/new") ? "page" : undefined}
              className={sideClass(navCurrent(pathname, "/feedback/new"))}
            >
              <IconInfo className="h-5 w-5" />
              Feedback
            </Link>
          </li>
        </ul>
        <div className="mt-auto border-t border-white/15 px-0 pb-6 pt-4">
          {guest ? (
            <div className="space-y-1">
              <Link href="/signin" aria-current={signInActive ? "page" : undefined} className={`flex h-12 items-center whitespace-nowrap rounded-xl px-3 text-base font-semibold ${signInActive ? "bg-white text-pine" : "bg-cream text-pine"}`}>
                Sign in
              </Link>
              <Link href="/signin?reason=save" className={sideClass(false)}>
                Save account
              </Link>
            </div>
          ) : (
            <div>
              <p className="truncate px-3 text-caption text-cream/70">{accountLabel || "Signed in"}</p>
              <form action={signOut} className="mt-1">
                <SubmitButton
                  pendingLabel="Signing out…"
                  className="h-12 w-full whitespace-nowrap rounded-xl px-3 text-left text-base font-semibold text-cream/80 hover:bg-white/10 hover:text-cream"
                >
                  Sign out
                </SubmitButton>
              </form>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
