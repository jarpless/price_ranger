import assert from "node:assert/strict";
import test from "node:test";

import { bugIsValid, classifyByRules, findDuplicate } from "./classify";
import { receiptEmail, sendSupportEmail } from "./mail";
import { replaceDuplicateLine, scoreTicket } from "./model";

test("a pro trades account with a severe duplicated bug outranks a quiet free note", () => {
  const quiet = scoreTicket({
    plan: "free",
    paidCents: 0,
    events30d: 0,
    industry: null,
    quotes30d: 0,
    duplicateCount: 0,
    severity: "low",
  });
  const urgent = scoreTicket({
    plan: "pro",
    paidCents: 4800,
    events30d: 20,
    industry: "trades",
    quotes30d: 6,
    duplicateCount: 3,
    severity: "high",
  });
  assert.equal(quiet.score, 5);
  assert.ok(urgent.score > quiet.score);
  assert.equal(
    urgent.score,
    urgent.lines.reduce((sum, line) => sum + line.points, 0),
  );
  assert.equal(urgent.lines.find((line) => line.factor === "Plan")?.points, 30);
  assert.equal(urgent.lines.find((line) => line.factor === "Revenue paid")?.points, 25);
  assert.equal(urgent.lines.find((line) => line.factor === "Opportunity")?.points, 20);
  assert.equal(urgent.lines.find((line) => line.factor === "Duplicates")?.points, 12);
  assert.equal(urgent.lines.find((line) => line.factor === "Severity")?.points, 25);
});

test("duplicate requests raise only the duplicate line", () => {
  const first = scoreTicket({
    plan: "plus",
    paidCents: 499,
    events30d: 4,
    industry: "trades",
    quotes30d: 1,
    duplicateCount: 0,
    severity: "medium",
  });
  const next = replaceDuplicateLine(first, 2);
  assert.equal(next.lines.find((line) => line.factor === "Duplicates")?.points, 8);
  assert.equal(next.score, first.score + 8);
});

test("rules call a crash a bug and match an existing note", () => {
  const existing = [{ id: "ticket-1", summary: "The price button crashes on send", body: "Send crashes the price screen" }];
  const classified = classifyByRules("The price button crashes when I tap send", "/guide/1", existing);
  assert.equal(classified.kind, "bug");
  assert.equal(classified.severity, "high");
  assert.equal(classified.duplicateOf, "ticket-1");
  assert.equal(findDuplicate("Add a dark mode for night quotes", existing), null);
  const feature = classifyByRules("Add a dark mode for night quotes", "/menu", existing);
  assert.equal(feature.kind, "feature");
  assert.equal(feature.duplicateOf, null);
});

test("a valid bug needs a real note or a screenshot and is not a duplicate", () => {
  assert.equal(bugIsValid({ kind: "bug", duplicateOf: null, body: "Send crashes", hasShot: false }), true);
  assert.equal(bugIsValid({ kind: "bug", duplicateOf: "other", body: "Send crashes", hasShot: true }), false);
  assert.equal(bugIsValid({ kind: "feature", duplicateOf: null, body: "Add dark mode please", hasShot: true }), false);
  assert.equal(bugIsValid({ kind: "bug", duplicateOf: null, body: "no", hasShot: false }), false);
});

test("email is a no-op when the provider is unset", async () => {
  const previous = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  const result = await sendSupportEmail({ to: "ada@example.com", subject: "We got your note", text: receiptEmail({ summary: "Send crashes", kind: "bug", duplicate: false }) });
  assert.equal(result.sent, false);
  assert.equal(result.reason, "unset");
  const empty = await sendSupportEmail({ to: "", subject: "Hi", text: "Hi" });
  assert.equal(empty.reason, "no-address");
  if (previous) process.env.RESEND_API_KEY = previous;
});
