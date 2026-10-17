"use client";

import { PendingLink as Link } from "@/components/pending-link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { signOut } from "@/app/actions";

import { buildMenu } from "@/lib/menu";
import type { IndustryId } from "@/lib/vocabulary";

import { IconMenu } from "./icons";
import { NavTree } from "./nav-tree";
import { OPEN_MENU_EVENT } from "./tab-bar";
import { BetaTag } from "./beta";
import { SubmitButton } from "./ui";
import { Logo } from "./logo";
import { VERSION_LABEL } from "@/lib/version";

export function navCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/new") return pathname === "/new" || pathname.startsWith("/guide");
  if (href === "/feedback/new") {
    return pathname === "/feedback" || (pathname.startsWith("/feedback/") && !pathname.startsWith("/feedback/trade"));
  }
  if (href === "/library") {
    return pathname === "/library" || (/^\/library\/(?!groups(?:\/|$)).+/.test(pathname));
  }
  if (href === "/library/groups") return pathname.startsWith("/library/groups");
  if (href === "/settings") return pathname === "/settings";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function sideClass(active: boolean) {
  return `flex h-12 w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 text-left text-base font-semibold ${active ? "bg-cream text-pine shadow-[inset_3px_0_0_#132e24]" : "text-cream/80 hover:bg-white/10 hover:text-cream"}`;
}

export function Sidebar({
  quotesLabel,
  account,
  accountLabel,
  owner = false,
  industry = null,
}: {
  quotesLabel: string;
  account: "member" | "guest";
  accountLabel: string | null;
  owner?: boolean;
  industry?: IndustryId | null;
}) {
  const guest = account === "guest";
  void quotesLabel;
  const pathname = usePathname();
  const signInActive = pathname === "/signin" || pathname.startsWith("/signin/");
  const sections = useMemo(() => buildMenu({ guest, owner }), [guest, owner]);

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col self-stretch overflow-y-auto border-r border-pine-deep bg-pine text-cream lg:flex">
      <Link href="/" className="flex items-center gap-3 px-5 pb-2 pt-8">
        <Logo tone="light" width={32} height={32} className="h-8 w-8 shrink-0" alt="" />
        <span className="font-serif text-title leading-8">Price Ranger</span>
      </Link>
      <BetaTag tone="pine" className="ml-16 self-start" />
      <nav className="mt-6 flex flex-1 flex-col px-3" aria-label="Workspace">
        <NavTree sections={sections} pathname={pathname} industry={industry} density="desk" />
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
          <p className="px-3 pt-4 text-caption text-cream/70">{VERSION_LABEL}</p>
        </div>
      </nav>
    </aside>
  );
}

export function PhoneMenu({
  account,
  accountLabel,
  owner = false,
  industry = null,
}: {
  account: "member" | "guest";
  accountLabel: string | null;
  owner?: boolean;
  industry?: IndustryId | null;
}) {
  const guest = account === "guest";
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const signInActive = pathname === "/signin" || pathname.startsWith("/signin/");
  const sections = useMemo(() => buildMenu({ guest, owner }), [guest, owner]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_MENU_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_MENU_EVENT, onOpen);
  }, []);

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
            <Logo tone="light" width={28} height={28} className="h-7 w-7 shrink-0 object-contain" />
            <span className="min-w-0 truncate font-serif text-base leading-6">Price Ranger</span>
            <BetaTag tone="pine" className="ml-0.5" />
            <button type="button" className="ml-auto inline-flex h-11 items-center px-3 text-sm font-semibold" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-8" aria-label="Workspace">
            <NavTree sections={sections} pathname={pathname} industry={industry} density="phone" onNavigate={() => setOpen(false)} />
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
              <p className="px-3 pt-4 text-caption text-cream/70">{VERSION_LABEL}</p>
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
