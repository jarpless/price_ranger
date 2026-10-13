import { getSessionUser } from "@/lib/auth";
import { buildStamp } from "@/lib/build-info";
import { intakeFeedback } from "@/lib/feedback/intake";
import type { TicketSource } from "@/lib/feedback/desk";
import { listTicketMetas } from "@/lib/feedback/desk";
import { listFeedback } from "@/lib/store/basecamp";

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
  const body = String(form.get("body") || "").replace(/\s+/g, " ").trim().slice(0, 2000);
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
  });

  return Response.json({
    id: result.report.id,
    summary: result.summary,
    href: `/feedback/${result.report.id}`,
    githubIssueUrl: result.githubIssueUrl,
    githubError: result.githubError,
    email: result.email,
  });
}
