import { getSessionUser } from "@/lib/auth";
import { loadAccount, localAskAnswer, redactedContext } from "@/lib/assistant/context";
import { complete, llmProvider, type LlmResult, type LlmTurn } from "@/lib/assistant/llm";
import { planLocally } from "@/lib/assistant/plan";
import { describeTool, isToolName, toolNeedsConfirm } from "@/lib/assistant/tools";
import { redactText, restoreText } from "@/lib/redact";
import type { SessionUser } from "@/lib/types";
import { guideAnswer } from "@/lib/guide/help";
import { assistantAllowance, blockedAssistantMessage, recordAssistantUse } from "@/lib/usage";

async function charge(user: SessionUser, mode: "ask" | "agent", result: LlmResult) {
  await recordAssistantUse({
    userId: user.id,
    mode,
    provider: result.provider,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });
}

export const dynamic = "force-dynamic";

function turnsFrom(value: unknown): LlmTurn[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-12).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as { role?: string; content?: string; name?: string };
    const role = row.role === "assistant" || row.role === "tool" ? row.role : "user";
    const content = String(row.content || "").slice(0, 4000);
    if (!content) return [];
    return [{ role, content, name: row.name ? String(row.name).slice(0, 80) : undefined }];
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    mode?: string;
    pathname?: string;
    turns?: unknown;
  } | null;
  if (!body || (body.mode !== "ask" && body.mode !== "agent")) {
    return Response.json({ error: "Choose ask or agent." }, { status: 400 });
  }

  const pathname = String(body.pathname || "/").slice(0, 200);
  const turns = turnsFrom(body.turns);
  if (body.mode === "ask") {
    const latest = [...turns].reverse().find((turn) => turn.role === "user");
    const guided = guideAnswer(pathname, latest?.content || "");
    if (guided) {
      return Response.json({ type: "message", configured: llmProvider() != null, text: guided });
    }
  }
  const slice = await loadAccount(user.id, user.email);
  const configured = llmProvider() != null;
  if (configured) {
    const allowance = await assistantAllowance(user);
    if (allowance.remaining <= 0) {
      return Response.json({
        type: "message",
        configured: true,
        text: blockedAssistantMessage(user),
        allowance,
      });
    }
  }

  if (body.mode === "ask") {
    if (!configured) {
      return Response.json({ type: "message", configured: false, text: localAskAnswer(slice) });
    }
    const { json, redaction } = redactedContext(slice, pathname);
    const redactedTurns = turns.map((turn) => ({
      ...turn,
      content: redactText(turn.content, slice.names).text,
    }));
    try {
      const result = await complete({ mode: "ask", contextJson: json, turns: redactedTurns });
      await charge(user, "ask", result);
      const text = restoreText(result.text, redaction.tokens).trim();
      return Response.json({
        type: "message",
        configured: true,
        text: text || "I could not find that in your account.",
      });
    } catch (error) {
      const text = error instanceof Error ? error.message : "The assistant failed.";
      return Response.json({ type: "message", configured: true, text }, { status: 502 });
    }
  }

  const hasTool = turns.some((turn) => turn.role === "tool");
  if (!configured) {
    if (hasTool) {
      return Response.json({
        type: "message",
        configured: false,
        text: "Done. What I created is still editable.",
      });
    }
    const latest = [...turns].reverse().find((turn) => turn.role === "user")?.content || "";
    const steps = planLocally(latest, pathname);
    if (!steps) {
      return Response.json({
        type: "message",
        configured: false,
        text: "No model key is set. On this machine you can say “Add a price called Ridge vent at 40 each”, “Create a group called Ridge cap”, “New quote for a customer about a job”, or “Open prices”. Set OPENAI_API_KEY or ANTHROPIC_API_KEY for anything broader.",
      });
    }
    return Response.json({
      type: "plan",
      configured: false,
      note: "No model key is set, so this run stays on this machine and only uses in-app actions.",
      steps,
      continue: false,
    });
  }

  const { json, redaction } = redactedContext(slice, pathname);
  const redactedTurns = turns.map((turn) => ({
    ...turn,
    content: redactText(turn.content, slice.names).text,
  }));
  try {
    const result = await complete({ mode: "agent", contextJson: json, turns: redactedTurns });
    await charge(user, "agent", result);
    const steps = result.tools.filter((tool) => isToolName(tool.name)).map((tool) => {
      const args: Record<string, string> = {};
      for (const [key, value] of Object.entries(tool.args)) {
        args[key] = restoreText(value, redaction.tokens);
      }
      const described = describeTool(tool.name, args, pathname);
      return {
        name: tool.name,
        args,
        caption: described.caption,
        href: described.href,
        spotlight: described.spotlight,
        needsConfirm: toolNeedsConfirm(tool.name, args),
      };
    });
    if (steps.length === 0) {
      return Response.json({
        type: "message",
        configured: true,
        text: restoreText(result.text, redaction.tokens).trim() || "Done.",
      });
    }
    return Response.json({
      type: "plan",
      configured: true,
      text: restoreText(result.text, redaction.tokens).trim(),
      steps,
      continue: true,
    });
  } catch (error) {
    const text = error instanceof Error ? error.message : "The assistant failed.";
    return Response.json({ type: "message", configured: true, text }, { status: 502 });
  }
}
