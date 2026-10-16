import assert from "node:assert/strict";
import test from "node:test";

import { appPath, confirmedAction, inferAssistantMode, quoteCommand } from "./intent";

test("explain questions are not account actions", () => {
  assert.equal(confirmedAction("Why should I upgrade?", "/guide/1"), null);
  assert.equal(confirmedAction("Explain this price", "/guide/1"), null);
  assert.equal(confirmedAction("How do I share this?", "/"), null);
  assert.equal(confirmedAction("What does Plus include?", "/settings"), null);
});

test("a direct upgrade request opens plans, not a missing settings path", () => {
  const step = confirmedAction("Upgrade me to Plus", "/");
  assert.equal(step?.href, "/upgrade");
  assert.equal(step?.needsConfirm, true);
  assert.equal(appPath("/settings/plans"), "/upgrade");
});

test("change price updates the open quote and waits for confirm", () => {
  const step = quoteCommand("change the price to 160", "/guide/abc");
  assert.equal(step?.type, "step");
  if (step?.type !== "step") return;
  assert.equal(step.step.name, "set_asking_price");
  assert.equal(step.step.args.quoteId, "abc");
  assert.equal(step.step.args.amount, "160");
  assert.equal(step.step.needsConfirm, true);
  assert.equal(step.step.href, "/guide/abc");
  assert.equal(quoteCommand("change price", "/guide/abc")?.type, "reply");
  assert.equal(quoteCommand("How do I change the price?", "/guide/abc"), null);
  assert.equal(confirmedAction("change the price to 160", "/guide/abc"), null);
});

test("mark sold does the action after confirm", () => {
  const step = quoteCommand("mark sold", "/guide/abc");
  assert.equal(step?.type, "step");
  if (step?.type !== "step") return;
  assert.equal(step.step.name, "mark_sold");
  assert.equal(step.step.needsConfirm, true);
  assert.notEqual(step.step.name, "navigate");
  const priced = quoteCommand("mark this sold for 150", "/guide/abc");
  assert.equal(priced?.type, "step");
  if (priced?.type === "step") assert.equal(priced.step.args.amount, "150");
});

test("a question is answered and a request to open something is an action", () => {
  assert.equal(inferAssistantMode("What plan am I on?"), "ask");
  assert.equal(inferAssistantMode("How do I share a price?"), "ask");
  assert.equal(inferAssistantMode("Open prices"), "agent");
  assert.equal(inferAssistantMode("Upgrade me to Plus"), "agent");
});
