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

async function ensureLabel(name: string, color: string): Promise<void> {
  const existing = await github(`/repos/${REPO}/labels/${encodeURIComponent(name)}`, { method: "GET" });
  if (existing.ok) return;
  await github(`/repos/${REPO}/labels`, {
    method: "POST",
    body: JSON.stringify({ name, color, description: "Opened from Price Ranger feedback mode." }),
  });
}

export async function openFeedbackIssue(
  report: FeedbackReport,
  screenshotUrl: string | null,
): Promise<string | null> {
  if (!process.env.GITHUB_FEEDBACK_TOKEN) return null;

  const kindLabel = report.kind === "bug" ? "bug" : "feature";
  await ensureLabel("feedback", "C6A15B");
  await ensureLabel(kindLabel, report.kind === "bug" ? "8D3B32" : "1E4636");

  const consoleBlock = report.consoleErrors.length
    ? report.consoleErrors.map((line) => `- ${line}`).join("\n")
    : "None captured.";
  const shot = screenshotUrl
    ? `![Region screenshot](${screenshotUrl})`
    : "The screenshot is stored with this feedback record in the app inbox.";

  const body = [
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
    "Status in the app inbox starts at `new`. An agent should move it to `planned`, `in_progress`, or `shipped`, and set the shipped-in version when it ships.",
  ].join("\n");

  const title = `${report.kind === "bug" ? "Bug" : "Feature"}: ${report.body.replace(/\s+/g, " ").slice(0, 80)}`;
  let response = await github(`/repos/${REPO}/issues`, {
    method: "POST",
    body: JSON.stringify({ title, body, labels: ["feedback", kindLabel] }),
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
