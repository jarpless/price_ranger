/** Single source of truth for the shipping version and ranger codename. */
export const APP_VERSION = "2.2.0";

export const APP_CODENAME = "Ridgeline";

/** Shown on every screen. */
export const VERSION_LABEL = "v2.2 Ridgeline";

export interface Release {
  version: string;
  label: string;
  codename: string;
  state: "shipped" | "current" | "planned";
  summary: string;
}

export const RELEASES: Release[] = [
  {
    version: "2.0.0",
    label: "v2.0 Trailhead",
    codename: "Trailhead",
    state: "shipped",
    summary: "Phase 1. Phone quoting, sample catalogs, groups, and presentation.",
  },
  {
    version: "2.1.0",
    label: "v2.1 Basecamp",
    codename: "Basecamp",
    state: "shipped",
    summary: "Desktop and phone layouts, feedback capture, and the in-app assistant.",
  },
  {
    version: "2.1.1",
    label: "v2.1.1 Basecamp",
    codename: "Basecamp",
    state: "shipped",
    summary: "Taps show a pending state immediately. Auth is checked once per request, and the app runs closer to the database.",
  },
  {
    version: "2.2.0",
    label: "v2.2 Ridgeline",
    codename: "Ridgeline",
    state: "current",
    summary: "A guided price path, a returning home, and a test-mode upgrade. Draft until Jamie approves the merge.",
  },
  {
    version: "2.3.0",
    label: "v2.3 Lookout",
    codename: "Lookout",
    state: "planned",
    summary: "One live catalog feed, only with a written supplier agreement.",
  },
  {
    version: "2.4.0",
    label: "v2.4 Outpost",
    codename: "Outpost",
    state: "planned",
    summary: "The iPhone app via Capacitor. Face ID, camera, share sheet, and Sign in with Apple. TestFlight, then the App Store.",
  },
  {
    version: "3.0.0",
    label: "v3.0 Summit",
    codename: "Summit",
    state: "planned",
    summary: "A second industry on the same catalog, if a real user asks for it.",
  },
];
