export type AskMode = "ask" | "agent";

export type ChatLine = { role: "user" | "assistant"; text: string };

export type ChatTurn = { role: "user" | "assistant" | "tool"; content: string; name?: string };

export type AssistantChrome = "floating" | "docked";

export type AssistantSnapshot = {
  rev: number;
  mode: AskMode;
  lines: ChatLine[];
  turns: ChatTurn[];
  chrome: AssistantChrome;
  dockWidth: number;
};

export const ASSISTANT_STORAGE_KEY = "pr-assistant-v1";
export const ASSISTANT_CHANNEL = "pr-assistant";

export function emptySnapshot(): AssistantSnapshot {
  return { rev: 0, mode: "ask", lines: [], turns: [], chrome: "floating", dockWidth: 380 };
}

export function clampDockWidth(width: number): number {
  if (!Number.isFinite(width)) return 380;
  return Math.min(560, Math.max(320, Math.round(width)));
}

export function pickSnapshot(current: AssistantSnapshot | null, incoming: AssistantSnapshot | null): AssistantSnapshot {
  const base = current ?? emptySnapshot();
  if (!incoming) return base;
  if (incoming.rev < base.rev) return base;
  return {
    rev: incoming.rev,
    mode: incoming.mode === "agent" ? "agent" : "ask",
    lines: Array.isArray(incoming.lines) ? incoming.lines : [],
    turns: Array.isArray(incoming.turns) ? incoming.turns : [],
    chrome: incoming.chrome === "docked" ? "docked" : "floating",
    dockWidth: clampDockWidth(incoming.dockWidth),
  };
}

export function readSnapshot(): AssistantSnapshot {
  if (typeof window === "undefined") return emptySnapshot();
  try {
    const raw = window.localStorage.getItem(ASSISTANT_STORAGE_KEY);
    if (!raw) return emptySnapshot();
    return pickSnapshot(emptySnapshot(), JSON.parse(raw) as AssistantSnapshot);
  } catch {
    return emptySnapshot();
  }
}

export function writeSnapshot(current: AssistantSnapshot, patch: Partial<AssistantSnapshot>): AssistantSnapshot {
  const next = pickSnapshot(null, {
    ...current,
    ...patch,
    rev: current.rev + 1,
    dockWidth: clampDockWidth(patch.dockWidth ?? current.dockWidth),
  });
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ASSISTANT_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}
