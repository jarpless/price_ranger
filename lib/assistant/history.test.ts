import assert from "node:assert/strict";
import test from "node:test";

import { assistantGreeting, chatTitle, stepLabel, upsertChat, type SavedChat } from "./history";

test("the greeting follows the time of day", () => {
  assert.equal(assistantGreeting(new Date("2026-10-15T08:00:00")), "Morning, what are you pricing?");
  assert.equal(assistantGreeting(new Date("2026-10-15T14:00:00")), "Afternoon, what are you pricing?");
  assert.equal(assistantGreeting(new Date("2026-10-15T20:00:00")), "Evening, what are you pricing?");
});

test("a chat title comes from the first question", () => {
  const title = chatTitle([
    { role: "assistant", text: "Hello" },
    { role: "user", text: "  What is this Nintendo Switch worth on a good day in October?  " },
  ]);
  assert.match(title, /^What is this Nintendo Switch/);
  assert.ok(title.endsWith("…"));
  assert.ok(title.length <= 49);
});

test("opening a page reads as a finished step", () => {
  assert.equal(stepLabel("Open plans. Nothing is charged until you check out."), "Opened plans");
});

test("a finished price change reads as a short step", () => {
  assert.equal(
    stepLabel("Change this quote to $160? Nothing in your price library changes until you confirm."),
    "Changed price to $160",
  );
});

test("opening a chat again moves it to the top", () => {
  const older: SavedChat = {
    id: "a",
    title: "Older",
    updatedAt: "2026-10-14T00:00:00.000Z",
    lines: [],
    turns: [],
    mode: "ask",
  };
  const newer: SavedChat = { ...older, id: "b", title: "Newer", updatedAt: "2026-10-15T00:00:00.000Z" };
  const again: SavedChat = { ...older, title: "Older again", updatedAt: "2026-10-16T00:00:00.000Z" };
  const next = upsertChat([newer, older], again);
  assert.deepEqual(next.map((chat) => chat.id), ["a", "b"]);
  assert.equal(next[0]?.title, "Older again");
});
