import { getSessionUser } from "@/lib/auth";
import { loadAccount, localAskAnswer, redactedContext } from "@/lib/assistant/context";
import { complete, llmProvider, type LlmResult, type LlmTurn } from "@/lib/assistant/llm";
import { planLocally } from "@/lib/assistant/plan";
import { describeTool, isToolName, toolNeedsConfirm } from "@/lib/assistant/tools";
import { redactText, restoreText } from "@/lib/redact";
import type { SessionUser } from "@/lib/types";
import { feedbackAssistantText } from "@/lib/feedback/mine";
import { screenAnswer } from "@/lib/assistant/screen";
import { explainPrice } from "@/lib/guide/help";
import { getGuideQuote } from "@/lib/guide/store";
import { confirmedAction, appPath, quoteCommand } from "@/lib/assistant/intent";
import { priceChoices } from "@/lib/assistant/price-target";
import { answerFromMarket, conditionLabel, readMarketMeta } from "@/lib/market";
import { PLANS } from "@/lib/plans";
import { formatUsd, lineTotalCents, parseDollarsToCents } from "@/lib/money";
import { getData } from "@/lib/store";
import { assistantAllowance, blockedAssistantMessage, recordAssistantUse, recordLocalAssistantUse } from "@/lib/usage";

async function enrichPriceStep<T extends { name: string; args: Record<string, string>; caption: string }>(
  userId: string,
  step: T,
): Promise<T & { choices?: { label: string; args: Record<string, string> }[] }> {
  if (step.name !== "set_asking_price") return step;
  const amount = parseDollarsToCents(step.args.amount || "");
  const quoteId = step.args.quoteId || "";
  if (amount == null || !quoteId) return step;
  const data = await getData();
  const quote = await data.getQuote(userId, quoteId);
  const groups = await data.listGroups(userId);
  const group = quote?.tiers[0]?.groupIds.map((id) => groups.find((item) => item.id === id)).find(Boolean);
  const lines = (group?.items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    cents: lineTotalCents(item.quantity || 1, item.unitPriceCents),
  }));
  const row = await getGuideQuote(userId, quoteId);
  const total = row?.priceCents ?? lines.reduce((sum, line) => sum + line.cents, 0);
  const described = priceChoices(lines, amount, total);
  return {
    ...step,
    caption: described.caption,
    choices: described.choices.map((choice) => ({
      label: choice.label,
      args: {
        target: choice.target,
        ...(choice.lineId ? { lineId: choice.lineId } : {}),
      },
    })),
  };
}

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

async function localReply(user: SessionUser, text: string) {
  await recordLocalAssistantUse(user.id);
  return Response.json({
    type: "message",
    configured: llmProvider() != null,
    text,
    allowance: await assistantAllowance(user),
  });
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
  const commanded = quoteCommand(latestIntent, pathname);
  if (commanded?.type === "reply") return localReply(user, commanded.text);
  if (commanded?.type === "step") {
    const step = await enrichPriceStep(user.id, commanded.step);
    await recordLocalAssistantUse(user.id);
    return Response.json({
      type: "plan",
      configured: llmProvider() != null,
      text: step.caption,
      steps: [step],
      continue: false,
      allowance: await assistantAllowance(user),
    });
  }
  const confirmed = confirmedAction(latestIntent, pathname);
  if (confirmed) {
    await recordLocalAssistantUse(user.id);
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
    const meta = row ? readMarketMeta(row.sources) : null;
    const screened = screenAnswer(latestText, {
      pathname: guidePath,
      planName: PLANS[user.plan].name,
      quote: row
        ? {
            description: row.description,
            priceCents: row.priceCents,
            step: row.step,
            note: row.note,
            condition: conditionLabel(meta?.condition || "good"),
            range: meta?.lowCents && meta?.highCents ? `${formatUsd(meta.lowCents)}–${formatUsd(meta.highCents)}` : "",
          }
        : null,
    });
    if (screened) return localReply(user, screened);
    const askingPrice = /how much|worth|price|re-?price|what should i (ask|charge)|fair price|sold for/i.test(latestText);
    const namesProduct = /switch|iphone|playstation|\bps5\b|airpods|xbox|macbook/i.test(latestText);
    if (row?.description && (askingPrice || namesProduct)) {
      const fromQuote = answerFromMarket(row.description, row.priceCents);
      if (fromQuote) {
        return localReply(user, fromQuote);
      }
    }
    if (askingPrice || namesProduct) {
      const fromMessage = answerFromMarket(latestText, row?.priceCents ?? null);
      if (fromMessage) {
        return localReply(user, fromMessage);
      }
    }
    if (/my feedback|my ticket|my bug|feedback status/.test(latestText.toLowerCase())) {
      const text = await feedbackAssistantText(user.id);
      return localReply(user, text);
    }
    if (row) {
      const explained = explainPrice(latestText, row);
      if (explained) {
        return localReply(user, explained);
      }
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
      return localReply(user, localAskAnswer(slice));
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
        allowance: await assistantAllowance(user),
      });
    }
    const latest = [...turns].reverse().find((turn) => turn.role === "user")?.content || "";
    const steps = planLocally(latest, pathname);
    if (!steps) {
      return localReply(
        user,
        "No model key is set. On this machine you can say “Add a price called Ridge vent at 40 each”, “Create a group called Ridge cap”, “New quote for a customer about a job”, or “Open prices”. Set OPENAI_API_KEY or ANTHROPIC_API_KEY for anything broader.",
      );
    }
    await recordLocalAssistantUse(user.id);
    return Response.json({
      type: "plan",
      configured: false,
      note: "No model key is set, so this run stays on this machine and only uses in-app actions.",
      steps,
      continue: false,
      allowance: await assistantAllowance(user),
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
    const steps = await Promise.all(result.tools.filter((tool) => isToolName(tool.name)).map(async (tool) => {
      const args: Record<string, string> = {};
      for (const [key, value] of Object.entries(tool.args)) {
        args[key] = restoreText(value, redaction.tokens);
      }
      const described = describeTool(tool.name, args, pathname);
      return enrichPriceStep(user.id, {
        name: tool.name,
        args,
        caption: described.caption,
        href: appPath(described.href),
        spotlight: described.spotlight,
        needsConfirm: toolNeedsConfirm(tool.name, args),
      });
    }));
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
