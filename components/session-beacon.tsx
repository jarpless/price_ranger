"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { deviceId } from "./capture-shot";
import { sendTrack } from "./track-beacon";

export function SessionBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "screen", route: pathname, deviceId: deviceId() }),
    });
    sendTrack("session_started");
  }, [pathname]);

  return null;
}
