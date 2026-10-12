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
  const rows = await listUsage(user.id, false);
  const start = monthStartIso();
  const used = rows.filter((row) => row.createdAt >= start).length;
  return { used, cap, remaining: Math.max(0, cap - used) };
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
