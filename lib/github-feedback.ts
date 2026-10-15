import type { FeedbackReport } from "./store/basecamp";

const REPO = "jarpless/price_ranger";

async function github(path: string, init: RequestInit): Promise<Response> {
  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  if (!token) throw new Error("GITHUB_FEEDBACK_TOKEN is not set.");
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function ensureLabel(name: string, color: string, description = "Opened from Price Ranger feedback."): Promise<void> {
  const existing = await github(`/repos/${REPO}/labels/${encodeURIComponent(name)}`, { method: "GET" });
  if (existing.ok) return;
  await github(`/repos/${REPO}/labels`, {
    method: "POST",
    body: JSON.stringify({ name, color, description }),
  });
}

export const AGENT_FIX_LABEL = "agent-fix";

export async function openFeedbackIssue(
  report: FeedbackReport,
  screenshotUrl: string | null,
  options?: { summary?: string; agentFix?: boolean; email?: string },
): Promise<string | null> {
  if (!process.env.GITHUB_FEEDBACK_TOKEN) return null;

  const kindLabel = report.kind === "bug" ? "type:bug" : "type:feature";
  await ensureLabel(kindLabel, report.kind === "bug" ? "8D3B32" : "1E4636", "Opened from Price Ranger feedback.");
  await ensureLabel("source:user-feedback", "C6A15B", "Sent from feedback mode.");
  if (options?.agentFix) {
    await ensureLabel(AGENT_FIX_LABEL, "1E4636", "A person must review. Never auto-deploy.");
  }

  const consoleBlock = report.consoleErrors.length
    ? report.consoleErrors.map((line) => `- ${line}`).join("\n")
    : "None captured.";
  const shot = screenshotUrl
    ? `![Annotated screenshot](${screenshotUrl})`
    : "The annotated screenshot is stored with this feedback record in the admin inbox.";

  const summary = options?.summary?.replace(/\s+/g, " ").trim() || report.body.replace(/\s+/g, " ").trim();
  const bodyLines = [
    summary,
    "",
    report.body,
    "",
    shot,
    "",
    "| | |",
    "| --- | --- |",
    `| Type | ${report.kind} |`,
    `| Route | \`${report.route}\` |`,
    `| Version | ${report.versionLabel} |`,
    `| Git | \`${report.gitSha}\` |`,
    `| Env | ${report.env} |`,
    `| Viewport | ${report.viewport} |`,
    `| User agent | ${report.userAgent} |`,
    `| User id | \`${report.userId}\` |`,
    `| Email | ${options?.email || "none"} |`,
    `| Feedback id | \`${report.id}\` |`,
    "",
    "### Recent console errors",
    consoleBlock,
    "",
    "Status in the app starts at `triage`. Follow-up mail is not sent from the app.",
  ];
  if (options?.agentFix) {
    bodyLines.push(
      "",
      "### Agent",
      "This issue is labeled `agent-fix` so an agent can pick it up.",
      "Do not deploy. A person reviews the change and ships it.",
    );
  }
  const body = bodyLines.join("\n");
  const title = summary.slice(0, 80);
  const labels = options?.agentFix ? [kindLabel, "source:user-feedback", AGENT_FIX_LABEL] : [kindLabel, "source:user-feedback"];
  let response = await github(`/repos/${REPO}/issues`, {
    method: "POST",
    body: JSON.stringify({ title, body, labels }),
  });
  if (response.status === 422) {
    response = await github(`/repos/${REPO}/issues`, {
      method: "POST",
      body: JSON.stringify({ title, body }),
    });
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub issue was not created (${response.status}). ${detail.slice(0, 180)}`);
  }
  const payload = (await response.json()) as { html_url?: string };
  return payload.html_url ?? null;
}

export async function commentOnFeedbackIssue(issueUrl: string, text: string): Promise<void> {
  if (!process.env.GITHUB_FEEDBACK_TOKEN) return;
  const match = issueUrl.match(/\/issues\/(\d+)/);
  if (!match) return;
  const response = await github(`/repos/${REPO}/issues/${match[1]}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: text.slice(0, 6000) }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub comment was not posted (${response.status}). ${detail.slice(0, 180)}`);
  }
}
