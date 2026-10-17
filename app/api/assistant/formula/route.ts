import { getSessionUser } from "@/lib/auth";
import { complete, llmProvider } from "@/lib/assistant/llm";
import { explainFormula, formulaRefs, parseFormula, suggestFormula, type FormulaColumnHint } from "@/lib/guide/formula";

const INSTRUCTIONS = `You write one formula for a column on a seller's price. Reply with JSON only: {"formula":"qty * rate","explanation":"one plain sentence"}.
Use only numbers, the column ids you are given, + - * / and parentheses. Do not call functions. Do not invent a price.`;

function isHint(value: unknown): value is FormulaColumnHint {
  if (!value || typeof value !== "object") return false;
  const row = value as { id?: unknown; label?: unknown; type?: unknown };
  return (
    typeof row.id === "string" &&
    typeof row.label === "string" &&
    (row.type === "text" || row.type === "number" || row.type === "money" || row.type === "formula")
  );
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in." }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const columns = Array.isArray(record.columns) ? record.columns.filter(isHint).slice(0, 12) : [];
  const targetId = typeof record.targetId === "string" ? record.targetId.slice(0, 32) : "amount";
  const current = typeof record.formula === "string" ? record.formula.slice(0, 180) : "";
  const mode = record.mode === "explain" ? "explain" : "suggest";
  const labels = Object.fromEntries(columns.map((column) => [column.id, column.label]));
  const local =
    mode === "explain" && parseFormula(current).ok
      ? { formula: current, explanation: explainFormula(current, labels) }
      : suggestFormula(columns, targetId);

  if (!llmProvider()) return Response.json({ ...local, source: "local" });

  try {
    const result = await complete({
      mode: "ask",
      instructions: INSTRUCTIONS,
      contextJson: JSON.stringify({ mode, targetId, current, columns }),
      turns: [
        {
          role: "user",
          content:
            mode === "explain"
              ? `Explain this formula and keep it unless it is invalid: ${current}`
              : `Suggest a formula for the ${targetId} column.`,
        },
      ],
    });
    const match = result.text.match(/\{[\s\S]*\}/);
    if (!match) return Response.json({ ...local, source: "local" });
    const parsed = JSON.parse(match[0]) as { formula?: unknown; explanation?: unknown };
    const formula = typeof parsed.formula === "string" ? parsed.formula.trim().slice(0, 180) : "";
    const check = parseFormula(formula);
    if (!check.ok) return Response.json({ ...local, source: "local" });
    const known = new Set(columns.map((column) => column.id));
    if (formulaRefs(formula).some((name) => !known.has(name) || name === targetId)) {
      return Response.json({ ...local, source: "local" });
    }
    const explanation =
      typeof parsed.explanation === "string" && parsed.explanation.trim()
        ? parsed.explanation.trim().slice(0, 400)
        : explainFormula(formula, labels);
    return Response.json({ formula, explanation, source: "model" });
  } catch {
    return Response.json({ ...local, source: "local" });
  }
}
