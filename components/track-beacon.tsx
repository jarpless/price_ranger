"use client";

import { useEffect } from "react";

import type { ClientEventName } from "@/lib/analytics/events";

function platform(): "web" | "pwa" {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone ? "pwa" : "web";
}

let firstRequest: Promise<unknown> | null = null;

/**
 * Fire-and-forget. Survives a navigation that starts on the same tap.
 * Later calls wait for the first so a new visitor gets one id cookie, not one per parallel request.
 */
export function sendTrack(name: ClientEventName, props?: Record<string, string>) {
  const body = JSON.stringify({ name, props, platform: platform() });
  if (!firstRequest) {
    firstRequest = fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(
      () => undefined,
    );
    return;
  }
  void firstRequest.then(() => post(body));
}

function post(body: string) {
  try {
    if (navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) return;
  } catch {
    // Fall through to fetch.
  }
  void fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
}

/**
 * Sends `view` once on mount, and a click event for any element inside the page
 * marked `data-track="<event>"` (optional `data-track-action`).
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
      sendTrack(name, props);
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [view]);
  return null;
}
