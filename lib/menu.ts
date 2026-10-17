import {
  ITEM_STATUSES,
  ITEM_STATUS_LABEL,
  TRADES,
  TRADE_VIEWS,
  newPriceHref,
  tradeHref,
  tradeForIndustry,
  viewLabel,
  type TradeIcon,
} from "./trades";
import type { IndustryId } from "./vocabulary";

export type MenuIcon = "home" | "camera" | "list" | "chat" | "card" | "settings" | "info" | "phone" | TradeIcon;

export interface MenuLink {
  href: string;
  label: string;
  icon?: MenuIcon;
  spot?: string;
  /** Only this exact path lights the row. */
  exact?: boolean;
}

export interface MenuFolder {
  id: string;
  label: string;
  icon: MenuIcon;
  links: MenuLink[];
  /** Price · Quotes · Sold · Tools, rendered as one dense row. */
  views: MenuLink[];
  /** Any path under this prefix opens the folder. */
  prefix: string;
}

export interface MenuSection {
  id: string;
  label: string | null;
  links: MenuLink[];
  folders: MenuFolder[];
}

export function buildMenu({ guest, owner = false }: { guest: boolean; owner?: boolean }): MenuSection[] {
  const sections: MenuSection[] = [
    {
      id: "main",
      label: null,
      links: [
        { href: "/", label: "Home", icon: "home", spot: "nav-home", exact: true },
        { href: "/new", label: "New price", icon: "camera", spot: "nav-price" },
        { href: "/ask", label: "Assistant", icon: "chat", spot: "nav-ask" },
      ],
      folders: [],
    },
    {
      id: "items",
      label: "My items",
      links: [
        { href: "/items", label: "All items", icon: "list", spot: "nav-items", exact: true },
        ...ITEM_STATUSES.map((status) => ({ href: `/items/${status}`, label: ITEM_STATUS_LABEL[status], exact: true })),
      ],
      folders: [],
    },
    {
      id: "trades",
      label: "By trade",
      links: [],
      folders: TRADES.map((trade) => ({
        id: trade.id,
        label: trade.label,
        icon: trade.icon,
        prefix: tradeHref(trade),
        links: trade.subcategories.map((subcategory) => ({ href: newPriceHref(subcategory), label: subcategory.label })),
        views: [
          { href: tradeHref(trade), label: "Price", exact: true },
          ...TRADE_VIEWS.map((view) => ({ href: tradeHref(trade, view), label: viewLabel(trade, view), exact: true })),
        ],
      })),
    },
  ];
  if (!guest) {
    sections.push({
      id: "account",
      label: "Account",
      links: [
        { href: "/upgrade", label: "Plans", icon: "card", spot: "nav-plans" },
        { href: "/settings/billing", label: "Billing", icon: "card", spot: "nav-billing" },
        { href: "/settings", label: "Settings", icon: "settings", spot: "nav-settings", exact: true },
        { href: "/settings/delete", label: "Delete account", icon: "info", spot: "nav-delete" },
      ],
      folders: [],
    });
  }
  sections.push({
    id: "help",
    label: "Help & feedback",
    links: [
      { href: "/install", label: "Get the app", icon: "phone", spot: "nav-install" },
      { href: "/feedback/new", label: "Feedback", icon: "info", spot: "nav-feedback" },
      ...(owner ? [{ href: "/admin/feedback", label: "Feedback backlog", icon: "info" as const }] : []),
    ],
    folders: [],
  });
  return sections;
}

export function menuActive(pathname: string, link: MenuLink): boolean {
  const href = link.href.split("?")[0];
  if (link.href.includes("?")) return false;
  if (href === "/") return pathname === "/";
  if (href === "/new") return pathname === "/new" || pathname.startsWith("/guide");
  if (href === "/feedback/new") return pathname === "/feedback" || pathname.startsWith("/feedback/");
  if (link.exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Open the folder for the current page, else the user's own trade. */
export function folderOpenByDefault(folder: MenuFolder, pathname: string, industry: IndustryId | null | undefined): boolean {
  if (pathname === folder.prefix || pathname.startsWith(`${folder.prefix}/`)) return true;
  if (pathname.startsWith("/trades/")) return false;
  return tradeForIndustry(industry)?.id === folder.id;
}

export function allMenuLinks(sections: MenuSection[]): MenuLink[] {
  return sections.flatMap((section) => [...section.links, ...section.folders.flatMap((folder) => [...folder.links, ...folder.views])]);
}
