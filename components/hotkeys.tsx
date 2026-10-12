"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

function typingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function Hotkeys() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (pathname.includes("/present")) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (typingTarget(event.target)) return;
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        router.push("/quotes/new");
        return;
      }
      if (event.key === "/") {
        const inputs = [...document.querySelectorAll<HTMLInputElement>("[data-shortcut=search]")];
        const visible = inputs.find((input) => input.getClientRects().length > 0);
        if (visible) {
          event.preventDefault();
          visible.focus();
          visible.select();
          return;
        }
        event.preventDefault();
        router.push("/library");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router]);
  return null;
}
