"use client";

import { useEffect } from "react";

import type { ClientEventName } from "@/lib/analytics/events";

function platform(): "web" | "pwa" {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone ? "pwa" : "web";
}

/** Fire-and-forget. Survives a navigation that starts on the same tap. */
export function sendTrack(name: ClientEventName, props?: Record<string, string>) {
  const body = JSON.stringify({ name, props, platform: platform() });
  try {
    if (navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) return;
  } catch {
    // Fall through to fetch.
  }
  void fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
}

/**
 * Sends `view` once on mount, and a click event for any element inside the page
 * marked `data-track="<event>"` (optional `data-track-action` / `data-track-where`).
 */
export function TrackBeacon({ view }: { view?: ClientEventName }) {
  useEffect(() => {
    if (view) sendTrack(view);
    function onClick(event: MouseEvent) {
      const target = (event.target as Element | null)?.closest?.("[data-track]");
      if (!(target instanceof HTMLElement)) return;
      const name = target.dataset.track as ClientEventName;
      const props: Record<string, string> = {};
      if (target.dataset.trackAction) props.action = target.dataset.trackAction;
      if (target.dataset.trackWhere) props.where = target.dataset.trackWhere;
      sendTrack(name, props);
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [view]);
  return null;
}
