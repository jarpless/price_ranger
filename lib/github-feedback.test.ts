import assert from "node:assert/strict";
import test from "node:test";

import type { FeedbackReport } from "./store/basecamp";
import { publicFeedbackIssueBody, redactPublicFeedbackText } from "./github-feedback";

const email = "ada@example.com";
const userId = "11111111-2222-4333-8444-555555555555";
const feedbackId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const shot =
  "https://abc.supabase.co/storage/v1/object/sign/feedback/11111111-2222-4333-8444-555555555555/shot.png?token=secret";

function report(): FeedbackReport {
  return {
    id: feedbackId,
    userId,
    kind: "bug",
    body: `The total is wrong for ${email}. Signed in as ${userId}. Shot: ${shot}`,
    route: "/quotes",
    versionLabel: "v2.3.0",
    gitSha: "abc1234",
    env: "local",
    viewport: "390x844",
    userAgent: "Mozilla/5.0 (iPhone)",
    consoleErrors: [`TypeError: failed for ${email} at user ${userId}`],
    screenshotPath: `${userId}/${feedbackId}.png`,
    status: "triage",
    shippedIn: null,
    githubIssueUrl: null,
    createdAt: "2026-10-17T00:00:00.000Z",
    updatedAt: "2026-10-17T00:00:00.000Z",
  };
}

test("public GitHub issue body has no email, user id, or screenshot link", () => {
  const body = publicFeedbackIssueBody(report(), {
    summary: `Broken for ${email.toUpperCase()} user ${userId.toUpperCase()}`,
    redact: [email, userId],
  });

  assert.equal(body.toLowerCase().includes(email), false);
  assert.equal(body.toLowerCase().includes(userId), false);
  assert.equal(body.includes("token=secret"), false);
  assert.equal(body.includes("supabase.co"), false);
  assert.equal(body.includes("TypeError"), false);
  assert.equal(body.includes("Mozilla"), false);
  assert.equal(body.includes("390x844"), false);
  assert.equal(body.includes(`${userId}/${feedbackId}.png`), false);
  assert.match(body, new RegExp(feedbackId));
  assert.match(body, /private feedback record/);
});

test("public comments drop the same account data", () => {
  const text = redactPublicFeedbackText(
    `Reply from ${email} (${userId}). ${shot}`,
    [email, userId],
  );
  assert.equal(text.toLowerCase().includes(email), false);
  assert.equal(text.toLowerCase().includes(userId), false);
  assert.equal(text.includes("token=secret"), false);
});
