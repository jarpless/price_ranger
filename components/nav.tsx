"use client";

import { PendingLink as Link } from "@/components/pending-link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

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
  if (href === "/settings") return pathname === "/settings";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const menuSections = [
  {
    label: "Prices",
    links: [
      { href: "/new", label: "New price", icon: IconCamera, spot: "nav-price" },
      { href: "/", label: "Your prices", icon: IconHome, spot: "nav-home" },
    ],
  },
  {
    label: "Account",
    links: [
      { href: "/upgrade", label: "Plans", icon: IconCard, spot: "nav-plans" },
      { href: "/settings/billing", label: "Billing", icon: IconCard, spot: "nav-billing" },
      { href: "/settings", label: "Settings", icon: IconSettings, spot: "nav-settings" },
      { href: "/settings/delete", label: "Delete account", icon: IconInfo, spot: "nav-delete" },
    ],
  },
  {
    label: "Help",
    links: [
      { href: "/install", label: "Get the app", icon: IconPhone, spot: "nav-install" },
      { href: "/feedback/new", label: "Feedback", icon: IconInfo, spot: "nav-feedback" },
    ],
  },
] as const;

function sectionsFor(guest: boolean) {
  if (!guest) return menuSections;
  return menuSections.filter((section) => section.label !== "Account");
}

function sideClass(active: boolean) {
  return `flex h-12 w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 text-left text-base font-semibold ${active ? "bg-cream text-pine shadow-[inset_3px_0_0_#132e24]" : "text-cream/80 hover:bg-white/10 hover:text-cream"}`;
}

function sectionOpen(label: string, pathname: string, chosen: Record<string, boolean>): boolean {
  if (label in chosen) return chosen[label];
  const current = menuSections.some((item) => item.links.some((link) => navCurrent(pathname, link.href)));
  if (!current) return label === "Prices";
  const section = menuSections.find((item) => item.label === label);
  return Boolean(section?.links.some((link) => navCurrent(pathname, link.href)));
}

function FolderSection({
  label,
  pathname,
  chosen,
  onToggle,
  children,
}: {
  label: string;
  pathname: string;
  chosen: Record<string, boolean>;
  onToggle: (label: string) => void;
  children: ReactNode;
}) {
  const open = sectionOpen(label, pathname, chosen);
  return (
    <div className="mt-3 first:mt-0" data-nav-folder={label}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onToggle(label)}
        className="flex h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-caption font-semibold uppercase tracking-[0.14em] text-cream/70 hover:bg-white/10"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 ${open ? "rotate-90" : ""}`}>
          <path d="M7 4.5 13 10l-6 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="flex-1">{label}</span>
      </button>
      {open ? <div className="ml-5 border-l border-white/25 pl-2">{children}</div> : null}
    </div>
  );
}

export function Sidebar({
  quotesLabel,
  account,
  accountLabel,
  owner = false,
}: {
  quotesLabel: string;
  account: "member" | "guest";
  accountLabel: string | null;
  owner?: boolean;
}) {
  const guest = account === "guest";
  void quotesLabel;
  const pathname = usePathname();
  const [folders, setFolders] = useState<Record<string, boolean>>({});
  const signInActive = pathname === "/signin" || pathname.startsWith("/signin/");
  const sections = sectionsFor(guest);
  const toggleFolder = (label: string) => {
    setFolders((current) => ({ ...current, [label]: !sectionOpen(label, pathname, current) }));
  };

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col self-stretch overflow-y-auto border-r border-pine-deep bg-pine text-cream lg:flex">
      <Link href="/" className="flex items-center gap-3 px-5 pb-2 pt-8">
        <Logo tone="inverse" width={32} height={32} className="h-8 w-8" />
        <span>
          <span className="block font-serif text-title leading-8">Price Ranger</span>
          <span className="block text-caption uppercase tracking-[0.14em] text-cream/70">{APP_CODENAME}</span>
        </span>
      </Link>
      <nav className="mt-6 flex flex-1 flex-col px-3" aria-label="Workspace">
        {sections.map((section) => (
          <FolderSection key={section.label} label={section.label} pathname={pathname} chosen={folders} onToggle={toggleFolder}>
            <ul className="space-y-1">
              {section.links.map((item) => {
                const Icon = item.icon;
                const active = navCurrent(pathname, item.href);
                const feedback = item.href === "/feedback/new";
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      data-spotlight={item.spot}
                      data-feedback-label={feedback ? "true" : undefined}
                      className={sideClass(active)}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              {section.label === "Help" && owner ? (
                <li>
                  <Link href="/admin/feedback" className={sideClass(navCurrent(pathname, "/admin/feedback"))}>
                    <IconInfo className="h-5 w-5" />
                    Feedback backlog
                  </Link>
                </li>
              ) : null}
            </ul>
          </FolderSection>
        ))}
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
  account,
  accountLabel,
  owner = false,
}: {
  account: "member" | "guest";
  accountLabel: string | null;
  owner?: boolean;
}) {
  const guest = account === "guest";
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [folders, setFolders] = useState<Record<string, boolean>>({});
  const signInActive = pathname === "/signin" || pathname.startsWith("/signin/");
  const sections = sectionsFor(guest);
  const toggleFolder = (label: string) => {
    setFolders((current) => ({ ...current, [label]: !sectionOpen(label, pathname, current) }));
  };

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
            <Logo tone="inverse" width={28} height={28} className="h-7 w-7 shrink-0 object-contain" />
            <span className="min-w-0 truncate font-serif text-base leading-6">Price Ranger</span>
            <button type="button" className="ml-auto inline-flex h-11 items-center px-3 text-sm font-semibold" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-8" aria-label="Workspace">
            {sections.map((section) => (
              <FolderSection key={section.label} label={section.label} pathname={pathname} chosen={folders} onToggle={toggleFolder}>
                <ul className="space-y-1">
                  {section.links.map((item) => {
                    const Icon = item.icon;
                    const active = navCurrent(pathname, item.href);
                    const feedback = item.href === "/feedback/new";
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          data-spotlight={item.spot}
                          data-feedback-label={feedback ? "true" : undefined}
                          className={sideClass(active)}
                          onClick={() => setOpen(false)}
                        >
                          <Icon className="h-5 w-5" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                  {section.label === "Help" && owner ? (
                    <li>
                      <Link href="/admin/feedback" className={sideClass(navCurrent(pathname, "/admin/feedback"))} onClick={() => setOpen(false)}>
                        <IconInfo className="h-5 w-5" />
                        Feedback backlog
                      </Link>
                    </li>
                  ) : null}
                </ul>
              </FolderSection>
            ))}
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
