"use client";

import { PendingLink as Link } from "@/components/pending-link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { signOut } from "@/app/actions";

import { IconCamera, IconCard, IconHome, IconInfo, IconMenu, IconPhone, IconSettings } from "./icons";
import { SubmitButton } from "./ui";
import { Logo } from "./logo";
import { APP_CODENAME } from "@/lib/version";

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
  owner = false,
}: {
  quotesLabel: string;
  guest: boolean;
  accountLabel: string | null;
  owner?: boolean;
}) {
  void quotesLabel;
  const pathname = usePathname();
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
          {owner ? (
            <li>
              <Link href="/admin/feedback" className={sideClass(navCurrent(pathname, "/admin/feedback"))}>
                <IconInfo className="h-5 w-5" />
                Feedback backlog
              </Link>
            </li>
          ) : null}
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

export function PhoneMenu({
  guest,
  accountLabel,
  owner = false,
}: {
  guest: boolean;
  accountLabel: string | null;
  owner?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const signInActive = pathname === "/signin" || pathname.startsWith("/signin/");

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-cream"
        aria-expanded={open}
        aria-controls="phone-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
      >
        <IconMenu className="h-6 w-6" />
      </button>
      {open ? (
        <div id="phone-menu" role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-[80] flex flex-col bg-pine text-cream">
          <div className="flex h-12 items-center gap-2 px-3">
            <Logo tone="light" width={28} height={28} className="h-7 w-7" />
            <span className="font-serif text-base">Price Ranger</span>
            <button type="button" className="ml-auto inline-flex h-11 items-center px-3 text-sm font-semibold" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-8" aria-label="Workspace">
            <ul className="space-y-1">
              {workLinks.map((item) => {
                const Icon = item.icon;
                const active = navCurrent(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link href={item.href} aria-current={active ? "page" : undefined} data-spotlight={item.spot} className={sideClass(active)} onClick={() => setOpen(false)}>
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
                    <Link href={item.href} aria-current={active ? "page" : undefined} data-spotlight={item.spot} className={sideClass(active)} onClick={() => setOpen(false)}>
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              <li>
                <Link
                  href="/feedback/new"
                  data-feedback-label="true"
                  data-spotlight="nav-feedback"
                  aria-current={navCurrent(pathname, "/feedback/new") ? "page" : undefined}
                  className={sideClass(navCurrent(pathname, "/feedback/new"))}
                  onClick={() => setOpen(false)}
                >
                  <IconInfo className="h-5 w-5" />
                  Feedback
                </Link>
              </li>
              {owner ? (
                <li>
                  <Link href="/admin/feedback" className={sideClass(navCurrent(pathname, "/admin/feedback"))} onClick={() => setOpen(false)}>
                    <IconInfo className="h-5 w-5" />
                    Feedback backlog
                  </Link>
                </li>
              ) : null}
            </ul>
            <div className="mt-auto border-t border-white/15 pt-4">
              {guest ? (
                <div className="space-y-1">
                  <Link href="/signin" aria-current={signInActive ? "page" : undefined} className="flex h-12 items-center whitespace-nowrap rounded-xl bg-cream px-3 text-base font-semibold text-pine" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                  <Link href="/signin?reason=save" className={sideClass(false)} onClick={() => setOpen(false)}>
                    Save account
                  </Link>
                </div>
              ) : (
                <div>
                  <p className="truncate px-3 text-caption text-cream/70">{accountLabel || "Signed in"}</p>
                  <form action={signOut} className="mt-1">
                    <SubmitButton pendingLabel="Signing out…" className="h-12 w-full whitespace-nowrap rounded-xl px-3 text-left text-base font-semibold text-cream/80">
                      Sign out
                    </SubmitButton>
                  </form>
                </div>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
