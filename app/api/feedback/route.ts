import { getSessionUser } from "@/lib/auth";
import { buildStamp } from "@/lib/build-info";
import { openFeedbackIssue } from "@/lib/github-feedback";
import { isOwnerEmail } from "@/lib/owner";
import {
  attachGithubIssue,
  createFeedback,
  feedbackScreenshotUrl,
  getPreferences,
  type FeedbackKind,
} from "@/lib/store/basecamp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !isOwnerEmail(user.email)) {
    return Response.json({ error: "Feedback is limited to the owner." }, { status: 403 });
  }
  const preferences = await getPreferences(user.id);
  if (!preferences.feedbackEnabled) {
    return Response.json({ error: "Turn on feedback in Settings first." }, { status: 403 });
  }

  const form = await request.formData();
  const kind: FeedbackKind = form.get("kind") === "feature" ? "feature" : "bug";
  const body = String(form.get("body") || "").replace(/\s+/g, " ").trim().slice(0, 2000);
  if (body.length < 4) return Response.json({ error: "Describe what is wrong or what you expected." }, { status: 400 });

  const file = form.get("screenshot");
  let png: Uint8Array | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > 4_000_000) return Response.json({ error: "That screenshot is too large." }, { status: 413 });
    png = new Uint8Array(await file.arrayBuffer());
  }

  let consoleErrors: string[] = [];
  try {
    const parsed = JSON.parse(String(form.get("consoleErrors") || "[]"));
    if (Array.isArray(parsed)) consoleErrors = parsed.map((line) => String(line).slice(0, 500)).slice(0, 20);
  } catch {
    consoleErrors = [];
  }

  const stamp = buildStamp();
  const report = await createFeedback({
    userId: user.id,
    kind,
    body,
    route: String(form.get("route") || "/").slice(0, 200),
    versionLabel: stamp.label,
    gitSha: stamp.sha,
    env: stamp.env,
    viewport: String(form.get("viewport") || "").slice(0, 40),
    userAgent: String(form.get("userAgent") || "").slice(0, 300),
    consoleErrors,
    png,
  });

  let githubIssueUrl: string | null = null;
  let githubError: string | null = null;
  if (process.env.GITHUB_FEEDBACK_TOKEN) {
    try {
      const shot = await feedbackScreenshotUrl(user.id, report.id);
      githubIssueUrl = await openFeedbackIssue(report, shot);
      if (githubIssueUrl) await attachGithubIssue(user.id, report.id, githubIssueUrl);
    } catch (error) {
      githubError = error instanceof Error ? error.message : "GitHub issue was not created.";
    }
  }

  return Response.json({ id: report.id, githubIssueUrl, githubError });
}
