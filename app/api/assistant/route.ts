import { getSessionUser } from "@/lib/auth";
import { loadAccount, localAskAnswer, redactedContext } from "@/lib/assistant/context";
import { complete, llmProvider, type LlmResult, type LlmTurn } from "@/lib/assistant/llm";
import { planLocally } from "@/lib/assistant/plan";
import { describeTool, isToolName, toolNeedsConfirm } from "@/lib/assistant/tools";
import { redactText, restoreText } from "@/lib/redact";
import type { SessionUser } from "@/lib/types";
import { feedbackAssistantText } from "@/lib/feedback/mine";
import { explainPrice, guideAnswer } from "@/lib/guide/help";
import { getGuideQuote } from "@/lib/guide/store";
import { answerFromMarket } from "@/lib/market";
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

function confirmedAction(message: string, pathname: string): {
  name: "navigate";
  args: Record<string, string>;
  caption: string;
  href: string;
  spotlight: string;
  needsConfirm: boolean;
} | null {
  const text = message.trim().toLowerCase();
  if (!text) return null;
  const guide = pathname.split("?")[0] || "/";
  if (/delete (my )?account|close (my )?account/.test(text)) {
    return {
      name: "navigate",
      args: { path: "/settings/delete" },
      caption: "Open delete account. Nothing is removed until you confirm on that screen.",
      href: "/settings/delete",
      spotlight: "settings-feedback",
      needsConfirm: true,
    };
  }
  if (/\b(upgrade|subscribe|change my plan|switch to plus|switch to pro|get plus|get pro)\b/.test(text)) {
    return {
      name: "navigate",
      args: { path: "/upgrade" },
      caption: "Open plans. Nothing is charged until you check out.",
      href: "/upgrade",
      spotlight: "nav-menu",
      needsConfirm: true,
    };
  }
  if (/mark (it |this |that )?sold/.test(text)) {
    const href = guide.startsWith("/guide/") ? guide : "/";
    return {
      name: "navigate",
      args: { path: href },
      caption: "I won't mark it sold from here. Open the price and tap Yes, sold.",
      href,
      spotlight: "nav-price",
      needsConfirm: true,
    };
  }
  if (/\b(share (it|this|the link)|send the link|copy the link)\b/.test(text)) {
    const href = guide.startsWith("/guide/") ? guide : "/";
    return {
      name: "navigate",
      args: { path: href },
      caption: "I won't share it from here. Open the price and tap Send, then copy the link.",
      href,
      spotlight: "nav-price",
      needsConfirm: true,
    };
  }
  return null;
}

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
  const latestIntent = [...turns].reverse().find((turn) => turn.role === "user")?.content || "";
  const confirmed = confirmedAction(latestIntent, pathname);
  if (confirmed) {
    return Response.json({
      type: "plan",
      configured: llmProvider() != null,
      text: confirmed.caption,
      steps: [confirmed],
      continue: false,
      allowance: await assistantAllowance(user),
    });
  }
  if (body.mode === "ask") {
    const latest = [...turns].reverse().find((turn) => turn.role === "user");
    const latestText = latest?.content || "";
    const guidePath = pathname.split("?")[0] || "";
    const quoteId = guidePath.startsWith("/guide/") ? guidePath.split("/")[2] || "" : "";
    const row = quoteId ? await getGuideQuote(user.id, quoteId) : null;
    const askingPrice = /how much|worth|price|re-?price|what should i (ask|charge)|fair price|sold for/i.test(latestText);
    const namesProduct = /switch|iphone|playstation|\bps5\b|airpods|xbox|macbook/i.test(latestText);
    if (row?.description && (askingPrice || namesProduct)) {
      const fromQuote = answerFromMarket(row.description, row.priceCents);
      if (fromQuote) {
        return Response.json({ type: "message", configured: llmProvider() != null, text: fromQuote, allowance: await assistantAllowance(user) });
      }
    }
    if (askingPrice || namesProduct) {
      const fromMessage = answerFromMarket(latestText, row?.priceCents ?? null);
      if (fromMessage) {
        return Response.json({ type: "message", configured: llmProvider() != null, text: fromMessage, allowance: await assistantAllowance(user) });
      }
    }
    if (/my feedback|my ticket|my bug|feedback status/.test(latestText.toLowerCase())) {
      return Response.json({
        type: "message",
        configured: llmProvider() != null,
        text: await feedbackAssistantText(user.id),
        allowance: await assistantAllowance(user),
      });
    }
    if (row) {
      const explained = explainPrice(latestText, row);
      if (explained) {
        return Response.json({ type: "message", configured: llmProvider() != null, text: explained, allowance: await assistantAllowance(user) });
      }
    }
    const guided = guideAnswer(pathname, latestText);
    if (guided) {
      return Response.json({ type: "message", configured: llmProvider() != null, text: guided, allowance: await assistantAllowance(user) });
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
        allowance: await assistantAllowance(user),
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
