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

const EMAIL = /[A-Z0-9._%+'-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL = /https?:\/\/[^\s)]+/gi;
const PRIVATE_URL = /supabase|storage|token=|x-amz|signature=|screenshot|\/feedback\//i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Removes account identifiers and signed screenshot links from text that will be public. */
export function redactPublicFeedbackText(text: string, hidden: Array<string | null | undefined> = []): string {
  let out = text;
  const direct = [...new Set(hidden.map((value) => (value || "").trim()).filter((value) => value.length >= 8))];
  const encoded = direct
    .map((secret) => encodeURIComponent(secret))
    .filter((value) => value.length >= 8 && !direct.includes(value));
  const secrets = [...direct, ...encoded].sort((left, right) => right.length - left.length);
  for (const secret of secrets) out = out.replace(new RegExp(escapeRegExp(secret), "gi"), "[redacted]");
  out = out.replace(EMAIL, "[redacted]");
  out = out.replace(URL, (url) => (PRIVATE_URL.test(url) ? "[redacted]" : url));
  return out;
}

/**
 * Public GitHub issue text. The email, user id, browser details, error log, and
 * screenshot stay on the private feedback row. The issue only names that row.
 */
export function publicFeedbackIssueBody(
  report: FeedbackReport,
  options?: { summary?: string; agentFix?: boolean; redact?: string[] },
): string {
  const hidden = [report.userId, ...(options?.redact ?? [])];
  const summary = redactPublicFeedbackText(options?.summary || report.body, hidden).replace(/\s+/g, " ").trim();
  const note = redactPublicFeedbackText(report.body, hidden).trim();
  const publicId = hidden.some((value) => (value || "").trim() === report.id) ? "" : report.id;
  const bodyLines = [
    summary || "Feedback",
    "",
    note && note !== summary ? note : "",
    note && note !== summary ? "" : "",
    "The account, browser details, error log, and screenshot stay on the private feedback record.",
    "",
    "| | |",
    "| --- | --- |",
    `| Type | ${report.kind} |`,
    `| Route | \`${redactPublicFeedbackText(report.route, hidden)}\` |`,
    `| Version | ${redactPublicFeedbackText(report.versionLabel, hidden)} |`,
    `| Git | \`${redactPublicFeedbackText(report.gitSha, hidden)}\` |`,
    `| Env | ${redactPublicFeedbackText(report.env, hidden)} |`,
    publicId ? `| Feedback id | \`${publicId}\` |` : "",
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
  return bodyLines.filter((line, index, all) => line !== "" || all[index - 1] !== "").join("\n");
}

export async function openFeedbackIssue(
  report: FeedbackReport,
  options?: { summary?: string; agentFix?: boolean; redact?: string[]; labels?: string[] },
): Promise<string | null> {
  if (!process.env.GITHUB_FEEDBACK_TOKEN) return null;

  const kindLabel = report.kind === "bug" ? "type:bug" : "type:feature";
  await ensureLabel(kindLabel, report.kind === "bug" ? "8D3B32" : "1E4636", "Opened from Price Ranger feedback.");
  await ensureLabel("source:user-feedback", "C6A15B", "Sent from feedback mode.");
  if (options?.agentFix) {
    await ensureLabel(AGENT_FIX_LABEL, "1E4636", "A person must review. Never auto-deploy.");
  }

  const body = publicFeedbackIssueBody(report, options);
  const title = redactPublicFeedbackText(options?.summary || report.body, [report.userId, ...(options?.redact ?? [])])
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "Feedback";
  const extraLabels = (options?.labels ?? []).filter((label) => /^[a-z0-9:_-]{1,50}$/.test(label));
  for (const label of extraLabels) await ensureLabel(label, "C6A15B", "Feature request from Price Ranger.");
  const labels = [
    ...(options?.agentFix ? [kindLabel, "source:user-feedback", AGENT_FIX_LABEL] : [kindLabel, "source:user-feedback"]),
    ...extraLabels,
  ];
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

export async function commentOnFeedbackIssue(
  issueUrl: string,
  text: string,
  hidden: Array<string | null | undefined> = [],
): Promise<void> {
  if (!process.env.GITHUB_FEEDBACK_TOKEN) return;
  const match = issueUrl.match(/\/issues\/(\d+)/);
  if (!match) return;
  const response = await github(`/repos/${REPO}/issues/${match[1]}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: redactPublicFeedbackText(text, hidden).slice(0, 6000) }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub comment was not posted (${response.status}). ${detail.slice(0, 180)}`);
  }
}
