import { llmProvider, modelFor } from "../assistant/llm";

import type { Severity } from "./model";

export interface Brief {
  id: string;
  summary: string;
  body: string;
}

export interface Classification {
  kind: "bug" | "feature";
  summary: string;
  severity: Severity;
  duplicateOf: string | null;
  source: "model" | "rules";
}

const BUG = /\b(bugs?|broken|crashes?|crashed|errors?|can't|cannot|does not|doesn't|won't|fails?|failed|stuck|blank|wrong)\b/i;
const HIGH = /\b(crashes?|crashed|data loss|lost my|can't sign|cannot sign|charged|payment failed)\b/i;
const LOW = /\b(typo|spelling|wording|color|colour)\b/i;

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2),
  );
}

export function similarity(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / (a.size + b.size - shared);
}

export function findDuplicate(text: string, existing: Brief[]): string | null {
  let best: { id: string; score: number } | null = null;
  for (const row of existing) {
    const score = Math.max(similarity(text, row.summary), similarity(text, row.body), similarity(text, `${row.summary} ${row.body}`));
    if (!best || score > best.score) best = { id: row.id, score };
  }
  if (!best || best.score < 0.5) return null;
  return best.id;
}

export function classifyByRules(body: string, route: string, existing: Brief[]): Classification {
  const text = body.replace(/\s+/g, " ").trim();
  const screenshotOnly = text.length < 4;
  const kind: Classification["kind"] = screenshotOnly || BUG.test(text) ? "bug" : "feature";
  const severity: Severity = HIGH.test(text) ? "high" : LOW.test(text) ? "low" : "medium";
  const summary = screenshotOnly
    ? `Screenshot on ${route || "this screen"}`.slice(0, 120)
    : text.slice(0, 120);
  return {
    kind,
    summary,
    severity,
    duplicateOf: findDuplicate(`${summary} ${text}`, existing),
    source: "rules",
  };
}

function parseModel(text: string, fallback: Classification, existing: Brief[]): Classification {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return fallback;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as {
      kind?: string;
      summary?: string;
      severity?: string;
      duplicateOf?: string | null;
    };
    const kind = parsed.kind === "feature" ? "feature" : parsed.kind === "bug" ? "bug" : fallback.kind;
    const severity: Severity =
      parsed.severity === "low" || parsed.severity === "high" || parsed.severity === "medium"
        ? parsed.severity
        : fallback.severity;
    const summary = String(parsed.summary || fallback.summary).replace(/\s+/g, " ").trim().slice(0, 120) || fallback.summary;
    const duplicateOf =
      typeof parsed.duplicateOf === "string" && existing.some((row) => row.id === parsed.duplicateOf)
        ? parsed.duplicateOf
        : null;
    return { kind, summary, severity, duplicateOf, source: "model" };
  } catch {
    return fallback;
  }
}

async function askModel(body: string, route: string, existing: Brief[]): Promise<string> {
  const provider = llmProvider();
  if (!provider) throw new Error("No model.");
  const catalog = existing.slice(0, 40).map((row) => ({ id: row.id, summary: row.summary, body: row.body.slice(0, 180) }));
  const prompt = [
    "Classify this product note. Reply with JSON only:",
    '{"kind":"bug"|"feature","summary":"one sentence under 120 characters","severity":"low"|"medium"|"high","duplicateOf":null or an id from the list}',
    "duplicateOf is an existing id only when this is the same request. Otherwise null.",
    `Route: ${route}`,
    `Note: ${body.slice(0, 1500)}`,
    `Existing: ${JSON.stringify(catalog)}`,
  ].join("\n");
  if (provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelFor("openai", "ask"),
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`Classifier returned ${response.status}.`);
    const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    return payload.choices?.[0]?.message?.content || "";
  }
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelFor("anthropic", "ask"),
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`Classifier returned ${response.status}.`);
  const payload = (await response.json()) as { content?: { text?: string }[] };
  return payload.content?.[0]?.text || "";
}

export async function classifyTicket(body: string, route: string, existing: Brief[]): Promise<Classification> {
  const rules = classifyByRules(body, route, existing);
  if (!llmProvider()) return rules;
  try {
    const text = await askModel(body, route, existing);
    return parseModel(text, rules, existing);
  } catch {
    return rules;
  }
}

export function bugIsValid(input: { kind: "bug" | "feature"; duplicateOf: string | null; body: string; hasShot: boolean }): boolean {
  if (input.kind !== "bug" || input.duplicateOf) return false;
  return input.hasShot || input.body.trim().length >= 8;
}
