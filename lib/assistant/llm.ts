import { llmToolDefinitions, type ToolName } from "./tools";

export type LlmProvider = "openai" | "anthropic";

export function llmProvider(): LlmProvider | null {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export interface LlmTurn {
  role: "user" | "assistant" | "tool";
  content: string;
  name?: string;
}

export interface LlmToolCall {
  name: ToolName;
  args: Record<string, string>;
}

export interface LlmResult {
  text: string;
  tools: LlmToolCall[];
  provider: LlmProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export function modelFor(provider: LlmProvider, mode: "ask" | "agent"): string {
  if (provider === "openai") {
    if (mode === "agent") return process.env.OPENAI_AGENT_MODEL || "gpt-4o";
    return process.env.OPENAI_ASK_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
  }
  if (mode === "agent") return process.env.ANTHROPIC_AGENT_MODEL || "claude-3-5-sonnet-latest";
  return process.env.ANTHROPIC_ASK_MODEL || process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
}

const SYSTEM = `You are the Price Ranger assistant inside an estimating app. You only know the JSON context, which already hides names, emails, phones, and addresses. Never invent prices.

Speak in plain sentences a seller would say out loud. Never say "price record", "quote record", "database", or "draft status". Do not repeat the word quote. Do not mention ids.

Ask mode: answer from the context. When you point at something they saved, use a short link with its path, like [the oak table](/quotes/id). Use only paths from the context.

Agent mode: use the tools to navigate, create, or edit. Everything you create must stay editable. Do not invent a path that leaves the site. Plans are at /upgrade. There is no /settings/plans page. Deletes, plan changes, sharing, price changes, and marking sold wait for the person to confirm. Changing the price on an open /guide page uses set_asking_price, not update_price. update_price only edits the Prices library and still waits for confirm. Marking sold uses mark_sold and does the action after confirm. Do not navigate somewhere and tell them to tap it themselves. Questions that start with why, how, or what are answers, not actions. If the task is done, reply in one or two sentences and do not call a tool.`;

function asStringArgs(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const args: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry == null) continue;
    args[key] = String(entry).slice(0, 2000);
  }
  return args;
}

function transcript(turns: LlmTurn[]): { role: "user" | "assistant"; content: string }[] {
  const messages: { role: "user" | "assistant"; content: string }[] = [];
  for (const turn of turns) {
    if (turn.role === "tool") {
      messages.push({
        role: "user",
        content: `Tool ${turn.name || "tool"} finished: ${turn.content}`,
      });
    } else {
      messages.push({ role: turn.role, content: turn.content });
    }
  }
  return messages;
}

export async function complete(input: {
  mode: "ask" | "agent";
  contextJson: string;
  turns: LlmTurn[];
}): Promise<LlmResult> {
  const provider = llmProvider();
  if (!provider) throw new Error("No assistant model is configured.");
  const preamble = `${SYSTEM}\n\nMode: ${input.mode}\n\nContext:\n${input.contextJson}`;
  if (provider === "openai") return openAi(preamble, input);
  return anthropic(preamble, input);
}

async function openAi(
  preamble: string,
  input: { mode: "ask" | "agent"; turns: LlmTurn[] },
): Promise<LlmResult> {
  const tools = llmToolDefinitions().map((tool) => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelFor("openai", input.mode),
      temperature: 0.2,
      messages: [{ role: "system", content: preamble }, ...transcript(input.turns)],
      tools: input.mode === "agent" ? tools : undefined,
    }),
  });
  if (!response.ok) {
    throw new Error(`The assistant model returned ${response.status}.`);
  }
  const payload = (await response.json()) as {
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    choices?: {
      message?: {
        content?: string | null;
        tool_calls?: { function?: { name?: string; arguments?: string } }[];
      };
    }[];
  };
  const message = payload.choices?.[0]?.message;
  const toolsOut: LlmToolCall[] = [];
  for (const call of message?.tool_calls ?? []) {
    const name = call.function?.name;
    if (!name) continue;
    let parsed: unknown = {};
    try {
      parsed = JSON.parse(call.function?.arguments || "{}");
    } catch {
      parsed = {};
    }
    toolsOut.push({ name: name as ToolName, args: asStringArgs(parsed) });
  }
  return {
    text: message?.content || "",
    tools: input.mode === "agent" ? toolsOut : [],
    provider: "openai",
    model: modelFor("openai", input.mode),
    inputTokens: payload.usage?.prompt_tokens ?? 0,
    outputTokens: payload.usage?.completion_tokens ?? 0,
  };
}

async function anthropic(
  preamble: string,
  input: { mode: "ask" | "agent"; turns: LlmTurn[] },
): Promise<LlmResult> {
  const tools = llmToolDefinitions().map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelFor("anthropic", input.mode),
      max_tokens: 800,
      system: preamble,
      tools: input.mode === "agent" ? tools : undefined,
      messages: transcript(input.turns),
    }),
  });
  if (!response.ok) {
    throw new Error(`The assistant model returned ${response.status}.`);
  }
  const payload = (await response.json()) as {
    usage?: { input_tokens?: number; output_tokens?: number };
    content?: { type: string; text?: string; name?: string; input?: unknown }[];
  };
  const text = (payload.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text || "")
    .join("\n")
    .trim();
  const toolsOut: LlmToolCall[] = [];
  for (const block of payload.content || []) {
    if (block.type !== "tool_use" || !block.name) continue;
    toolsOut.push({ name: block.name as ToolName, args: asStringArgs(block.input) });
  }
  return {
    text,
    tools: input.mode === "agent" ? toolsOut : [],
    provider: "anthropic",
    model: modelFor("anthropic", input.mode),
    inputTokens: payload.usage?.input_tokens ?? 0,
    outputTokens: payload.usage?.output_tokens ?? 0,
  };
}
