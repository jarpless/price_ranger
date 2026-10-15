export type FeedbackKind = "bug" | "feature";

export interface FeedbackSelection {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function promptLabels(kind: FeedbackKind): [string, string] {
  if (kind === "feature") return ["What do you want?", "Why?"];
  return ["What happened?", "What did you expect to happen?"];
}

/** A short title from the first answer, or from the page when that answer is still empty. */
export function suggestFeedbackTitle(kind: FeedbackKind, answer: string, route: string): string {
  const typed = answer.replace(/\s+/g, " ").trim();
  if (typed) return typed.slice(0, 80);
  const page = route && route !== "/" ? route : "this page";
  return kind === "feature" ? `Idea for ${page}` : `Bug on ${page}`;
}

export function composeFeedbackBody(input: {
  title: string;
  kind: FeedbackKind;
  answerA: string;
  answerB: string;
  selection: FeedbackSelection | null;
  url: string;
  viewport: string;
}): string {
  const [labelA, labelB] = promptLabels(input.kind);
  const lines = [input.title.trim(), "", labelA, input.answerA.trim(), "", labelB, input.answerB.trim()];
  if (input.selection) {
    const box = input.selection;
    lines.push("", `Selection: ${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.w)}x${Math.round(box.h)}`);
  }
  if (input.url) lines.push(`URL: ${input.url}`);
  if (input.viewport) lines.push(`Viewport: ${input.viewport}`);
  return lines.join("\n").slice(0, 4000);
}

function trimMeta(value: string): string {
  return value.split("\nSelection:")[0]?.split("\nURL:")[0]?.split("\nViewport:")[0]?.trim() ?? "";
}

export function readFeedbackAnswers(body: string): { answerA: string; answerB: string; selection: string } {
  const selection = body.match(/^Selection: (.+)$/m)?.[1]?.trim() ?? "";
  const pairs: [string, string][] = [
    ["What happened?", "What did you expect to happen?"],
    ["What do you want?", "Why?"],
  ];
  for (const [labelA, labelB] of pairs) {
    const start = body.indexOf(`\n${labelA}\n`);
    if (start < 0) continue;
    const from = start + labelA.length + 2;
    const next = body.indexOf(`\n${labelB}\n`, from);
    const answerA = trimMeta(next < 0 ? body.slice(from) : body.slice(from, next));
    const answerB = next < 0 ? "" : trimMeta(body.slice(next + labelB.length + 2));
    return { answerA, answerB, selection };
  }
  return { answerA: body.trim(), answerB: "", selection };
}
