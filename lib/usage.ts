import { assistantLimitMessage, assistantMessageCap, estimateCostUsd } from "./plans";
import { listUsage, recordUsage, type UsageEvent } from "./store/basecamp";
import type { SessionUser } from "./types";

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function assistantAllowance(user: SessionUser): Promise<{
  used: number;
  cap: number;
  remaining: number;
}> {
  const cap = assistantMessageCap(user.plan);
  const start = monthStartIso();
  const used = await countUsageSince(user.id, start);
  return { used, cap, remaining: Math.max(0, cap - used) };
}

async function countUsageSince(userId: string, start: string): Promise<number> {
  try {
    const rows = await listUsage(userId, false);
    return rows.filter((row) => row.createdAt >= start).length;
  } catch {
    return 0;
  }
}

/** Counts a local answer. A failure must not block the reply. */
export async function recordLocalAssistantUse(userId: string): Promise<void> {
  try {
    await recordAssistantUse({
      userId,
      mode: "ask",
      provider: "local",
      model: "guide",
      inputTokens: 0,
      outputTokens: 0,
    });
  } catch {
    return;
  }
}

export async function recordAssistantUse(input: {
  userId: string;
  mode: "ask" | "agent";
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const event: UsageEvent = {
    id: crypto.randomUUID(),
    userId: input.userId,
    mode: input.mode,
    provider: input.provider,
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    costUsd: estimateCostUsd(input.model, input.inputTokens, input.outputTokens),
    createdAt: new Date().toISOString(),
  };
  await recordUsage(event);
}

export function blockedAssistantMessage(user: SessionUser): string {
  return assistantLimitMessage(user.plan);
}
