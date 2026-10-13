"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function vibrate() {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  navigator.vibrate(10);
}

/** Swipe-back from the left edge, a short haptic on primary presses, and the install worker. */
export function Feel() {
  const router = useRouter();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-haptic]")) vibrate();
    }

    let startX = 0;
    let startY = 0;
    let tracking = false;

    function onStart(event: TouchEvent) {
      const touch = event.touches[0];
      if (!touch || touch.clientX > 24) {
        tracking = false;
        return;
      }
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    }

    function onEnd(event: TouchEvent) {
      if (!tracking) return;
      tracking = false;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (dx < 72 || Math.abs(dy) > 48) return;
      if (window.history.length <= 1) return;
      vibrate();
      router.back();
    }

    document.addEventListener("click", onClick);
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, [router]);

  return null;
}
