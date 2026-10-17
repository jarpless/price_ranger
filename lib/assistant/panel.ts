export const DESKTOP_PANEL_KEY = "pr-assistant-desktop-v1";

export type DesktopChrome = "docked" | "floating";

export type DesktopPanelPref = {
  open: boolean;
  chrome: DesktopChrome;
};

export function defaultDesktopPanel(): DesktopPanelPref {
  return { open: true, chrome: "docked" };
}

export function parseDesktopPanel(raw: string | null): DesktopPanelPref | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { open?: unknown; chrome?: unknown };
    if (typeof value.open !== "boolean") return null;
    return {
      open: value.open,
      chrome: value.chrome === "floating" ? "floating" : "docked",
    };
  } catch {
    return null;
  }
}

export function readDesktopPanel(): DesktopPanelPref {
  if (typeof window === "undefined") return defaultDesktopPanel();
  try {
    return parseDesktopPanel(window.localStorage.getItem(DESKTOP_PANEL_KEY)) ?? defaultDesktopPanel();
  } catch {
    return defaultDesktopPanel();
  }
}

export function writeDesktopPanel(pref: DesktopPanelPref) {
  if (typeof window === "undefined") return;
  const next: DesktopPanelPref = {
    open: pref.open,
    chrome: pref.chrome === "floating" ? "floating" : "docked",
  };
  window.localStorage.setItem(DESKTOP_PANEL_KEY, JSON.stringify(next));
}
