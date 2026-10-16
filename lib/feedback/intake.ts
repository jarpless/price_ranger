import { dataBackend } from "../env";
import type { PlanId } from "../plans";
import { getData } from "../store";
import { getLocalUser } from "../store/local";
import {
  attachGithubIssue,
  createFeedback,
  feedbackScreenshotUrl,
  listAllFeedback,
  type FeedbackReport,
} from "../store/basecamp";
import { commentOnFeedbackIssue, openFeedbackIssue } from "../github-feedback";
import { listFunnelEvents } from "../guide/store";
import { createClient } from "../supabase/server";

import { bugIsValid, classifyTicket, type Brief } from "./classify";
import {
  addHistory,
  bumpDuplicate,
  listAppEvents,
  listOpenBriefs,
  listTicketMetas,
  saveExtraImage,
  saveTicketMeta,
  type TicketSource,
} from "./desk";
import { scoreTicket, type ScoreLine } from "./model";

const DAY = 24 * 60 * 60 * 1000;

export interface IntakeInput {
  userId: string;
  email: string;
  plan: PlanId;
  industry: string | null;
  body: string;
  route: string;
  versionLabel: string;
  gitSha: string;
  env: string;
  viewport: string;
  userAgent: string;
  consoleErrors: string[];
  png: Uint8Array | null;
  extras: Uint8Array[];
  deviceId: string;
  source: TicketSource;
  kind?: "bug" | "feature";
  title?: string;
}

async function paidCents(userId: string): Promise<number> {
  if (dataBackend() !== "supabase") {
    const user = await getLocalUser(userId);
    return Number((user as { paidCents?: number } | null)?.paidCents ?? 0);
  }
  const client = await createClient();
  const { data, error } = await client.from("profiles").select("paid_cents").eq("id", userId).maybeSingle();
  if (error || !data) return 0;
  return Number((data as { paid_cents?: number }).paid_cents ?? 0);
}

async function activity(userId: string): Promise<{ events30d: number; quotes30d: number }> {
  const since = Date.now() - 30 * DAY;
  let events30d = 0;
  try {
    const funnel = await listFunnelEvents();
    events30d += funnel.filter((event) => event.userId === userId && Date.parse(event.createdAt) >= since).length;
  } catch {
    events30d += 0;
  }
  try {
    const app = await listAppEvents(userId);
    events30d += app.filter((event) => Date.parse(event.createdAt) >= since).length;
  } catch {
    events30d += 0;
  }
  let quotes30d = 0;
  try {
    const quotes = await (await getData()).listQuotes(userId);
    quotes30d = quotes.filter((quote) => Date.parse(quote.updatedAt) >= since).length;
  } catch {
    quotes30d = 0;
  }
  return { events30d, quotes30d };
}

async function briefs(): Promise<Brief[]> {
  if (dataBackend() === "supabase") {
    const remote = await listOpenBriefs();
    if (remote.length > 0) {
      return remote.map((row) => ({ id: row.id, summary: row.summary || row.body, body: row.body }));
    }
  }
  const [reports, metas] = await Promise.all([listAllFeedback(), listTicketMetas()]);
  const metaById = new Map(metas.map((meta) => [meta.id, meta]));
  return reports
    .filter((report) => report.status !== "shipped" && !metaById.get(report.id)?.duplicateOf)
    .map((report) => ({
      id: report.id,
      summary: metaById.get(report.id)?.summary || report.body.slice(0, 120),
      body: report.body,
    }));
}

export async function intakeFeedback(input: IntakeInput): Promise<{
  report: FeedbackReport;
  summary: string;
  duplicateOf: string | null;
  score: number;
  lines: ScoreLine[];
  githubIssueUrl: string | null;
  githubError: string | null;
  email: "skipped";
}> {
  const existing = await briefs();
  const classified = await classifyTicket(input.body, input.route, existing);
  const { events30d, quotes30d } = await activity(input.userId);
  const paid = await paidCents(input.userId);
  const scored = scoreTicket({
    plan: input.plan,
    paidCents: paid,
    events30d,
    industry: input.industry,
    quotes30d,
    duplicateCount: 0,
    severity: classified.severity,
  });
  const note = input.body.trim() || classified.summary;
  const kind = input.kind === "feature" || input.kind === "bug" ? input.kind : classified.kind;
  const summary = input.title?.replace(/\s+/g, " ").trim().slice(0, 80) || classified.summary;
  const report = await createFeedback({
    userId: input.userId,
    email: input.email,
    kind,
    body: note.slice(0, 2000),
    route: input.route,
    versionLabel: input.versionLabel,
    gitSha: input.gitSha,
    env: input.env,
    viewport: input.viewport,
    userAgent: input.userAgent,
    consoleErrors: input.consoleErrors,
    png: input.png,
  });
  await saveTicketMeta({
    id: report.id,
    userId: input.userId,
    email: input.email,
    summary,
    severity: classified.severity,
    duplicateOf: classified.duplicateOf,
    duplicateCount: 0,
    score: scored.score,
    lines: scored.lines,
    deviceId: input.deviceId,
    source: input.source,
  });
  await addHistory({
    feedbackId: report.id,
    actorId: input.userId,
    fromStatus: null,
    toStatus: report.status,
    note: kind === "bug" ? "We saved this as a bug." : "We saved this as an idea.",
  });
  for (const extra of input.extras.slice(0, 4)) {
    await saveExtraImage({ feedbackId: report.id, userId: input.userId, png: extra });
  }
  if (classified.duplicateOf) {
    try {
      await bumpDuplicate(classified.duplicateOf);
    } catch {
      // The ticket is saved either way. The canonical count updates when the migration is applied.
    }
  }

  let githubIssueUrl: string | null = null;
  let githubError: string | null = null;
  const agentFix = bugIsValid({
    kind,
    duplicateOf: classified.duplicateOf,
    body: note,
    hasShot: Boolean(input.png),
  });
  if (!process.env.GITHUB_FEEDBACK_TOKEN) {
    githubError = "Saved your note, but GitHub feedback is not configured on this server.";
  } else {
    try {
      if (classified.duplicateOf) {
        const canonical = (await listAllFeedback()).find((item) => item.id === classified.duplicateOf);
        if (canonical?.githubIssueUrl) {
          await commentOnFeedbackIssue(
            canonical.githubIssueUrl,
            `Another person reported the same thing.\n\n${classified.summary}\n\nFeedback id \`${report.id}\`.`,
          );
          githubIssueUrl = canonical.githubIssueUrl;
          await attachGithubIssue(input.userId, report.id, githubIssueUrl);
        }
      }
      if (!githubIssueUrl) {
        const shot = await feedbackScreenshotUrl(input.userId, report.id);
        githubIssueUrl = await openFeedbackIssue({ ...report, kind, body: note }, shot, {
          summary,
          agentFix,
          email: input.email,
        });
        if (githubIssueUrl) await attachGithubIssue(input.userId, report.id, githubIssueUrl);
      }
    } catch (error) {
      githubError = error instanceof Error ? error.message : "GitHub issue was not created.";
    }
    if (!githubIssueUrl && !githubError) {
      githubError = "Saved your note, but no GitHub issue was created.";
    }
  }

  return {
    report,
    summary,
    duplicateOf: classified.duplicateOf,
    score: scored.score,
    lines: scored.lines,
    githubIssueUrl,
    githubError,
    email: "skipped",
  };
}
