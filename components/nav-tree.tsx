"use client";

import { PendingLink as Link } from "@/components/pending-link";
import { useState, type ComponentType, type SVGProps } from "react";

import { folderOpenByDefault, menuActive, type MenuFolder, type MenuIcon, type MenuLink, type MenuSection } from "@/lib/menu";
import type { IndustryId } from "@/lib/vocabulary";

import {
  IconBox,
  IconBrush,
  IconCamera,
  IconCard,
  IconChat,
  IconHammer,
  IconHome,
  IconInfo,
  IconList,
  IconPhone,
  IconRepeat,
  IconSettings,
  IconWrench,
} from "./icons";

const ICONS: Record<MenuIcon, ComponentType<SVGProps<SVGSVGElement>>> = {
  home: IconHome,
  camera: IconCamera,
  list: IconList,
  chat: IconChat,
  card: IconCard,
  settings: IconSettings,
  info: IconInfo,
  phone: IconPhone,
  wrench: IconWrench,
  hammer: IconHammer,
  box: IconBox,
  repeat: IconRepeat,
  brush: IconBrush,
};

type Density = "desk" | "phone";

const ROW: Record<Density, string> = {
  desk: "h-8 gap-2 rounded-lg px-2 text-sm",
  phone: "h-11 gap-3 rounded-xl px-3 text-base",
};

function rowClass(density: Density, active: boolean) {
  return `flex w-full min-w-0 items-center whitespace-nowrap text-left font-semibold ${ROW[density]} ${
    active ? "bg-cream text-pine shadow-[inset_3px_0_0_#132e24]" : "text-cream/85 hover:bg-white/10 hover:text-cream"
  }`;
}

function Row({ link, pathname, density, onNavigate, indent = false }: { link: MenuLink; pathname: string; density: Density; onNavigate?: () => void; indent?: boolean }) {
  const active = menuActive(pathname, link);
  const Icon = link.icon ? ICONS[link.icon] : null;
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      data-spotlight={link.spot}
      data-feedback-label={link.href === "/feedback/new" ? "true" : undefined}
      className={`${rowClass(density, active)} ${indent ? "font-medium" : ""}`}
      onClick={onNavigate}
    >
      {Icon ? <Icon className={density === "desk" ? "h-4 w-4 shrink-0" : "h-5 w-5 shrink-0"} /> : <span className={density === "desk" ? "w-4 shrink-0" : "w-5 shrink-0"} />}
      <span className="min-w-0 truncate">{link.label}</span>
    </Link>
  );
}

function Folder({
  folder,
  open,
  onToggle,
  pathname,
  density,
  onNavigate,
}: {
  folder: MenuFolder;
  open: boolean;
  onToggle: () => void;
  pathname: string;
  density: Density;
  onNavigate?: () => void;
}) {
  const Icon = ICONS[folder.icon];
  const here = pathname === folder.prefix || pathname.startsWith(`${folder.prefix}/`);
  return (
    <li data-nav-folder={folder.id}>
      <button
        type="button"
        aria-expanded={open}
        title={folder.label}
        onClick={onToggle}
        className={`${rowClass(density, false)} ${here ? "text-cream" : ""}`}
      >
        <Icon className={density === "desk" ? "h-4 w-4 shrink-0" : "h-5 w-5 shrink-0"} />
        <span className="min-w-0 flex-1 truncate">{folder.label}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 text-cream/60 ${open ? "rotate-90" : ""}`}>
          <path d="M7 4.5 13 10l-6 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div className={density === "desk" ? "ml-4 border-l border-white/20 pb-1 pl-1" : "ml-5 border-l border-white/20 pb-2 pl-2"}>
          <div className={`grid grid-cols-4 gap-1 ${density === "desk" ? "py-1" : "py-1.5"}`} role="group" aria-label={`${folder.label} views`}>
            {folder.views.map((view) => {
              const active = menuActive(pathname, view);
              return (
                <Link
                  key={view.href}
                  href={view.href}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  className={`flex items-center justify-center truncate rounded-md px-1 font-semibold ${density === "desk" ? "h-7 text-xs" : "h-10 text-sm"} ${
                    active ? "bg-cream text-pine" : "bg-white/10 text-cream/85 hover:bg-white/20"
                  }`}
                >
                  {view.label}
                </Link>
              );
            })}
          </div>
          <ul>
            {folder.links.map((link) => (
              <li key={link.href}>
                <Row link={link} pathname={pathname} density={density} onNavigate={onNavigate} indent />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

export function NavTree({
  sections,
  pathname,
  industry,
  density,
  onNavigate,
}: {
  sections: MenuSection[];
  pathname: string;
  industry: IndustryId | null;
  density: Density;
  onNavigate?: () => void;
}) {
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const isOpen = (folder: MenuFolder) => chosen[folder.id] ?? folderOpenByDefault(folder, pathname, industry);
  const header =
    density === "desk"
      ? "px-2 pb-1 pt-3 text-[11px] font-semibold uppercase leading-4 tracking-[0.14em] text-cream/60"
      : "sticky top-0 z-10 -mx-3 bg-pine px-6 pb-1 pt-4 text-caption font-semibold uppercase tracking-[0.14em] text-cream/70";

  return (
    <>
      {sections.map((section) => (
        <div key={section.id} data-nav-section={section.id}>
          {section.label ? <p className={header}>{section.label}</p> : null}
          <ul className={density === "desk" ? "space-y-px" : "space-y-0.5"}>
            {section.links.map((link) => (
              <li key={link.href}>
                <Row link={link} pathname={pathname} density={density} onNavigate={onNavigate} />
              </li>
            ))}
            {section.folders.map((folder) => (
              <Folder
                key={folder.id}
                folder={folder}
                open={isOpen(folder)}
                onToggle={() => setChosen((current) => ({ ...current, [folder.id]: !isOpen(folder) }))}
                pathname={pathname}
                density={density}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
