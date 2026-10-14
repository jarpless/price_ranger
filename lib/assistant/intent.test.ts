import assert from "node:assert/strict";
import test from "node:test";

import { appPath, confirmedAction, inferAssistantMode } from "./intent";

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

test("a question is answered and a request to open something is an action", () => {
  assert.equal(inferAssistantMode("What plan am I on?"), "ask");
  assert.equal(inferAssistantMode("How do I share a price?"), "ask");
  assert.equal(inferAssistantMode("Open prices"), "agent");
  assert.equal(inferAssistantMode("Upgrade me to Plus"), "agent");
});
