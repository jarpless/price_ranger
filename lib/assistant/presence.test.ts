import assert from "node:assert/strict";
import test from "node:test";

import { clampDockWidth, emptySnapshot, pickSnapshot, writeSnapshot } from "./presence";

test("a newer snapshot replaces the local one", () => {
  const local = { ...emptySnapshot(), rev: 2, mode: "ask" as const, lines: [{ role: "user" as const, text: "old" }] };
  const incoming = { ...emptySnapshot(), rev: 3, mode: "agent" as const, lines: [{ role: "user" as const, text: "new" }] };
  const picked = pickSnapshot(local, incoming);
  assert.equal(picked.rev, 3);
  assert.equal(picked.mode, "agent");
  assert.equal(picked.lines[0]?.text, "new");
});

test("an older snapshot does not rewind the conversation", () => {
  const local = { ...emptySnapshot(), rev: 5, lines: [{ role: "assistant" as const, text: "kept" }] };
  const incoming = { ...emptySnapshot(), rev: 4, lines: [{ role: "assistant" as const, text: "stale" }] };
  assert.equal(pickSnapshot(local, incoming).lines[0]?.text, "kept");
});

test("dock width stays inside the resize range", () => {
  assert.equal(clampDockWidth(100), 320);
  assert.equal(clampDockWidth(900), 560);
  assert.equal(clampDockWidth(400), 400);
});

test("writing a snapshot bumps the revision", () => {
  const next = writeSnapshot(emptySnapshot(), { mode: "agent", chrome: "docked" });
  assert.equal(next.rev, 1);
  assert.equal(next.mode, "agent");
  assert.equal(next.chrome, "docked");
});
