"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** The desktop workspace lives in the sidebar, so /menu is a phone page. */
export function HideMenuOnDesktop() {
  const router = useRouter();
  useEffect(() => {
    const media = window.matchMedia("(min-width: 64rem)");
    const leave = () => {
      if (media.matches) router.replace("/");
    };
    leave();
    media.addEventListener("change", leave);
    return () => media.removeEventListener("change", leave);
  }, [router]);
  return null;
}
