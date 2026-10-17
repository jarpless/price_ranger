export const CAPTURE_STATE_KEY = "prNew";

export interface CaptureState {
  description: string;
  category: string | null;
}

/** The search text and category stored on the /new history entry. */
export function readCaptureState(historyState: unknown): CaptureState | null {
  if (!historyState || typeof historyState !== "object") return null;
  const raw = (historyState as Record<string, unknown>)[CAPTURE_STATE_KEY];
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const description = typeof record.description === "string" ? record.description.slice(0, 280) : "";
  const category = typeof record.category === "string" && record.category ? record.category.slice(0, 40) : null;
  if (!description && !category) return null;
  return { description, category };
}

/** Keep Next's history fields and attach the search the Back button should restore. */
export function withCaptureState(historyState: unknown, capture: CaptureState): Record<string, unknown> {
  const base = historyState && typeof historyState === "object" ? { ...(historyState as Record<string, unknown>) } : {};
  return {
    ...base,
    [CAPTURE_STATE_KEY]: {
      description: capture.description.slice(0, 280),
      category: capture.category,
    },
  };
}

export function captureFromQuery(
  q: string | undefined,
  cat: string | undefined,
  categories: readonly string[],
): CaptureState {
  const description = (q ?? "").slice(0, 280);
  const category = cat && categories.includes(cat) ? cat : null;
  return { description, category };
}
