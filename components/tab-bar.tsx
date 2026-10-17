"use client";

import { PendingLink as Link } from "@/components/pending-link";
import { usePathname } from "next/navigation";

import { menuActive } from "@/lib/menu";

import { IconCamera, IconHome, IconList, IconMenu } from "./icons";

export const OPEN_MENU_EVENT = "pr:open-menu";

const TABS = [
  { href: "/", label: "Home", icon: IconHome, exact: true },
  { href: "/new", label: "New price", icon: IconCamera, exact: false },
  { href: "/items", label: "Items", icon: IconList, exact: false },
] as const;

/** Compact widths only. Its height is the --tab-bar token the assistant pill clears. */
export function TabBar() {
  const pathname = usePathname();
  const tab = "flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold leading-3";
  return (
    <nav aria-label="Tabs" className="tab-bar fixed inset-x-0 bottom-0 z-[60] border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((item) => {
          const active = menuActive(pathname, { href: item.href, label: item.label, exact: item.exact });
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex flex-1">
              <Link href={item.href} aria-current={active ? "page" : undefined} className={`${tab} ${active ? "text-pine" : "text-muted"}`}>
                <Icon className="h-6 w-6" strokeWidth={active ? 2.25 : 1.75} />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li className="flex flex-1">
          <button type="button" className={`${tab} text-muted`} onClick={() => window.dispatchEvent(new Event(OPEN_MENU_EVENT))}>
            <IconMenu className="h-6 w-6" />
            Menu
          </button>
        </li>
      </ul>
    </nav>
  );
}
