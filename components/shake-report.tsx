"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { captureShot, deviceId } from "./capture-shot";

const SHOT_KEY = "pr-feedback-shot";

export function ShakeReport() {
  const router = useRouter();
  const pathname = usePathname();
  const last = useRef({ x: 0, y: 0, z: 0, at: 0 });
  const busy = useRef(false);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (!coarse || pathname.startsWith("/feedback")) return;
    let stop = false;

    async function onMotion(event: DeviceMotionEvent) {
      if (stop || busy.current) return;
      const accel = event.accelerationIncludingGravity;
      if (!accel || accel.x == null || accel.y == null || accel.z == null) return;
      const previous = last.current;
      const dx = accel.x - previous.x;
      const dy = accel.y - previous.y;
      const dz = accel.z - previous.z;
      last.current = { x: accel.x, y: accel.y, z: accel.z, at: Date.now() };
      const delta = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (delta < 18 || Date.now() - previous.at < 2500) return;
      busy.current = true;
      try {
        const shot = await captureShot(null);
        window.sessionStorage.setItem(SHOT_KEY, shot.preview);
        window.sessionStorage.setItem("pr-feedback-device", deviceId());
        router.push("/feedback/new?shake=1");
      } catch {
        busy.current = false;
      }
    }

    window.addEventListener("devicemotion", onMotion);
    return () => {
      stop = true;
      window.removeEventListener("devicemotion", onMotion);
    };
  }, [pathname, router]);

  useEffect(() => {
    async function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.hasAttribute("data-feedback-label")) return;
      const href = link.getAttribute("href") || "";
      if (href !== "/feedback/new" && !href.startsWith("/feedback/new?")) return;
      event.preventDefault();
      event.stopPropagation();
      try {
        const shot = await captureShot(null);
        window.sessionStorage.setItem(SHOT_KEY, shot.preview);
        window.sessionStorage.setItem("pr-feedback-device", deviceId());
      } catch {
        window.sessionStorage.removeItem(SHOT_KEY);
      }
      router.push("/feedback/new?shot=1");
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return null;
}

export function takeStoredShot(): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(SHOT_KEY) || "";
}
