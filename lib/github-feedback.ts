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
  options?: { summary?: string; agentFix?: boolean },
): Promise<string | null> {
  if (!process.env.GITHUB_FEEDBACK_TOKEN) return null;

  const kindLabel = report.kind === "bug" ? "bug" : "feature";
  await ensureLabel("feedback", "C6A15B");
  await ensureLabel(kindLabel, report.kind === "bug" ? "8D3B32" : "1E4636");
  if (options?.agentFix) {
    await ensureLabel(AGENT_FIX_LABEL, "1E4636", "A person must review. Never auto-deploy.");
  }

  const consoleBlock = report.consoleErrors.length
    ? report.consoleErrors.map((line) => `- ${line}`).join("\n")
    : "None captured.";
  const shot = screenshotUrl
    ? `![Region screenshot](${screenshotUrl})`
    : "The screenshot is stored with this feedback record in the app inbox.";

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
    `| Route | \`${report.route}\` |`,
    `| Version | ${report.versionLabel} |`,
    `| Git | \`${report.gitSha}\` |`,
    `| Env | ${report.env} |`,
    `| Viewport | ${report.viewport} |`,
    `| User agent | ${report.userAgent} |`,
    `| Feedback id | \`${report.id}\` |`,
    "",
    "### Recent console errors",
    consoleBlock,
    "",
    "Status in the app starts at `new`. Move it to `planned`, `in_progress`, or `shipped` from the admin backlog.",
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
  const title = `${report.kind === "bug" ? "Bug" : "Feature"}: ${summary.slice(0, 80)}`;
  const labels = options?.agentFix ? ["feedback", kindLabel, AGENT_FIX_LABEL] : ["feedback", kindLabel];
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
