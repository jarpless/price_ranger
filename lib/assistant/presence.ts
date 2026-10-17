export type AskMode = "ask" | "agent";

export type ChatLine = { role: "user" | "assistant"; text: string; kind?: "step" };

export type ChatTurn = { role: "user" | "assistant" | "tool"; content: string; name?: string };

export type AssistantChrome = "floating" | "docked";

export type AssistantSnapshot = {
  rev: number;
  mode: AskMode;
  lines: ChatLine[];
  turns: ChatTurn[];
  chrome: AssistantChrome;
  dockWidth: number;
  chatId: string;
};

export const ASSISTANT_STORAGE_KEY = "pr-assistant-v1";
export const ASSISTANT_CHANNEL = "pr-assistant";

export function emptySnapshot(): AssistantSnapshot {
  return { rev: 0, mode: "ask", lines: [], turns: [], chrome: "floating", dockWidth: 380, chatId: "" };
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
    lines: cleanLines(incoming.lines),
    turns: Array.isArray(incoming.turns) ? incoming.turns : [],
    chrome: incoming.chrome === "docked" ? "docked" : "floating",
    dockWidth: clampDockWidth(incoming.dockWidth),
    chatId: typeof incoming.chatId === "string" ? incoming.chatId : base.chatId,
  };
}

function cleanLines(value: unknown): ChatLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as { role?: unknown; text?: unknown; kind?: unknown };
    const role = row.role === "assistant" || row.role === "user" ? row.role : null;
    if (!role) return [];
    const text = typeof row.text === "string" ? row.text : "";
    return [{ role, text, ...(row.kind === "step" ? { kind: "step" as const } : {}) }];
  });
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
