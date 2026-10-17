"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { captureShot, deviceId } from "./capture-shot";

const SHOT_KEY = "pr-feedback-shot";
const ROUTE_KEY = "pr-feedback-route";

function feedbackHref(link: HTMLAnchorElement): boolean {
  const href = link.getAttribute("href") || "";
  return href === "/feedback/new" || href.startsWith("/feedback/new?");
}

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
        window.sessionStorage.setItem(ROUTE_KEY, window.location.pathname);
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
    let openedAt = 0;

    function isPlainClick(event: MouseEvent | PointerEvent): boolean {
      return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    }

    function linkFrom(event: Event): HTMLAnchorElement | null {
      const target = event.target;
      if (!(target instanceof Element)) return null;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement) || !feedbackHref(link)) return null;
      return link;
    }

    async function openAppForm() {
      if (Date.now() - openedAt < 800) return;
      openedAt = Date.now();
      try {
        const shot = await captureShot(null);
        window.sessionStorage.setItem(SHOT_KEY, shot.preview);
        window.sessionStorage.setItem(ROUTE_KEY, `${window.location.pathname}${window.location.search}`.slice(0, 200));
        window.sessionStorage.setItem("pr-feedback-device", deviceId());
      } catch {
        window.sessionStorage.removeItem(SHOT_KEY);
      }
      router.push("/feedback/new?shot=1");
    }

    function stopToolbar(event: Event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    // pointerdown preventDefault stops the click a preview toolbar uses to enter its own feedback mode.
    function onPointerDown(event: PointerEvent) {
      if (!isPlainClick(event) || !linkFrom(event)) return;
      stopToolbar(event);
    }

    function onPointerUp(event: PointerEvent) {
      if (event.defaultPrevented && !linkFrom(event)) return;
      if (!isPlainClick(event) || !linkFrom(event)) return;
      stopToolbar(event);
      void openAppForm();
    }

    function onClick(event: MouseEvent) {
      if (!isPlainClick(event) || !linkFrom(event)) return;
      stopToolbar(event);
      void openAppForm();
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [router]);

  return null;
}

export function takeStoredShot(): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(SHOT_KEY) || "";
}
