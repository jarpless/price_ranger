export interface OpenDraft {
  quoteId: string;
  description: string;
  sample: boolean;
  sharedAt: string | null;
  finishedAt: string | null;
  outcome: string | null;
}

export function sameItem(a: string, b: string): boolean {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  return normalize(a) === normalize(b);
}

/** An unsent draft for this item. Back-and-retry and a second tap reuse it. */
export function reusableDraftId(quotes: OpenDraft[], description: string): string | null {
  const match = quotes.find((quote) => {
    if (quote.sample || quote.sharedAt || quote.finishedAt || quote.outcome) return false;
    return sameItem(quote.description, description);
  });
  return match?.quoteId ?? null;
}

export function draftKey(userId: string, description: string): string {
  return `${userId}\0${description.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

const inflight = new Map<string, Promise<string>>();

/** One create for a double tap. The second caller waits for the first quote id. */
export function shareDraftWork(key: string, work: () => Promise<string>): Promise<string> {
  const current = inflight.get(key);
  if (current) return current;
  const run = work().finally(() => {
    if (inflight.get(key) === run) inflight.delete(key);
  });
  inflight.set(key, run);
  return run;
}
