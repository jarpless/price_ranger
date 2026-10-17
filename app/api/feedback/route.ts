import { getSessionUser } from "@/lib/auth";
import { track } from "@/lib/analytics/track";
import { featureRequestBody, featureRequestTitle, isTradeId, needIsValid, tradeLabelName } from "@/lib/beta";
import { buildStamp } from "@/lib/build-info";
import { intakeFeedback } from "@/lib/feedback/intake";
import { composeFeedbackBody, type FeedbackKind } from "@/lib/feedback/note";
import type { TicketSource } from "@/lib/feedback/desk";
import { listTicketMetas } from "@/lib/feedback/desk";
import { listFeedback } from "@/lib/store/basecamp";
import type { SessionUser } from "@/lib/types";

export const dynamic = "force-dynamic";

function sourceOf(value: string): TicketSource {
  if (value === "mobile" || value === "shake") return value;
  return "desktop";
}

async function readPng(entry: FormDataEntryValue | null): Promise<Uint8Array | null> {
  if (!(entry instanceof File) || entry.size === 0) return null;
  if (entry.size > 4_000_000) throw new Error("That image is too large.");
  return new Uint8Array(await entry.arrayBuffer());
}

function withContext(body: string, context: string, plan: string): string {
  if (context !== "beta") return body.slice(0, 2000);
  const line = `Context: from the early-beta note. Plan: ${plan}. Beta: yes.`;
  return (body ? `${body}\n\n${line}` : line).slice(0, 2000);
}

async function featureRequest(form: FormData, user: SessionUser): Promise<Response> {
  const trade = String(form.get("trade") || "");
  if (!isTradeId(trade)) return Response.json({ error: "Pick the trade this is for." }, { status: 400 });
  const need = String(form.get("need") || "").trim().slice(0, 1500);
  if (!needIsValid(need)) return Response.json({ error: "Tell us what you need." }, { status: 400 });
  const route = String(form.get("route") || "/").slice(0, 200);
  const body = featureRequestBody({ trade, need, followUp: form.get("followUp") === "1", route });
  const stamp = buildStamp();
  const result = await intakeFeedback({
    userId: user.id,
    email: user.email,
    plan: user.plan,
    industry: user.industry,
    body,
    route,
    versionLabel: stamp.label,
    gitSha: stamp.sha,
    env: stamp.env,
    viewport: String(form.get("viewport") || "").slice(0, 40),
    userAgent: String(form.get("userAgent") || "").slice(0, 300),
    consoleErrors: [],
    png: null,
    extras: [],
    deviceId: String(form.get("deviceId") || "").slice(0, 80),
    source: sourceOf(String(form.get("source") || "")),
    kind: "feature",
    title: featureRequestTitle(trade, need),
    classifyText: need,
    labels: ["type:feature-request", tradeLabelName(trade)],
  });
  return Response.json({
    id: result.report.id,
    trade,
    summary: result.summary,
    href: `/feedback/${result.report.id}`,
    githubIssueUrl: result.githubIssueUrl,
    githubError: result.githubError,
  });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  const [reports, metas] = await Promise.all([listFeedback(user.id), listTicketMetas()]);
  const metaById = new Map(metas.map((meta) => [meta.id, meta]));
  const tickets = reports.map((report) => {
    const meta = metaById.get(report.id);
    return {
      id: report.id,
      summary: meta?.summary || report.body.slice(0, 120),
      kind: report.kind,
      status: report.status,
      createdAt: report.createdAt,
      href: `/feedback/${report.id}`,
    };
  });
  return Response.json({ tickets });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });

  const form = await request.formData();
  if (String(form.get("requestType") || "") === "feature_request") return featureRequest(form, user);
  const kindRaw = String(form.get("kind") || "");
  const kind: FeedbackKind | undefined = kindRaw === "bug" || kindRaw === "feature" ? kindRaw : undefined;
  const title = String(form.get("title") || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const answerA = String(form.get("answerA") || "").trim().slice(0, 2000);
  const answerB = String(form.get("answerB") || "").trim().slice(0, 2000);
  const selectionRaw = String(form.get("selection") || "");
  const selectionParts = selectionRaw.split(",").map((part) => Number(part));
  const selection =
    selectionParts.length === 4 && selectionParts.every((part) => Number.isFinite(part))
      ? { x: selectionParts[0], y: selectionParts[1], w: selectionParts[2], h: selectionParts[3] }
      : null;
  const url = String(form.get("url") || "").slice(0, 500);
  const body = kind
    ? composeFeedbackBody({
        title,
        kind,
        answerA,
        answerB,
        selection,
        url,
        viewport: String(form.get("viewport") || "").slice(0, 40),
      })
    : withContext(String(form.get("body") || "").trim(), String(form.get("context") || ""), user.plan);
  let png: Uint8Array | null = null;
  const extras: Uint8Array[] = [];
  try {
    png = await readPng(form.get("screenshot"));
    for (const entry of form.getAll("images")) {
      const extra = await readPng(entry);
      if (extra) extras.push(extra);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "That image is too large.";
    return Response.json({ error: message }, { status: 413 });
  }
  if (kind && answerA.length < 2 && answerB.length < 2) {
    return Response.json({ error: "Add a note before sending." }, { status: 400 });
  }
  if (body.length < 4 && !png) {
    return Response.json({ error: "Add a note or a screenshot." }, { status: 400 });
  }

  let consoleErrors: string[] = [];
  try {
    const parsed = JSON.parse(String(form.get("consoleErrors") || "[]"));
    if (Array.isArray(parsed)) consoleErrors = parsed.map((line) => String(line).slice(0, 500)).slice(0, 20);
  } catch {
    consoleErrors = [];
  }

  const stamp = buildStamp();
  const result = await intakeFeedback({
    userId: user.id,
    email: user.email,
    plan: user.plan,
    industry: user.industry,
    body,
    route: String(form.get("route") || "/").slice(0, 200),
    versionLabel: stamp.label,
    gitSha: stamp.sha,
    env: stamp.env,
    viewport: String(form.get("viewport") || "").slice(0, 40),
    userAgent: String(form.get("userAgent") || "").slice(0, 300),
    consoleErrors,
    png,
    extras,
    deviceId: String(form.get("deviceId") || "").slice(0, 80),
    source: sourceOf(String(form.get("source") || "")),
    kind,
    title,
  });

  await track("feedback_submitted", { type: kind ?? "note", source: sourceOf(String(form.get("source") || "")) }, { user });
  return Response.json({
    id: result.report.id,
    summary: result.summary,
    href: `/feedback/${result.report.id}`,
    githubIssueUrl: result.githubIssueUrl,
    githubError: result.githubError,
  });
}
