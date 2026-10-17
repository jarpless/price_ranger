"use client";

import { usePathname, useRouter } from "next/navigation";

import { isRootPath } from "@/lib/nav";
import { backHref } from "@/lib/search-return";

import { vibrate } from "./feel";

export function BackButton({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  if (isRootPath(pathname)) return null;

  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => {
        vibrate();
        router.push(backHref(pathname, window.location.search, window.matchMedia("(min-width: 64rem)").matches));
      }}
      className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-current ${className}`}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none">
        <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
